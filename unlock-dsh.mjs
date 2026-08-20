#!/usr/bin/env node
/**
 * DSH Core Components Patching Script
 * ----------------------------------------------------
 * 自动检测并对 DeepSeek Harness 核心组件应用补丁：
 * 1. dsh-client-connection:
 *    - 解除 isLoopbackHostname 限制（允许远程/隧道访问）
 *    - 修复 isTrustedApiRequest 的 trustedHosts 转发
 * 2. dsh-client-ui-settings:
 *    - 解除 SettingsScopeController 对远程客户端的设置锁定
 * 3. dsh-client-ui-settings-models:
 *    - 增加对 antigravity provider 和 llm-antigravity namespace 的配置支持
 * 4. dsh-client-ui-settings-plugins:
 *    - 增加 web-search-selector 的 antigravity 选项支持
 */

import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

function findNodeModulesDirs() {
  const dirs = [];
  const home = process.env.DSH_HOME || path.join(homedir(), '.dsh');

  // 1. ~/.dsh/profiles/web/node_modules
  dirs.push(path.join(home, 'profiles', 'web', 'node_modules'));

  // 2. Windows npx cache
  if (process.env.LOCALAPPDATA) {
    const npxCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
    if (fs.existsSync(npxCache)) {
      for (const entry of fs.readdirSync(npxCache, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          dirs.push(path.join(npxCache, entry.name, 'node_modules'));
        }
      }
    }
  }

  // 3. Global npm node_modules
  if (process.platform === 'win32') {
    if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm', 'node_modules'));
    dirs.push('C:\\Program Files\\nodejs\\node_modules');
  } else {
    dirs.push('/usr/local/lib/node_modules');
    dirs.push('/usr/lib/node_modules');
    dirs.push(path.join(homedir(), '.npm-global', 'lib', 'node_modules'));
  }

  // 4. Current & parent working directories
  dirs.push(path.resolve(process.cwd(), 'node_modules'));
  dirs.push(path.resolve(process.cwd(), '..', 'node_modules'));

  return dirs.filter((d) => fs.existsSync(d));
}

