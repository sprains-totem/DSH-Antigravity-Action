# EasyTier 异地组网插件 (`dsh-easytier`)

基于 [EasyTier](https://github.com/EasyTier/EasyTier) 去中心化 P2P / Mesh 虚拟局域网构建的 DeepSeek Harness (DSH) 外联插件。

本插件特别针对 GitHub Actions Runner 以及各种无特权容器环境设计，原生支持 **No-TUN 用户态模式 (`--no-tun`)**，无需内核 `/dev/net/tun` 设备或 `CAP_NET_ADMIN` / Root 权限，即可实现容器内 HTTP Web 服务向异地虚拟局域网的透明暴露与双向互联。

---

## 🌟 核心特性

1. **容器友好免特权 (No-TUN 模式)**：
   - 依赖 EasyTier 内置的用户态网络栈 (`smoltcp`)，绕过 Linux 内核虚拟网卡要求；
   - 虚拟网内的其他设备可直接通过分配的虚拟 IP（如 `http://10.144.144.1:3080`）访问 DSH Web GUI。
2. **多通道参数与 GitHub Actions 传参**：
   - 支持通过 GitHub Actions 环境变量或 Action 输入传参（如 `EASYTIER_NETWORK_NAME` 等）；
   - 支持在 DSH 网页前端「设置 (Settings) -> EasyTier」可视化面板中动态配置与保存。
3. **安全透明与上下文集成**：
   - 自动将节点虚拟 IP 加入 DSH WebRuntime `trustedHosts` 白名单，防止外部跨域拦截；
   - 自动注入 `systemPrompt`，让 AI Agent 获知自身的 EasyTier 虚拟网访问地址；
   - 注入 Agent Tools（`get_easytier_status`、`get_easytier_peers`），支持实时探针检测；
   - 自动记录状态至 `~/.dsh/easytier_status.json` 及 GitHub Actions Step Summary。

---

## ⚙️ 参数与配置说明

可以通过以下方式之一进行配置：

### 1. 环境变量 / GitHub Actions 传参
在 `start.sh` 或 Action 执行环境中注入以下变量：

| 环境变量名 | Action 别名 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `EASYTIER_NETWORK_NAME` | `INPUT_EASYTIER_NETWORK_NAME` | *(空)* | **(必填)** 虚拟网络名称，组网设备需保持一致 |
| `EASYTIER_NETWORK_SECRET` | `INPUT_EASYTIER_NETWORK_SECRET` | *(空)* | 虚拟网络访问密码 |
| `EASYTIER_IPV4` | `INPUT_EASYTIER_IPV4` | *(留空走 DHCP)* | 指定固定虚拟 IP（如 `10.144.144.1`） |
| `EASYTIER_PEERS` | `INPUT_EASYTIER_PEERS` | 官方公共 Peers 列表 | 初始连接的公共/私有 Peer，逗号分隔 |
| `EASYTIER_NO_TUN` | `INPUT_EASYTIER_NO_TUN` | `true` | 启用用户态 No-TUN 模式（容器内必须为 `true`） |
| `EASYTIER_ENABLED` | `INPUT_EASYTIER_ENABLED` | `true` | 是否启用 EasyTier 守护进程 |
| `EASYTIER_RPC_PORT` | `INPUT_EASYTIER_RPC_PORT` | `15888` | 本地 RPC 探针端口 |

### 2. Cordis Patch (`cordis.patch.yml`)
```yaml
- id: easytier
  name: dsh-easytier
  config:
    enabled: true
    port: 3080
    networkName: "my_dsh_mesh"
    networkSecret: "my_secret_pass"
    ipv4: "10.144.144.1"
```

### 3. WebUI 设置界面
登录 DSH Web 界面后，在 **Settings -> EasyTier 异地组网** 卡片中可查看当前在线状态、虚拟 IP、连接的 Peer 数量，并直接修改网络名、密码与节点参数。

---

## 🚀 外部设备访问指南

1. **在你的电脑/手机端安装 EasyTier**：
   - 访问 [EasyTier 官网/Release](https://github.com/EasyTier/EasyTier) 下载对应客户端；
2. **加入同一网络**：
   - 输入与容器端相同的 **网络名称 (Network Name)** 与 **网络密码 (Network Secret)**；
   - 保持公共 Peer（或自建 Peer）一致；
3. **直接访问**：
   - 打开浏览器，输入容器端分配的虚拟 IP 与端口：
     ```
     http://<容器虚拟IP>:3080
     ```
     例如：`http://10.144.144.1:3080`，即可直连体验极低延迟的 P2P 直连访问！
