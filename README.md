# vibeQwenGlasses

直连千问 G1 眼镜（绕过官方 APP）的 **Android 原生录音应用**。

## 功能

- 🔗 经典蓝牙直连眼镜，复现私有握手协议
- 🎙️ 录音开始 / 结束（`airecord://start` 指令）
- 💾 音频流接收（398B 帧 → PCM，按魔数头匹配动态 CID）→ WAV / AAC/M4A
- ▶️ 完整录音播放器（变速 / 循环 / 跳转 / 波形）
- 📂 录音列表、删除、分享、ZIP 导出
- 🔋 前台服务 + WakeLock 后台录音

## 技术栈

- **纯 Android 原生**: Kotlin + Jetpack Compose
- **协议**: 千问 G1 私有蓝牙协议（详见 [docs/PROTOCOL.md](docs/PROTOCOL.md)）
- **音频管线**: 移植自 [vibeARS](https://github.com/sprains-totem/vibeARS)（输入源由麦克风替换为眼镜蓝牙流）

## 文档

- [架构设计](docs/ARCHITECTURE.md) — 分层架构、模块设计、里程碑
- [协议规格](docs/PROTOCOL.md) — 逆向成果完整存档（握手 / 指令 / 帧格式 / SDP 分析）
- [组合测试报告](docs/combo_test_report.md) — 4 种发起/结束组合的录音还原验证
- [tools/](tools/) — HCI 日志分析脚本（Node.js）
- 协议 / 架构 / 测试报告完整存档（原始抓包与录音样本仅本地保留，不入库）

## 逆向进展

- ✅ 协议破解：控制通道（CID 0x0041/0x004A JSON）+ 音频通道（398B 帧 = 8B魔数 + 1B序号 + 4B填充 + 384B PCM + 1B填充）
- ✅ 音频还原与官方 APP 导出**字节级一致**（3402 帧验证）
- ✅ 4 种录音组合（眼镜/手机 发起 × 眼镜/手机 结束）全部还原成功
- ✅ 双模型交叉验证（deepseek-v4-flash 与 hy3 独立还原，结果字节级一致）
- ✅ 关键修正：音频 CID 是**动态**的（0x0047/0x0048 因连接而异），实现须按魔数头匹配

## 状态

代码已落地（M0–M3 完成，M4/M5 部分）：

- [x] 协议逆向完成（字节级验证 + 双模型交叉验证）
- [x] 组合测试验证（4 种发起/结束方式）
- [x] M1: Android 连接 + 握手（`bluetooth/` + `protocol/`）
- [x] M2: 录音开始/结束 + 音频落盘（`audio/` + `service/`）
- [x] M3: 录音列表 + 播放器（Compose UI）
- [~] M4: 稳定性（断开自动保存已实现；自动重连待实测）
- [~] M5: 扩展（AAC/M4A、5 分钟切片已实现；ZIP 导出待做）

## 构建

CI（`.github/workflows/build-and-release.yml`）在主分支 push 时自动构建并上传
`app-release.apk`（debug 签名，可直接安装）与 `app-debug.apk`：

```bash
# 本地（环境不支持时改走 CI）
./gradlew assembleDebug assembleRelease
```