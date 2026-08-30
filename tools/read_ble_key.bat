@echo off
REM ============================================================
REM vibeQwenGlasses - 读取千问官方APP的BLE认证密钥（方案三，Windows版）
REM 目的：读出官方 APP (com.alibaba.wow) 存的 BLE key，
REM       验证能否复用该密钥完成 L2CAP 认证。
REM 前提：手机已 root 或 Shizuku 可用；adb 已连接
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set PKG=com.alibaba.wow
set PREFS=/data/data/%PKG%/shared_prefs

echo ============================================
echo   vibeQwenGlasses 官方APP密钥读取工具
echo   包名: %PKG%
echo ============================================
echo.

echo === 1. 检查官方APP是否已安装 ===
adb shell pm path %PKG% >nul 2>&1
if errorlevel 1 (
  echo [!] 未找到 %PKG%，请确认官方千问APP已安装
  exit /b 1
)
echo [OK] 官方APP已安装

echo.
echo === 2. 尝试读取 prefs 目录（root 或 Shizuku）===
echo [*] 先试 root（su）...
adb shell "su -c 'ls %PREFS%/'" 2>nul
if errorlevel 1 (
  echo [!] su 失败，尝试 Shizuku...
  adb shell "sh /data/local/tmp/shizuku ls %PREFS%/" 2>nul
  if errorlevel 1 (
    echo [!] Shizuku 也失败。请确认：
    echo     1. 手机已 root（Magisk）且 adb 有 su 权限
    echo     2. 或已安装 Shizuku 并授权
    echo     3. 或手动执行: adb shell su -c "cat %PREFS%/*.xml"
    exit /b 1
  )
)

echo.
echo === 3. 读取密钥内容 ===
adb shell "su -c 'cat %PREFS%/*.xml'" 2>nul | findstr /i "GMA_BLE_KEY local32BleKey bleKey gma_last bind_device productId macAddress psk"
echo.
echo === 4. 直接 grep 搜索 ===
adb shell "su -c 'grep -rE \"GMA_BLE_KEY|32BleKey|bleKey16|psk_key\" %PREFS%'" 2>nul
echo.
echo === 完成 ===
echo 如果读到 GMA_BLE_KEY_* / local32BleKeyHex，把值发给开发者。
pause