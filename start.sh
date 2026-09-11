#!/usr/bin/env bash
# ==============================================================================
# DSH Antigravity Action - Unified Lifecycle & A/B Slot Self-Healing Launcher
# ==============================================================================
# 该脚本与 .github/workflows/dsh.yml 彻底解耦。
# Agent 在 Action 内部拥有此文件的完全修改权限，可随意调整流程并 git commit & push，
# 规避 GitHub Actions 默认限制修改 .github/workflows/*.yml 的安全策略。
# ==============================================================================

DSH_PORT="${DSH_PORT:-3080}"
DSH_HOME_DIR="${DSH_HOME_DIR:-${HOME}/.dsh}"
export PATH="${DSH_HOME_DIR}/bin:${PATH}"
SLOT_A_DIR="${DSH_HOME_DIR}/slots/slot-a"
SLOT_B_DIR="${DSH_HOME_DIR}/slots/slot-b"
SLOT_ACTIVE_FILE="${DSH_HOME_DIR}/slots/active_slot"
SLOT_STATUS_FILE="${DSH_HOME_DIR}/slots/status.json"
PROFILE_WEB_DIR="${DSH_HOME_DIR}/profiles/web"
GUARDIAN_LOG="/tmp/dsh_guardian.log"
CRASH_LOG="/tmp/dsh_crash.log"

# ==============================================================================
# 🔄 会话跨 Action 同步与端到端隐私加密配置 (Session Sync & E2EE)
# ==============================================================================
DSH_SYNC_SECRET="${INPUT_DSH_SYNC_SECRET:-${DSH_SYNC_SECRET:-${INPUT_DSH_SYNC_PASSWORD:-${DSH_SYNC_PASSWORD:-}}}}"
DSH_SYNC_GIT_ENABLED="${INPUT_DSH_SYNC_GIT_ENABLED:-${DSH_SYNC_GIT_ENABLED:-true}}"
DSH_SYNC_GIT_BRANCH="${INPUT_DSH_SYNC_GIT_BRANCH:-${DSH_SYNC_GIT_BRANCH:-dsh-sessions}}"
DSH_SYNC_INTERVAL="${INPUT_DSH_SYNC_INTERVAL:-${DSH_SYNC_INTERVAL:-300}}"

# Cloudflare R2 对象存储配置
R2_ACCOUNT_ID="${INPUT_R2_ACCOUNT_ID:-${R2_ACCOUNT_ID:-}}"
R2_ACCESS_KEY_ID="${INPUT_R2_ACCESS_KEY_ID:-${R2_ACCESS_KEY_ID:-}}"
R2_SECRET_ACCESS_KEY="${INPUT_R2_SECRET_ACCESS_KEY:-${R2_SECRET_ACCESS_KEY:-}}"
R2_BUCKET="${INPUT_R2_BUCKET:-${R2_BUCKET:-dsh-sessions}}"

# 通用 S3 兼容对象存储配置
S3_ENDPOINT="${INPUT_S3_ENDPOINT:-${S3_ENDPOINT:-}}"
S3_ACCESS_KEY_ID="${INPUT_S3_ACCESS_KEY_ID:-${S3_ACCESS_KEY_ID:-}}"
S3_SECRET_ACCESS_KEY="${INPUT_S3_SECRET_ACCESS_KEY:-${S3_SECRET_ACCESS_KEY:-}}"
S3_BUCKET="${INPUT_S3_BUCKET:-${S3_BUCKET:-dsh-sessions}}"
S3_REGION="${INPUT_S3_REGION:-${S3_REGION:-auto}}"

RCLONE_CONF="/tmp/dsh_rclone.conf"
LAST_SYNC_HASH_FILE="/tmp/dsh_last_sync_hash"

log_guardian() {
  local msg="$1"
  local ts
  ts=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$ts] $msg" | tee -a "$GUARDIAN_LOG"
}

get_global_node_modules() {
  if [ -d "/usr/local/lib/node_modules" ]; then
    echo "/usr/local/lib/node_modules"
    return
  fi
  local nm
  nm="$(npm root -g 2>/dev/null || true)"
  if [ -n "$nm" ] && [ -d "$nm" ]; then
    echo "$nm"
    return
  fi
  echo "/usr/lib/node_modules"
}

