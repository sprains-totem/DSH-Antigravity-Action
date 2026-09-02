// 实时监控：捕捉官方APP与眼镜交互时的瞬态端口
// 用法：先在官方APP触发传视频/OTA，然后跑本脚本
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
let lastCommandId = 0;

function call(tool, args = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    lastCommandId = id;
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

async function snap(label) {
  try {
    const r = await call('shell', { command: "cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | awk '{print $2, $3, $4}' | grep -i 'C0A8:3101\\|C0A8:3102'" });
    const txt = r?.content?.[0]?.text || '';
    if (txt.trim() && !txt.includes('(无')) {
      console.log(`[${label}] 眼镜连接:`);
      console.log(txt);
    } else {
      console.log(`[${label}] -`);
    }
  } catch (e) {
    console.log(`[${label}] err ${e.message}`);
  }
}

console.log('=== 开始监控眼镜连接（10秒，现在去官方APP触发传视频/OTA）===');
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 10; i++) {
  await snap(`t+${i * 3}s`);
  await sleep(3000);
}
console.log('=== 监控结束 ===');
child.kill();
process.exit(0);