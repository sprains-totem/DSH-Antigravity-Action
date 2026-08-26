# AGENTS.md - DSH Antigravity Action 架构规范与开发指南

> 本指南为运行在本项目中的 AI Agent 以及维护者提供架构全景、开发规范与自我演进准则。

---

## 1. 架构总览与核心设计原则

本项目是基于 **DeepSeek Harness (DSH)** 与 **Cordis 微内核** 构建的云端全自动部署环境，运行在 GitHub Actions Runner（Ubuntu 22.04）上，并通过 Cloudflare Quick Tunnel 与 Cloudflare Worker 向外提供安全 HTTPS 访问。

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions Runner                           │
│                                                                        │
│   .github/workflows/dsh.yml  ──(不可变引导骨架)──►  start.sh (可编程生命周期)│
│                                                            │           │
│                                                            ▼           │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               A/B 槽自愈守护管理器 (start.sh)                   │   │
│   │   • Slot A: ~/.dsh/slots/slot-a (稳定快照)                      │   │
│   │   • 15s 启动健康窗口监控 (崩溃自动秒级回滚)                     │   │
│   └────────────────────────┬───────────────────────────────────────┘   │
│                            │                                           │
│                            ▼                                           │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                   DSH Web 实例 (Port 3080)                     │   │
│   │   • plugins/dsh-llm-antigravity (Gemini 核心与额度看板)        │   │
│   │   • plugins/dsh-mobile-nav (移动端响应式与抽屉化适配)          │   │
│   │   • plugins/dsh-fail-soft (运行时故障隔离与全局异常捕获)       │   │
│   │   • plugins/dsh-cloudflare-tunnel (隧道管理与路由同步)         │   │
│   │   • plugins/dsh-web-search-antigravity / selector (联网搜索)   │   │
│   │   • plugins/dsh-image-gen-antigravity (AI 生图)                │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 关联子项目仓库与组件来源 (Ecosystem Matrix)

本项目作为聚合部署与运行容器，其核心插件与子系统分别由以下开源仓库维护：

