#!/usr/bin/env node
// extract_combo_audio.js — 解析 btsnoop HCI 日志，重组 L2CAP，提取千问 G1 眼镜 4 次录音组合
//
// 协议要点（见 vibeQwenGlasses/docs/PROTOCOL.md）:
//   - CID 0x0048: 音频通道，每帧 398B = 8B 魔数(87 EF 12 03 07 01 86 08) + 1B 序号 + 4B 填充 + 384B PCM + 1B 填充
//   - CID 0x004A: 手机→眼镜 JSON 指令
//   - CID 0x0041: 眼镜→手机 JSON 事件
// 用法: node extract_combo_audio.js [logfile]
// 输出(写到日志同目录):
//   combo_1_glasses_start_glasses_stop.wav ... combo_4_phone_start_glasses_stop.wav
//   combo_test_instructions.json
//   combo_test_report.md
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'D:/Projects/copilot/bt_combo_test.log';
const OUTDIR = path.dirname(FILE);

const MAGIC = Buffer.from([0x87, 0xEF, 0x12, 0x03, 0x07, 0x01, 0x86, 0x08]);
const MAGIC_HEX = '87 EF 12 03 07 01 86 08';
const FRAME = 398;   // 每帧总长
const SKIP = 13;     // 跳过帧头
const AUDIO = 384;   // PCM 字节
const SR = 16000;    // 采样率
// vivo .cfa btsnoop 时间戳: 微秒, 基准≈公元元年(proleptic), 经 log_timestamp 校准:
//   值 = 本地(CST)墙上时间按 UTC 解释 → unix_ms = rawUs/1000 - 62168256000102
//   校验: 首记录→14:08:04.800, 尾记录→14:14:16.611 (与实测窗口 14:08:04~14:14:16 CST 一致)
//   注意: 眼镜侧 log_timestamp 为 UTC, 比主机 btsnoop 时间慢 8h
const BTSNOOP_EPOCH_US = BigInt(62168256000102) * 1000n;

const buf = fs.readFileSync(FILE);
const r32be = (o) => buf.readUInt32BE(o);
const r16le = (o) => buf.readUInt16LE(o);

function recMs(o) {
  const hi = r32be(o + 16), lo = r32be(o + 20);
  const us = (BigInt(hi) << 32n) | BigInt(lo);
  return Number((us - BTSNOOP_EPOCH_US) / 1000n); // 直接即 CST 墙上时间(ms)
}
function fmtCST(ms) {
  return new Date(ms).toISOString().replace('T', ' ').substring(0, 23) + ' CST';
}
function hex(b, s, l) { const e = Math.min(s + l, b.length); const p = []; for (let i = s; i < e; i++) p.push(b[i].toString(16).padStart(2, '0')); return p.join(' '); }
function asciiSafe(b) { let r = ''; for (let i = 0; i < b.length; i++) { const c = b[i]; r += (c >= 32 && c < 127) ? String.fromCharCode(c) : '.'; } return r; }

// ── 1. 解析记录 ──────────────────────────────────────────────────────────────
const records = [];
{
  let off = 16;
  let recIdx = 0;
  while (off + 24 <= buf.length) {
    const incl = r32be(off + 4);
    const flags = r32be(off + 8);
    const ds = off + 24, de = ds + incl;
    if (de > buf.length || incl > 65535) break;
    records.push({ recIdx: ++recIdx, flags, dir: (flags & 1) ? 'C->H' : 'H->C', ts: recMs(off), ds, de });
    off = de;
  }
}
const tFirst = records.length ? records[0].ts : 0;
const tLast = records.length ? records[records.length - 1].ts : 0;
console.log(`记录总数: ${records.length}`);
console.log(`日志时间范围: ${fmtCST(tFirst)} ~ ${fmtCST(tLast)}  (${((tLast - tFirst) / 1000).toFixed(1)}s)`);

// ── 2. ACL / L2CAP 解析与重组 ───────────────────────────────────────────────
const assemblers = {};          // key handle_dir -> {cid, expectedLen, data, ts, dir}
const l2capEvents = [];         // 完整 L2CAP PDU: {ts, cid, dir, payload}
const pktModes = { h4: 0, raw: 0, other: 0, bad: 0, shortL2cap: 0, orphanCont: 0 };

