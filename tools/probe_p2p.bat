@echo off
REM ============================================================
REM vibeQwenGlasses - 眼镜 P2P 网络探测工具（Windows 版）
REM
REM 用途：手机通过 WiFi P2P 连上眼镜后，电脑用 USB+adb
REM       在手机端扫描眼镜的开放端口（5555=adb, 554/8554=RTSP,
REM       8080/8099=HTTP/相机等），判断能否直接进眼镜系统。
REM
REM 前提：
REM   1. 手机 USB 调试连接电脑（adb devices 能看到）
REM   2. 手机已通过 WiFi P2P 连上眼镜（官方APP触发传视频即可）
REM   3. 手机会自动获得 192.168.43.x 网段 IP
REM
REM 用法：双击运行，或 cmd 里执行
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo   眼镜 P2P 网络探测工具
echo ============================================
echo.

echo [1/4] 检查 adb 连接...
adb devices 2>nul | findstr /i "device$" >nul
if errorlevel 1 (
  echo [!] 未检测到设备。请：
  echo     1. 手机开启 USB 调试并连接电脑
  echo     2. adb devices 确认出现 device 状态
  exit /b 1
)
echo [OK] 设备已连接
echo.

echo [2/4] 查看手机当前 IP（应处于 192.168.43.x P2P 网段）...
adb shell ip addr show wlan0 2>nul | findstr "inet "
echo.
echo 若上面没有 192.168.43.x，说明手机还没连上眼镜的 P2P。
echo 请在官方APP触发一次视频/照片同步，让眼镜建立 P2P 组。
echo.

echo [3/4] 查找眼镜 IP...
set GLASSES_IP=192.168.43.1
echo 假设眼镜 IP=192.168.43.1（P2P Group Owner 默认）. 若不通请手动改脚本里的 GLASSES_IP。
echo.

echo [4/4] 端口扫描（192.168.43.1）...
set PORTS=5555 554 8554 8080 8099 8888 3344 4455 3702 6666 9090
for %%p in (%PORTS%) do (
  call :probe 192.168.43.1 %%p
)
echo.
echo ============ 扫描完成 ============
echo 如果 5555 显示 OPEN：执行 adb connect 192.168.43.1:5555 进眼镜
echo 如果 RTSP 554/8554 OPEN：用 VLC/ffplay 打开 rtsp://192.168.43.1:<端口>
pause
exit /b 0

:probe
set HOST=%1
set PORT=%2
set FOUND=
REM 用 curl telnet 探测（多数 Android 有 curl）
for /f "delims=" %%r in ('adb shell "curl -s --connect-timeout 2 telnet://%HOST%:%PORT% 2>/dev/null && echo OPEN || echo CLOSED" 2^>nul') do set RESULT=%%r
echo   Port %PORT% : %RESULT%
exit /b 0