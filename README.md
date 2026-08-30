# vibeQwenGlasses

直连千问 G1 眼镜（绕过官方 APP）的 **Android 原生录音应用**。

## 功能

- 🔗 经典蓝牙直连眼镜，复现私有握手协议
- 🎙️ 录音开始 / 结束（`airecord://start` 指令）
- 💾 音频流接收（CID 0x0048，398B 帧 → PCM）→ WAV / AAC/M4A
- ▶️ 完整录音播放器（变速 / 循环 / 跳转 / 波形）
- 📂 录音列表、删除、分享、ZIP 导出
- 🔋 前台服务 + WakeLock 后台录音

## 技术栈

- **纯 Android 原生**: Kotlin + Jetpack Compose
- **协议**: 千问 G1 私有蓝牙协议（详见 [docs/PROTOCOL.md](docs/PROTOCOL.md)）
- **音频管线**: 移植自 [vibeARS](https://github.com/sprains-totem/vibeARS)（输入源由麦克风替换为眼镜蓝牙流）

## 文档

- [架构设计](docs/ARCHITECTURE.md) — 分层架构、模块设计、里程碑
- [协议规格](docs/PROTOCOL.md) — 逆向成果完整存档（握手 / 指令 / 帧格式）
- [tools/](tools/) — HCI 日志分析脚本（Node.js）
- [reference/](reference/) — 官方 APP 导出参考录音（对照验证样本）

## 状态

架构定稿中（M0）。当前进度：

- [x] 协议逆向完成（字节级验证）
- [ ] M1: Android 连接 + 握手
- [ ] M2: 录音开始/结束 + 音频落盘
- [ ] M3: 录音列表 + 播放器（MVP）
- [ ] M4: 稳定性（重连 / 断流 / 长录音 / 后台）
- [ ] M5: 扩展（AAC、切片、分享 / ZIP、云同步）
