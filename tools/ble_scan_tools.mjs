// BLE 扫描：找眼镜（0xFEB3 服务 + WoW 厂商数据）
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
function call(tool, args = {}, timeoutMs = 60000) {
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
  // 方法 A: 用 hcidump/bt 工具搜广播（低概率）
  ['BLE scan 工具', 'which btmgmt ble-scan hcitool bluetoothctl 2>/dev/null; ls /system/bin/ | grep -iE "bt|ble|hci" | head -20'],
  // 方法 B: 强制系统扫描并查看结果（不实际）
  // 方法 C: 查 bluetooth 日志里的扫描结果
  ['最近 scan 结果', 'dumpsys bluetooth_manager 2>/dev/null | grep -B5 -A10 "Scan result\\|onScanResult\\|FoundDevice" | head -30'],
  ['官方APP的BleL2capActivity扫描', 'logcat -d -t 100 --pid=$(pidof com.alibaba.wow) 2>/dev/null | grep -iE "ble|gatt|scan|feb3|wow" | tail -20'],
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