# 千问 G1 眼镜私有蓝牙协议规格书（逆向成果）

> 来源：vivo 手机 `bt_hci_*.cfa`（实际为 btsnoop 格式）HCI 日志分析
> 验证：音频流提取结果与官方 APP 导出的 WAV **字节级一致**（已验证）
> 日期：2026-08-30
> 状态：已确认，可据此实现客户端

---

## 1. 硬件与连接架构

```
千问G1 眼镜（恒玄 BES2800 RTOS 协处理器 + 高通骁龙 AR1 Android 主芯片）
    │
    ├── 经典蓝牙 BR/EDR (蓝牙 5.3 双模)
    │     ├── 控制连接 (ACL Handle 0x0001)
    │     │     ├── L2CAP CID 0x0041   眼镜→手机  事件/状态/心跳 JSON
    │     │     ├── L2CAP CID 0x004A   手机→眼镜  指令/配置/应答 JSON
    │     │     ├── L2CAP CID 0x0048   私有数据通道（HFP AT 命令 + 录音音频流）
    │     │     └── L2CAP CID 0x0004   BLE ATT（仅少量控制包，无音频）
    │     └── 数据连接 (ACL Handle 0x0EDC, 大流量)
    │           └── 多路复用 0xXXff CIDs（传感器/遥测/其他）
    │
    └── BLE（低功耗，发现/配对辅助）

手机 APP（本项目客户端）
    └── 经典蓝牙 RFCOMM/L2CAP
          ├── 控制通道 → JSON 协议层
          └── 数据通道 → 398B 音频帧解析
```

---

## 2. 关键常量

| 常量 | 值 | 说明 |
|------|-----|------|
| 眼镜 ODM 标识 | `AILABS_SG02_QW` | 握手时眼镜上报 |
| 产品型号 | `Quark_glasses` / `ro.product.model=AILABS_SG02_QW` | 属性查询 |
| 设备类型 | `bes2800` | 事件中的 deviceType |
| 固件版本 | `1.10.0-RS-20260826.0248` | 事件上报 |
| pid | `8665` | 连接参数上报 |
| 设备SN | `D5A74C04894A4E70C2AE0BDC687904FE` | type:1103 认证 |
| 眼镜 MAC（示例） | `22:c1:37:10:6e:b4` | peerAddr 上报 |
| 音频帧魔数头 | `87 EF 12 03 07 01 86 08` | 每帧前 8 字节 |
| 音频帧总长 | `398` 字节 | 固定 |
| 有效 PCM | `384` 字节/帧 | 16bit LE / 16000Hz / 单声道 |

---

## 3. 握手流程（连接建立 → READY）

时序（时间戳为相对日志起点毫秒）：

