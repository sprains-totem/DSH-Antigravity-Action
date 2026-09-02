package com.vibeqwen.glasses.util;

import android.content.pm.PackageManager;

import rikka.shizuku.Shizuku;

/**
 * 官方千问 APP BLE 密钥读取器（方案三）。
 *
 * 读取 /data/data/com.alibaba.wow/shared_prefs 中的 GMA_BLE_KEY。
 * 方式（按优先级）：
 *  1) Shizuku 授权后执行命令（Shizuku.newProcess(String[],String[],String)）
 *  2) root（su -c）兜底
 */
public class ShizukuKeyReader {

    public static final String OFFICIAL_PKG = "com.alibaba.wow";
    private static final String PREFS_DIR = "/data/data/" + OFFICIAL_PKG + "/shared_prefs";

    /** Shizuku binder 是否存在 */
    public static boolean isShizukuAvailable() {
        try {
            return Shizuku.pingBinder();
        } catch (Exception e) {
            return false;
        }
    }

    /** 是否已获得 Shizuku 授权 */
    public static boolean isGranted() {
        try {
            return Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 发起 Shizuku 授权请求（异步，系统弹授权框）。
     * @return 是否成功发起
     */
    public static boolean requestPermission() {
        if (!isShizukuAvailable() || isGranted()) return false;
        final Shizuku.OnRequestPermissionResultListener listener =
                new Shizuku.OnRequestPermissionResultListener() {
                    @Override
                    public void onRequestPermissionResult(int requestCode, int grantResult) {
                        try {
                            Shizuku.removeRequestPermissionResultListener(this);
                        } catch (Exception ignored) {
                        }
                    }
                };
        try {
            Shizuku.addRequestPermissionResultListener(listener);
            Shizuku.requestPermission(1001);
            return true;
        } catch (Exception e) {
            try {
                Shizuku.removeRequestPermissionResultListener(listener);
            } catch (Exception ignored) {
            }
            return false;
        }
    }

    /** 是否有 root */
    public static boolean hasRoot() {
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"su", "-c", "id"});
            String out = new String(p.getInputStream().readAllBytes(), "UTF-8");
            p.waitFor();
            return out.contains("uid=0");
        } catch (Exception e) {
            return false;
        }
    }

    private static String shRoot(String command) {
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"su", "-c", command});
            String out = new String(p.getInputStream().readAllBytes(), "UTF-8");
            p.waitFor();
            String t = out.trim();
            return t.isEmpty() ? null : t;
        } catch (Exception e) {
            return null;
        }
    }

    private static String sh(String command) {
        return shRoot(command);
    }

    /** 读取官方 APP 的 BLE 认证密钥 */
    public static String readOfficialBleKey() {
        StringBuilder sb = new StringBuilder();
        sb.append("=== 官方APP BLE密钥读取 ===\n");
        sb.append("包名: ").append(OFFICIAL_PKG).append("\n");
        sb.append("Shizuku: ").append(isShizukuAvailable() ? "已启动" : "未启动")
            .append(" / 授权: ").append(isGranted() ? "已授权" : "未授权").append("\n");
        sb.append("root: ").append(hasRoot() ? "可用" : "不可用").append("\n\n");

        if (!isShizukuAvailable() && !hasRoot()) {
            sb.append("说明：两种权限都不可用。\n");
            sb.append("请安装并启动 Shizuku（moe.shizuku.privileged.api），\n");
            sb.append("返回本页点按钮 → 系统弹窗点允许 → 再点一次读取。\n");
            return sb.toString();
        }

        if (isShizukuAvailable() && !isGranted()) {
            sb.append("提示：请在系统弹出授权框允许后，再点一次「读取官方密钥」。\n\n");
        }

        String ls = sh("ls -la " + PREFS_DIR + "/");
        sb.append("--- prefs 目录 ---\n").append(ls != null ? ls : "(无法访问 " + PREFS_DIR + "/)").append("\n\n");

        String grep = sh("grep -rE 'GMA_BLE_KEY|32BleKey|bleKey16|psk_key|local32BleKey|gma_last_success' " + PREFS_DIR + "/");
        sb.append("--- 密钥内容 ---\n").append(grep != null ? grep : "(未搜到密钥)").append("\n\n");

        String xml = sh("cat " + PREFS_DIR + "/*.xml");
        if (xml != null) {
            StringBuilder filtered = new StringBuilder();
            for (String line : xml.split("\n")) {
                if (line.contains("GMA_BLE_KEY") || line.contains("bleKey")
                        || line.contains("bind_device") || line.contains("local32BleKey")) {
                    filtered.append(line).append("\n");
                }
            }
            if (filtered.length() > 0) sb.append("--- prefs XML 过滤 ---\n").append(filtered);
        }
        return sb.toString();
    }
}