// vibeADB 通用调用器：通过 MCP 在真机执行任意 shell
import { spawn } from 'node:child_process';

const PAIRING = process.env.VIBEADB_PAIRING;
const CMD = process.argv[2] || 'echo ok';

const child = spawn('node', ['dist/index.js'], {
  env: { ...process.env, VIBEADB_PAIRING: PAIRING },
  stdio: ['pipe', 'pipe', 'pipe']
});
let buf = '';
child.stdout.on('data', d => { buf += d.toString(); });

function send(obj) { child.stdin.write(JSON.stringify(obj) + '\n'); }

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'shell-runner', version: '1.0' } } });

setTimeout(() => {
  const args = { command: CMD };
  // 支持 timeoutSec 第二个参数
  if (process.argv[3]) args.timeoutSec = parseInt(process.argv[3]);
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'shell', arguments: args } });
}, 1000);

const timeoutSec = (process.argv[3] ? parseInt(process.argv[3]) : 60) * 1000 + 15000;
setTimeout(() => {
  const lines = buf.split('\n').filter(l => l.includes('"id":2'));
  if (lines.length) {
    try {
      const r = JSON.parse(lines[0]);
      const txt = r.result?.content?.[0]?.text || JSON.stringify(r);
      console.log(txt);
    } catch { console.log(lines[0].slice(0, 4000)); }
  } else {
    console.log('(无响应)');
  }
  child.kill();
  process.exit(0);
}, timeoutSec);