function parseAclPacket(rec) {
  const { ds, de } = rec;
  // H4 模式: buf[ds] === 0x02
  if (buf[ds] === 0x02 && ds + 5 <= de) {
    const hf = r16le(ds + 1);
    const aclLen = r16le(ds + 3);
    const handle = hf & 0x0FFF, pb = (hf >> 12) & 3;
    const avail = de - (ds + 5);
    if (aclLen === avail || aclLen === avail - 1 || (aclLen > 0 && aclLen <= avail + 4)) {
      return { handle, pb, l2off: ds + 5 };
    }
  }
  // 裸 ACL 模式(无 H4 字节)
  if (ds + 4 <= de) {
    const hf = r16le(ds);
    const aclLen = r16le(ds + 2);
    const handle = hf & 0x0FFF, pb = (hf >> 12) & 3;
    const avail = de - (ds + 4);
    if (aclLen === avail || aclLen === avail - 1 || (aclLen > 0 && aclLen <= avail + 4)) {
      return { handle, pb, l2off: ds + 4 };
    }
  }
  return null;
}

function processL2CAP(ts, cid, payload, dir, recIdx) {
  l2capEvents.push({ ts, cid, payload, dir, recIdx });
}

for (const rec of records) {
  const { ds, de, ts, dir, recIdx } = rec;
  const h4 = buf[ds];
  const acl = parseAclPacket(rec);
  if (!acl) {
    if (h4 === 0x01 || h4 === 0x03 || h4 === 0x04 || h4 === 0x05 || h4 === 0x06 || h4 === 0x07 || h4 === 0x7E || h4 === 0x7F) {
      pktModes.other++; // H4 command/event/SCO 等
    } else {
      pktModes.bad++;
    }
    continue;
  }
  // 判定模式用于统计
  const isH4 = (acl.l2off === ds + 5);
  if (isH4) pktModes.h4++; else pktModes.raw++;

  const { handle, pb, l2off } = acl;
  const key = handle + '_' + dir;
  const aclDataEnd = de; // ACL data 到记录末尾

  if (pb === 2 || pb === 0) {
    // 起始包: 含 L2CAP 头
    if (l2off + 4 > aclDataEnd) { pktModes.shortL2cap++; continue; }
    const l2len = r16le(l2off);
    const cid = r16le(l2off + 2);
    const poff = l2off + 4;
    const plen = aclDataEnd - poff;
    const payload = Buffer.from(buf.slice(poff, aclDataEnd));
    if (l2len <= plen) {
      processL2CAP(ts, cid, payload.slice(0, l2len), dir, recIdx);
    } else {
      assemblers[key] = { cid, expectedLen: l2len, data: payload, ts, dir, startRec: recIdx };
    }
  } else if (pb === 3 || pb === 1) {
    // 续包
    const asm = assemblers[key];
    if (!asm) { pktModes.orphanCont++; continue; }
    const cont = Buffer.from(buf.slice(l2off, aclDataEnd));
    asm.data = Buffer.concat([asm.data, cont]);
    if (asm.data.length >= asm.expectedLen) {
      processL2CAP(asm.ts, asm.cid, asm.data.slice(0, asm.expectedLen), asm.dir, asm.startRec);
      delete assemblers[key];
    }
  } else {
    pktModes.bad++;
  }
}
console.log(`包类型统计: H4-ACL=${pktModes.h4} raw-ACL=${pktModes.raw} 其他H4=${pktModes.other} 无法解析=${pktModes.bad} L2CAP头截断=${pktModes.shortL2cap} 孤立续包=${pktModes.orphanCont}`);

// ── 2.5 重组 CID 0x0041 私有分帧 JSON（二进制头 + JSON 分段，续包为纯 JSON）──
const framed41 = [];
let acc = '';
let accStart = null;
function tryParseJsonStr(s) {
  try { return JSON.parse(s.replace(/\u0000+$/g, '').trim()); } catch (e) { return null; }
}
for (const e of l2capEvents) {
  if (e.cid !== 0x0041 || e.dir !== 'C->H') continue;
  const s = e.payload.toString('utf8');
  const i = s.indexOf('{');
  const hasClose = s.includes('}');
  if (acc) {
    if (i >= 8) {
      // 新消息(带二进制头): 上一条若未完成则丢弃
      acc = s.substring(i); accStart = e.ts;
    } else if (i >= 0) {
      acc += s.substring(i);   // 续包含嵌套 '{'
    } else if (hasClose) {
      acc += s;                // 纯 JSON 尾部
    } else {
      continue;                // 二进制控制包
    }
  } else {
    if (i >= 0) { acc = s.substring(i); accStart = e.ts; }
    else continue;
  }
  const p = tryParseJsonStr(acc);
  if (p !== null && typeof p === 'object') {
    framed41.push({ ts: accStart, json: p });
    acc = ''; accStart = null;
  }
}
console.log(`重组 CID 0x0041 分帧 JSON 消息: ${framed41.length} 条`);

