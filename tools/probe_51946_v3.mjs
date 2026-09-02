// 查 51946 连接归属 + 用 toybox nc 探测
import { spawn } from 'node:child_process';

const PAIRING = process.env.VIBEADB_PAIRING;

const child = spawn('node', ['dist/index.js'], {
  env: { ...process.env, VIBEADB_PAIRING: PAIRING },
  stdio: ['pipe', 'pipe', 'pipe']
});
let buf = '';
child.stdout.on('data', d => { buf += d.toString(); });

let nextId = 1;
const pending = new Map();
function call(tool, args = {}, timeoutMs = 50000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`超时: ${tool}`)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: tool, arguments: args } }) + '\n');
  });
}
function processBuf() {
  const lines = buf.split('\n');
  buf = lines.pop();
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
    } catch {}
  }
}
child.stdout.on('data', processBuf);

const cmds = [
  ['谁在用 51946（ss -p）', 'ss -tnp 2>/dev/null | grep 51946; echo ---; ss -tnp 2>/dev/null | grep "192.168.49"'],
  ['toybox nc 探测', 'printf "\\x00\\x01" | timeout 3 toybox nc -w 2 192.168.49.2 51946 2>&1 | xxd | head -10; echo NC_EXIT=$?'],
  ['再次确认连接状态', "cat /proc/net/tcp | awk '{print $2, $3, $4}' | grep -i 'C0A8:3101'"],
];

for (const [label, cmd] of cmds) {
  console.log(`\n### ${label}`);
  try {
    const r = await call('shell', { command: cmd, timeoutSec: 50 });
    console.log(r?.content?.[0]?.text || JSON.stringify(r));
  } catch (e) {
    console.log(`[错误] ${e.message}`);
  }
}
child.kill();
process.exit(0);