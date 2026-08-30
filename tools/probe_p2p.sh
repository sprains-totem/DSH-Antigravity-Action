#!/usr/bin/env bash
# ============================================================
# vibeQwenGlasses - 眼镜 P2P 网络探测（手机端 / Termux 版）
# 前提：手机已通过 WiFi P2P 连上眼镜（官方APP触发视频传输）
#       手机获得 192.168.43.x IP
# 用法：在 Termux（或其他本地终端）里执行本脚本
# ============================================================
HOST="${1:-192.168.43.1}"
echo "=== 眼镜 P2P 探测: $HOST ==="
echo "本机 IP: $(ip addr show 2>/dev/null | grep -o 'inet 192.168.[0-9.]*' | head -1)"

echo ""
echo "--- 是否存在 nc/toybox nc ---"
which nc toybox 2>/dev/null || echo "(无 nc，用 curl 代替)"

PORTS=(5555 554 8554 8080 8099 8888 3344 4455 3702 6666 9090 2000 3000)
for p in "${PORTS[@]}"; do
  R=""
  if command -v nc >/dev/null 2>&1; then
    R=$(nc -z -w 2 "$HOST" "$p" 2>/dev/null && echo "OPEN" || echo "closed")
  elif command -v curl >/dev/null 2>&1; then
    R=$(curl -s --connect-timeout 2 "telnet://$HOST:$p" >/dev/null 2>&1 && echo "OPEN" || echo "closed")
  else
    # 用 /dev/tcp (bash) 或 timeout 工具
    R=$(timeout 2 bash -c "echo >/dev/tcp/$HOST/$p" 2>/dev/null && echo "OPEN" || echo "closed")
  fi
  printf "  %-6s : %s\n" "$p" "$R"
done

echo ""
echo "=== 结果解读 ==="
echo " 5555 OPEN  -> adb connect $HOST:5555 可直接进眼镜 Android"
echo " 554/8554 OPEN -> rtsp://$HOST:<端口> 可拉视频流"
echo " 8080/8099 OPEN -> 可能有 HTTP/相机服务"

echo ""
echo "--- 附加: 尝试 adb connect (若本机有 adb) ---"
if command -v adb >/dev/null 2>&1; then
  adb connect "$HOST:5555" 2>/dev/null || echo "(本机无 adb 或连接失败)"
fi