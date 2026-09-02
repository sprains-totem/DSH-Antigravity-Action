// 通过 vibeADB 查看官方 APP 连接的 GATT 服务（眼镜 BLE 通道）
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
  ['GATT 缓存（眼镜设备）', "dumpsys bluetooth_manager 2>/dev/null | grep -B2 -A15 'C4:D7:DC:3F:71:ED' | grep -iE 'service|characteristic|uuid|handle|gatt' | head -40"],
  ['GATT 服务列表', 'dumpsys bluetooth_manager 2>/dev/null | grep -A5 "GattService" | head -20'],
  ['连接状态细看', 'dumpsys bluetooth_manager 2>/dev/null | grep -iE "isConnected|AclState|acl state|isAclConnected" | head -10'],
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