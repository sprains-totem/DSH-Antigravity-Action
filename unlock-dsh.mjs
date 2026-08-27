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
import { execSync } from 'node:child_process';

function findNodeModulesDirs() {
  const dirs = [];
  const home = process.env.DSH_HOME || path.join(homedir(), '.dsh');

  // 1. ~/.dsh/profiles/web/node_modules, profiles/node_modules, and .dsh/node_modules
  dirs.push(path.join(home, 'profiles', 'web', 'node_modules'));
  dirs.push(path.join(home, 'profiles', 'node_modules'));
  dirs.push(path.join(home, 'node_modules'));

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

  // 3. Dynamic npm root -g & node binary lib
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    if (npmRoot) dirs.push(npmRoot);
  } catch {}

  try {
    const nodeLibNm = path.resolve(process.execPath, '..', '..', 'lib', 'node_modules');
    dirs.push(nodeLibNm);
  } catch {}

  // 4. Global npm node_modules
  if (process.platform === 'win32') {
    if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm', 'node_modules'));
    dirs.push('C:\\Program Files\\nodejs\\node_modules');
  } else {
    dirs.push('/usr/local/lib/node_modules');
    dirs.push('/usr/lib/node_modules');
    dirs.push(path.join(homedir(), '.npm-global', 'lib', 'node_modules'));
  }

  // 5. Current & parent working directories
  dirs.push(path.resolve(process.cwd(), 'node_modules'));
  dirs.push(path.resolve(process.cwd(), '..', 'node_modules'));

  // Normalize, deduplicate and filter existing directories
  const uniqueDirs = Array.from(new Set(dirs.filter(Boolean).map(d => path.resolve(d))));
  return uniqueDirs.filter((d) => fs.existsSync(d));
}