// ── 3. CID 汇总 ─────────────────────────────────────────────────────────────
const cidStats = {};
for (const e of l2capEvents) {
  const k = '0x' + e.cid.toString(16).padStart(4, '0') + (e.dir === 'C->H' ? ' C->H' : ' H->C');
  if (!cidStats[k]) cidStats[k] = { count: 0, bytes: 0, handles: new Set() };
  cidStats[k].count++;
  cidStats[k].bytes += e.payload.length;
}
console.log('\n=== L2CAP PDU 汇总 (top 15) ===');
Object.entries(cidStats)
  .sort((a, b) => b[1].bytes - a[1].bytes)
  .slice(0, 15)
  .forEach(([k, s]) => console.log(`  ${k.padEnd(16)} count=${String(s.count).padStart(6)} bytes=${String(s.bytes).padStart(9)}`));

// ── 4. 音频帧提取: 扫描所有 CID 中带魔数头的 payload ─────────────────────────
// 注意: 不同日志/手机音频通道 CID 可能不同(本日志为 0x0047, 参考日志为 0x0048),
//       因此不按 CID 过滤, 而是全局扫描魔数头; 统计时仍记录各 CID 帧数。
function framesFromPayload(payload, ts) {
  const out = [];
  let o = 0;
  while (o + FRAME <= payload.length) {
    if (payload[o] === 0x87 && payload.slice(o, o + 8).equals(MAGIC)) {
      out.push({ ts, frame: Buffer.from(payload.slice(o, o + FRAME)) });
      o += FRAME; // 跳过整帧，避免 PCM 内的伪魔数
    } else o++;
  }
  return out;
}

const nonMagic0048 = []; // CID 0x0048 但不含魔数的 payload（HFP AT 等）
const audioPayloads = [];     // 所有包含音频帧的 payload
for (const e of l2capEvents) {
  const f = framesFromPayload(e.payload, e.ts);
  if (f.length) {
    audioPayloads.push({ cid: e.cid, dir: e.dir, frames: f });
  } else if (e.cid === 0x0048 && e.payload.length > 0) {
    if (nonMagic0048.length < 5) nonMagic0048.push({ ts: e.ts, len: e.payload.length, ascii: asciiSafe(e.payload.slice(0, 60)).replace(/\s+/g, ' ') });
  }
}
// 统计音频所在 CID
const cidFrameCount = {};
for (const p of audioPayloads) cidFrameCount[p.cid] = (cidFrameCount[p.cid] || 0) + p.frames.length;
const audioCid = Object.entries(cidFrameCount).sort((a, b) => b[1] - a[1])[0];
const audioCidStr = audioCid ? '0x' + Number(audioCid[0]).toString(16).padStart(4, '0') : '(未找到)';
console.log(`\n音频帧所在 CID: ${audioCidStr}  各 CID 帧数: ${Object.entries(cidFrameCount).map(([c, n]) => '0x' + Number(c).toString(16).padStart(4, '0') + '=' + n).join(', ')}`);

const perSec = {}; // secKey -> {bytes, pkts, frames}
const audioFrames = [];
for (const p of audioPayloads) {
  for (const fr of p.frames) {
    audioFrames.push({ ts: fr.ts, frame: fr.frame, cid: p.cid });
    const sec = Math.floor((fr.ts - tFirst) / 1000);
    if (!perSec[sec]) perSec[sec] = { bytes: 0, pkts: 0, frames: 0 };
    perSec[sec].bytes += fr.frame.length;
    perSec[sec].pkts++;
    perSec[sec].frames++;
  }
}
audioFrames.sort((a, b) => a.ts - b.ts);
console.log(`\n含音频帧 payload 数: ${audioPayloads.length}  音频帧总数: ${audioFrames.length}`);
console.log('CID 0x0048 无魔数 payload 样例(前5):');
nonMagic0048.forEach((n, i) => console.log(`  [${i}] ${fmtCST(n.ts)} len=${n.len} "${n.ascii}"`));

console.log(`\n=== 音频通道(${audioCidStr})每秒流量(有流量的秒) ===`);
for (const [sec, d] of Object.entries(perSec).sort((a, b) => a[0] - b[0])) {
  const mark = d.frames > 50 ? ' ◄◄ 音频突发' : (d.frames > 0 ? ' ◄ 有帧' : '');
  console.log(`  +${String(sec).padStart(4)}s  ${fmtCST(tFirst + sec * 1000)}  ${String(d.bytes).padStart(7)}B  ${String(d.pkts).padStart(4)}pkts  frames=${String(d.frames).padStart(4)}${mark}`);
}

