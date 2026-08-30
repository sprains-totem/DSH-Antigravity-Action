# vibeQwenGlasses — 千问 G1 眼镜录音 APP 架构设计（Android 原生版）

> 版本: v0.2（架构草案 · Android 原生）
> 状态: 待评审
> 变更记录: v0.2 移除 iOS/Flutter，改为纯 Android 原生（Kotlin），音频输入源从麦克风替换为眼镜蓝牙流

---

## 1. 项目定位

**纯 Android 原生 APP（Kotlin + Jetpack Compose）**，直连千问 G1 眼镜，绕开官方 APP 实现：

| 功能 | 说明 |
|------|------|
| 连接眼镜 | 经典蓝牙 RFCOMM/L2CAP，复现私有握手协议 |
| 录音开始/结束 | 发送 `airecord://start` / `PART` 指令控制 |
| 音频流接收 | 监听 CID 0x0048 数据通道，解析 398B 帧 |
| 本地保存 | PCM → WAV / AAC/M4A 落盘（复用 vibeARS 管线） |
| 录音播放器 | 完整播放器（变速/循环/跳转/波形） |
| 后台录音 | 前台服务 + WakeLock（复用 vibeARS 模式） |

**不包含**：iOS（系统不开放经典蓝牙，已放弃）、Flutter UI（改原生）。

---

## 2. 核心设计决策

### 2.1 复用 vibeARS 音频引擎，替换唯一输入点

vibeARS 的 `AudioPipeline`（vibeARS/android/.../audio/AudioPipeline.kt）是**完全自包含**的：
- 输入：`AudioRecord.read()` 产生的 PCM 字节流
- 输出：WAV（RIFF 头写入 + 封口）/ AAC-M4A（MediaCodec+MediaMuxer）、5 分钟无缝切片、幅度/分贝计算、实时上行 AAC

**改造方案**：保持管线输出侧不变，把 `recordLoop()` 中 `audioRecord.read()` 这一个输入点替换为眼镜蓝牙流：

```
vibeARS 原输入                           vibeQwenGlasses 新输入
┌─────────────────────┐                 ┌──────────────────────────────┐
│ AudioRecord (麦克风) │    ──替换──▶    │ GlassesBtTransport (蓝牙)     │
│  48kHz/16bit/立体声  │                 │  16kHz/16bit/单声道 PCM 帧流  │
└─────────┬───────────┘                 └──────────────┬───────────────┘
          │  ShortArray/ByteArray PCM                   │  398B 帧 → 384B PCM
          ▼                                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ AudioPipeline（复用：WAV/AAC 编码、切片、幅度/分贝、Watchdog）       │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 只做 Android

- Android 经典蓝牙（RFCOMM/L2CAP）对第三方 APP 开放 → 全功能直连。
- iOS CoreBluetooth 仅支持 BLE，无法访问经典蓝牙私有通道 → **不做 iOS**。

---

## 3. 总体架构（分层）

```
┌───────────────────────────────────────────────────────────────┐
│                      UI 层 (Jetpack Compose)                  │
│  ConnectScreen · RecordScreen(实时波形/计时) · RecordingsList │
│  PlayerSheet(变速/循环/跳转/波形)                              │
├───────────────────────────────────────────────────────────────┤
│                    ViewModel / 状态层                          │
│  ConnectionViewModel · RecordingViewModel · PlayerViewModel   │
│  连接状态 · 录音状态 · 音频缓冲 · 播放状态                     │
├───────────────────────────────────────────────────────────────┤
│                  Service 层 (前台服务, 保活)                   │
│  GlassesConnectionService                                    │
│   ├─ 持有蓝牙连接 + 协议会话（进程存活期）                     │
│   ├─ WakeLock / 通知栏（复用 vibeARS AudioCaptureService 模式）│
│   └─ 自动重连（眼镜唤醒后恢复）                               │
├───────────────────────────────────────────────────────────────┤
│                    协议层 (纯 Kotlin, 可单测)                  │
│  QwenProtocol                                                    │
│   ├─ HandshakeStateMachine  握手状态机                         │
│   ├─ CommandBuilder         指令构造(start/stop/query)         │
│   ├─ EventParser            事件解析(record_start/end等)       │
│   └─ FrameParser            398B 音频帧解析                    │
├───────────────────────────────────────────────────────────────┤
│                    传输层 (Android 蓝牙)                       │
│  ClassicBtTransport (RFCOMM socket)                           │
│   ├─ connect(addr, uuid) / write(bytes) / readLoop()          │
│   └─ 数据流: 控制通道 JSON + 音频通道 398B 帧                  │
├───────────────────────────────────────────────────────────────┤
│                    音频管线 (复用/移植 vibeARS)                │
│  AudioPipeline (WAV/AAC 切片编码) ← PCM 来自 FrameParser       │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. 模块详细设计

### 4.1 传输层 `ClassicBtTransport.kt`