function patchFile(filePath, transforms) {
  if (!fs.existsSync(filePath)) return false;
  try {
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
      try {
        fs.writeFileSync(filePath, code, 'utf8');
      } catch (writeErr) {
        if (writeErr.code === 'EACCES') {
          try {
            fs.chmodSync(filePath, 0o666);
            fs.writeFileSync(filePath, code, 'utf8');
          } catch (chmodErr) {
            console.warn(`  [!] EACCES: skipped read-only file ${filePath}`);
            return false;
          }
        } else {
          throw writeErr;
        }
      }
      return true;
    }
  } catch (err) {
    console.warn(`  [!] Warning while patching ${filePath}:`, err?.message || err);
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
              name: 'unlock isTrustedApiRequest',
              search: 'function isTrustedApiRequest(request, trustedHosts) {',
              replace: 'function isTrustedApiRequest(request, trustedHosts) { return true; /* UNLOCKED */',
            },
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
            {
              name: 'unlock isLoopback property',
              search: 'isLoopback: pageLocation === void 0 || isLoopbackHostname(pageLocation.hostname)',
              replace: 'isLoopback: true /* UNLOCKED */',
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
              name: 'deriveKeyRef antigravity',
              search: 'function deriveKeyRef(provider) {\n\t\t\treturn `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;\n\t\t}',
              replace: 'function deriveKeyRef(provider) {\n\t\t\tif (provider === "antigravity") return "ANTIGRAVITY_REFRESH_TOKEN";\n\t\t\treturn `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;\n\t\t}',
            },
            {
              name: 'apiKeyEnvOf refreshTokenEnv support',
              search: 'function apiKeyEnvOf(namespace, path, schema) {\n\t\t\tif (namespace === void 0) return void 0;\n\t\t\tconst profile = schema.getPath(namespace.value, path);\n\t\t\tif (typeof profile !== "object" || profile === null) return void 0;\n\t\t\tconst ref = profile.apiKeyEnv;\n\t\t\treturn typeof ref === "string" && ref.length > 0 ? ref : void 0;\n\t\t}',
              replace: 'function apiKeyEnvOf(namespace, path, schema) {\n\t\t\tif (namespace === void 0) return void 0;\n\t\t\tif (namespace.ns === "llm-antigravity") return "ANTIGRAVITY_REFRESH_TOKEN";\n\t\t\tconst profile = schema.getPath(namespace.value, path);\n\t\t\tif (typeof profile !== "object" || profile === null) return void 0;\n\t\t\tconst ref = profile.apiKeyEnv ?? profile.refreshTokenEnv;\n\t\t\treturn typeof ref === "string" && ref.length > 0 ? ref : void 0;\n\t\t}',
            },
            {
              name: 'refFor refreshTokenEnv support',
              search: 'function refFor(schema, namespace, path, provider) {\n\t\t\tconst profile = schema.getPath(namespace.value, path);\n\t\t\tconst named = typeof profile === "object" && profile !== null ? profile.apiKeyEnv : void 0;\n\t\t\treturn typeof named === "string" && named.length > 0 ? named : deriveKeyRef(provider);\n\t\t}',
              replace: 'function refFor(schema, namespace, path, provider) {\n\t\t\tif (provider === "antigravity" || namespace?.ns === "llm-antigravity") return "ANTIGRAVITY_REFRESH_TOKEN";\n\t\t\tconst profile = schema.getPath(namespace.value, path);\n\t\t\tconst named = typeof profile === "object" && profile !== null ? (profile.apiKeyEnv ?? profile.refreshTokenEnv) : void 0;\n\t\t\treturn typeof named === "string" && named.length > 0 ? named : deriveKeyRef(provider);\n\t\t}',
            },
            {
              name: 'curatedFields isAntigravity',
              search: 'const curatedFields = (family) => {\n\t\t\t\tconst ownsIdentity = family === "pi-ai" && props.declared === true;',
              replace: 'const curatedFields = (family) => {\n\t\t\t\tconst isAntigravity = Boolean(namespace?.ns === "llm-antigravity" || props.provider === "antigravity");\n\t\t\t\tconst ownsIdentity = family === "pi-ai" && props.declared === true;',
            },
            {
              name: 'keyPlaceholder Refresh Token',
              search: 'const keyPlaceholder = keyLocked ? t("keyEnvLocked") : keyState?.configured === true && props.credentialRequired !== true ? t("keyStored") : family === "pi-ai" ? t("keyPlaceholderNative") : t("keyPlaceholder");',
              replace: 'const keyPlaceholder = keyLocked ? t("keyEnvLocked") : keyState?.configured === true && props.credentialRequired !== true ? (isAntigravity ? "Refresh Token 已配置（留空保持不变）" : t("keyStored")) : (isAntigravity ? "请输入 OAuth 2.0 Refresh Token" : (family === "pi-ai" ? t("keyPlaceholderNative") : t("keyPlaceholder")));',
            },
            {
              name: 'keyLabel Refresh Token',
              search: 'children: t("keyInput")\n\t\t\t\t\t\t}),\n\t\t\t\t\t\t(0, react_jsx_runtime.jsx)("input", {\n\t\t\t\t\t\t\tclassName: ModelsSection_module_css_default["input"],\n\t\t\t\t\t\t\ttype: "password",\n\t\t\t\t\t\t\tautoComplete: "off",\n\t\t\t\t\t\t\tvalue: keyDraft,\n\t\t\t\t\t\t\tplaceholder: keyPlaceholder,\n\t\t\t\t\t\t\t"aria-label": t("keyInput"),',
              replace: 'children: isAntigravity ? "Refresh Token" : t("keyInput")\n\t\t\t\t\t\t}),\n\t\t\t\t\t\t(0, react_jsx_runtime.jsx)("input", {\n\t\t\t\t\t\t\tclassName: ModelsSection_module_css_default["input"],\n\t\t\t\t\t\t\ttype: "password",\n\t\t\t\t\t\t\tautoComplete: "off",\n\t\t\t\t\t\t\tvalue: keyDraft,\n\t\t\t\t\t\t\tplaceholder: keyPlaceholder,\n\t\t\t\t\t\t\t"aria-label": isAntigravity ? "Refresh Token" : t("keyInput"),',
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

        // Patch dsh-host-frontend-static (serve /mobile SPA route)
        if (fullPath.includes('dsh-host-frontend-static') && fullPath.endsWith('index.js')) {
          patchFile(fullPath, [
            {
              name: 'serve /mobile SPA route in frontend-static',
              search: '		if (target === distRoot || target === distIndex) {\n\t\t\tbody = await renderIndex();\n\t\t\ttype = HTML_MIME;\n\t\t} else {\n\t\t\tbody = await readFile(target);\n\t\t\ttype = MIME[extname(target)] ?? "application/octet-stream";\n\t\t}',
              replace: '		if (target === distRoot || target === distIndex) {\n\t\t\tbody = await renderIndex();\n\t\t\ttype = HTML_MIME;\n\t\t} else {\n\t\t\tlet readTarget = target;\n\t\t\tif (pathname === "/mobile" || pathname === "/mobile/" || pathname.startsWith("/mobile/session/")) {\n\t\t\t\treadTarget = join(distRoot, "mobile", "index.html");\n\t\t\t}\n\t\t\tbody = await readFile(readTarget);\n\t\t\ttype = MIME[extname(readTarget)] ?? "application/octet-stream";\n\t\t}',
            }
          ]);
        }

        // Patch dsh-credentials-local (prevent 644 permission check crash)
        if (fullPath.includes('dsh-credentials-local')) {
          patchFile(fullPath, [
            {
              name: 'bypass assertOwnerOnly permission strict check',
              search: 'async function assertOwnerOnly(filename) {',
              replace: 'async function assertOwnerOnly(filename) { return; /* UNLOCKED */',
            }
          ]);
        }

        // Patch dsh-host-apiproxy (allow video/audio/pdf in durablePromptContent)
        if (fullPath.includes('dsh-host-apiproxy') && fullPath.endsWith('index.js')) {
          patchFile(fullPath, [
            {
              name: 'preserve video/audio/pdf in durablePromptContent',
              search: 'const refs = await admitEncodedImages(ctx.attachments, content.filter((part) => part.type === "image"));\n\tlet next = 0;\n\treturn content.map((part) => part.type === "text" ? {\n\t\ttype: "text",\n\t\ttext: part.text\n\t} : {\n\t\ttype: "image",\n\t\tattachment: refs[next++]\n\t});',
              replace: 'const imageParts = content.filter((part) => part.type === "image");\n\tconst refs = imageParts.length > 0 ? await admitEncodedImages(ctx.attachments, imageParts) : [];\n\tlet next = 0;\n\treturn content.map((part) => {\n\t\tif (part.type === "text") return { type: "text", text: part.text };\n\t\tif (part.type === "image") return { type: "image", attachment: refs[next++] };\n\t\treturn { ...part };\n\t});',
            }
          ]);
        }

        // Patch dsh-client-ui-conversation (allow multimodal files in composer)
        if (fullPath.includes('dsh-client-ui-conversation') && fullPath.endsWith('client.js')) {
          patchFile(fullPath, [
            {
              name: 'expand imageMediaType to multimodal',
              search: '		function imageMediaType(value) {\n\t\t\tswitch (value) {\n\t\t\t\tcase "image/png":\n\t\t\t\tcase "image/jpeg":\n\t\t\t\tcase "image/webp":\n\t\t\t\tcase "image/gif": return value;\n\t\t\t\tdefault: throw new UnsupportedImageMediaTypeError(value);\n\t\t\t}\n\t\t}',
              replace: '		function imageMediaType(value, fileName = "") {\n\t\t\tconst ext = (fileName.split(".").pop() || "").toLowerCase();\n\t\t\tswitch (value) {\n\t\t\t\tcase "image/png":\n\t\t\t\tcase "image/jpeg":\n\t\t\t\tcase "image/webp":\n\t\t\t\tcase "image/gif":\n\t\t\t\tcase "image/heic":\n\t\t\t\tcase "image/heif":\n\t\t\t\tcase "video/mp4":\n\t\t\t\tcase "video/webm":\n\t\t\t\tcase "video/quicktime":\n\t\t\t\tcase "video/x-msvideo":\n\t\t\t\tcase "video/ogg":\n\t\t\t\tcase "audio/mp3":\n\t\t\t\tcase "audio/mpeg":\n\t\t\t\tcase "audio/wav":\n\t\t\t\tcase "audio/x-wav":\n\t\t\t\tcase "audio/m4a":\n\t\t\t\tcase "audio/aac":\n\t\t\t\tcase "audio/ogg":\n\t\t\t\tcase "audio/opus":\n\t\t\t\tcase "audio/flac":\n\t\t\t\tcase "application/pdf":\n\t\t\t\tcase "application/x-ipynb+json":\n\t\t\t\tcase "application/rtf":\n\t\t\t\tcase "text/csv": return value;\n\t\t\t\tdefault: {\n\t\t\t\t\tif (["mp4","webm","mov","avi","mkv","ogg","ogv"].includes(ext)) return "video/mp4";\n\t\t\t\t\tif (["mp3","wav","m4a","aac","opus","flac","weba"].includes(ext)) return "audio/mp3";\n\t\t\t\t\tif (ext === "pdf") return "application/pdf";\n\t\t\t\t\tif (ext === "ipynb") return "application/x-ipynb+json";\n\t\t\t\t\tif (ext === "rtf") return "application/rtf";\n\t\t\t\t\tif (ext === "csv") return "text/csv";\n\t\t\t\t\tif (["png","jpg","jpeg","webp","gif","heic","heif"].includes(ext)) return "image/png";\n\t\t\t\t\treturn value || "application/octet-stream";\n\t\t\t\t}\n\t\t\t}\n\t\t}',
            },
            {
              name: 'createDraftImages pass fileName',
              search: '			createDraftImages(files) {\n\t\t\t\tfor (const file of files) imageMediaType(file.type);',
              replace: '			createDraftImages(files) {\n\t\t\t\tfor (const file of files) imageMediaType(file.type, file.name);',
            },
            {
              name: 'serializeImages multimodal support',
              search: '			/** Convert browser files to canonical base64 prompt parts. */\n\t\t\tserializeImages(images) {\n\t\t\t\treturn Promise.all(images.map(async (file) => ({\n\t\t\t\t\ttype: "image",\n\t\t\t\t\t...await this.encodeImage(file)\n\t\t\t\t})));\n\t\t\t}',
              replace: '			/** Convert browser files to canonical base64 prompt parts (multimodal). */\n\t\t\tserializeImages(images) {\n\t\t\t\treturn Promise.all(images.map(async (file) => {\n\t\t\t\t\tconst mt = imageMediaType(file.type, file.name);\n\t\t\t\t\tlet blockType = "image";\n\t\t\t\t\tif (mt.startsWith("video/")) blockType = "video";\n\t\t\t\t\telse if (mt.startsWith("audio/")) blockType = "audio";\n\t\t\t\t\telse if (mt === "application/pdf" || file.name.endsWith(".pdf")) blockType = "pdf";\n\t\t\t\t\telse if (mt === "application/x-ipynb+json" || file.name.endsWith(".ipynb") || mt === "application/rtf" || mt === "text/csv") blockType = "document";\n\t\t\t\t\tconst buf = new Uint8Array(await file.arrayBuffer());\n\t\t\t\t\treturn {\n\t\t\t\t\t\ttype: blockType,\n\t\t\t\t\t\tmediaType: mt,\n\t\t\t\t\t\tmimeType: mt,\n\t\t\t\t\t\tdata: bytesToBase64(buf),\n\t\t\t\t\t\t...file.name === "" ? {} : { name: file.name }\n\t\t\t\t\t};\n\t\t\t\t}));\n\t\t\t}',
            },
            {
              name: 'intakeImages allow multimodal',
              search: 'if (files.some((file) => !imageLimits.mediaTypes.includes(file.type))) return addImages(files);',
              replace: '// Allow all multimodal files\n\t\t\t\t\t\treturn addImages(files);',
            }
          ]);
        }

        // Patch dsh-client-ui-attachment (preview video/audio/pdf)
        if (fullPath.includes('dsh-client-ui-attachment') && fullPath.endsWith('client.js')) {
          patchFile(fullPath, [
            {
              name: 'render video/audio in attachment rail',
              search: '								children: (0, react_jsx_runtime.jsx)("img", {\n\t\t\t\t\t\t\t\t\tsrc: item.previewUrl,\n\t\t\t\t\t\t\t\t\talt: item.alt\n\t\t\t\t\t\t\t\t})',
              replace: '								children: item.attachment.file.type.startsWith("video/") || item.attachment.file.name.match(/\\.(mp4|webm|mov|avi|mkv)$/i) ? (0, react_jsx_runtime.jsx)("video", {\n\t\t\t\t\t\t\t\t\tsrc: item.previewUrl,\n\t\t\t\t\t\t\t\t\tstyle: { width: "100%", height: "100%", objectFit: "cover" },\n\t\t\t\t\t\t\t\t\tmuted: true\n\t\t\t\t\t\t\t\t}) : item.attachment.file.type.startsWith("audio/") || item.attachment.file.name.match(/\\.(mp3|wav|m4a|aac|ogg|flac)$/i) ? (0, react_jsx_runtime.jsxs)("div", {\n\t\t\t\t\t\t\t\t\tstyle: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fef3c7", color: "#b45309", fontSize: 10, padding: 2, textAlign: "center" },\n\t\t\t\t\t\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("span", { style: { fontSize: 20 }, children: "🎵" }), (0, react_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }, children: item.alt })]\n\t\t\t\t\t\t\t\t}) : (item.attachment.file.type === "application/pdf" || item.attachment.file.name.endsWith(".pdf")) ? (0, react_jsx_runtime.jsxs)("div", {\n\t\t\t\t\t\t\t\t\tstyle: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#dcfce7", color: "#15803d", fontSize: 10, padding: 2, textAlign: "center" },\n\t\t\t\t\t\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("span", { style: { fontSize: 20 }, children: "📄" }), (0, react_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }, children: item.alt })]\n\t\t\t\t\t\t\t\t}) : (0, react_jsx_runtime.jsx)("img", {\n\t\t\t\t\t\t\t\t\tsrc: item.previewUrl,\n\t\t\t\t\t\t\t\t\talt: item.alt\n\t\t\t\t\t\t\t\t})',
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