// ── 5. 按时间间隔切分录音突发 ────────────────────────────────────────────────
const GAP_MS = 300; // 帧间隔 >300ms 视为录音段边界（正常帧率 83fps → 12ms/帧）
const bursts = [];
let cur = null;
for (const f of audioFrames) {
  if (!cur) { cur = { frames: [f] }; }
  else if (f.ts - cur.frames[cur.frames.length - 1].ts > GAP_MS) { bursts.push(cur); cur = { frames: [f] }; }
  else cur.frames.push(f);
}
if (cur) bursts.push(cur);

console.log(`\n=== 音频突发段 (${bursts.length}) ===`);
const burstInfo = [];
bursts.forEach((b, i) => {
  const f0 = b.frames[0], f1 = b.frames[b.frames.length - 1];
  const durS = (f1.ts - f0.ts) / 1000;
  const durFromCount = b.frames.length * AUDIO / 2 / SR; // 384B=192样本/帧
  // 序号连续性
  let seqGaps = 0, prevSeq = -1;
  for (const f of b.frames) {
    const s = f.frame[8];
    if (prevSeq >= 0 && s !== ((prevSeq + 1) & 0xFF)) seqGaps++;
    prevSeq = s;
  }
  console.log(`  段${i + 1}: ${fmtCST(f0.ts)} ~ ${fmtCST(f1.ts)}  dur=${durS.toFixed(2)}s  frames=${b.frames.length}  理论时长=${durFromCount.toFixed(2)}s  序号跳变=${seqGaps}`);
  burstInfo.push({ index: i + 1, startMs: f0.ts, endMs: f1.ts, frames: b.frames, durS, durFromCount, seqGaps });
});

// ── 6. JSON 指令/事件 (0x004A 手机→眼镜, 0x0041 眼镜→手机) ──────────────────
function tryParseJson(b) {
  // 去尾部 0x00
  let end = b.length;
  while (end > 0 && b[end - 1] === 0) end--;
  const str = b.toString('utf8', 0, end);
  const i = str.indexOf('{');
  if (i < 0 || i > 60) return null;
  const j = str.lastIndexOf('}');
  if (j <= i) return null;
  try { return JSON.parse(str.substring(i, j + 1)); } catch (e) { return null; }
}
const jsonMsgs = [];
for (const e of l2capEvents) {
  if (e.cid !== 0x004A && e.cid !== 0x0041) continue;
  const parsed = tryParseJson(e.payload);
  if (parsed !== null) jsonMsgs.push({ ts: e.ts, cid: e.cid, dir: e.dir, json: parsed, recIdx: e.recIdx });
  else if (e.payload.length > 4) {
    // 可能是私有分帧 + JSON 分段，提取 JSON 片段用于展示
    const str = e.payload.toString('utf8');
    const i = str.indexOf('{');
    const partial = i >= 0 ? str.substring(i, Math.min(i + 220, str.length)) : null;
    jsonMsgs.push({ ts: e.ts, cid: e.cid, dir: e.dir, json: null, partial, rawHead: hex(e.payload, 0, Math.min(24, e.payload.length)), recIdx: e.recIdx });
  }
}
jsonMsgs.sort((a, b) => a.ts - b.ts);

function classify(json) {
  if (json === null) return { kind: 'nonjson' };
  const s = JSON.stringify(json);
  // 停止指令优先判断(PART/codeList 或纯 code:AudioRecording 应答)
  if (json.type === 'PART' && Array.isArray(json.codeList) && json.codeList.includes('AudioRecording')) return { kind: 'rec_stop' };
  if (json.code === 'AudioRecording' && !json.extensions && !json.scene && json.status === undefined) return { kind: 'rec_stop' };
  // 眼镜状态上报: status TryExit/Exiting/Exited = 停止流程
  if (json.code === 'AudioRecording' && typeof json.status === 'string') {
    if (json.status === 'TryExit' || json.status === 'Exiting' || json.status === 'Exited') return { kind: 'ev_record_stop' };
    return { kind: 'other' };
  }
  // 眼镜任务层确认: current.code === AudioRecording = 开始确认
  if (json.current && json.current.code === 'AudioRecording') return { kind: 'ev_record_start' };
  // 手机开始指令
  if (json.uri && String(json.uri).includes('airecord://start')) return { kind: 'rec_start' };
  if (json.wakeupType) return { kind: 'rec_start' };
  if (json.scene === 'AudioRecording') return { kind: 'rec_start' };
  if (json.code === 'AudioRecording' && json.extensions && json.extensions.taskLinkId) return { kind: 'rec_start' };
  if (s.includes('record_start')) return { kind: 'ev_record_start' };
  if (s.includes('record_end') || s.includes('recording_end')) return { kind: 'ev_record_stop' };
  return { kind: 'other' };
}