function patchFile(filePath, transforms) {
  if (!fs.existsSync(filePath)) return false;
  let code = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const { name, search, replace } of transforms) {
    if (typeof search === 'string') {
      if (code.includes(search) && !code.includes(replace)) {
        code = code.replace(search, replace);
        changed = true;
        console.log(`  [+] Applied patch [${name}] to: ${filePath}`);
      }
    } else if (search instanceof RegExp) {
      if (search.test(code)) {
        code = code.replace(search, replace);
        changed = true;
        console.log(`  [+] Applied regex patch [${name}] to: ${filePath}`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, code, 'utf8');
    return true;
  }
  return false;
}

function walkAndPatch(rootDir) {
  if (!fs.existsSync(rootDir)) return;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        // Patch dsh-client-connection
        if (fullPath.includes('dsh-client-connection')) {
          patchFile(fullPath, [
            {
              name: 'trustedHosts in PRIVILEGED_METHODS',
              search: 'if (method !== void 0 && PRIVILEGED_METHODS.has(method) && !isTrustedApiRequest(request, [])) return new Response("forbidden", { status: 403 });',
              replace: 'if (method !== void 0 && PRIVILEGED_METHODS.has(method) && !isTrustedApiRequest(request, trustedHosts)) return new Response("forbidden", { status: 403 });',
            },
            {
              name: 'trustedHosts in loopback authority',
              search: 'if (interceptor.options.authority === "loopback" && !isTrustedApiRequest(request, [])) return Promise.resolve(new Response("forbidden", { status: 403 }));',
              replace: 'if (interceptor.options.authority === "loopback" && !isTrustedApiRequest(request, this.trustedHosts)) return Promise.resolve(new Response("forbidden", { status: 403 }));',
            },
            {
              name: 'unlock isLoopbackHostname',
              search: 'function isLoopbackHostname(hostname) {',
              replace: 'function isLoopbackHostname(hostname) { return true; /* UNLOCKED */',
            },
          ]);
        }

        // Patch dsh-client-ui-settings
        if (fullPath.includes('dsh-client-ui-settings') && !fullPath.includes('dsh-client-ui-settings-')) {
          patchFile(fullPath, [
            {
              name: 'unlock SettingsScopeController host',
              search: 'new SettingsScopeController(connection.api, spec, connection.isLoopback ? "host" : "remote")',
              replace: 'new SettingsScopeController(connection.api, spec, "host" /* UNLOCKED */)',
            },
          ]);
        }

        // Patch dsh-client-ui-settings-models
        if (fullPath.includes('dsh-client-ui-settings-models')) {
          patchFile(fullPath, [
            {
              name: 'layoutOf llm-antigravity',
              search: 'if (ns === "llm-deepseek") return "deepseek";',
              replace: 'if (ns === "llm-deepseek" || ns === "llm-antigravity") return "deepseek";',
            },
            {
              name: 'antigravity provider refreshTokenEnv',
              search: 'if (provider === "deepseek") return "DEEPSEEK_API_KEY";',
              replace: 'if (provider === "deepseek") return "DEEPSEEK_API_KEY";\n\t\t\t\tif (provider === "antigravity") return "ANTIGRAVITY_REFRESH_TOKEN";',
            },
            {
              name: 'curatedFields isAntigravity',
              search: 'const curatedFields = (family) => {',
              replace: 'const curatedFields = (family) => {\n\t\t\t\tconst isAntigravity = namespace?.ns === "llm-antigravity" || props.provider === "antigravity";',
            },
            {
              name: 'keyLabel Refresh Token',
              search: 'const keyLabel = t("keyInput");',
              replace: 'const keyLabel = isAntigravity ? "Refresh Token" : t("keyInput");',
            },
            {
              name: 'keyPlaceholder Refresh Token',
              search: 'const keyPlaceholder = keyLocked ? t("keyEnvLocked") : keyState?.configured === true && props.credentialRequired !== true ? t("keyStored") : (family === "pi-ai" ? t("keyPlaceholderNative") : t("keyPlaceholder"));',
              replace: 'const keyPlaceholder = keyLocked ? t("keyEnvLocked") : keyState?.configured === true && props.credentialRequired !== true ? (isAntigravity ? "Refresh Token 已配置 (留空保持不变)" : t("keyStored")) : (isAntigravity ? "OAuth 2.0 Refresh Token" : (family === "pi-ai" ? t("keyPlaceholderNative") : t("keyPlaceholder")));',
            },
            {
              name: 'welcomeController host',
              search: 'new WelcomeNoticeStore(connection.api, connection.isLoopback ? "host" : "remote")',
              replace: 'new WelcomeNoticeStore(connection.api, "host" /* UNLOCKED */)',
            }
          ]);
        }

        // Patch dsh-client-ui-settings-plugins
        if (fullPath.includes('dsh-client-ui-settings-plugins')) {
          patchFile(fullPath, [
            {
              name: 'unlock PluginCard available',
              search: 'if (!state.available) return null;',
              replace: '/* if (!state.available) return null; UNLOCKED */',
            },
            {
              name: 'unlock ConfigurablePluginsTabController served',
              search: 'entry.options.key !== void 0 && served.has(entry.options.key)',
              replace: 'entry.options.key !== void 0 /* UNLOCKED_PLUGINS */',
            },
            {
              name: 'append served namespaces',
              search: 'this.served = response.result.value.namespaces.map((view) => view.ns);',
              replace: 'this.served = response.result.value.namespaces.map((view) => view.ns); /* UNLOCKED_SERVED */ if (!this.served.includes("web-search-selector")) this.served.push("web-search-selector"); if (!this.served.includes("llm-antigravity")) this.served.push("llm-antigravity");',
            },
            {
              name: 'unlock SettingsScopeController ready status',
              search: 'status: persistence === "host" ? "loading" : "unavailable"',
              replace: 'status: "ready" /* UNLOCKED */',
            }
          ]);
        }
      }
    }
  }

  walk(rootDir);
}

export function runPatches(targetDirs = null) {
  const dirs = targetDirs || findNodeModulesDirs();
  console.log('Target node_modules search paths:');
  for (const d of dirs) console.log(' - ' + d);

  for (const dir of dirs) {
    console.log(`\nScanning & Patching in: ${dir}`);
    walkAndPatch(dir);
  }
  console.log('\nPatching complete.');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const customTarget = process.argv[2] ? [process.argv[2]] : null;
  runPatches(customTarget);
}
