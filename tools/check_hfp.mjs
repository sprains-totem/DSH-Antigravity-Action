// 眼镜 HFP 连接详情 + 音频路由状态
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
  ['眼镜 HFP/A2DP 连接状态', "dumpsys bluetooth_manager | grep -A30 'C4:D7:DC:40:19:1C' | head -40"],
  ['音频路由（audio devices）', 'dumpsys audio | grep -iE "Bluetooth|sco|a2dp|Output device|input device" | head -20'],
  ['当前音频模式', 'dumpsys audio | grep -iE "mode|mMode|STREAM" | head -10'],
];

for (const [label, cmd] of cmds) {
  console.log(`\n### ${label}`);
  try {
    const r = await call('shell', { command: cmd, timeoutSec: 40 });
    console.log(r?.content?.[0]?.text || JSON.stringify(r));
  } catch (e) {
    console.log(`[错误] ${e.message}`);
  }
}
child.kill();
process.exit(0);