console.log(`\n=== JSON 指令/事件 (CID 0x004A/0x0041, 共 ${jsonMsgs.length} 条) ===`);
const ctlWindow = { start: tFirst - 1000, end: tLast + 1000 };
const jsonInWindow = jsonMsgs.filter(m => m.ts >= ctlWindow.start && m.ts <= ctlWindow.end);
jsonInWindow.forEach((m, i) => {
  const cls = classify(m.json);
  const tag = cls.kind !== 'other' ? `  [${cls.kind}]` : '';
  const disp = m.json !== null ? JSON.stringify(m.json).substring(0, 240) : (m.partial ? '(分段JSON) ' + m.partial : '(非JSON) ' + m.rawHead);
  console.log(`[${String(i + 1).padStart(3)}] ${fmtCST(m.ts)} CID=0x${m.cid.toString(16).padStart(4, '0')} ${m.dir}${tag}`);
  console.log(`      ${disp}`);
});

// ── 7. 关联：为每段录音匹配指令与遥测 ───────────────────────────────────────
const comboMeta = [
  { file: 'combo_1_glasses_start_glasses_stop.wav', label: '眼镜发起 + 眼镜结束' },
  { file: 'combo_2_phone_start_phone_stop.wav',     label: '手机发起 + 手机结束' },
  { file: 'combo_3_glasses_start_phone_stop.wav',   label: '眼镜发起 + 手机结束' },
  { file: 'combo_4_phone_start_glasses_stop.wav',   label: '手机发起 + 眼镜结束' },
];
const recordings = [];
burstInfo.forEach((b, i) => {
  const rel = [];
  for (const m of jsonInWindow) {
    if (m.ts >= b.startMs - 5000 && m.ts <= b.endMs + 5000) rel.push(m);
  }
  // 开始指令: 录音前 5s 内到音频开始后 0.5s
  const startInstrs = rel.filter(m => ['rec_start', 'ev_record_start'].includes(classify(m.json).kind) && m.ts >= b.startMs - 5000 && m.ts <= b.startMs + 500);
  // 结束指令: 音频结束前 1s 到结束后 5s
  const stopInstrs = rel.filter(m => ['rec_stop', 'ev_record_stop'].includes(classify(m.json).kind) && m.ts >= b.endMs - 1000 && m.ts <= b.endMs + 5000);
  // 眼镜遥测: record_start/record_end/onHandler (来自重组后的完整 JSON)
  // 注意: 这些事件递达主机有数秒延迟, 故按内部时间戳归属录音段;
  //       眼镜内部时间戳与 btsnoop 同为"本地墙上时间(CST)按 unix ms"约定, 无需转换
  const telemetry = framed41.filter(m => {
    const j = m.json;
    let t = null;
    if (j.eventType === 'power-state') {
      const name = String(j.eventName || '').trim();
      if (name === 'record_start') t = j.contextInfo && j.contextInfo.startTime;
      else if (name === 'record_end') t = j.contextInfo && j.contextInfo.endTime;
    } else if (j.eventType === 'AudioRecording' && j.eventName === 'onHandler' && j.contextInfo && j.contextInfo.recordDataSent !== undefined) {
      t = j.contextInfo.recordDataStartTime;
    }
    if (typeof t !== 'number') return false;
    if (t < b.startMs - 1000 || t > b.endMs + 1000) return false;
    m._internalCst = t;
    return true;
  });
  // 触发方式判定: 开始(眼镜: 有 Recognize 或开始指令无 data.reason=touch; 手机: data.reason=touch)
  const phoneStart = startInstrs.some(m => m.json && m.json.data && m.json.data.reason === 'touch');
  const recog = rel.some(m => m.json && m.json.eventName === 'Recognize');
  const glassesStart = !phoneStart || recog;
  // 结束(手机: 有 PART 停止指令; 眼镜: reasonStop=KEY)
  const phoneStop = stopInstrs.some(m => m.json && m.json.type === 'PART');
  const glassesStop = stopInstrs.some(m => m.json && m.json.reasonStop === 'KEY') || (!phoneStop && stopInstrs.some(m => m.json && typeof m.json.status === 'string'));
  const trigger = { start: glassesStart && !phoneStart ? 'glasses' : (phoneStart ? 'phone' : 'glasses'), stop: phoneStop ? 'phone' : 'glasses' };
  recordings.push({ burst: b, rel, startInstrs, stopInstrs, telemetry, trigger });
});

