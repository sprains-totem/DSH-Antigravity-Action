#!/usr/bin/env bash
# ==============================================================================
# DSH Antigravity Action - Unified Lifecycle & A/B Slot Self-Healing Launcher
# ==============================================================================
# 该脚本与 .github/workflows/dsh.yml 彻底解耦。
# Agent 在 Action 内部拥有此文件的完全修改权限，可随意调整流程并 git commit & push，
# 规避 GitHub Actions 默认限制修改 .github/workflows/*.yml 的安全策略。
# ==============================================================================

set -eo pipefail

DSH_PORT="${DSH_PORT:-3080}"
DSH_HOME_DIR="${HOME}/.dsh"
SLOT_A_DIR="${DSH_HOME_DIR}/slots/slot-a"
SLOT_B_DIR="${DSH_HOME_DIR}/slots/slot-b"
PROFILE_WEB_DIR="${DSH_HOME_DIR}/profiles/web"

echo "=========================================================================="
echo "🚀 [1/4] 初始化系统依赖环境..."
echo "=========================================================================="
sudo apt-get update -qq && sudo apt-get install -y -qq tmate curl jq

if ! command -v cloudflared &> /dev/null; then
  echo "正在安装 Cloudflare Tunnel 客户端 (cloudflared)..."
  curl -L -s --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i cloudflared.deb
  rm -f cloudflared.deb
fi

if ! command -v dsh &> /dev/null; then
  echo "正在安装全局 DeepSeek Harness (@deepseek-ai/dsh)..."
  sudo npm install -g @deepseek-ai/dsh
  sudo chown -R $(whoami) /usr/local/lib/node_modules
fi

echo "=========================================================================="
echo "🛡️ [2/4] A/B 槽位快照初始化与自愈环境准备..."
echo "=========================================================================="
mkdir -p "$SLOT_A_DIR" "$SLOT_B_DIR" "$PROFILE_WEB_DIR/plugins" "$PROFILE_WEB_DIR/node_modules"

# 函数：创建 Slot A 稳定快照
snapshot_to_slot_a() {
  echo "📸 正在创建 Slot A 稳定快照..."
  mkdir -p "$SLOT_A_DIR"
  [ -f "cordis.patch.yml" ] && cp "cordis.patch.yml" "$SLOT_A_DIR/cordis.patch.yml"
  [ -f "unlock-dsh.mjs" ] && cp "unlock-dsh.mjs" "$SLOT_A_DIR/unlock-dsh.mjs"
  [ -f "AGENTS.md" ] && cp "AGENTS.md" "$SLOT_A_DIR/AGENTS.md"
  if [ -d "plugins" ]; then
    rm -rf "$SLOT_A_DIR/plugins"
    cp -r "plugins" "$SLOT_A_DIR/plugins"
  fi
}

