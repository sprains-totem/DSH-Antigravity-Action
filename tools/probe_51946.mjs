// 眼镜 51946 端口：发送探测字节，看响应
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

// 检查手机有没有 python / node / 其他 socket 工具
const cmds = [
  ['探测工具', 'which python3 python nc toybox curl busybox socat 2>/dev/null; echo ---; ls /system/bin/ | grep -iE "python|nc|socat|curl" | head'],
  ['51946 完整连接状态', "cat /proc/net/tcp | awk '{print $2, $3, $4}' | grep -i '49.2'"],
  // 用 python3 socket 探测（若存在）
  ['python3 探测 51946', 'python3 -c "
import socket, time
try:
    s = socket.create_connection(('192.168.49.2', 51946), timeout=3)
    print('CONNECTED to 51946')
    s.settimeout(2)
    try:
        data = s.recv(256)
        print('GOT:', data.hex() if data else '(empty)')
    except socket.timeout:
        print('NO DATA (server silent, pure pull protocol)')
    # 发一些字节试探
    for payload in [b'\x00', b'\x01', b'\\r\\n', b'GET / HTTP/1.0\\r\\n\\r\\n']:
        try:
            s.sendall(payload)
            time.sleep(0.3)
            s.settimeout(0.5)
            data = s.recv(256)
            print(f'SENT {payload.hex()} -> GOT: {data.hex() if data else \"(no resp)\"}')
        except Exception as e:
            print(f'SENT {payload.hex()} -> ERR: {e}')
            break
    s.close()
except Exception as e:
    print('FAIL:', e)
" 2>&1'],
];

for (const [label, cmd] of cmds) {
  console.log(`\n### ${label}`);
  try {
    const r = await call('shell', { command: cmd, timeoutSec: 60 });
    console.log(r?.content?.[0]?.text || JSON.stringify(r));
  } catch (e) {
    console.log(`[错误] ${e.message}`);
  }
}
child.kill();
process.exit(0);