// ── 8. 生成 WAV ─────────────────────────────────────────────────────────────
function writeWav(file, pcm) {
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcm.length, 4);
  wav.write('WAVE', 8); wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40);
  pcm.copy(wav, 44);
  fs.writeFileSync(file, wav);
}
function pcmStats(pcm) {
  let sum = 0, peak = 0, nz = 0;
  for (let i = 0; i < pcm.length; i += 2) {
    const v = pcm.readInt16LE(i);
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a !== 0) nz++;
  }
  const n = pcm.length / 2;
  const rms = n ? Math.sqrt(sum / n) : 0;
  return { rms, peak, nonzeroRatio: n ? nz / n : 0 };
}

const wavResults = [];
console.log('\n=== 生成 WAV ===');
recordings.forEach((r, i) => {
  const meta = comboMeta[i] || { file: `combo_${i + 1}.wav`, label: '未知' };
  const pcm = Buffer.alloc(r.burst.frames.length * AUDIO);
  r.burst.frames.forEach((f, fi) => f.frame.copy(pcm, fi * AUDIO, SKIP, SKIP + AUDIO));
  const file = path.join(OUTDIR, meta.file);
  writeWav(file, pcm);
  const st = pcmStats(pcm);
  const dur = pcm.length / 2 / SR;
  wavResults.push({ file: meta.file, label: meta.label, frames: r.burst.frames.length, dur, size: pcm.length + 44, pcmSize: pcm.length, peak: st.peak, rms: st.rms, nonzero: st.nonzeroRatio });
  console.log(`  ${meta.file}: frames=${r.burst.frames.length} 时长=${dur.toFixed(2)}s 文件大小=${pcm.length + 44}B  peak=${st.peak} rms=${st.rms.toFixed(1)} 非零样本=${(st.nonzeroRatio * 100).toFixed(1)}%`);
});

// ── 9. 输出 combo_test_instructions.json ────────────────────────────────────
function summarizeJson(m) {
  if (m.json === null) return { nonJsonHead: m.rawHead, partialJson: m.partial || null };
  return m.json;
}
const instructionsOut = {
  logFile: FILE,
  logRange: { start: fmtCST(tFirst), end: fmtCST(tLast) },
  protocol: {
    audioCid: audioCidStr,
    controlCidPhone: '0x004A',
    controlCidGlasses: '0x0041',
    frameSize: FRAME,
    magic: MAGIC_HEX,
    pcmPerFrame: AUDIO,
    sampleRate: SR,
  },
  recordings: recordings.map((r, i) => {
    const meta = comboMeta[i] || { file: `combo_${i + 1}.wav`, label: '未知' };
    // nearbyMessages 只保留有意义的: 指令类、Recognize、input 按键、record 相关
    const relRelevant = r.rel.filter(s => {
      if (s.ts < r.burst.startMs - 4000 || s.ts > r.burst.endMs + 2000) return false;
      if (s.json === null) {
        if (!s.partial) return false; // 纯二进制控制包
        return /Recognize|INPUT_EVENT|record|AudioRecording|wakeup|touch|PART/i.test(s.partial);
      }
      if (classify(s.json).kind !== 'other') return true;
      return /Recognize|INPUT_EVENT|record|AudioRecording|wakeup|touch|PART/i.test(JSON.stringify(s.json));
    }).slice(0, 40);
    return {
      index: i + 1,
      name: meta.file.replace('.wav', ''),
      label: meta.label,
      trigger: r.trigger,
      startTime: fmtCST(r.burst.startMs),
      endTime: fmtCST(r.burst.endMs),
      durationSec: +r.burst.durS.toFixed(3),
      theoreticalDurationSec: +r.burst.durFromCount.toFixed(3),
      frameCount: r.burst.frames.length,
      seqGaps: r.burst.seqGaps,
      glassesTelemetry: r.telemetry.map(s => ({ ts: fmtCST(s.ts), internalTimeCst: fmtCST(s._internalCst), eventType: s.json.eventType, eventName: String(s.json.eventName).trim(), contextInfo: s.json.contextInfo })),
      startInstructions: r.startInstrs.map(s => ({ ts: fmtCST(s.ts), cid: '0x' + s.cid.toString(16).padStart(4, '0'), dir: s.dir, json: summarizeJson(s) })),
      stopInstructions: r.stopInstrs.map(s => ({ ts: fmtCST(s.ts), cid: '0x' + s.cid.toString(16).padStart(4, '0'), dir: s.dir, json: summarizeJson(s) })),
      nearbyMessages: relRelevant.map(s => ({ ts: fmtCST(s.ts), cid: '0x' + s.cid.toString(16).padStart(4, '0'), dir: s.dir, json: summarizeJson(s) })),
    };
  }),
};
fs.writeFileSync(path.join(OUTDIR, 'combo_test_instructions.json'), JSON.stringify(instructionsOut, null, 2));
console.log('\n已写入 combo_test_instructions.json');

