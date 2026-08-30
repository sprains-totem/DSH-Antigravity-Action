// extract_audio.js — 从 btsnoop HCI 日志提取 CID 0x0048 音频流
// 输入: bt_recording.log (vivo .cfa 改扩展名即可, 头部为 btsnoop\0)
// 输出: audio_0048.bin (原始398B帧拼接) + 可选 WAV 验证
// 依据: docs/PROTOCOL.md §5 (帧格式 398B = 8B魔数 + 1B序号 + 4B填充 + 384B PCM + 1B填充)
//
// 用法: node extract_audio.js <bt_recording.log> [recordStartSec] [recordEndSec]

const fs = require('fs');
const FILE = process.argv[2] || 'bt_recording.log';
const ARG_START = parseFloat(process.argv[3] || '14'); // 录音起点(相对日志起点,秒)
const ARG_END   = parseFloat(process.argv[4] || '69'); // 录音终点(秒)

const buf = fs.readFileSync(FILE);

function r32be(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function r16le(b, o) { return (b[o] | (b[o + 1] << 8)) >>> 0; }
function hex(b, s, l) { const e = Math.min(s + l, b.length), p = []; for (let i = s; i < e; i++) p.push(b[i].toString(16).padStart(2, '0')); return p.join(' '); }

const MAGIC = [0x87, 0xef, 0x12, 0x03, 0x07, 0x01, 0x86, 0x08];
const FRAME = 398, SKIP = 13, AUDIO = 384; // 每帧398B, 前13B头, 384B PCM, 尾部1B填充

// btsnoop 时间戳: 微秒, 相对日志起点换算
let offset = 16;
const hi0 = r32be(buf, offset + 16), lo0 = r32be(buf, offset + 20);
const t0 = (BigInt(hi0) << 32n) | BigInt(lo0);
const T_START = t0 + BigInt(Math.round(ARG_START * 1e6));
const T_END   = t0 + BigInt(Math.round(ARG_END   * 1e6));

const assemblers = {};
const chunks = [];
let frameCount = 0, seqErrors = 0, prevSeq = -1;
let firstPayloads = [];

function processL2CAP(cid, payload, dir, t) {
  if (cid !== 0x0048) return;
  if (t < T_START || t > T_END) return;
  const plen = payload.length;

  // 帧边界检测: 必须含魔数头
  let magicOk = plen >= 8;
  for (let i = 0; magicOk && i < 8; i++) magicOk = payload[i] === MAGIC[i];
  if (!magicOk) {
    console.log(`[!] CID 0x0048 无魔数头: len=${plen} head=${hex(payload,0,8)}`);
    return;
  }

  // 序列号连续性检查
  const seq = payload[8];
  if (prevSeq >= 0 && seq !== ((prevSeq + 1) & 0xFF)) {
    const gap = (seq - prevSeq) & 0xFF;
    console.log(`[!] 序列号跳变: ${prevSeq.toString(16)} -> ${seq.toString(16)} (gap=${gap})`);
    seqErrors++;
  }
  prevSeq = seq;

  if (firstPayloads.length < 3) {
    firstPayloads.push({ len: plen, hex: hex(payload, 0, Math.min(plen, 40)) });
  }

  chunks.push(Buffer.from(payload));
  frameCount++;
}

while (offset + 24 <= buf.length) {
  const incl = r32be(buf, offset + 4);
  const flags = r32be(buf, offset + 8);
  const hi = r32be(buf, offset + 16), lo = r32be(buf, offset + 20);
  const t = (BigInt(hi) << 32n) | BigInt(lo);
  const ds = offset + 24, de = ds + incl;
  if (de > buf.length || incl > 65535) break;
  const dir = (flags & 1) ? 'C->H' : 'H->C';

  if (buf[ds] === 0x02 && ds + 8 <= de) {
    const hf = r16le(buf, ds + 1);
    const handle = hf & 0x0FFF, pb = (hf >> 12) & 3;
    const key = handle + '_' + dir;
    if ((pb === 2 || pb === 0) && ds + 8 <= de) {
      const l2len = r16le(buf, ds + 5), cid = r16le(buf, ds + 7);
      const poff = ds + 9, plen = de - poff;
      const payload = Buffer.from(buf.slice(poff, de));
      if (l2len <= plen) processL2CAP(cid, payload.slice(0, l2len), dir, t);
      else assemblers[key] = { cid, expectedLen: l2len, data: payload, dir, t };
    } else if ((pb === 1 || pb === 3) && assemblers[key]) {
      const a = assemblers[key];
      a.data = Buffer.concat([a.data, Buffer.from(buf.slice(ds + 5, de))]);
      if (a.data.length >= a.expectedLen) {
        processL2CAP(a.cid, a.data.slice(0, a.expectedLen), a.dir, a.t);
        delete assemblers[key];
      }
    }
  }
  offset = de;
}

console.log(`=== 提取结果 ===`);
console.log(`窗口: ${ARG_START}s ~ ${ARG_END}s`);
console.log(`帧数: ${frameCount}`);
console.log(`序列号跳变: ${seqErrors}`);
if (firstPayloads.length) {
  console.log('前3帧头部:');
  firstPayloads.forEach((p, i) => console.log(`  [${i}] len=${p.len} ${p.hex}`));
}

if (frameCount === 0) {
  console.log('未提取到音频帧 — 请调整窗口参数 (录音起点秒数)');
  process.exit(1);
}

const raw = Buffer.concat(chunks);
fs.writeFileSync('audio_0048.bin', raw);
console.log(`原始帧流: audio_0048.bin (${raw.length} 字节, 应 ≈ ${frameCount * FRAME})`);

// 重组 PCM 并生成 WAV
const pcm = Buffer.alloc(frameCount * AUDIO);
for (let f = 0; f < frameCount; f++) raw.copy(pcm, f * AUDIO, f * FRAME + SKIP, f * FRAME + SKIP + AUDIO);

const SR = 16000, CH = 1, BPS = 16;
const wav = Buffer.alloc(44 + pcm.length);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length, 4);
wav.write('WAVE', 8); wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(CH, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * CH * BPS / 8, 28);
wav.writeUInt16LE(CH * BPS / 8, 32); wav.writeUInt16LE(BPS, 34);
wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40);
pcm.copy(wav, 44);
fs.writeFileSync('extracted_recording.wav', wav);
console.log(`PCM WAV: extracted_recording.wav (${pcm.length} 字节, ${(pcm.length / 2 / SR).toFixed(2)}s)`);
console.log('\n验证: 与 reference/official_reference_16000hz_mono.wav 逐字节比对即可确认正确性');
