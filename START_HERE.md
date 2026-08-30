# vibeQwenGlasses 鈥?妯″瀷寮€鍙戝惎鍔ㄥ寘

> 鏈粨搴撲负妯″瀷寮€鍙?vibQwenGlasses锛堝崈闂?G1 鐪奸暅 Android 褰曢煶 APP锛夌殑**瀹屾暣鏉愭枡鍖?*銆?> 鐩爣锛欰ndroid 鍘熺敓锛圞otlin + Jetpack Compose锛夛紝鐩磋繛鐪奸暅褰曢煶锛岀粫寮€瀹樻柟 APP銆?
---

## 馃摝 鏉愭枡娓呭崟

| 璺緞 | 鍐呭 | 鐢ㄩ€?|
|------|------|------|
| `docs/ARCHITECTURE.md` | Android 鍘熺敓鐗堟灦鏋勮璁?| 鍒嗗眰缁撴瀯銆佹ā鍧楄璁°€侀噷绋嬬 |
| `docs/PROTOCOL.md` | 閫嗗悜鍗忚瑙勬牸锛堟牳蹇冿紒锛?| 鎻℃墜銆佹寚浠ゃ€?98B 闊抽甯ф牸寮?|
| `reference/hci_logs/*.cfa` | 鍘熷 HCI 钃濈墮鎶撳寘鏃ュ織 | 鑷鍒嗘瀽鍗忚缁嗚妭 |
| `reference/official_reference_16000hz_mono.wav` | 瀹樻柟 APP 瀵煎嚭鍙傝€冨綍闊?| 楠岃瘉杈撳嚭姝ｇ‘鎬?|
| `tools/analyze_recording.js` | HCI 鏃ュ織鍒嗘瀽鑴氭湰 | 閫愮娴侀噺/CID/JSON 鎻愬彇 |
| `tools/extract_audio.js` | 闊抽甯ф彁鍙栬剼鏈?| 398B 甯?鈫?PCM 鈫?WAV |

---

## 馃攽 鍏抽敭浜嬪疄閫熸煡锛堝厛璇昏繖涓紒锛?
### 纭欢
- 鐪奸暅锛氭亽鐜?BES2800 + 楂橀€氶獊榫?AR1锛岃摑鐗?5.3 鍙屾ā
- **鐪奸暅 MAC: `A0:FB:C5:21:9B:20`**锛堟敞鎰忥細`B4:6E:10:37:C1:22` 鏄墜鏈鸿嚜宸辩殑鍦板潃锛屼笉鏄溂闀滐紒锛?
### 鍗忚锛堣瑙?PROTOCOL.md锛?- 鎺у埗閫氶亾锛歀2CAP CID `0x0041`锛堢溂闀溾啋鎵嬫満 JSON锛? `0x004A`锛堟墜鏈衡啋鐪奸暅 JSON锛?- 闊抽閫氶亾锛歀2CAP CID `0x0048`锛?98 瀛楄妭/甯э細
  ```
  [0..7]   8B  榄旀暟澶?87 EF 12 03 07 01 86 08
  [8]      1B  搴忓垪鍙凤紙閫掑锛?  [9..12]  4B  濉厖 00 00 00 00
  [13..396] 384B PCM锛?6bit LE / 16000Hz / 鍗曞０閬擄級
  [397]    1B  濉厖锛堜涪寮冿級
  ```
- 褰曢煶寮€濮嬶細3 鏉?JSON锛坄code:"AudioRecording"` + `wakeupType:"longRecord"` + `uri:"airecord://start"`锛?- 褰曢煶鍋滄锛歚{"type":"PART","codeList":["AudioRecording"]}` + `{"code":"AudioRecording"}`
- 闊抽甯ф彁鍙栧凡**瀛楄妭绾ч獙璇?*涓庡畼鏂?WAV 涓€鑷达紙3402 甯?鈫?1,306,368 瀛楄妭 PCM锛?
### 澶嶇敤 vibeARS
闊抽绠＄嚎 `AudioPipeline`锛圵AV/AAC 缂栫爜銆?min 鍒囩墖銆佸箙搴﹁绠楋級鍙粠
vibeARS 浠撳簱锛坄com.vibears.app.audio` 鍖咃級绉绘锛屼粎鏇挎崲杈撳叆鐐癸細
`audioRecord.read()` 鈫?鐪奸暅 398B 甯ф祦瑙ｆ瀽銆?
---

## 馃殌 寮€鍙戣捣鐐癸紙M1锛?
1. **杩炴帴鍙傛暟**锛氱‘璁?SPP 鏈嶅姟 UUID锛堜粠 `reference/hci_logs/bt_hci_20260830_110332_d.cfa` 鐨?SDP 娈垫彁鍙栵紝瑙?PROTOCOL.md 搂8锛?2. **Android 宸ョ▼**锛欿otlin + Compose锛宮inSdk 26锛宑ompileSdk 34
3. **浼犺緭灞?*锛歚BluetoothDevice.createRfcommSocketToServiceRecord(uuid)` + 璇诲彇寰幆
4. **鍗忚灞?*锛氭彙鎵嬬姸鎬佹満锛圥ROTOCOL.md 搂3锛夆啋 READY
5. **褰曢煶**锛氬彂 3 鏉?JSON 鈫?鏀堕煶棰戝抚 鈫?瑙ｆ瀽 PCM 鈫?鍐?WAV
6. **楠岃瘉**锛氫笌 `reference/official_reference_16000hz_mono.wav` 瀵规瘮

---

## 鈿狅笍 绾︽潫

- **涓嶅湪鏈湴缂栬瘧**锛氭墍鏈夋瀯寤?娴嬭瘯璧?GitHub Actions锛坄.github/workflows/`锛?- 闇€瑕佽摑鐗欐潈闄?+ 宸查厤瀵硅澶?- 鏃ュ織 `.cfa` 瀹為檯鏄?btsnoop 鏍煎紡锛屾敼鍚庣紑 `.log` 鍗冲彲瑙ｆ瀽