1. **[sprains-totem/dsh-Antigravity-Provider](https://github.com/sprains-totem/dsh-Antigravity-Provider)**：
   - 核心 Antigravity 插件套件源代码仓库；
   - 维护 `dsh-llm-antigravity`、`dsh-web-search-antigravity`、`dsh-web-search-selector` 与 `dsh-image-gen-antigravity`。
2. **[sprains-totem/dsh-cloudflare-tunnel](https://github.com/sprains-totem/dsh-cloudflare-tunnel)**：
   - Cloudflare 安全穿透与 Worker 动态路由代码仓库；
   - 维护 `dsh-cloudflare-tunnel` 插件及 Worker 代理脚本。
3. **[sprains-totem/DSH-Antigravity-Action](https://github.com/sprains-totem/DSH-Antigravity-Action)**（本项目）：
   - 负责上述套件的云端聚合装配、A/B 槽自愈生命周期管理与一键部署。

---

## 3. 工作流解耦与 Action 内修改规范 (CRITICAL)

### ⚠️ 权限铁律
* **严禁尝试在 Action 运行期间直接修改 `.github/workflows/dsh.yml`**！
  * **原因**：GitHub Actions 的默认 `GITHUB_TOKEN` 受到平台安全策略保护，严格禁止 Workflow 进程创建或修改 `.github/workflows/` 目录下的任何文件，否则会报 `refusing to allow a GitHub App to create or update workflow without workflows permission` 错误导致 `git push` 失败。
* **修改与扩展全部下沉到 `start.sh`**：
  * `.github/workflows/dsh.yml` 保持为永久不变的轻量启动器；
  * 所有环境依赖（apt/npm）、环境变量、解禁脚本调用、插件复制逻辑、Tunnel 同步参数均在 **`start.sh`** 中进行编辑；
  * `start.sh` 属于普通文件，Agent 在 Action 内部拥有完全的读写与提交权限，可直接 `git add start.sh && git commit && git push`。

---

## 4. A/B 槽位自愈与崩溃保护机制

为了解决“Agent 自我修改（Self-modification）改出语法错误导致重启崩溃掉线”的痛点，本项目内建了双层自愈防护与严密的晋升门禁：

### ① 启动守护（`start.sh` 中的 A/B 槽状态机）
1. **Slot A 稳定快照（安全底盘）**：
   - 启动前，脚本自动将基于 Git 稳定版本的 `cordis.patch.yml`、`plugins/` 和 `unlock-dsh.mjs` 备份至 `~/.dsh/slots/slot-a`；
   - 严禁 Agent 或开发者在开发/修改期间手动直接覆盖 Slot A。
2. **深度健康探针（拒绝仅看进程存活的伪健康）**：
   - 启动 `dsh web` 后，守护程序执行三位一体的深度健康探针：
     - **活体检测**：`kill -0 $PID` 进程存活判定；
     - **HTTP 握手**：探测 `http://127.0.0.1:3080/` 确保端口监听并返回 HTTP 200；
     - **日志断言**：扫描启动日志，确保没有 `fail-soft` 拦截的致命未捕获异常、Cordis 插件缺失或模块加载失败。
3. **敏捷自动回滚**：
   - 若进程在健康判定期内退出，或 HTTP 探针超时、或日志检出致命错误：
     - 捕获最后 20 行异常日志；
     - 立即调用 `rollback_from_slot_a`，将 Slot A 稳定快照全量还原回工作区与 `~/.dsh/profiles/web/`；
     - 重新拉起稳定版本，输出警报并自愈，保障 Web 永远在线。
4. **Git 锚定晋升门禁（解耦自动回滚与盲目晋升）**：
   - **禁止无条件盲目自动晋升**：未崩溃不代表配置正确（如静默软失败、React 白屏、业务逻辑错误）；
   - **双重晋升判定**：仅当 **工作区为干净的已提交状态（Git Commit 确认）** 且 **深度健康探针全部通过** 时，当前代码才允许自动晋升为新的 Slot A 稳定版本；未提交的 Dirty 实验代码保留在工作区运行，但绝不覆盖 Slot A 原始救命基线。

### ② 运行时故障软隔离（`plugins/dsh-fail-soft`）
- 在 Node.js 宿主端监听 `unhandledRejection` 与 `uncaughtException`，防止个别插件的异步错误直接终止 V8 进程；
- 在浏览器客户端监听 `window.error`，防止单个 UI 组件渲染失败造成 React 界面全白屏。

---

## 5. 插件体系与开发指南

所有插件均统一存放在 `plugins/<plugin-name>` 目录下。

### 插件规范结构
```text
plugins/my-plugin/
├── package.json        # 必须声明 type: module, main, exports 及 dsh.client
├── cordis.patch.yml    # (可选) 插件自带的 patch 片段
├── lib/
│   ├── index.js        # Node 宿主半区：导出 name 与 apply(ctx)
│   └── client.js       # (可选) 浏览器半区：导出 inject 与 apply(ctx)
└── src/                # (可选) TypeScript/React 源码
```

### 挂载新插件步骤
1. 在 `plugins/` 下新建或构建插件目录；
2. 在项目根目录的 `cordis.patch.yml` 中的 `- insert:` 列表中追加插件项：
   ```yaml
   - insert:
       - id: my-plugin
         name: dsh-my-plugin
         config:
           enabled: true
   ```
3. 执行 `start.sh`（或在已启动实例中触发重启）；`start.sh` 会自动将 `plugins/*` 镜像复制到 `~/.dsh/profiles/web/plugins/` 和 `node_modules/`。

---

## 6. 移动端 UI 适配指南 (`dsh-mobile-nav`)

本项目集成了 `@dsh-external/dsh-mobile-nav`，为手机和窄屏设备提供丝滑的触屏操作：

1. **断点规范**：
   - 统一断点为 `(max-width: 1023px)`；
   - $\ge 1024\text{px}$ 必须为 **完全零副作用（Complete no-op）**，绝不影响桌面端原有布局。
2. **触屏手势与交互处理**：
   - 使用 `PointerEvent.pointerType === 'touch'` 感知手指输入，不要使用静态 UA 嗅探；
   - 避免直接在 `pointerup` 同步关闭抽屉，以防 iOS Safari 丢失后续合成的 `click` 事件；采用监听 `aria-selected` 变动或微任务自愈检测。
3. **样式与安全区**：
   - 顶部和底部必须使用 `env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)` 避让刘海与手势条；
   - 对超长 JSON 响应由宿主端的 `compress.js` 自动进行 Brotli/Gzip 压缩。

---

## 7. 核心解禁补丁 (`unlock-dsh.mjs`) 维护规范

`unlock-dsh.mjs` 负责在每次启动前自动为 DSH 核心包打入针对云端/反向代理环境的解禁补丁：
- **网络与权限**：解开 `isLoopbackHostname`、`isTrustedApiRequest`，允许外部反代与非 127.0.0.1 访问；
- **设置页解锁**：将 `SettingsScopeController` 强制设为 `host`，使远程客户端能够自由编辑设置；
- **凭据文件权限**：跳过 Linux 下 `.credentials.yaml` 严格的 0600 所有者权限报错（防止 CI 容器内报错崩溃）；
- **多模态与附件**：放宽 Composer 对音视频、PDF 等多模态文件的上传与预览类型限制。

若升级上游 `@deepseek-ai/dsh` 导致哈希或函数签名变化，应优先检查并更新 `unlock-dsh.mjs` 中的匹配规则。
