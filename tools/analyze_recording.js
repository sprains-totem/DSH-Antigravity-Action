// Targeted recording session analyzer
// Focus: 11:05:40 ~ 11:06:35 window
// btsnoop timestamps: microseconds since Jan 1 2000 (epoch offset = 946684800 seconds)

const fs = require('fs');
const FILE = process.argv[2] || 'bt_recording.log';
const buf = fs.readFileSync(FILE);

function r32be(b,o){return((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;}
function r16le(b,o){return(b[o]|(b[o+1]<<8))>>>0;}
function r16be(b,o){return((b[o]<<8)|b[o+1])>>>0;}
function hex(b,s,l){const e=Math.min(s+l,b.length),p=[];for(let i=s;i<e;i++)p.push(b[i].toString(16).padStart(2,'0'));return p.join(' ');}
function ascii(b,s,l){const e=Math.min(s+l,b.length);let r='';for(let i=s;i<e;i++)r+=(b[i]>=32&&b[i]<127)?String.fromCharCode(b[i]):'.';return r;}

// btsnoop epoch: Jan 1 2000 00:00:00 UTC in microseconds since Unix epoch
const BTSNOOP_EPOCH_US = BigInt(946684800) * BigInt(1000000);

function readTimestamp(buf, off) {
  // 8 bytes big-endian microseconds since Jan 1 2000
  const hi = r32be(buf, off);
  const lo = r32be(buf, off+4);
  const us = (BigInt(hi) << 32n) | BigInt(lo);
  const unixUs = us + BTSNOOP_EPOCH_US;
  const ms = Number(unixUs / 1000n);
  return new Date(ms);
}

// Target window (local time CST = UTC+8)
const REC_START = new Date('2026-08-30T03:05:40Z'); // 11:05:40 CST
const REC_END   = new Date('2026-08-30T03:06:35Z'); // 11:06:35 CST

const HEADER=16, REC=24;
let offset=HEADER;
let recIdx=0;

// Per-handle reassemblers
const assemblers={};

// Stats during recording window
const windowStats = {}; // cid -> {count, totalBytes, samples}
const allJsonMsgs = [];
const hfpCmds = [];
const bigPayloads = []; // potential audio

// Also collect per-second traffic to identify audio burst
const perSecond = {}; // second-bucket -> {bytes, pkts}

function inWindow(t) {
  return t >= REC_START && t <= REC_END;
}

function processL2CAP(handle, cid, payload, dir, recIdx, ts) {
  const plen = payload.length;
  const inWin = inWindow(ts);
  const tsStr = ts.toISOString().replace('T',' ').substring(0,23);
  const secKey = tsStr.substring(0,19);

  if (!perSecond[secKey]) perSecond[secKey]={bytes:0,pkts:0,cids:{}};
  perSecond[secKey].bytes += plen;
  perSecond[secKey].pkts++;
  const cidHex = `0x${cid.toString(16).padStart(4,'0')}`;
  perSecond[secKey].cids[cidHex] = (perSecond[secKey].cids[cidHex]||0)+plen;

  if (!inWin) return;

  const key = cidHex;
  if (!windowStats[key]) windowStats[key]={count:0,totalBytes:0,samples:[]};
  windowStats[key].count++;
  windowStats[key].totalBytes+=plen;
  if (windowStats[key].samples.length < 3) {
    windowStats[key].samples.push({recIdx,dir,plen,hex:hex(payload,0,Math.min(plen,48)),ascii:ascii(payload,0,Math.min(plen,32)),ts:tsStr});
  }

  // JSON sniff
  if (plen > 4) {
    const str = payload.toString('utf8');
    const ji = str.indexOf('{');
    if (ji>=0 && ji<20) {
      allJsonMsgs.push({recIdx,ts:tsStr,cid:cidHex,dir,json:str.substring(ji,ji+400)});
    }
    // HFP AT
    const ai = str.indexOf('AT+');
    if (ai>=0 && ai<10) {
      hfpCmds.push({recIdx,ts:tsStr,dir,cmd:str.substring(0,80).replace(/[\x00-\x1f]/g,' ')});
    }
  }

  // Large payloads > 40 bytes - potential audio
  if (plen > 40) {
    bigPayloads.push({recIdx,ts:tsStr,cid:cidHex,dir,plen,hex:hex(payload,0,Math.min(plen,80))});
  }
}

while (offset + REC <= buf.length) {
  const origLen = r32be(buf, offset);
  const inclLen = r32be(buf, offset+4);
  const flags   = r32be(buf, offset+8);
  const ts      = readTimestamp(buf, offset+16);
  const dataStart = offset + REC;
  const dataEnd   = dataStart + inclLen;

  if (dataEnd > buf.length || inclLen > 65535) break;
  recIdx++;

  const dir = (flags&1)?'C→H':'H→C';
  const pktType = buf[dataStart];

  if (pktType === 0x02 && dataStart+5 <= dataEnd) {
    const hf     = r16le(buf, dataStart+1);
    const handle = hf & 0x0FFF;
    const pb     = (hf>>12)&3;
    const aclData = dataStart+5;
    const key = `${handle}_${dir}`;

    if ((pb===2||pb===0) && aclData+4<=dataEnd) {
      const l2len = r16le(buf, aclData);
      const cid   = r16le(buf, aclData+2);
      const poff  = aclData+4;
      const plen  = dataEnd-poff;
      const payload = Buffer.from(buf.slice(poff, dataEnd));

      if (l2len <= plen) {
        processL2CAP(handle, cid, payload.slice(0,l2len), dir, recIdx, ts);
      } else {
        assemblers[key] = {cid, expectedLen:l2len, data:payload, dir, startRec:recIdx, ts};
      }
    } else if ((pb===1||pb===3) && assemblers[key]) {
      const cont = Buffer.from(buf.slice(aclData, dataEnd));
      const asm = assemblers[key];
      asm.data = Buffer.concat([asm.data, cont]);
      if (asm.data.length >= asm.expectedLen) {
        processL2CAP(handle, asm.cid, asm.data.slice(0,asm.expectedLen), asm.dir, asm.startRec, asm.ts);
        delete assemblers[key];
      }
    }
  }

  offset = dataEnd;
}

// ── Output ──────────────────────────────────────────────────────────────────
console.log(`Total records: ${recIdx}\n`);

console.log('=== Per-second traffic (all time) ===');
Object.entries(perSecond)
  .sort((a,b)=>a[0].localeCompare(b[0]))
  .forEach(([sec,d])=>{
    const cidStr = Object.entries(d.cids).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,b])=>`${c}:${b}B`).join(' ');
    const mark = (sec >= '2026-08-30 11:05:40' && sec <= '2026-08-30 11:06:35') ? ' ◄ RECORDING' : '';
    console.log(`  ${sec}  ${d.bytes.toString().padStart(8)}B  ${d.pkts.toString().padStart(4)}pkts  ${cidStr}${mark}`);
  });

