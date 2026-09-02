// 眼镜 P2P 深探：组详情 + 广范围端口扫描 + 邻居表
import { spawn } from 'node:child_process';

const PAIRING = process.env.VIBEADB_PAIRING;
const TARGET = process.argv[2] || '192.168.49.2';

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
  ['本机 p2p0 IP', 'ip addr show p2p0 2>/dev/null || ip addr show wlan0'],
  ['P2P 组信息', 'dumpsys wifi p2p 2>/dev/null | grep -A8 "P2P group\|GroupCreated\|isGroupOwner\|GO Negotiation\|mGroupOwner\|WifiP2pGroup{" | head -50'],
  ['邻居表', 'cat /proc/net/arp'],
  ['广扫 1-1024', 'for p in $(seq 1 1024); do (echo >/dev/tcp/192.168.49.2/$p) 2>/dev/null && echo "OPEN $p"; done; echo DONE'],
  ['广扫常用高端口', 'for p in 1935 4443 8090 8081 8082 9000 10000 12345 20000 30000 40000 50000 51000 5541 6666 7777 8888; do (echo >/dev/tcp/192.168.49.2/$p) 2>/dev/null && echo "OPEN $p"; done; echo DONE2'],
];

for (const [label, cmd] of cmds) {
  console.log(`\n### ${label}`);
  try {
    const r = await call('shell', { command: cmd, timeoutSec: 90 });
    console.log(r?.content?.[0]?.text || JSON.stringify(r));
  } catch (e) {
    console.log(`[错误] ${e.message}`);
  }
}
child.kill();
process.exit(0);