```
class ClassicBtTransport(
    private val device: BluetoothDevice,
    private val sppUuid: UUID           // 待从 SDP 日志确认
) {
    fun connect(): Boolean              // createRfcommSocketToServiceRecord + connect
    fun write(data: ByteArray)          // 指令下发（JSON 文本）
    fun startReadLoop(callback: (ByteArray) -> Unit)  // 持续读取
    fun disconnect()
}
```

**关键点**：
- 连接方式：`createRfcommSocketToServiceRecord(uuid)`；UUID 需从 HCI 日志 SDP 段或官方 APP 反编译确认（未知项 #1）。
- 读取循环需**区分两种数据流**（同一 socket 或不同 channel，待确认）：
  - 控制 JSON（CID 0x0041/0x004A 内容）
  - 音频帧（CID 0x0048 内容，398B/帧）
- 若为不同 RFCOMM 通道，则需两次 `createRfcommSocketToServiceRecord` 或使用 `createL2capChannel`（Android 10+）。

### 4.2 协议层 `QwenProtocol`（纯 Kotlin）

```
com.vibeqwen.glasses.protocol/
├── QwenConstants.kt      # CID、魔数头 87 EF 12 03 07 01 86 08、固定参数
├── QwenHandshake.kt      # 握手状态机
├── QwenCommands.kt       # startRecord()/stopRecord()/queryDevice()
├── QwenEvents.kt         # 事件解析
└── QwenFrameParser.kt    # 398B 帧 → 384B PCM (+ 序列号校验)
```

**握手状态机**（含异常路径）：
```
IDLE → DEVICE_QUERY → MESSAGE_ID → AUTH_RESP → SESSION_SETUP
     → SN_AUTH → ATTACH_SUCCESS → READY
READY → RECORD_STARTED → RECORDING → RECORD_STOPPED → READY
任何状态 → ERROR → reconnect(backoff)
```

详细协议规格见 [PROTOCOL.md](./PROTOCOL.md)（逆向成果完整存档）。

### 4.3 音频管线 `AudioPipeline`（移植 vibeARS）

**复用代码**（从 vibeARS 复制并改造输入点）：
- `openNextSlice()` / `closeCurrentSlice()` / `writeWavHeader()` → WAV 切片
- `configureAacEncoder()` / `encodeAacFrame()` / `drainAacOutputs()` → AAC/M4A
- 幅度/分贝计算、Watchdog（无数据告警）
- 输出目录：`/storage/emulated/0/Music/vibeQwenGlasses`（沿用 vibeARS 公共目录优先原则）

**改动点**：
```
recordLoop() 中:
  val readCount = audioRecord.read(...)      // 原: 麦克风
  ↓
  val pcmBlock = frameParser.nextPcmBlock()  // 新: 眼镜帧流
```
- 采样率硬编码 16000、单声道（眼镜协议固定）。
- 帧序号连续性检测：丢帧时在 WAV 中插入静音或记录丢帧标记（待定）。

### 4.4 前台服务 `GlassesConnectionService`

移植 vibeARS `AudioCaptureService` 模式：
- 录音期间 `startForeground`（通知类型视用途：`FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE` 或 `MICROPHONE`）
- `PARTIAL_WAKE_LOCK`（24h 上限）
- 服务持有 `ClassicBtTransport` + `AudioPipeline`，Activity 通过 Binder 绑定

### 4.5 UI 层（Jetpack Compose）

| 屏幕 | 内容 |
|------|------|
| ConnectScreen | 已配对设备列表（`BluetoothAdapter.getBondedDevices` 过滤 G1）、连接/断开、状态指示 |
| RecordScreen | 大录音按钮、实时波形（自定义 Canvas）、计时、分贝表 |
| RecordingsScreen | 录音列表（文件名/时长/大小）、删除、分享、ZIP 导出 |
| PlayerSheet | 播放器：0.5x-2.0x 变速、±10s 跳转、循环/单曲、波形进度条（移植 vibeARS 播放器功能） |

---

## 5. 目录结构（目标）

```
vibeQwenGlasses/
├── .github/workflows/build-and-release.yml   # CI/CD: Android APK 自动构建发布
├── app/
│   ├── build.gradle                          # compileSdk 34, minSdk 26
│   └── src/main/
│       ├── AndroidManifest.xml               # 蓝牙权限 + 前台服务声明
│       └── kotlin/com/vibeqwen/glasses/
│           ├── MainActivity.kt
│           ├── ui/
│           │   ├── theme/Theme.kt
│           │   ├── connect/ConnectScreen.kt + ConnectViewModel.kt
│           │   ├── record/RecordScreen.kt + RecordViewModel.kt
│           │   ├── recordings/RecordingsScreen.kt + RecordingsViewModel.kt
│           │   └── player/PlayerSheet.kt + PlayerViewModel.kt
│           ├── service/GlassesConnectionService.kt
│           ├── bluetooth/
│           │   ├── ClassicBtTransport.kt
│           │   └── DeviceScanner.kt
│           ├── protocol/
│           │   ├── QwenConstants.kt
│           │   ├── QwenHandshake.kt
│           │   ├── QwenCommands.kt
│           │   ├── QwenEvents.kt
│           │   └── QwenFrameParser.kt
│           └── audio/
│               ├── AudioPipeline.kt          # 移植自 vibeARS（输入点替换）
│               ├── WavWriter.kt
│               └── SliceManager.kt
├── docs/
│   ├── ARCHITECTURE.md                       # 本文档
│   └── PROTOCOL.md                           # 逆向协议规格（完整存档）
├── tools/
│   ├── analyze_recording.js                  # HCI 日志分析脚本（保留）
│   └── extract_audio.js                      # 音频帧提取/验证脚本（保留）
└── reference/
    └── 11_05 .wav                            # 官方 APP 导出参考录音（对照样本）
```

