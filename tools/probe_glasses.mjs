// 眼镜 P2P 端口扫描器（通过 vibeADB MCP 在手机端执行）
// 用法: node probe_glasses.mjs [target_ip] [tool_dir]
// 环境变量: VIBEADB_PAIRING
import { spawn } from 'node:child_process';

const PAIRING = process.env.VIBEADB_PAIRING;
const TARGET = process.argv[2] || '192.168.49.2';
const MCP_DIR = process.argv[3] || process.env.VIBEADB_MCP_DIR || 'dist';

if (!PAIRING) { console.error('[!] 需要 VIBEADB_PAIRING 环境变量'); process.exit(1); }

// 维持一个 MCP 会话，连续发工具调用
const child = spawn('node', ['dist/index.js'], {
  env: { ...process.env, VIBEADB_PAIRING: PAIRING },
  stdio: ['pipe', 'pipe', 'pipe']
});
let buf = '';
child.stdout.on('data', d => { buf += d.toString(); });
child.stderr.on('data', d => { /* 忽略 */ });

let nextId = 1;
const pending = new Map();

function call(tool, args = {}, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`超时: ${tool}`)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: tool, arguments: args } }) + '\n');
  });
}

// 解析 stdout 流中的 JSON-RPC 行
function processBuf() {
  const lines = buf.split('\n');
  buf = lines.pop(); // 保留不完整行
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    } catch { /* 非 JSON-RPC 行忽略 */ }
  }
}
child.stdout.on('data', processBuf);

async function main() {
  const commands = [];
  const useCmd = (label, cmd) => { commands.push({ label, cmd }); };

  // 1. 确认目标可达
  useCmd('ping 目标', `ping -c 2 -W 2 ${TARGET} 2>&1 || echo PING_FAIL`);

  // 2. 端口扫描：优先 nc/toybox nc，其次 curl telnet，再 fallback /dev/tcp
  const ports = ['5555','554','8554','8080','8099','8888','3344','4455','6666','9090','2000','3000','4444','22','80','443','4443','8090','1935','10000'];
  // 用一条命令循环探测，输出 OPEN 的端口
  const scanScript = `
for p in ${ports.join(' ')}; do
  if command -v nc >/dev/null 2>&1; then
    nc -z -w 2 ${TARGET} $p 2>/dev/null && echo "PORT $p OPEN"
  elif command -v curl >/dev/null 2>&1; then
    timeout 2 curl -s --connect-timeout 2 "telnet://${TARGET}:$p" >/dev/null 2>&1 && echo "PORT $p OPEN"
  else
    timeout 2 sh -c "exec 3<>/dev/tcp/${TARGET}/$p" 2>/dev/null && echo "PORT $p OPEN"
  fi
done
echo SCAN_DONE
`;
  useCmd('端口扫描', scanScript);

  // 3. 获取眼镜信息（若可达常用协议）
  useCmd('TCP banner 5555', `timeout 3 curl -s --connect-timeout 2 "telnet://${TARGET}:5555" 2>&1 | head -c 200 || true`);
  useCmd('HTTP 8080 banner', `timeout 3 curl -s --connect-timeout 2 "http://${TARGET}:8080/" 2>&1 | head -c 300 || true`);

  for (const { label, cmd } of commands) {
    console.log(`\n### ${label}`);
    try {
      const r = await call('shell', { command: cmd, timeoutSec: 60 });
      const txt = r?.content?.[0]?.text || JSON.stringify(r);
      console.log(txt);
    } catch (e) {
      console.log(`[错误] ${e.message}`);
    }
  }
  child.kill();
  process.exit(0);
}

main();