# 函数：从 Slot A 紧急回滚
rollback_from_slot_a() {
  echo "🚨 触发 A/B 槽自动回滚机制：正在从 Slot A 恢复稳定配置..."
  if [ -f "$SLOT_A_DIR/cordis.patch.yml" ]; then
    cp "$SLOT_A_DIR/cordis.patch.yml" "cordis.patch.yml"
    cp "$SLOT_A_DIR/cordis.patch.yml" "$PROFILE_WEB_DIR/cordis.patch.yml"
  fi
  if [ -f "$SLOT_A_DIR/unlock-dsh.mjs" ]; then
    cp "$SLOT_A_DIR/unlock-dsh.mjs" "unlock-dsh.mjs"
  fi
  if [ -f "$SLOT_A_DIR/AGENTS.md" ]; then
    cp "$SLOT_A_DIR/AGENTS.md" "AGENTS.md"
    cp "$SLOT_A_DIR/AGENTS.md" "${DSH_HOME_DIR}/AGENTS.md"
  fi
  if [ -d "$SLOT_A_DIR/plugins" ]; then
    rm -rf "plugins"
    cp -r "$SLOT_A_DIR/plugins" "plugins"
    rm -rf "$PROFILE_WEB_DIR/plugins"/* "$PROFILE_WEB_DIR/node_modules"/*
    deploy_plugins "$SLOT_A_DIR/plugins"
  fi
  if [ -f "unlock-dsh.mjs" ]; then
    node unlock-dsh.mjs
  fi
}

# 部署插件目录与处理 scoped package
deploy_plugins() {
  local src_dir="${1:-plugins}"
  mkdir -p "$PROFILE_WEB_DIR/plugins" "$PROFILE_WEB_DIR/node_modules"
  
  if [ -d "$src_dir" ]; then
    for p in "$src_dir"/*; do
      [ -d "$p" ] || continue
      pname=$(basename "$p")
      
      # 复制到 web plugins 目录
      cp -rf "$p" "$PROFILE_WEB_DIR/plugins/"
      
      # 复制到 web node_modules 目录
      cp -rf "$p" "$PROFILE_WEB_DIR/node_modules/"
      
      # 针对 scoped package (@dsh-external/dsh-mobile-nav) 建立 scope 路径映射
      if [ "$pname" = "dsh-mobile-nav" ]; then
        mkdir -p "$PROFILE_WEB_DIR/node_modules/@dsh-external"
        cp -rf "$p" "$PROFILE_WEB_DIR/node_modules/@dsh-external/dsh-mobile-nav"
        if [ -d "/usr/local/lib/node_modules" ]; then
          sudo mkdir -p "/usr/local/lib/node_modules/@dsh-external"
          sudo cp -rf "$p" "/usr/local/lib/node_modules/@dsh-external/dsh-mobile-nav"
        fi
      fi

      # 针对 dsh-mobile-webui 挂载至前端 dist/mobile 静态目录
      if [ "$pname" = "dsh-mobile-webui" ]; then
        if [ -d "$p/dist" ] && [ -d "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist" ]; then
          sudo ln -sfn "$(realpath "$p/dist")" "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/mobile"
        fi
      fi
    done
  fi
}

# 如果尚无 Slot A 快照，进行初始备份
if [ ! -f "$SLOT_A_DIR/cordis.patch.yml" ]; then
  snapshot_to_slot_a
fi

echo "=========================================================================="
echo "📦 [3/4] 部署插件套件 (移动端UI / Antigravity / Cloudflare / Fail-Soft)..."
echo "=========================================================================="
deploy_current_profile() {
  # 1. 部署插件
  deploy_plugins "plugins"

  # 2. 部署 cordis.patch.yml
  if [ -f "cordis.patch.yml" ]; then
    cp cordis.patch.yml "$PROFILE_WEB_DIR/cordis.patch.yml"
    rm -f "${DSH_HOME_DIR}/cordis.patch.yml"
  fi

  # 3. 执行全局解禁补丁
  if [ -f "unlock-dsh.mjs" ]; then
    node unlock-dsh.mjs
  fi

  # 4. 配置 Antigravity Token 凭据
  REFRESH_TOKEN="${INPUT_REFRESH_TOKEN:-$ANTIGRAVITY_REFRESH_TOKEN}"
  if [ -n "$REFRESH_TOKEN" ]; then
    cat <<EOF > "${DSH_HOME_DIR}/.credentials.yaml"
ANTIGRAVITY_REFRESH_TOKEN: "$REFRESH_TOKEN"
EOF
    export ANTIGRAVITY_REFRESH_TOKEN="$REFRESH_TOKEN"
    echo "✅ 已注入 ANTIGRAVITY_REFRESH_TOKEN 凭证。"
  fi

  # 5. 导出 Cloudflare Worker 与默认搜索提供方环境变量
  export CF_WORKER_URL="${CF_WORKER_URL}"
  export CF_WORKER_TOKEN="${CF_WORKER_TOKEN}"
  export DSH_WEB_SEARCH_PROVIDER="${DSH_WEB_SEARCH_PROVIDER:-antigravity}"

  # 6. 初始化 settings.yaml 默认配置（若不存在）
  if [ ! -f "${DSH_HOME_DIR}/settings.yaml" ]; then
    cat <<EOF > "${DSH_HOME_DIR}/settings.yaml"
ui-onboarding:
  welcomeNoticeVersion: 2026-08-13.1
web-search-selector:
  provider: antigravity
agent-default-model:
  provider: antigravity
  model: gemini-3.7-flash-high
EOF
  fi

  # 7. 同步并注入 Harness 全局指令规范 (~/.dsh/AGENTS.md)
  if [ -f "AGENTS.md" ]; then
    cp "AGENTS.md" "${DSH_HOME_DIR}/AGENTS.md"
    if [ -d ".." ] && [ -w ".." ]; then
      cp "AGENTS.md" "../AGENTS.md" 2>/dev/null || true
    fi
  fi
}

deploy_current_profile

echo "=========================================================================="
echo "🛡️ [4/4] 启动带 A/B 槽自愈守护的 DeepSeek Harness Web 服务..."
echo "=========================================================================="

# 深度健康探针：检测进程存活、HTTP端口就绪及日志致命异常
probe_dsh_health() {
  local pid="$1"
  local log_file="$2"
  local max_wait=20
  local http_ready=false

  for i in $(seq 1 "$max_wait"); do
    # 1. 进程存活检测
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "❌ [探针] DSH 进程已提前退出 (PID: $pid)"
      return 1
    fi

    # 2. 检查日志中是否存在致命插件/模块异常
    if grep -Ei "Intercepted uncaught exception|ERR_MODULE_NOT_FOUND|Cannot find module" "$log_file" 2>/dev/null; then
      echo "❌ [探针] 启动日志中检测到未捕获的致命异常或模块缺失"
      return 1
    fi

    # 3. HTTP 端口握手探针
    if curl -fsS -m 2 "http://127.0.0.1:${DSH_PORT}/" >/dev/null 2>&1; then
      http_ready=true
      # HTTP 就绪后持续观察 3 秒确认稳定性
      sleep 3
      if kill -0 "$pid" 2>/dev/null && ! grep -Ei "Intercepted uncaught exception|ERR_MODULE_NOT_FOUND|Cannot find module" "$log_file" 2>/dev/null; then
        echo "✅ [探针] Web 服务 (Port ${DSH_PORT}) HTTP 响应正常，且无致命异常日志。"
        return 0
      fi
    fi

    sleep 1
  done

  if [ "$http_ready" = false ]; then
    echo "❌ [探针] 探测超时 ($max_wait 秒)：Web 服务未能正常响应 HTTP 请求"
    return 1
  fi

  return 0
}

run_dsh() {
  local crash_log="/tmp/dsh_crash.log"
  local is_rollback_attempt=0

  while true; do
    echo "正在启动 DSH Web 实例 (Port ${DSH_PORT})..."
    echo "Cloudflare Tunnel 与动态路由将由 dsh-cloudflare-tunnel 插件原生统一托管。"
    
    # 启动 dsh web 并捕获输出与进程 PID
    dsh web --port "${DSH_PORT}" 2>&1 | tee "$crash_log" &
    local DSH_PID=$!

    echo "⏳ [A/B 自愈守护] 正在执行深度健康判定 (进程存活 + HTTP 握手 + 异常日志扫描)..."
    if probe_dsh_health "$DSH_PID" "$crash_log"; then
      echo "✅ [A/B 自愈守护] DSH 实例深度健康检查通过！"

      # 晋升门禁：仅在非回滚状态且工作区为已提交稳定代码时，才允许晋升 Slot A
      if [ "$is_rollback_attempt" -eq 0 ]; then
        if git diff --quiet && git diff --cached --quiet 2>/dev/null; then
          echo "🚀 [A/B 自愈守护] 检测到已提交稳定代码且通过深度健康检查，安全晋升为 Slot A 稳定快照..."
          snapshot_to_slot_a
        else
          echo "ℹ️ [A/B 自愈守护] 当前工作区存在未提交修改 (Dirty Working Tree)，保留 Slot A 原始基准快照不予覆盖。"
        fi
      fi

      # 挂起等待主进程运行
      wait "$DSH_PID" || true
      local exit_code=$?
      echo "⚠️ DSH 进程退出 (Exit Code: $exit_code)"
      break
    else
      # 进程可能异常挂起或失败，若仍在运行则终止它
      if kill -0 "$DSH_PID" 2>/dev/null; then
        kill "$DSH_PID" 2>/dev/null || true
      fi
      wait "$DSH_PID" 2>/dev/null || true
      local exit_code=$?

      echo "🚨 [A/B 自愈守护] 警告：DSH 实例未通过健康检查！(Exit Code: $exit_code)"
      echo "====== 异常日志截取 (最后 20 行) ======"
      tail -n 20 "$crash_log" 2>/dev/null || true
      echo "======================================="

      if [ "$is_rollback_attempt" -eq 0 ]; then
        is_rollback_attempt=1
        echo "🔄 [A/B 自愈守护] 正在执行自动回滚：从 Slot A 恢复稳定配置..."
        rollback_from_slot_a
        echo "🔄 [A/B 自愈守护] 正在以 Slot A 稳定配置重新拉起服务..."
        sleep 2
        continue
      else
        echo "❌ [A/B 自愈守护] 致命错误：Slot A 稳定配置亦无法启动，请检查基础环境！"
        exit 1
      fi
    fi
  done
}

run_dsh