---

## 6. 数据流（录音场景）

```
用户点击"开始录音"
  │
  ▼
RecordViewModel.startRecording()
  │
  ▼
QwenCommands.startRecord(sessionId, taskLinkId)  →  JSON 字节
  │
  ▼
ClassicBtTransport.write(bytes)  →  蓝牙 → 眼镜
  │
  ▼
眼镜响应 → 事件流 {"eventName":"record_start"}  →  EventParser → 状态=RECORDING
  │
  ▼
眼镜推送音频流 → CID 0x0048 → readLoop  →  QwenFrameParser
  │                                                  │ 398B/帧
  ▼                                                  ▼
状态更新/UI 波形 ◄── onAudioFrame(pcm, amp, db) ◄── 384B PCM
  │
  ▼
AudioPipeline（WAV 或 AAC 编码 + 切片写入）
  │
  ▼（用户点击停止）
QwenCommands.stopRecord() → PART → record_end → 封口 WAV/M4A → 列表刷新
```

---

## 7. 权限清单（Android）

| 权限 | 用途 |
|------|------|
| `BLUETOOTH_CONNECT` (API 31+) | 连接/读写经典蓝牙 |
| `BLUETOOTH_SCAN` (API 31+) | 设备发现 |
| `BLUETOOTH` / `BLUETOOTH_ADMIN` (API 30-) | 旧版本兼容 |
| `ACCESS_FINE_LOCATION` (API 30-) | 旧版本蓝牙扫描前提 |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_CONNECTED_DEVICE` | 前台服务 |
| `POST_NOTIFICATIONS` (API 33+) | 通知栏 |

---

## 8. 里程碑

| 阶段 | 内容 | 验收标准 |
|------|------|---------|
| **M0** | 架构定稿 + 协议文档 | 本文档 + PROTOCOL.md |
| **M1** | Android 连接 + 握手 | 能连上眼镜、完成 attach_success、收到心跳事件 |
| **M2** | 录音开始/结束 + 音频落盘 | 录出 WAV 且与官方 APP 导出字节级一致 |
| **M3** | 录音列表 + 播放器 | 完整 MVP |
| **M4** | 稳定性：重连/断流/长录音/后台 | 可日常使用 |
| **M5** | 扩展：AAC、切片、分享/ZIP、云同步 | 完整版 |

---

## 9. 未知项与实现前确认清单

| # | 未知项 | 确认方法 | 影响 |
|---|--------|---------|------|
| 1 | 眼镜 SPP 服务 UUID / 数据通道 UUID | HCI 日志 SDP 段 / 官方 APP 反编译 | 连接建立方式（M1 前置） |
| 2 | 控制 JSON 与音频帧是否同一条 RFCOMM 流 | 实测抓流 | 传输层单/双通道设计 |
| 3 | 握手是否校验 `active_data` | 实验跳过 | 简化握手 |
| 4 | 录音时长上限 / 断流行为 | 实测 | 可靠性设计 |
| 5 | 长录音时音频帧序号回绕/丢帧 | 实测 | 丢帧补偿策略 |
| 6 | 眼镜固件更新是否变更协议 | 版本比对 | 兼容表 |

---

## 10. 风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| SPP UUID 未知导致连不上 | 高 | 解析 HCI 日志 SDP 段（M1 前置任务）；反编译官方 APP 双保险 |
| 协议带加密/签名 | 中 | HCI 证据表明 JSON 明文；若加密则 Frida 提取密钥 |
| 官方 APP 与第三方并发连接冲突 | 中 | 测试独占/共存行为；连接时提示用户断开官方 APP |
| 固件更新变更协议 | 中 | 协议层隔离 + 版本兼容表 |
| 长录音丢帧 | 低 | 帧序号检测 + 静音补偿 |

---

## 11. 下一步行动

1. 评审本文档
2. **解析 HCI 日志 SDP 段，确认 SPP UUID**（M1 前置，我可以先做）
3. 搭 Android 工程骨架（Gradle + Compose）
4. 移植 vibeARS AudioPipeline + 实现 ClassicBtTransport（M1）
