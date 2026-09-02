// vibeADB 快速截图+UI dump 组合工具
import { spawn } from 'node:child_process';

const PAIRING = process.env.VIBEADB_PAIRING;
const TOOL = process.argv[2] || 'device_status';
const ARG = process.argv[3] || '';

const child = spawn('node', ['dist/index.js'], {
  env: { ...process.env, VIBEADB_PAIRING: PAIRING },
  stdio: ['pipe', 'pipe', 'pipe']
});
let buf = '';
child.stdout.on('data', d => { buf += d.toString(); });

function send(obj) { child.stdin.write(JSON.stringify(obj) + '\n'); }
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'tool-runner', version: '1.0' } } });

setTimeout(() => {
  let params = { name: TOOL, arguments: {} };
  if (TOOL === 'shell') params.arguments = { command: ARG };
  if (TOOL === 'screenshot') params.arguments = ARG ? { path: ARG } : {};
  if (TOOL === 'ui_dump') params.arguments = ARG ? { path: ARG } : {};
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params });
}, 1000);

setTimeout(() => {
  const lines = buf.split('\n').filter(l => l.includes('"id":2'));
  if (lines.length) {
    const r = JSON.parse(lines[0]);
    const content = r.result?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c.type === 'text') console.log(c.text.slice(0, 6000));
        else if (c.type === 'image') console.log(`[IMAGE: ${JSON.stringify(c).slice(0, 200)}]`);
        else console.log(JSON.stringify(c).slice(0, 1000));
      }
    } else console.log(JSON.stringify(r).slice(0, 4000));
  } else console.log('(无响应)');
  child.kill();
  process.exit(0);
}, 30000);