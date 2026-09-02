// 眼镜 51946 端口探测 v2
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

// 每行 python -c 单独执行（避免 JS 转义问题）
const pyCmds = [
  's=socket.create_connection(("192.168.49.2",51946),timeout=3);print("CONNECTED");s.settimeout(2);d=s.recv(256);print("RECV_HEX:",d.hex() if d else "EMPTY");s.close()',
  's=socket.create_connection(("192.168.49.2",51946),timeout=3);s.sendall(b"\\x00");s.settimeout(1);d=s.recv(256);print("SEND0_HEX:",d.hex() if d else "NONE");s.close()',
];

for (let i = 0; i < pyCmds.length; i++) {
  console.log(`\n### python 探测 ${i + 1}`);
  const cmd = `python3 -c "import socket; ${pyCmds[i]}" 2>&1 || echo PY_NOT_AVAILABLE`;
  try {
    const r = await call('shell', { command: cmd, timeoutSec: 40 });
    console.log(r?.content?.[0]?.text || JSON.stringify(r));
  } catch (e) {
    console.log(`[错误] ${e.message}`);
  }
}
child.kill();
process.exit(0);