```
[3676ms] 手机→眼镜  CID 0x004A  {"device":[]}
[3689ms] 手机→眼镜  CID 0x004A  {"device":[]}
[3689ms] 手机→眼镜  CID 0x004A  {}
[3737ms] 手机→眼镜  CID 0x004A  {"device":[{"identifier":"calendarSync",
              "value":"{\"calendarSyncEnable\":false,\"notificationSyncEnable\":false,\"scheduleEnable\":false}"}]}
[3738ms] 手机→眼镜  CID 0x004A  {"messageId":"1788059130049","phoneType":1,"supportHeicDecode":1}
[3875ms] 眼镜→手机  CID 0x0041  {"eventContext":{"taskLayer":{"current":{},"background":[]}}}
[3876ms] 眼镜→手机  CID 0x0041  {"messageId":"1788059130049","setMessageResult":1}
[4804ms] 眼镜→手机  CID 0x0041  {"reset":false,"active_data":"656D4B74446A73536C74705A774D646ABC5F5A5F7894355744B0393B3B13A03C",
              "odm":"AILABS_SG02_QW"}
[4835ms] 眼镜→手机  CID 0x0041  {"pairAdv":false,"reset":false,"pid":8665,
              "sppChanBitMap":6442467520,"iapChanBitMap":6442467520,
              "addrType":0,"peerAddr":"22:c1:37:10:6e:b4"}
[4863ms] 眼镜→手机  CID 0x0041  {"type":10001,"arg1":1,"arg2":1}
[4911ms] 手机→眼镜  CID 0x004A  {"type":10001,"arg1":1,"arg2":1}
[4912ms] 手机→眼镜  CID 0x004A  {"sessionId":4196571}
[4914ms] 手机→眼镜  CID 0x004A  {"support":true}
[6457ms] 手机→眼镜  CID 0x004A  {"type":1103,"arg1":1,"arg2":0,"data":"D5A74C04894A4E70C2AE0BDC687904FE"}
[6461ms] 手机→眼镜  CID 0x004A  {"code":1,"msg":"attach_success"}
[6462ms] 手机→眼镜  CID 0x004A  {"feature":{"app":[{"i":"AIPay",...},{"i":"AudioRecording","m":"2.0","v":"2.0"},
              {"i":"AudioRecordingPlus","m":"2.0","v":"2.0"},...]}}
[6537ms] 手机→眼镜  CID 0x004A  {"props":["ro.product.model","ro.product.brand"]}
[6693ms] 眼镜→手机  CID 0x0041  {"ro.product.model":"AILABS_SG02_QW","ro.product.brand":"Quark_glasses"}
[6755ms] 眼镜→手机  CID 0x0041  {"eventNs":"AliGenie.System","eventName":"SynchronizeState",
              "payLoad":{"contexts":{"system":{"cfgVersion":"20180328","version":"1.10.0-RS-20260826.0248",
              "sn":"5200002612240211A002181","appVersion":"00"}, ...}}}
[... 大量设置同步 ...]
```

### 3.1 握手消息字段说明

| 字段 | 生成规则 | 备注 |
|------|---------|------|
| `messageId` | 毫秒时间戳字符串 | 收发配对：眼镜回 `setMessageResult:1` |
| `active_data` | 眼镜每次生成的不同 hex | 会话令牌；实验确认是否可忽略 |
| `sessionId` | APP 分配的递增整数 | 每个请求可新开 |
| `phoneType` | 1 | 固定 |
| `supportHeicDecode` | 1 | 固定 |
| `type:1103` 的 `data` | 设备 SN 常量 | 认证 |
| `attach_success` | 眼镜回 `code:1` | 绑定完成标志 |

### 3.2 简化握手建议（待实验验证）

从时序看，`active_data` 是眼镜**主动上报**的而非 APP 计算——客户端可能只需按序发送固定格式的 JSON 即可完成 READY，无需预先知道 token。M1 阶段验证。

---

## 4. 录音控制指令

### 4.1 开始录音（手机 → 眼镜, CID 0x004A, 3 条连续 JSON）

```json
{
  "code": "AudioRecording",
  "data": {"reason": "touch"},
  "extensions": {
    "taskLinkId": "AudioRecording1788061683242FC9658C0DB8D4AD9BF4092EFA469D4E6",
    "bizType": "live"
  },
  "sessionId": "1788061683"
}
{
  "data": {"reason": "touch"},
  "scene": "AudioRecording",
  "sessionId": "1788061683",
  "taskLinkId": "AudioRecording1788061683242FC9658C0DB8D4AD9BF4092EFA469D4E6",
  "wakeupType": "longRecord"
}
{
  "data": {"reason": "touch"},
  "pageType": "SCHEME_AIRECORD_START",
  "sessionId": "1788061683",
  "uri": "airecord://start"
}
```

### 4.2 停止录音（手机 → 眼镜, CID 0x004A）

```json
{"type": "PART", "codeList": ["AudioRecording"]}
{"code": "AudioRecording"}
```

### 4.3 字段生成规则

