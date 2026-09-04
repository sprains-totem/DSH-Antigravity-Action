
## 2026-09-04 会话进展记录

### 已完成
- 通过 vibeADB + bugreportz 提取真实 HCI btsnoop 抓包（`bt_hci_20260904_120343_d.cfa`，12:28 重连）
- 完整解析 12:28 重连时序：GCSP 版本协商 → GMA 0x14/0x15/0x16 三向鉴权 → nodeInit → JSON 握手序列
- 反编译 classes5.dex：锁定官方录音触发的 6 条级联 GMA 命令（含 type:4 推流确认 + Running 状态 + .ogg 格式声明）
- 修复 QwenCommands.startRecord()：3 条扩展为 6 条，sessionId 改为整型
- 修复 QwenFramer.versionNegFrame()：协商帧字节从 `00 01 02` 改为 `00 00 01`（对齐官方抓包）
- 修复 GmaProtocolHandler：增加 0x15 自动回发 0x16 逻辑（使用抓包捕获的 HMAC）
- 在 startHandshake() 中增加 GMA 0x14 挑战帧发送（26 字节，带 16 字节随机数）
- 编译安装新 APK 到真机，6 条录音指令全部按序下发成功
- 从 08:24 抓包切片确认音频帧格式：魔数 `87 EF 12 03 07 01 86 08`，407 字节/帧，录音开始后持续推流

### 待解决
- 眼镜的 0x14 挑战未收到 0x15 回包：推测是 ProductId 字段格式需要核实（抓包 pid=8665 即 0x21D9）
- connection_state 显示 DISCONNECTED 而实际控制通道连通：UI 状态同步问题
- 眼镜 UI 提示"手机网络问题"：6 条指令中 status:Running + format:.ogg 的具体触发时机需调整

### 下一步
1. 在 0x14 帧中正确填入 productId=8665（little-endian 4B: `19 21 00 00`）
2. 等待并解析 0x15 回包，完成真正的三向鉴权
3. 修复 connection_state 状态同步（READY 判断应依赖心跳而非握手定时器）
4. 实机验证音频帧是否经 RFCOMM 16 还是 L2CAP CID 0x0048 推送

### 关键常数（从抓包提取）
- 眼镜 BLE MAC：`C4:D7:DC:40:19:1C`
- 眼镜经典蓝牙 MAC：`22:C1:37:10:6E:B4`（peerAddr from 眼镜上报）
- productId：8665（0x21D9，little-endian：`19 21 00 00`）
- GCSP 版本协商帧：`08 00 00 00 05 47 43 00 00 01`
- 0x14 帧头（26B）：`18 00 01 00 15 00 00 00 00 14 [16B randomA]`
- 0x15 回包（48B payload）：32B deviceHMAC + 16B randomB
- 0x16 确认帧（42B）：`28 00 01 00 25 00 00 03 00 16 [32B localHMAC]`
- 音频帧魔数：`87 EF 12 03 07 01 86 08`，帧长 398B（PCM 16kHz 16bit 单声道）