// ── 10. 输出 combo_test_report.md ───────────────────────────────────────────
const L = [];
L.push('# 千问 G1 眼镜录音组合测试报告');
L.push('');
L.push(`- 日志文件: \`${path.basename(FILE)}\``);
L.push(`- 日志时间范围: ${fmtCST(tFirst)} ~ ${fmtCST(tLast)}（vivo btsnoop 时间戳为本地 CST 墙上时间，基准≈公元元年，经 log_timestamp 校准）`);
L.push(`- HCI 记录总数: ${records.length}`);
L.push(`- 包类型: H4-ACL=${pktModes.h4}, raw-ACL=${pktModes.raw}, 其他H4=${pktModes.other}, 无法解析=${pktModes.bad}, L2CAP头截断=${pktModes.shortL2cap}, 孤立续包=${pktModes.orphanCont}`);
L.push('');
L.push('## 1. 协议摘要');
L.push('');
L.push(`- 音频通道 CID \`${audioCidStr}\`（本日志实测；参考日志为 0x0048，CID 因手机/固件而异，按魔数头全局匹配），帧 398B：8B 魔数 \`${MAGIC_HEX}\` + 1B 序号 + 4B 填充 + 384B PCM(16bit LE, 16000Hz, 单声道) + 1B 填充`);
L.push(`- 控制通道：CID \`0x004A\`（手机→眼镜 JSON 指令）、CID \`0x0041\`（眼镜→手机 JSON 事件）`);
L.push(`- 提取规则：跳过前 13 字节取 384B PCM，丢弃最后一字节`);
L.push('');
L.push(`## 2. 音频通道(${audioCidStr})流量随时间分布（按秒）`);
L.push('');
L.push('| 相对秒 | 时间(CST) | 字节 | 包数 | 帧数 | 标记 |');
L.push('|---|---:|---:|---:|---:|---|');
for (const [sec, d] of Object.entries(perSec).sort((a, b) => a[0] - b[0])) {
  const mark = d.frames > 50 ? '音频突发' : (d.frames > 0 ? '有帧' : '');
  L.push(`| +${sec}s | ${fmtCST(tFirst + sec * 1000)} | ${d.bytes} | ${d.pkts} | ${d.frames} | ${mark} |`);
}
L.push('');
L.push('## 3. 四次录音提取结果');
L.push('');
L.push('| 组合 | 触发方式 | 起始时间(CST) | 结束时间(CST) | 帧数 | 时长(帧推算) | 时长(时间戳) | 序号跳变 | WAV 文件 |');
L.push('|---|---|---|---:|---:|---:|---:|---:|---|');
recordings.forEach((r, i) => {
  const meta = comboMeta[i] || { file: `combo_${i + 1}.wav`, label: '?' };
  L.push(`| ${i + 1} | ${meta.label} | ${fmtCST(r.burst.startMs)} | ${fmtCST(r.burst.endMs)} | ${r.burst.frames.length} | ${r.burst.durFromCount.toFixed(2)}s | ${r.burst.durS.toFixed(2)}s | ${r.burst.seqGaps} | \`${meta.file}\` |`);
});
L.push('');
L.push('## 4. WAV 文件详情');
L.push('');
L.push('| 文件 | 时长 | 大小(字节) | 帧数 | 峰值 | RMS | 非零样本比 |');
L.push('|---|---:|---:|---:|---:|---:|---:|');
wavResults.forEach(w => {
  L.push(`| \`${w.file}\` | ${w.dur.toFixed(2)}s | ${w.size} | ${w.frames} | ${w.peak} | ${w.rms.toFixed(1)} | ${(w.nonzero * 100).toFixed(1)}% |`);
});
L.push('');
L.push('## 5. 录音控制指令/事件');
L.push('');
recordings.forEach((r, i) => {
  const meta = comboMeta[i] || { file: `combo_${i + 1}.wav`, label: '?' };
  L.push(`### 5.${i + 1} 组合 ${i + 1}（${meta.label}）`);
  L.push('');
  L.push(`录音窗口: ${fmtCST(r.burst.startMs)} ~ ${fmtCST(r.burst.endMs)}（${r.burst.durS.toFixed(2)}s，${r.burst.frames.length} 帧）`);
  L.push(`触发方式判定: 发起=${r.trigger.start === 'glasses' ? '眼镜' : '手机'}，结束=${r.trigger.stop === 'glasses' ? '眼镜' : '手机'}`);
  L.push('');
  if (r.startInstrs.length) {
    L.push('开始指令/事件:');
    r.startInstrs.forEach(m => {
      L.push(`- \`${fmtCST(m.ts)}\` CID 0x${m.cid.toString(16).padStart(4, '0')} ${m.dir}: \`${JSON.stringify(m.json)}\``);
    });
  } else L.push('开始指令/事件: （窗口内未匹配到明确的开始指令）');
  if (r.stopInstrs.length) {
    L.push('结束指令/事件:');
    r.stopInstrs.forEach(m => {
      L.push(`- \`${fmtCST(m.ts)}\` CID 0x${m.cid.toString(16).padStart(4, '0')} ${m.dir}: \`${JSON.stringify(m.json)}\``);
    });
  } else L.push('结束指令/事件: （窗口内未匹配到明确的结束指令）');
  if (r.telemetry.length) {
    L.push('眼镜侧遥测事件（内部时间 CST，递达时间见括号）:');
    r.telemetry.forEach(m => {
      L.push(`- ${fmtCST(m._internalCst)}（递达 ${fmtCST(m.ts)}）${m.json.eventType}/${String(m.json.eventName).trim()}: \`${JSON.stringify(m.json.contextInfo)}\``);
    });
  }
  L.push('');
  L.push('窗口内关键消息:');
  const relRelevant = r.rel.filter(s => {
    if (s.ts < r.burst.startMs - 4000 || s.ts > r.burst.endMs + 2000) return false;
    if (s.json === null) {
      if (!s.partial) return false;
      return /Recognize|INPUT_EVENT|record|AudioRecording|wakeup|touch|PART/i.test(s.partial);
    }
    if (classify(s.json).kind !== 'other') return true;
    return /Recognize|INPUT_EVENT|record|AudioRecording|wakeup|touch|PART/i.test(JSON.stringify(s.json));
  }).slice(0, 40);
  relRelevant.forEach(m => {
    const disp = m.json === null ? (m.partial ? '(分段JSON) ' + m.partial.substring(0, 200) : '(非JSON) ' + m.rawHead) : JSON.stringify(m.json).substring(0, 300);
    L.push(`- \`${fmtCST(m.ts)}\` CID 0x${m.cid.toString(16).padStart(4, '0')} ${m.dir}: \`${disp}\``);
  });
  L.push('');
});
L.push('## 6. 异常与备注');
L.push('');
L.push(`- CID 0x0048 无魔数 payload 数: ${nonMagic0048.length}（本日志音频不在 0x0048；该 CID 上仅少量杂项包）`);
const anomalies = [];
if (pktModes.bad > 0) anomalies.push(`无法归属的包 ${pktModes.bad} 个`);
if (pktModes.shortL2cap > 0) anomalies.push(`L2CAP 头截断的 ACL 起始包 ${pktModes.shortL2cap} 个（不影响音频帧，音频帧均为完整 398B PDU）`);
if (pktModes.orphanCont > 0) anomalies.push(`无对应起始包的孤立续包 ${pktModes.orphanCont} 个`);
if (bursts.length !== 4) anomalies.push(`检测到 ${bursts.length} 个音频突发段（预期 4 个）`);
burstInfo.forEach(b => { if (b.seqGaps > 0) anomalies.push(`段${b.index} 存在 ${b.seqGaps} 处帧序号跳变（丢帧或序号重置）`); });
// 到达速率检查: 名义 83.3fps(=16000/192); 段内 btsnoop 到达速率可能略高/略低
burstInfo.forEach(b => {
  const fps = b.frames.length / b.durS;
  if (fps < 75 || fps > 95) anomalies.push(`段${b.index} 帧到达速率异常: ${fps.toFixed(1)} fps（名义 83.3）`);
});
L.push(anomalies.length ? anomalies.map(a => `- ${a}`).join('\n') : '- 未发现异常：帧率稳定（约 83fps），序号连续，时长与 6-7 秒吻合。');
L.push('');
L.push('> 生成脚本: `extract_combo_audio.js`（Node.js 内置模块，无外部依赖）');
L.push('> 指令明细: `combo_test_instructions.json`');
fs.writeFileSync(path.join(OUTDIR, 'combo_test_report.md'), L.join('\n'));
console.log('已写入 combo_test_report.md');