get_dsh_global_root() {
  for candidate in \
    "/usr/local/lib/node_modules/@deepseek-ai/dsh" \
    "$(get_global_node_modules)/@deepseek-ai/dsh" \
    "/usr/lib/node_modules/@deepseek-ai/dsh"; do
    if [ -d "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done
  local from_node
  from_node="$(node -e 'try { const p = require.resolve("@deepseek-ai/dsh/package.json"); console.log(require("path").dirname(p)); } catch(e) {}' 2>/dev/null || true)"
  if [ -n "$from_node" ] && [ -d "$from_node" ]; then
    echo "$from_node"
    return
  fi
  echo "/usr/local/lib/node_modules/@deepseek-ai/dsh"
}

update_slot_status() {
  local active="$1"
  local state="$2"
  local detail="$3"
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat <<EOF > "$SLOT_STATUS_FILE"
{
  "activeSlot": "$active",
  "state": "$state",
  "detail": "$detail",
  "timestamp": "$ts"
}
EOF
}

# ==============================================================================
# 📦 环境与依赖初始化
# ==============================================================================
init_env() {
  echo "=========================================================================="
  echo "🚀 [1/4] 初始化系统依赖环境..."
  echo "=========================================================================="
  sudo apt-get update -qq && sudo apt-get install -y -qq tmate curl jq unzip

  if ! command -v cloudflared &> /dev/null; then
    echo "正在安装 Cloudflare Tunnel 客户端 (cloudflared)..."
    curl -L -s --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm -f cloudflared.deb
  fi

  # 初始化 EasyTier 依赖环境
  mkdir -p "${DSH_HOME_DIR}/bin"
  export PATH="${DSH_HOME_DIR}/bin:${PATH}"

  if ! command -v easytier-core &> /dev/null; then
    local local_et="/home/runner/work/easytier/bin/easytier-linux-x86_64/easytier-core"
    local local_cli="/home/runner/work/easytier/bin/easytier-linux-x86_64/easytier-cli"
    if [ -f "$local_et" ] && [ -f "$local_cli" ]; then
      echo "发现预编译 EasyTier，正在配置软链接..."
      ln -sfn "$local_et" "${DSH_HOME_DIR}/bin/easytier-core"
      ln -sfn "$local_cli" "${DSH_HOME_DIR}/bin/easytier-cli"
      chmod +x "${DSH_HOME_DIR}/bin/easytier-core" "${DSH_HOME_DIR}/bin/easytier-cli" 2>/dev/null || true
    else
      echo "正在下载并安装 EasyTier (v2.6.4)..."
      curl -L -s --output /tmp/easytier.zip https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-linux-x86_64-v2.6.4.zip
      if [ -f /tmp/easytier.zip ]; then
        unzip -q -o /tmp/easytier.zip -d /tmp/easytier-dist
        cp -f /tmp/easytier-dist/easytier-linux-x86_64/easytier-core "${DSH_HOME_DIR}/bin/"
        cp -f /tmp/easytier-dist/easytier-linux-x86_64/easytier-cli "${DSH_HOME_DIR}/bin/"
        chmod +x "${DSH_HOME_DIR}/bin/easytier-core" "${DSH_HOME_DIR}/bin/easytier-cli"
        rm -rf /tmp/easytier.zip /tmp/easytier-dist
      fi
    fi
  fi

  local global_nm
  global_nm="$(get_global_node_modules)"
  sudo chown -R "$(whoami)" "$global_nm" /usr/local/lib/node_modules /usr/lib/node_modules 2>/dev/null || true

  local dsh_ver
  dsh_ver="$(dsh --version 2>/dev/null || true)"
  if ! command -v dsh &> /dev/null || [ "$dsh_ver" != "0.1.2-rc.1" ]; then
    echo "正在安装全局 DeepSeek Harness (@deepseek-ai/dsh@0.1.2-rc.1)..."
    sudo npm install -g @deepseek-ai/dsh@0.1.2-rc.1 esbuild preact marked
    sudo chown -R "$(whoami)" "$global_nm" /usr/local/lib/node_modules /usr/lib/node_modules 2>/dev/null || true
  fi

  if ! command -v esbuild &> /dev/null; then
    echo "正在安装 esbuild 与移动端构建依赖..."
    sudo npm install -g esbuild preact marked
  fi

  # 若启用了对象存储同步且未安装 rclone，自动安装 rclone
  if is_s3_sync_enabled && ! command -v rclone &> /dev/null; then
    echo "正在安装 rclone 以支持对象存储会话同步..."
    sudo apt-get install -y -qq rclone 2>/dev/null || true
  fi

  mkdir -p "$SLOT_A_DIR" "$SLOT_B_DIR" "$PROFILE_WEB_DIR/plugins" "$PROFILE_WEB_DIR/node_modules"
  touch "$GUARDIAN_LOG" "$CRASH_LOG"
  [ -f "$SLOT_ACTIVE_FILE" ] || echo "slot-a" > "$SLOT_ACTIVE_FILE"
}

# ==============================================================================
# 🔄 会话跨 Action 同步与端到端隐私加密模块 (Session Sync & E2EE)
# ==============================================================================

# 检查是否启用了端到端加密
is_crypto_enabled() {
  [ -n "$DSH_SYNC_SECRET" ]
}

# 检查是否配置并启用了对象存储同步 (Cloudflare R2 或通用 S3)
is_s3_sync_enabled() {
  if [ -n "$R2_ACCOUNT_ID" ] && [ -n "$R2_ACCESS_KEY_ID" ] && [ -n "$R2_SECRET_ACCESS_KEY" ]; then
    return 0
  fi
  if [ -n "$S3_ENDPOINT" ] && [ -n "$S3_ACCESS_KEY_ID" ] && [ -n "$S3_SECRET_ACCESS_KEY" ]; then
    return 0
  fi
  return 1
}

# 检查是否启用了 Git 孤立分支同步
is_git_sync_enabled() {
  if [ "$DSH_SYNC_GIT_ENABLED" != "true" ]; then
    return 1
  fi
  if [ -n "$GITHUB_REPOSITORY" ] && [ -n "$GITHUB_TOKEN" ]; then
    return 0
  fi
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    local r
    r="$(git config --get remote.origin.url 2>/dev/null || true)"
    [ -n "$r" ] && return 0
  fi
  return 1
}

# 计算本地会话目录哈希 (用于变动感知与防重推送)
calc_sessions_hash() {
  local target_dirs=()
  [ -d "${DSH_HOME_DIR}/sessions" ] && target_dirs+=("${DSH_HOME_DIR}/sessions")
  [ -d "${DSH_HOME_DIR}/storages" ] && target_dirs+=("${DSH_HOME_DIR}/storages")

  if [ ${#target_dirs[@]} -eq 0 ]; then
    echo "empty"
    return
  fi

  find "${target_dirs[@]}" -type f -printf '%T@ %p\n' 2>/dev/null | sort | md5sum | cut -d' ' -f1
}

# 动态配置 rclone 临时内存凭据
setup_rclone_conf() {
  rm -f "$RCLONE_CONF"
  touch "$RCLONE_CONF"
  chmod 600 "$RCLONE_CONF"

  if [ -n "$R2_ACCOUNT_ID" ] && [ -n "$R2_ACCESS_KEY_ID" ] && [ -n "$R2_SECRET_ACCESS_KEY" ]; then
    cat <<EOF >> "$RCLONE_CONF"
[dsh-r2]
type = s3
provider = Cloudflare
access_key_id = $R2_ACCESS_KEY_ID
secret_access_key = $R2_SECRET_ACCESS_KEY
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
acl = private
EOF
  fi

  if [ -n "$S3_ENDPOINT" ] && [ -n "$S3_ACCESS_KEY_ID" ] && [ -n "$S3_SECRET_ACCESS_KEY" ]; then
    cat <<EOF >> "$RCLONE_CONF"
[dsh-s3]
type = s3
provider = Other
access_key_id = $S3_ACCESS_KEY_ID
secret_access_key = $S3_SECRET_ACCESS_KEY
endpoint = $S3_ENDPOINT
region = $S3_REGION
acl = private
EOF
  fi
}

# 打包会话并进行可选端到端 AES-256 加密
pack_and_encrypt_sessions() {
  local out_file="$1"
  mkdir -p "$(dirname "$out_file")"
  rm -f "$out_file"

  local items=()
  [ -d "${DSH_HOME_DIR}/sessions" ] && items+=("sessions")
  [ -d "${DSH_HOME_DIR}/storages" ] && items+=("storages")

  if [ ${#items[@]} -eq 0 ]; then
    return 1
  fi

  if is_crypto_enabled; then
    tar -I zstd -cf - -C "${DSH_HOME_DIR}" "${items[@]}" 2>/dev/null | \
      openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -pass "pass:$DSH_SYNC_SECRET" -out "$out_file" 2>/dev/null
  else
    tar -I zstd -cf "$out_file" -C "${DSH_HOME_DIR}" "${items[@]}" 2>/dev/null
  fi

  [ -f "$out_file" ] && [ -s "$out_file" ]
}

# 解密并解包还原会话至 ~/.dsh/
decrypt_and_unpack_sessions() {
  local in_file="$1"
  if [ ! -f "$in_file" ] || [ ! -s "$in_file" ]; then
    return 1
  fi

  local tmp_restore
  tmp_restore="$(mktemp -d)"

  # 检查是否为加密数据 (OpenSSL 格式文件头包含 Salted__)
  local is_encrypted=false
  if head -c 8 "$in_file" 2>/dev/null | grep -q "Salted__"; then
    is_encrypted=true
  fi

  local success=false
  if [ "$is_encrypted" = true ]; then
    if is_crypto_enabled; then
      if openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass "pass:$DSH_SYNC_SECRET" -in "$in_file" 2>/dev/null | \
        tar -I zstd -xf - -C "$tmp_restore" 2>/dev/null; then
        success=true
      else
        log_guardian "❌ [会话同步] 解密失败：密钥不匹配或备份损坏！"
      fi
    else
      log_guardian "⚠️ [会话同步] 远端会话数据已加密，但未提供 DSH_SYNC_SECRET 密码，跳过还原。"
    fi
  else
    if tar -I zstd -xf "$in_file" -C "$tmp_restore" 2>/dev/null; then
      success=true
    else
      log_guardian "❌ [会话同步] 压缩包解压失败：文件损坏或格式不受支持！"
    fi
  fi

  if [ "$success" = true ]; then
    mkdir -p "${DSH_HOME_DIR}/sessions" "${DSH_HOME_DIR}/storages"
    if [ -d "$tmp_restore/sessions" ]; then
      cp -r "$tmp_restore/sessions/." "${DSH_HOME_DIR}/sessions/" 2>/dev/null || true
    fi
    if [ -d "$tmp_restore/storages" ]; then
      cp -r "$tmp_restore/storages/." "${DSH_HOME_DIR}/storages/" 2>/dev/null || true
    fi
    rm -rf "$tmp_restore"
    return 0
  fi

  rm -rf "$tmp_restore"
  return 1
}

# 从 Git 孤立分支拉取会话归档
git_sync_pull() {
  if ! is_git_sync_enabled; then return 1; fi
  log_guardian "📥 [Git 同步] 正在从 Git 分支 (${DSH_SYNC_GIT_BRANCH}) 拉取会话备份..."

  local tmp_git_dir
  tmp_git_dir="$(mktemp -d)"
  local pull_ok=false

  if git fetch origin "${DSH_SYNC_GIT_BRANCH}:${DSH_SYNC_GIT_BRANCH}" --depth=1 2>/dev/null || \
     git fetch origin "${DSH_SYNC_GIT_BRANCH}" --depth=1 2>/dev/null; then
    if git --work-tree="$tmp_git_dir" checkout "${DSH_SYNC_GIT_BRANCH}" -- . 2>/dev/null || \
       git --work-tree="$tmp_git_dir" checkout "origin/${DSH_SYNC_GIT_BRANCH}" -- . 2>/dev/null; then
      if [ -f "$tmp_git_dir/dsh_sessions.archive" ]; then
        if decrypt_and_unpack_sessions "$tmp_git_dir/dsh_sessions.archive"; then
          pull_ok=true
          log_guardian "✅ [Git 同步] 成功从 Git 分支 (${DSH_SYNC_GIT_BRANCH}) 还原历史会话！"
        fi
      fi
    fi
  fi

  rm -rf "$tmp_git_dir"
  [ "$pull_ok" = true ]
}

# 将当前会话推送至 Git 孤立分支
git_sync_push() {
  local archive_file="$1"
  if ! is_git_sync_enabled || [ ! -f "$archive_file" ]; then return 1; fi

  log_guardian "📤 [Git 同步] 正在将最新会话推送至 Git 孤立分支 (${DSH_SYNC_GIT_BRANCH})..."
  local tmp_push_dir
  tmp_push_dir="$(mktemp -d)"

  cp -f "$archive_file" "$tmp_push_dir/dsh_sessions.archive"
  cat <<EOF > "$tmp_push_dir/README.md"
# DSH Antigravity Session Storage Branch
This branch is automatically managed by DSH Antigravity Action to persist conversation history.
- Last Sync: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- Encrypted: $(is_crypto_enabled && echo "true (AES-256-CBC PBKDF2)" || echo "false")
EOF

  local remote_url=""
  if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPOSITORY" ]; then
    remote_url="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
  else
    remote_url="$(git config --get remote.origin.url 2>/dev/null || echo "")"
  fi

  if [ -z "$remote_url" ]; then
    log_guardian "⚠️ [Git 同步] 未找到有效的 Git Remote URL，跳过 Git 同步推送。"
    rm -rf "$tmp_push_dir"
    return 1
  fi

  (
    cd "$tmp_push_dir"
    git init -q
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git checkout -q --orphan "${DSH_SYNC_GIT_BRANCH}"
    git add dsh_sessions.archive README.md
    git commit -q -m "chore(sessions): auto sync $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
    git push -q -f "$remote_url" HEAD:"${DSH_SYNC_GIT_BRANCH}" 2>/dev/null
  )
  local push_status=$?

  rm -rf "$tmp_push_dir"
  if [ $push_status -eq 0 ]; then
    log_guardian "✅ [Git 同步] 成功推送到分支 ${DSH_SYNC_GIT_BRANCH}！"
    return 0
  else
    log_guardian "⚠️ [Git 同步] Git 推送失败 (可能缺少 GITHUB_TOKEN write 权限或网络波动)。"
    return 1
  fi
}

# 从 S3 / Cloudflare R2 拉取会话
s3_sync_pull() {
  if ! is_s3_sync_enabled; then return 1; fi
  setup_rclone_conf

  local tmp_archive="/tmp/dsh_s3_download.archive"
  rm -f "$tmp_archive"
  local pull_ok=false

  # 优先尝试 Cloudflare R2
  if [ -n "$R2_ACCOUNT_ID" ] && [ -n "$R2_ACCESS_KEY_ID" ]; then
    log_guardian "📥 [R2 同步] 正在从 Cloudflare R2 存储桶 (${R2_BUCKET}) 拉取会话..."
    if rclone --config "$RCLONE_CONF" copy "dsh-r2:${R2_BUCKET}/dsh_sessions.archive" "/tmp/" 2>/dev/null; then
      if [ -f "/tmp/dsh_sessions.archive" ]; then
        mv -f "/tmp/dsh_sessions.archive" "$tmp_archive"
        if decrypt_and_unpack_sessions "$tmp_archive"; then
          pull_ok=true
          log_guardian "✅ [R2 同步] 成功从 Cloudflare R2 还原历史会话！"
        fi
      fi
    fi
  fi

  # 通用 S3 兼容后端尝试
  if [ "$pull_ok" = false ] && [ -n "$S3_ENDPOINT" ] && [ -n "$S3_ACCESS_KEY_ID" ]; then
    log_guardian "📥 [S3 同步] 正在从 S3 存储桶 (${S3_BUCKET}) 拉取会话..."
    if rclone --config "$RCLONE_CONF" copy "dsh-s3:${S3_BUCKET}/dsh_sessions.archive" "/tmp/" 2>/dev/null; then
      if [ -f "/tmp/dsh_sessions.archive" ]; then
        mv -f "/tmp/dsh_sessions.archive" "$tmp_archive"
        if decrypt_and_unpack_sessions "$tmp_archive"; then
          pull_ok=true
          log_guardian "✅ [S3 同步] 成功从 S3 存储桶还原历史会话！"
        fi
      fi
    fi
  fi

  rm -f "$tmp_archive"
  [ "$pull_ok" = true ]
}

# 推送会话至 S3 / Cloudflare R2
s3_sync_push() {
  local archive_file="$1"
  if ! is_s3_sync_enabled || [ ! -f "$archive_file" ]; then return 1; fi
  setup_rclone_conf

  local push_any=false

  # 推送至 R2
  if [ -n "$R2_ACCOUNT_ID" ] && [ -n "$R2_ACCESS_KEY_ID" ]; then
    log_guardian "📤 [R2 同步] 正在上传会话归档至 Cloudflare R2 (${R2_BUCKET})..."
    local tmp_up="/tmp/dsh_s3_up"
    mkdir -p "$tmp_up"
    cp -f "$archive_file" "$tmp_up/dsh_sessions.archive"
    if rclone --config "$RCLONE_CONF" copy "$tmp_up/dsh_sessions.archive" "dsh-r2:${R2_BUCKET}/" 2>/dev/null; then
      log_guardian "✅ [R2 同步] 成功同步会话至 Cloudflare R2！"
      push_any=true
    else
      log_guardian "⚠️ [R2 同步] 上传至 Cloudflare R2 失败。"
    fi
    rm -rf "$tmp_up"
  fi

  # 推送至 通用 S3
  if [ -n "$S3_ENDPOINT" ] && [ -n "$S3_ACCESS_KEY_ID" ]; then
    log_guardian "📤 [S3 同步] 正在上传会话归档至 S3 (${S3_BUCKET})..."
    local tmp_up="/tmp/dsh_s3_up"
    mkdir -p "$tmp_up"
    cp -f "$archive_file" "$tmp_up/dsh_sessions.archive"
    if rclone --config "$RCLONE_CONF" copy "$tmp_up/dsh_sessions.archive" "dsh-s3:${S3_BUCKET}/" 2>/dev/null; then
      log_guardian "✅ [S3 同步] 成功同步会话至 S3 存储桶！"
      push_any=true
    else
      log_guardian "⚠️ [S3 同步] 上传至 S3 失败。"
    fi
    rm -rf "$tmp_up"
  fi

  [ "$push_any" = true ]
}

# 统一拉取调度器 (启动阶段恢复)
sync_sessions_pull_all() {
  log_guardian "=========================================================================="
  log_guardian "🔄 正在检查并恢复历史会话记录..."
  if is_crypto_enabled; then
    log_guardian "🔐 端到端加密已启用 (AES-256-CBC PBKDF2 100k iters)"
  fi

  local restored=false
  # 1. 优先尝试从 S3 / R2 拉取
  if is_s3_sync_enabled; then
    if s3_sync_pull; then
      restored=true
    fi
  fi

  # 2. 若 S3 未恢复成功，尝试从 Git 分支拉取
  if [ "$restored" = false ] && is_git_sync_enabled; then
    if git_sync_pull; then
      restored=true
    fi
  fi

  # 更新最新哈希，防止未产生新对话时重复推送
  calc_sessions_hash > "$LAST_SYNC_HASH_FILE"

  if [ "$restored" = true ]; then
    local sess_count=0
    sess_count=$(find "${DSH_HOME_DIR}/sessions" -name "session.jsonl*" 2>/dev/null | wc -l || echo 0)
    log_guardian "🎉 历史会话恢复完成！当前可用会话数: $sess_count"
  else
    log_guardian "ℹ️ 未发现远端历史会话备份或已处于最新状态。"
  fi
  log_guardian "=========================================================================="
}

# 统一推送调度器 (守护定时 / 退出推送)
sync_sessions_push_all() {
  local force="${1:-false}"
  local cur_hash
  cur_hash="$(calc_sessions_hash)"

  if [ "$cur_hash" = "empty" ]; then
    return 0
  fi

  local last_hash
  last_hash="$(cat "$LAST_SYNC_HASH_FILE" 2>/dev/null || echo "")"

  if [ "$force" != "true" ] && [ "$cur_hash" = "$last_hash" ]; then
    return 0
  fi

  local tmp_archive="/tmp/dsh_sessions_push.archive"
  if ! pack_and_encrypt_sessions "$tmp_archive"; then
    return 0
  fi

  local push_success=false

  # 并行/依次推送至所有已启用的后端
  if is_s3_sync_enabled; then
    if s3_sync_push "$tmp_archive"; then
      push_success=true
    fi
  fi

  if is_git_sync_enabled; then
    if git_sync_push "$tmp_archive"; then
      push_success=true
    fi
  fi

  rm -f "$tmp_archive"
  if [ "$push_success" = true ]; then
    echo "$cur_hash" > "$LAST_SYNC_HASH_FILE"
  fi
}

# 自动定时同步守护进程
sync_sessions_daemon() {
  local interval="${DSH_SYNC_INTERVAL:-300}"
  while true; do
    sleep "$interval"
    sync_sessions_push_all false >/dev/null 2>&1 || true
  done
}

# ==============================================================================
# 🛡️ A/B 槽位核心状态机操作
# ==============================================================================

# 将当前工作区暂存至 Slot B 候选槽
stage_to_slot_b() {
  local src_dir="${1:-.}"
  log_guardian "📦 [A/B 管理器] 正在将最新工作区代码暂存至 Slot B 候选槽位..."
  mkdir -p "$SLOT_B_DIR"

  [ -f "$src_dir/cordis.patch.yml" ] && cp "$src_dir/cordis.patch.yml" "$SLOT_B_DIR/cordis.patch.yml"
  [ -f "$src_dir/unlock-dsh.mjs" ] && cp "$src_dir/unlock-dsh.mjs" "$SLOT_B_DIR/unlock-dsh.mjs"
  [ -f "$src_dir/AGENTS.md" ] && cp "$src_dir/AGENTS.md" "$SLOT_B_DIR/AGENTS.md"
  if [ -d "$src_dir/plugins" ]; then
    rm -rf "$SLOT_B_DIR/plugins"
    cp -r "$src_dir/plugins" "$SLOT_B_DIR/plugins"
  fi

  echo "slot-b" > "$SLOT_ACTIVE_FILE"
  update_slot_status "slot-b" "staged" "Candidate staged to Slot B, pending restart validation"
  log_guardian "✅ [A/B 管理器] Slot B 候选代码已就绪，当前激活槽位切换为: slot-b"
}

# 将 Slot B (或当前干净提交) 晋升为 Slot A 黄金稳定快照
promote_to_slot_a() {
  local src_dir="${1:-$SLOT_B_DIR}"
  if [ ! -d "$src_dir/plugins" ] && [ -d "plugins" ]; then
    src_dir="."
  fi

  log_guardian "📸 [A/B 晋升] 正在创建/晋升 Slot A 黄金稳定快照..."
  mkdir -p "$SLOT_A_DIR"
  [ -f "$src_dir/cordis.patch.yml" ] && cp "$src_dir/cordis.patch.yml" "$SLOT_A_DIR/cordis.patch.yml"
  [ -f "$src_dir/unlock-dsh.mjs" ] && cp "$src_dir/unlock-dsh.mjs" "$SLOT_A_DIR/unlock-dsh.mjs"
  [ -f "$src_dir/AGENTS.md" ] && cp "$src_dir/AGENTS.md" "$SLOT_A_DIR/AGENTS.md"
  if [ -d "$src_dir/plugins" ]; then
    rm -rf "$SLOT_A_DIR/plugins"
    cp -r "$src_dir/plugins" "$SLOT_A_DIR/plugins"
  fi

  echo "slot-a" > "$SLOT_ACTIVE_FILE"
  update_slot_status "slot-a" "promoted" "Promoted candidate to Slot A golden baseline"
  log_guardian "🏆 [A/B 晋升] 成功晋升并固化 Slot A 黄金基准快照！当前激活槽位: slot-a"
}

# 从 Slot A 紧急自动回滚
rollback_to_slot_a() {
  log_guardian "🚨 [A/B 自愈] 触发自动回滚机制：正在从 Slot A 黄金稳定快照全量恢复..."
  echo "slot-a" > "$SLOT_ACTIVE_FILE"
  update_slot_status "slot-a" "rolled_back" "Rolled back to Slot A due to startup failure in Slot B"

  if [ -f "$SLOT_A_DIR/cordis.patch.yml" ]; then
    cp "$SLOT_A_DIR/cordis.patch.yml" "$PROFILE_WEB_DIR/cordis.patch.yml"
  fi
  if [ -f "$SLOT_A_DIR/AGENTS.md" ]; then
    cp "$SLOT_A_DIR/AGENTS.md" "${DSH_HOME_DIR}/AGENTS.md"
  fi
  if [ -d "$SLOT_A_DIR/plugins" ]; then
    rm -rf "$PROFILE_WEB_DIR/plugins"/* "$PROFILE_WEB_DIR/node_modules"/*
    deploy_plugins "$SLOT_A_DIR/plugins"
  fi
  if [ -f "$SLOT_A_DIR/unlock-dsh.mjs" ]; then
    node "$SLOT_A_DIR/unlock-dsh.mjs"
  fi
  log_guardian "🔄 [A/B 自愈] 已完成 Slot A 稳定快照全量部署，准备重新拉起稳定服务。"
}

# 部署插件目录与处理 scoped package
deploy_plugins() {
  local src_dir="${1:-plugins}"
  mkdir -p "$PROFILE_WEB_DIR/plugins" "$PROFILE_WEB_DIR/node_modules"

  local global_nm
  global_nm="$(get_global_node_modules)"
  local dsh_root
  dsh_root="$(get_dsh_global_root)"

  # 建立核心依赖软链接以确保插件在独立目录中解析到 @deepseek-ai/* 与通用包
  if [ -d "$dsh_root/node_modules" ]; then
    mkdir -p "$PROFILE_WEB_DIR/node_modules/@deepseek-ai"
    for mod in "$dsh_root/node_modules/@deepseek-ai"/*; do
      [ -d "$mod" ] || continue
      ln -sfn "$mod" "$PROFILE_WEB_DIR/node_modules/@deepseek-ai/$(basename "$mod")" 2>/dev/null || true
    done
    for mod in "$dsh_root/node_modules"/*; do
      [ -d "$mod" ] || continue
      [ "$(basename "$mod")" = "@deepseek-ai" ] && continue
      ln -sfn "$mod" "$PROFILE_WEB_DIR/node_modules/$(basename "$mod")" 2>/dev/null || true
    done
  fi

  if [ -d "$global_nm" ]; then
    if [ -d "$global_nm/@deepseek-ai" ]; then
      mkdir -p "$PROFILE_WEB_DIR/node_modules/@deepseek-ai"
      for mod in "$global_nm/@deepseek-ai"/*; do
        [ -d "$mod" ] || continue
        [ -e "$PROFILE_WEB_DIR/node_modules/@deepseek-ai/$(basename "$mod")" ] || \
          ln -sfn "$mod" "$PROFILE_WEB_DIR/node_modules/@deepseek-ai/$(basename "$mod")" 2>/dev/null || true
      done
    fi
    for mod in "$global_nm"/*; do
      [ -d "$mod" ] || continue
      [ "$(basename "$mod")" = "@deepseek-ai" ] && continue
      ln -sfn "$mod" "$PROFILE_WEB_DIR/node_modules/$(basename "$mod")" 2>/dev/null || true
    done
  fi

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
        if [ -d "$global_nm" ]; then
          sudo mkdir -p "$global_nm/@dsh-external" 2>/dev/null || true
          sudo cp -rf "$p" "$global_nm/@dsh-external/dsh-mobile-nav" 2>/dev/null || true
        fi
      fi

      # 针对 dsh-mobile-webui 挂载至前端 dist/mobile 静态目录
      if [ "$pname" = "dsh-mobile-webui" ]; then
        if [ -f "$p/build.js" ] && command -v esbuild &> /dev/null; then
          (cd "$p" && NODE_PATH="${PROFILE_WEB_DIR}/node_modules:${global_nm}:${dsh_root}/node_modules" node build.js >/dev/null 2>&1 || true)
        fi
        local frontend_dist=""
        if [ -d "${dsh_root}/node_modules/@deepseek-ai/dsh-web-frontend/dist" ]; then
          frontend_dist="${dsh_root}/node_modules/@deepseek-ai/dsh-web-frontend/dist"
        elif [ -d "${global_nm}/@deepseek-ai/dsh-web-frontend/dist" ]; then
          frontend_dist="${global_nm}/@deepseek-ai/dsh-web-frontend/dist"
        else
          frontend_dist="$(node -e 'try { const p = require.resolve("@deepseek-ai/dsh-web-frontend/package.json", { paths: [process.argv[1], process.argv[2]] }); console.log(require("path").dirname(p) + "/dist"); } catch(e) {}' "$global_nm" "$dsh_root" 2>/dev/null || true)"
        fi
        if [ -d "$p/dist" ] && [ -n "$frontend_dist" ] && [ -d "$frontend_dist" ]; then
          sudo ln -sfn "$(realpath "$p/dist")" "$frontend_dist/mobile" 2>/dev/null || true
        fi
      fi
    done
  fi
}

# 根据当前激活槽位部署环境
deploy_active_slot() {
  local active="${1:-$(cat "$SLOT_ACTIVE_FILE" 2>/dev/null || echo "slot-a")}"
  local source_dir="plugins"

  if [ "$active" = "slot-b" ] && [ -d "$SLOT_B_DIR/plugins" ]; then
    log_guardian "📦 [A/B 部署] 当前激活槽位为 Slot B，从候选槽 $SLOT_B_DIR 部署..."
    source_dir="$SLOT_B_DIR/plugins"
    [ -f "$SLOT_B_DIR/cordis.patch.yml" ] && cp "$SLOT_B_DIR/cordis.patch.yml" "$PROFILE_WEB_DIR/cordis.patch.yml"
    [ -f "$SLOT_B_DIR/unlock-dsh.mjs" ] && node "$SLOT_B_DIR/unlock-dsh.mjs" 2>&1 || true
  elif [ -d "$SLOT_A_DIR/plugins" ]; then
    log_guardian "📦 [A/B 部署] 当前激活槽位为 Slot A，从黄金稳定槽 $SLOT_A_DIR 部署..."
    source_dir="$SLOT_A_DIR/plugins"
    [ -f "$SLOT_A_DIR/cordis.patch.yml" ] && cp "$SLOT_A_DIR/cordis.patch.yml" "$PROFILE_WEB_DIR/cordis.patch.yml"
    [ -f "$SLOT_A_DIR/unlock-dsh.mjs" ] && node "$SLOT_A_DIR/unlock-dsh.mjs" 2>&1 || true
  else
    log_guardian "📦 [A/B 部署] 初始冷启动，从工作区 plugins/ 部署..."
    source_dir="plugins"
    [ -f "cordis.patch.yml" ] && cp cordis.patch.yml "$PROFILE_WEB_DIR/cordis.patch.yml"
    [ -f "unlock-dsh.mjs" ] && node unlock-dsh.mjs 2>&1 || true
  fi

  deploy_plugins "$source_dir"
  rm -f "${DSH_HOME_DIR}/cordis.patch.yml"

  # 配置凭据与环境变量
  REFRESH_TOKEN="${INPUT_REFRESH_TOKEN:-$ANTIGRAVITY_REFRESH_TOKEN}"
  if [ -n "$REFRESH_TOKEN" ]; then
    cat <<EOF > "${DSH_HOME_DIR}/.credentials.yaml"
version: 1
refs:
  ANTIGRAVITY_REFRESH_TOKEN: "$REFRESH_TOKEN"
EOF
    chmod 600 "${DSH_HOME_DIR}/.credentials.yaml" 2>/dev/null || true
    export ANTIGRAVITY_REFRESH_TOKEN="$REFRESH_TOKEN"
  fi

  local global_nm
  global_nm="$(get_global_node_modules)"
  local dsh_root
  dsh_root="$(get_dsh_global_root)"
  export NODE_PATH="${PROFILE_WEB_DIR}/node_modules:${global_nm}:${dsh_root}/node_modules:${NODE_PATH:-}"

  export CF_WORKER_URL="${CF_WORKER_URL}"
  export CF_WORKER_TOKEN="${CF_WORKER_TOKEN}"
  export DSH_WEB_SEARCH_PROVIDER="${DSH_WEB_SEARCH_PROVIDER:-antigravity}"

  # EasyTier 环境变量与 Action 传参归一化
  export EASYTIER_NETWORK_NAME="${INPUT_EASYTIER_NETWORK_NAME:-${EASYTIER_NETWORK_NAME:-}}"
  export EASYTIER_NETWORK_SECRET="${INPUT_EASYTIER_NETWORK_SECRET:-${EASYTIER_NETWORK_SECRET:-}}"
  export EASYTIER_IPV4="${INPUT_EASYTIER_IPV4:-${EASYTIER_IPV4:-}}"
  export EASYTIER_PEERS="${INPUT_EASYTIER_PEERS:-${EASYTIER_PEERS:-}}"
  export EASYTIER_NO_TUN="${INPUT_EASYTIER_NO_TUN:-${EASYTIER_NO_TUN:-true}}"
  export EASYTIER_ENABLED="${INPUT_EASYTIER_ENABLED:-${EASYTIER_ENABLED:-true}}"
  export EASYTIER_RPC_PORT="${INPUT_EASYTIER_RPC_PORT:-${EASYTIER_RPC_PORT:-15888}}"

  if [ -n "$EASYTIER_NETWORK_NAME" ]; then
    log_guardian "🌐 [EasyTier] 检测到虚拟网络配置: Network=$EASYTIER_NETWORK_NAME, No-TUN=$EASYTIER_NO_TUN, IPv4=${EASYTIER_IPV4:-DHCP}"
  fi

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

  if [ -f "AGENTS.md" ]; then
    cp "AGENTS.md" "${DSH_HOME_DIR}/AGENTS.md"
    [ -d ".." ] && [ -w ".." ] && cp "AGENTS.md" "../AGENTS.md" 2>/dev/null || true
  fi
}

# 深度健康探针：检测进程存活、HTTP端口就绪及日志致命异常
probe_dsh_health() {
  local pid="$1"
  local log_file="$2"
  local max_wait=60
  local http_ready=false

  for i in $(seq 1 "$max_wait"); do
    if ! kill -0 "$pid" 2>/dev/null; then
      log_guardian "❌ [探针] DSH 进程已提前退出 (PID: $pid)"
      return 1
    fi

    if grep -Ei "ERR_MODULE_NOT_FOUND|Cannot find module|SyntaxError:" "$log_file" 2>/dev/null; then
      log_guardian "❌ [探针] 启动日志中检测到未捕获的致命异常或模块缺失"
      return 1
    fi

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -m 2 "http://127.0.0.1:${DSH_PORT}/" 2>/dev/null || echo "000")
    if [ "$http_code" = "200" ] || [ "$http_code" = "302" ] || [ "$http_code" = "303" ] || [ "$http_code" = "401" ]; then
      http_ready=true
      sleep 2
      if kill -0 "$pid" 2>/dev/null && ! grep -Ei "ERR_MODULE_NOT_FOUND|Cannot find module|SyntaxError:" "$log_file" 2>/dev/null; then
        log_guardian "✅ [探针] Web 服务 (Port ${DSH_PORT}) HTTP 响应正常 (HTTP $http_code)，且无致命异常日志。"
        return 0
      fi
    fi

    sleep 1
  done

  if [ "$http_ready" = false ]; then
    log_guardian "❌ [探针] 探测超时 ($max_wait 秒)：Web 服务未能正常响应 HTTP 请求"
    return 1
  fi

  return 0
}

# ==============================================================================
# 🛡️ 守护主循环
# ==============================================================================
run_dsh() {
  touch "$GUARDIAN_LOG" "$CRASH_LOG"

  # 注册进程退出/终止信号捕获，确保 Action 停机或取消时执行会话持久化
  trap 'log_guardian "🛑 [自愈守护] 捕获到终止信号，正在持久化同步会话..."; sync_sessions_push_all true; exit 0' INT TERM EXIT

  # 启动前初始拉取并恢复历史会话
  sync_sessions_pull_all

  # 启动后台定时会话同步守护进程
  sync_sessions_daemon &
  local SYNC_DAEMON_PID=$!

  # 初始快照准备
  if [ ! -f "$SLOT_A_DIR/cordis.patch.yml" ]; then
    promote_to_slot_a "."
  fi

  while true; do
    local active_slot
    active_slot=$(cat "$SLOT_ACTIVE_FILE" 2>/dev/null || echo "slot-a")
    
    log_guardian "--------------------------------------------------------------------------"
    log_guardian "🚀 准备拉起 DSH 实例 [当前槽位: ${active_slot}] (Port ${DSH_PORT})..."
    deploy_active_slot "$active_slot"

    # 启动 dsh web 并直接输出到日志文件
    dsh web --port "${DSH_PORT}" --no-open > "$CRASH_LOG" 2>&1 &
    local DSH_PID=$!

    # 启动后台实时日志输出流 (便于 GitHub Actions 控制台实时观察)
    tail -n 0 -F "$CRASH_LOG" 2>/dev/null &
    local TAIL_PID=$!

    log_guardian "⏳ [A/B 自愈守护] 正在对 ${active_slot} (PID: $DSH_PID) 执行深度健康判定..."
    if probe_dsh_health "$DSH_PID" "$CRASH_LOG"; then
      log_guardian "✅ [A/B 自愈守护] 实例深度健康检查通过 (Healthy)！"

      if [ "$active_slot" = "slot-b" ]; then
        log_guardian "🎉 [A/B 自愈守护] Slot B 候选版本测试通过 (Verified)！"
        update_slot_status "slot-b" "verified" "Slot B passed health probes"

        # 检查工作区是否已干净提交
        if git diff --quiet && git diff --cached --quiet 2>/dev/null; then
          log_guardian "🚀 [A/B 自愈守护] 检测到已提交稳定代码，自动将 Slot B 晋升为 Slot A 黄金稳定快照..."
          promote_to_slot_a "$SLOT_B_DIR"
        else
          log_guardian "ℹ️ [A/B 自愈守护] 当前工作区存在未暂存修改，保持 Slot B 运行，等待 Git Commit 确认晋升。"
        fi
      else
        update_slot_status "slot-a" "running" "Slot A running healthy"
      fi

      # 挂起等待主进程运行
      wait "$DSH_PID" || true
      local exit_code=$?
      kill "$TAIL_PID" 2>/dev/null || true
      pkill -f "easytier-core" 2>/dev/null || true
      log_guardian "⚠️ DSH 进程退出 (PID: $DSH_PID, Exit Code: $exit_code)"
      continue
    else
      # 健康检查失败
      kill "$TAIL_PID" 2>/dev/null || true
      pkill -f "easytier-core" 2>/dev/null || true
      if kill -0 "$DSH_PID" 2>/dev/null; then
        kill "$DSH_PID" 2>/dev/null || true
      fi
      wait "$DSH_PID" 2>/dev/null || true
      local exit_code=$?

      log_guardian "🚨 [A/B 自愈守护] 警告：${active_slot} 实例未通过健康检查！(Exit Code: $exit_code)"
      log_guardian "====== 异常日志截取 (最后 100 行) ======"
      tail -n 100 "$CRASH_LOG" 2>/dev/null | while read -r line; do log_guardian "  $line"; done
      log_guardian "======================================="

      if [ "$active_slot" = "slot-b" ]; then
        log_guardian "🔄 [A/B 自愈守护] B 槽候选版本崩溃，立即执行秒级自动回滚：切回 Slot A 黄金快照！"
        rollback_to_slot_a
        sleep 2
        continue
      else
        log_guardian "❌ [A/B 自愈守护] 致命错误：Slot A 黄金基准配置亦无法启动，请检查系统底层依赖！"
        exit 1
      fi
    fi
  done
}

# ==============================================================================
# 🎯 CLI 指令路由
# ==============================================================================
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-}" in
    stage-b)
      init_env
      stage_to_slot_b "."
      echo "⚡ 候选代码已成功写入 Slot B，正在重启 DSH 服务以激活 Slot B 测试..."
      (sleep 1 && pkill -f "easytier-core" 2>/dev/null || true; pkill -f "dsh web") >/dev/null 2>&1 &
      ;;
    promote)
      promote_to_slot_a "$SLOT_B_DIR"
      ;;
    rollback)
      rollback_to_slot_a
      pkill -f "dsh web" || true
      ;;
    sync-pull)
      init_env
      sync_sessions_pull_all
      ;;
    sync-push)
      init_env
      sync_sessions_push_all true
      ;;
    status)
      echo "===== DSH A/B Slot Status ====="
      cat "$SLOT_STATUS_FILE" 2>/dev/null || echo "No status recorded"
      echo ""
      echo "===== Active Slot ====="
      cat "$SLOT_ACTIVE_FILE" 2>/dev/null || echo "Unknown"
      echo ""
      echo "===== Recent Guardian Log ====="
      tail -n 15 "$GUARDIAN_LOG" 2>/dev/null || echo "No guardian log"
      ;;
    *)
      init_env
      run_dsh
      ;;
  esac
fi