console.log('\n=== CID stats DURING recording window (11:05:40-11:06:35) ===');
Object.entries(windowStats)
  .sort((a,b)=>b[1].totalBytes-a[1].totalBytes)
  .forEach(([cid,s])=>{
    console.log(`\n  CID ${cid}: count=${s.count}, totalBytes=${s.totalBytes}`);
    s.samples.forEach(p=>{
      console.log(`    [rec#${p.recIdx}] ${p.ts} dir=${p.dir} len=${p.plen}`);
      console.log(`      hex  : ${p.hex}`);
      console.log(`      ascii: ${p.ascii}`);
    });
  });

console.log('\n=== JSON messages during recording ===');
allJsonMsgs.forEach((m,i)=>{
  console.log(`[${i+1}] ${m.ts} CID=${m.cid} dir=${m.dir}`);
  console.log(`  ${m.json.replace(/\n/g,' ').substring(0,300)}`);
});

console.log('\n=== HFP AT commands during recording ===');
hfpCmds.forEach((m,i)=>{
  console.log(`[${i+1}] ${m.ts} dir=${m.dir}: ${m.cmd}`);
});

console.log(`\n=== Large payloads during recording (${bigPayloads.length} total, showing first 20) ===`);
bigPayloads.slice(0,20).forEach((p,i)=>{
  console.log(`[${i+1}] ${p.ts} CID=${p.cid} dir=${p.dir} len=${p.plen}`);
  console.log(`  ${p.hex}`);
});