| 字段 | 规则 |
|------|------|
| `sessionId` | 毫秒时间戳的前 10 位（`1788061683`） |
| `taskLinkId` | `"AudioRecording" + 毫秒时间戳 + 32位大写HEX` |
| `wakeupType` | `longRecord`（长录音） |
| `reason` | `touch`（触控触发） |

### 4.4 眼镜侧录音事件

录音开始/结束时眼镜通过 CID 0x0041 上报事件：
```json
{"eventType":"power-state","eventName":"record_start","contextInfo":{...},"deviceType":"bes2800",...}
{"eventType":"power-state","eventName":"record_end",...}   // 推断，待确认
```

---

## 5. 音频流帧格式（CID 0x0048）

### 5.1 帧布局（398 字节/帧，固定）

```
偏移      长度    内容
─────────────────────────────────────────────────
[0..7]     8B    固定魔数头: 87 EF 12 03 07 01 86 08
[8]        1B    序列号（递增，循环回绕）
[9..12]    4B    填充: 00 00 00 00
[13..396] 384B   PCM 音频（16bit 有符号 LE, 16000Hz, 单声道）
[397]      1B    填充（APP 丢弃此字节）
```

### 5.2 实测样本（前两帧，hex）

```
帧0: 87 EF 12 03 07 01 86 08 5B 00 00 00 00 04 00 04 00 04 00 03 00 ...
帧1: 87 EF 12 03 07 01 86 08 5C 00 00 00 00 01 00 02 00 00 00 00 00 ...
                     └┬┘ └──────┘
                      │    └ 填充 4B
                      └ 序列号 5B→5C 递增
```

### 5.3 数据率

```
帧率: 约 83.33 帧/秒 (16000 Hz ÷ 192 样本/帧)
PCM 码率: 256 kbps
实测流量: ~33 KB/s 净数据 + 帧头 ≈ 33.5 KB/s
40.82s 录音 = 3402 帧 = 1,353,996 字节(含头) = 1,306,368 字节 PCM
```

### 5.4 与官方 WAV 的对应

```
官方导出 11_05.wav: 16000Hz / 单声道 / 16bit / 40.82s / 1,306,368 字节 data
客户端提取:        跳过帧头(前13B)+尾部1B填充 → 384B/帧 × 3402 帧
                  = 1,306,368 字节 → 与官方 WAV 逐字节一致 ✅
```

### 5.5 序列号行为

- 帧内第 9 字节（索引 8）为序列号，从 `0x5B` 起递增，`0x5C, 0x5D, ...` 连续。
- 实测样本无丢帧；长录音中需处理回绕（0xFF → 0x00）与丢帧（序号跳变）。

---

## 6. 其他观测（辅助信息）

### 6.1 HFP AT 命令（CID 0x0048 早期阶段）

连接初期眼镜侧发起标准 HFP 协商（在音频流之前的同一 CID）：
```
AT+BRSF=1023
AT+BAC=1,2
AT+CIND=?
AT+CIND?
AT+CMER=3,0,0,1
AT+CHLD=?
AT+BIND=1,2
AT+VGS=11
AT+NREC=0
AT+CLIP=1
AT+CCWA=1
AT+COPS=3,0
AT+CMEE=1
AT+CNUM
AT+BIEV=2,69
```
说明 CID 0x0048 是 HFP RFCOMM 通道上的复用流：协商期走 AT 命令，录音期走音频帧。**实现时需按内容分发**（`AT+` 开头 → HFP 处理；魔数头 `87 EF...` → 音频帧）。

### 6.2 心跳（CID 0x0041）

眼镜每约 10 分钟上报一次 system heartbeat，含内存/电量/队列统计，可用于连接活性检测。

### 6.3 其他事件（CID 0x0041）

- `wear` / `sport_health` / `input`：传感器事件
- `BTGlass.RssiWarning`：信号强度告警
- `AppTask`：任务状态
- `GlassPlayer`：媒体播放状态
- `fileCount`/缩略图同步：图片同步

---

## 7. 工具脚本说明

