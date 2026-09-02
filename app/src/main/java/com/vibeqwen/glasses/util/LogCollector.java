package com.vibeqwen.glasses.util;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * APP 内日志收集器：捕获连接/握手/录音/传输层运行日志，支持导出文件。
 * 设计：内存环形缓冲 + logcat 镜像 + 导出带设备信息的 .log 文件。
 */
public class LogCollector {

    private static final String TAG = "vibeLog";
    private static final int MAX_BUFFER = 5000;

    private static final Queue<String> buffer = new ConcurrentLinkedQueue<>();
    private static volatile boolean enabled = true;

    public static boolean isEnabled() { return enabled; }
    public static void setEnabled(boolean v) { enabled = v; }

    /** 记录一条日志 */
    public static void log(String scope, String message) {
        if (!enabled) return;
        String ts = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(new Date());
        String line = ts + " [" + scope + "] " + message;
        buffer.add(line);
        while (buffer.size() > MAX_BUFFER) buffer.poll();
        Log.i(TAG + "/" + scope, message);
    }

    /** 连接层 */
    public static void c(String m) { log("CONN", m); }
    /** 握手层 */
    public static void h(String m) { log("HANDSHAKE", m); }
    /** 协议层 */
    public static void p(String m) { log("PROTO", m); }
    /** 录音层 */
    public static void r(String m) { log("RECORD", m); }
    /** 错误 */
    public static void e(String m) { log("ERROR", m); }

    /** 当前缓冲日志 */
    public static java.util.List<String> dump() {
        return new java.util.ArrayList<>(buffer);
    }

    /** 导出日志文件（带设备信息头），返回文件或 null */
    public static File export(Context context) {
        try {
            File dir = new File(context.getExternalFilesDir(null), "logs");
            if (!dir.exists()) dir.mkdirs();
            String name = "vibeqwen_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".log";
            File file = new File(dir, name);
            PrintWriter pw = new PrintWriter(new FileOutputStream(file), true);
            pw.println("==========================================");
            pw.println("vibeQwenGlasses 日志导出");
            pw.println("时间: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()));
            pw.println("设备: " + Build.MANUFACTURER + " " + Build.MODEL);
            pw.println("系统: Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
            pw.println("==========================================");
            pw.println();
            for (String s : buffer) pw.println(s);
            pw.println();
            pw.println("===== END =====");
            pw.close();
            return file;
        } catch (Exception ex) {
            Log.e(TAG, "导出日志失败: " + ex.getMessage());
            return null;
        }
    }

    public static void clear() { buffer.clear(); }
    public static int size() { return buffer.size(); }
}