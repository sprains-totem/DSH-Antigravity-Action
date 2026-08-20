import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

console.log('Starting clean DSH restriction lifting (Native 3080 & Models UI Unlocked)...');

const searchDirs = new Set([
  '/usr/local/lib/node_modules',
  '/usr/lib/node_modules',
  path.join(process.env.HOME || '', '.dsh'),
  path.join(process.env.USERPROFILE || '', '.dsh'),
  path.resolve(process.cwd(), 'node_modules'),
  path.resolve(process.cwd(), '..', 'node_modules'),
  path.resolve(process.cwd(), 'plugins')
]);

if (process.env.NODE_PATH) {
  process.env.NODE_PATH.split(path.delimiter).forEach(p => {
    if (p) searchDirs.add(path.resolve(p));
  });
}

function unlockFile(fullPath) {
  try {
    let code = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // 1. 服务端 index.js (PRIVILEGED_METHODS & isTrustedApiRequest)
    if (code.includes('PRIVILEGED_METHODS.has(method) && !isTrustedApiRequest(request, [])')) {
      code = code.replaceAll('PRIVILEGED_METHODS.has(method) && !isTrustedApiRequest(request, [])', 'false');
      changed = true;
    }

    if (code.includes('interceptor.options.authority === "loopback" && !isTrustedApiRequest(request, [])')) {
      code = code.replaceAll('interceptor.options.authority === "loopback" && !isTrustedApiRequest(request, [])', 'false');
      changed = true;
    }

    if (code.includes('const trustedHosts = options.authority === "loopback" ? [] : this.trustedHosts;')) {
      code = code.replaceAll('const trustedHosts = options.authority === "loopback" ? [] : this.trustedHosts;', 'const trustedHosts = this.trustedHosts;');
      changed = true;
    }

    if (code.includes('function isTrustedApiRequest(request, trustedHosts) {') && !code.includes('/* UNLOCKED */')) {
      code = code.replace(
        'function isTrustedApiRequest(request, trustedHosts) {',
        'function isTrustedApiRequest(request, trustedHosts) { /* UNLOCKED */ return true;'
      );
      changed = true;
    }

    // 2. 客户端 client.js (isLoopback)
    if (code.includes('function isLoopbackHostname(hostname) {') && !code.includes('return true; /* UNLOCKED */')) {
      code = code.replace(
        'function isLoopbackHostname(hostname) {',
        'function isLoopbackHostname(hostname) { return true; /* UNLOCKED */'
      );
      changed = true;
    }

    if (code.includes('isLoopback: pageLocation === void 0 || isLoopbackHostname(pageLocation.hostname)')) {
      code = code.replaceAll(
        'isLoopback: pageLocation === void 0 || isLoopbackHostname(pageLocation.hostname)',
        'isLoopback: true /* UNLOCKED */'
      );
      changed = true;
    }

    // 3. 设置持久化 (connection.isLoopback ? "host" : "memory" -> "host")
    if (code.includes('connection.isLoopback ? "host" : "memory"')) {
      code = code.replaceAll(
        'connection.isLoopback ? "host" : "memory"',
        '"host" /* UNLOCKED */'
      );
      changed = true;
    }

    // 4. 支持在「设置 -> 模型」界面中直接通过 WebUI 配置 Antigravity 与自定义模型（不再提示修改 settings.yaml）
    if (code.includes('function layoutOf(ns) {') && code.includes('if (ns === "llm-deepseek") return "deepseek";')) {
      code = code.replace(
        'if (ns === "llm-deepseek") return "deepseek";',
        'if (ns === "llm-deepseek" || ns === "llm-antigravity") return "deepseek";'
      );
      changed = true;
    }

    if (code.includes('const isAntigravity = ') === false && code.includes('const curatedFields = (family) => {')) {
      code = code.replace(
        'const curatedFields = (family) => {',
        'const curatedFields = (family) => {\n\t\t\t\tconst isAntigravity = namespace?.ns === "llm-antigravity" || props.provider === "antigravity";'
      );
      code = code.replace(
        'const keyLabel = t("keyInput");',
        'const keyLabel = isAntigravity ? "OAuth 2.0 Refresh Token" : t("keyInput");'
      );
      code = code.replace(
        'const keyPlaceholder = keyLocked ? t("keyEnvLocked") : keyState?.configured === true && props.credentialRequired !== true ? t("keyStored") : (family === "pi-ai" ? t("keyPlaceholderNative") : t("keyPlaceholder"));',
        'const keyPlaceholder = keyLocked ? t("keyEnvLocked") : keyState?.configured === true && props.credentialRequired !== true ? (isAntigravity ? "Refresh Token 已配置 (留空保持不变)" : t("keyStored")) : (isAntigravity ? "请输入 OAuth 2.0 Refresh Token" : (family === "pi-ai" ? t("keyPlaceholderNative") : t("keyPlaceholder")));'
      );
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(fullPath, code, 'utf8');
      console.log('Successfully unlocked:', fullPath);
    }
  } catch (err) {
    console.error('Error unlocking file:', fullPath, err.message);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.git') walkDir(full);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
        unlockFile(full);
      }
    }
  } catch {}
}

for (const d of searchDirs) {
  if (fs.existsSync(d)) walkDir(d);
}

console.log('Clean DSH restriction lifting completed.');
