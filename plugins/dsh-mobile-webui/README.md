# dsh-mobile-webui

专为 **DeepSeek Harness (DSH)** 打造的独立、原生移动端专属 WebUI 插件（挂载于 `/mobile`）。

---

## 🌟 核心特性

1. **独立 `/mobile` 专属访问路径**：
   - 彻底摆脱在桌面端臃肿 DOM 上打补丁的局限；
   - 桌面端访问 `/` 保持完整工作台，手机端访问 `/mobile` 体验毫秒级秒开的触屏界面。
2. **移动端原生轨迹时间线（Trajectory & Trace Timeline）**：
   - 垂直折叠式执行流卡片（Bash、文件读写/编辑、搜索、子任务）；
   - 清晰的状态图标与实时耗时显示；
   - **触控底栏抽屉（Bottom Sheet Inspector）**：点击任意工具调用一键滑出入参、完整执行日志，自带代码换行与复制功能。
3. **即时乐观回显（Optimistic Echo）**：
   - 发送消息 0 毫秒上屏，彻底解决手机端因长连接等待而导致的消息“发了看不见、必须刷新”的痛点。
4. **移动端生命周期自愈与保活**：
   - 监听 `visibilitychange` 与 `focus` 事件：手机锁屏解锁、切回应用时自动静默握手重连与差量同步；
   - 周期性心跳探测，有效避免移动运营商 CGNAT 与 Cloudflare 100 秒空闲超时断连。
5. **多智能体（Subagents）与人机协同（HITL）**：
   - 底部滑入式权限审批面板（Approvals）；
   - 原生多选/单选用户提问交互（Ask User Question）；
   - 任务规划与清单看板（Goal & Todo Plan View）。

---

## 🛠️ 构建与测试

```bash
# 构建生产包
pnpm run build

# 运行无头浏览器自动化端到端测试
pnpm test
```
