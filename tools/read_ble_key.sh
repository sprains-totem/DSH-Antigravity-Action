#!/usr/bin/env bash
# ============================================================
# vibeQwenGlasses - 读取千问官方APP的BLE认证密钥（方案三）
# 目的：读出官方 APP (com.alibaba.wow) 存的本机 BLE key，
#       验证能否复用该密钥完成 L2CAP 认证握手。
#
# 运行要求：手机已 root（或 Shizuku + adb shell 有读取 /data/data 权限）
# 用法：
#   bash read_ble_key.sh             # 默认 adb 模式
#   bash read_ble_key.sh --shizuku   # 先手动在 Shizuku 授权后执行
# ============================================================
set -e

PKG="com.alibaba.wow"
PREFS_DIR="/data/data/$PKG/shared_prefs"

echo "=== vibeQwenGlasses 官方APP密钥读取工具 ==="
echo "包名: $PKG"
echo ""

# 选择读取方式
if [ "$1" == "--shizuku" ]; then
  echo "[*] 使用 Shizuku 模式（请确保已通过 adb/shizuku 授权）"
  READ() { sh /data/user_de/0/moe.shizuku.privileged.api/start.sh "$@" 2>/dev/null || sh /data/local/tmp/shizuku "$@"; }
else
  echo "[*] 使用 root/adb 模式"
  READ() { adb shell "su -c '$*'" 2>/dev/null || adb shell "$*"; }
fi

echo ""
echo "=== 1. 检查官方 APP 是否已安装 ==="
if ! READ "pm path $PKG" | grep -q "$PKG"; then
  echo "[!] 未找到 $PKG，请确认官方千问APP已安装"
  exit 1
fi
echo "[OK] 官方APP已安装"
APKPATH=$(READ "pm path $PKG" | head -1 | sed 's/package://')
echo "    APK: $APKPATH"

echo ""
echo "=== 2. 列出 SharedPreferences 文件 ==="
PREFS=$(READ "ls -la $PREFS_DIR/")
echo "$PREFS"

echo ""
echo "=== 3. 读取 GMA_BLE_KEY / 绑定信息 ==="
for f in $PREFS_DIR/*.xml; do
  echo ""
  echo "--- $f ---"
  READ "cat $f" | grep -iE "GMA_BLE_KEY|local32BleKey|bleKey|gma_last_success|bind_device|productId|macAddress" || echo "  (无匹配密钥)"
done

echo ""
echo "=== 4. 直接搜索 BLE key（整个 prefs 目录）==="
READ "grep -rE 'GMA_BLE_KEY|32BleKey|bleKey16|psk_key' $PREFS_DIR/" 2>/dev/null || echo "  (未搜到)"

echo ""
echo "=== 完成 ==="
echo "如果读到 GMA_BLE_KEY_* / local32BleKeyHex，把值发给开发者即可复用认证。"