仓库 `tools/` 下保留的分析脚本（Node.js，无需依赖）：

| 脚本 | 用途 | 用法 |
|------|------|------|
| `analyze_recording.js` | 解析 btsnoop HCI 日志：逐秒流量、CID 统计、JSON 消息、HFP 命令 | `node analyze_recording.js <bt_recording.log>` |
| `extract_audio.js` | 从日志提取 CID 0x0048 音频帧 → 重组 PCM → 验证/生成 WAV | `node extract_audio.js <bt_recording.log>` |

> 说明：vivo 的 `.cfa` 文件头为 `btsnoop\0`，**只需改扩展名为 `.log` 即可被 Wireshark / 脚本直接解析**。

---

## 8. 设备地址与 SDP 服务发现分析

> 补充发现（2026-08-30 第二轮 bugreport 分析）

### 8.1 设备 MAC 地址（重要修正）

| 地址 | 身份 | 证据 |
|------|------|------|
| `B4:6E:10:37:C1:22` | **vivo 手机自身**的蓝牙地址 | dump 文本 `[persist.vendor.service.bdroid.bdaddr]: [b4:6e:10:37:c1:22]`，`SETTINGS_SECURE bluetooth_address` |
| `A0:FB:C5:21:9B:20` | **眼镜**的蓝牙 MAC | HCI 日志中 `BTGlass.RssiWarning` 事件的 `RemoteMAC` 字段 |

> ⚠️ 注意：之前误以为 `B4:6E:10:37:C1:22` 是眼镜 MAC（它出现在 `hfpVoiceLauncher` 配置值里），实际它是**手机自己的地址**。握手时眼镜上报的 `peerAddr: 22:c1:37:10:6e:b4` 才是眼镜侧视角下的手机地址（字节反转）。**眼镜真实 MAC 为 `A0:FB:C5:21:9B:20`**。

### 8.2 SDP 服务发现（CID 0x0001）

从 HCI 日志提取了 SDP 通道（L2CAP CID 0x0001）的 130 个包。SDP 流程为标准的 `ServiceSearchRequest` → `ServiceAttributeRequest` 序列，属性响应中出现的 16-bit UUID 片段：

```
SDP pkt 30:   ... 01 02 9b 06        → UUID 0x069B?
SDP pkt 101:  ... 01 02 f0 03 04 09 03 0a 14 00 00 00 00 f2 03
SDP pkt 109:  ... 01 02 fd 03 04 09 03 05 03 d0 07 e0 2e 96 02
SDP pkt 110:  ... 04 09 03 05 03 d0 07 e0 2e 96 02
```

**初步判定**：SDP 中包含标准服务 UUID 及厂商自定义 UUID（`0xF003`/`0x03FD` 等为厂商私有段）。完整 UUID 列表需对 SDP 属性响应做完整解析（Data Element 解包），建议实现 M1 时用 `tools/` 中的脚本或 Wireshark 对 `reference/hci_logs/` 下日志做 SDP 过滤确认。

### 8.3 待办（连接参数确认）

- 从 `bt_hci_20260830_110332_d.cfa`（连接建立早期）提取 SDP ServiceSearch 请求的服务类 UUID 列表
- 确认眼镜暴露的 RFCOMM 服务 UUID（SPP `0x1101`？厂商自定义？）
- 该 UUID 即 `BluetoothDevice.createRfcommSocketToServiceRecord(uuid)` 所需参数

---

## 9. 待确认事项（开发前置）

| # | 事项 | 说明 |
|---|------|------|
| 1 | SPP 服务 UUID | 从 HCI 日志 SDP 段提取（M1 前置，需要原始日志） |
| 2 | `active_data` 是否可忽略 | 实验：不发该响应是否仍 READY |
| 3 | 录音停止事件名 | 实测确认 `record_end` 或类似事件 |
| 4 | 长录音/断流行为 | 长时间实测 |
| 5 | 官方 APP 共存 | 第三方连接时官方 APP 是否可用 |
