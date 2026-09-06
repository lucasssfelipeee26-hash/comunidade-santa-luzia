package br.com.comunidadesantaluzia.app;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Debug;
import android.os.SystemClock;
import android.os.Trace;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "DeepDiagnostics")
public class DeepDiagnosticsPlugin extends Plugin {
    private static final Object LOCK = new Object();
    private static final String PREFS = "santa_luzia_deep_diagnostics_v1";
    private static final String KEY_BREADCRUMBS = "breadcrumbs";
    private static final String KEY_CLEAR_CUTOFF = "clear_cutoff";
    private static final int MAX_BREADCRUMBS = 180;
    private static final int MAX_EXITS = 12;
    private static final int MAX_TRACE_BYTES = 96 * 1024;
    private static final int MAX_DETAIL_CHARS = 3200;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String clamp(String value, int max) {
        if (value == null) return "";
        String clean = value
            .replaceAll("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]+", "Bearer [redigido]")
            .replaceAll("(?i)(password|senha|token|authorization|cookie)(\\s*[:=]\\s*)[^,;\\s}]+", "$1$2[redigido]")
            .replaceAll("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", "[email-redigido]");
        return clean.length() > max ? clean.substring(0, max) + "…" : clean;
    }

    private static void appendBreadcrumb(Context context, String type, String level, String route, String message, String detailJson) {
        if (context == null) return;
        synchronized (LOCK) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                JSONArray rows;
                try { rows = new JSONArray(prefs.getString(KEY_BREADCRUMBS, "[]")); }
                catch (Exception ignored) { rows = new JSONArray(); }

                JSONObject row = new JSONObject();
                row.put("at", System.currentTimeMillis());
                row.put("elapsedRealtime", SystemClock.elapsedRealtime());
                row.put("type", clamp(type, 80));
                row.put("level", clamp(level, 24));
                row.put("route", clamp(route, 220));
                row.put("message", clamp(message, 700));
                if (detailJson != null && !detailJson.isEmpty()) row.put("detail", clamp(detailJson, MAX_DETAIL_CHARS));
                rows.put(row);

                JSONArray trimmed = new JSONArray();
                int start = Math.max(0, rows.length() - MAX_BREADCRUMBS);
                for (int i = start; i < rows.length(); i++) trimmed.put(rows.get(i));
                prefs.edit().putString(KEY_BREADCRUMBS, trimmed.toString()).commit();
            } catch (Exception ignored) {
                // Diagnóstico nunca pode derrubar o aplicativo.
            }
        }
    }

    public static void recordLifecycle(Context context, String event, String detail) {
        appendBreadcrumb(context, "android-lifecycle", "info", "", event, detail);
    }

    private static boolean crashlyticsAvailable() {
        try {
            Class.forName("com.google.firebase.crashlytics.FirebaseCrashlytics");
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static Object crashlyticsInstance() throws Exception {
        Class<?> clazz = Class.forName("com.google.firebase.crashlytics.FirebaseCrashlytics");
        Method getInstance = clazz.getMethod("getInstance");
        return getInstance.invoke(null);
    }

    private static void crashlyticsLog(String message) {
        try {
            Object instance = crashlyticsInstance();
            instance.getClass().getMethod("log", String.class).invoke(instance, clamp(message, 900));
        } catch (Throwable ignored) {}
    }

    private static void crashlyticsRecord(Throwable error) {
        try {
            Object instance = crashlyticsInstance();
            instance.getClass().getMethod("recordException", Throwable.class).invoke(instance, error);
        } catch (Throwable ignored) {}
    }

    private static JSObject memorySnapshot(Context context) {
        JSObject result = new JSObject();
        try {
            ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo memoryInfo = new ActivityManager.MemoryInfo();
            if (manager != null) manager.getMemoryInfo(memoryInfo);
            Runtime runtime = Runtime.getRuntime();
            long runtimeUsed = runtime.totalMemory() - runtime.freeMemory();
            result.put("available", true);
            result.put("at", System.currentTimeMillis());
            result.put("pid", android.os.Process.myPid());
            result.put("pssKb", Debug.getPss());
            result.put("nativeHeapAllocatedBytes", Debug.getNativeHeapAllocatedSize());
            result.put("runtimeUsedBytes", runtimeUsed);
            result.put("runtimeTotalBytes", runtime.totalMemory());
            result.put("runtimeMaxBytes", runtime.maxMemory());
            result.put("systemAvailBytes", memoryInfo.availMem);
            result.put("systemTotalBytes", Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN ? memoryInfo.totalMem : 0L);
            result.put("systemThresholdBytes", memoryInfo.threshold);
            result.put("systemLowMemory", memoryInfo.lowMemory);
        } catch (Throwable error) {
            result.put("available", false);
            result.put("error", clamp(error.getMessage(), 400));
        }
        return result;
    }

    private static String reasonLabel(int reason) {
        switch (reason) {
            case ApplicationExitInfo.REASON_EXIT_SELF: return "EXIT_SELF";
            case ApplicationExitInfo.REASON_SIGNALED: return "SIGNALED";
            case ApplicationExitInfo.REASON_LOW_MEMORY: return "LOW_MEMORY";
            case ApplicationExitInfo.REASON_CRASH: return "CRASH";
            case ApplicationExitInfo.REASON_CRASH_NATIVE: return "CRASH_NATIVE";
            case ApplicationExitInfo.REASON_ANR: return "ANR";
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE: return "INITIALIZATION_FAILURE";
            case ApplicationExitInfo.REASON_PERMISSION_CHANGE: return "PERMISSION_CHANGE";
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: return "EXCESSIVE_RESOURCE_USAGE";
            case ApplicationExitInfo.REASON_USER_REQUESTED: return "USER_REQUESTED";
            case ApplicationExitInfo.REASON_USER_STOPPED: return "USER_STOPPED";
            case ApplicationExitInfo.REASON_DEPENDENCY_DIED: return "DEPENDENCY_DIED";
            case ApplicationExitInfo.REASON_OTHER: return "OTHER";
            case ApplicationExitInfo.REASON_FREEZER: return "FREEZER";
            case ApplicationExitInfo.REASON_UNKNOWN:
            default: return "UNKNOWN";
        }
    }

    private static String readTrace(InputStream input) {
        if (input == null) return "";
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int total = 0;
            int read;
            while ((read = in.read(buffer)) > 0 && total < MAX_TRACE_BYTES) {
                int count = Math.min(read, MAX_TRACE_BYTES - total);
                out.write(buffer, 0, count);
                total += count;
            }
            return clamp(out.toString(StandardCharsets.UTF_8.name()), MAX_TRACE_BYTES);
        } catch (Throwable error) {
            return "trace-unavailable: " + clamp(error.getMessage(), 300);
        }
    }

    private static final class Api30 {
        static JSArray exits(Context context, long cutoff) {
            JSArray result = new JSArray();
            try {
                ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
                if (manager == null) return result;
                List<ApplicationExitInfo> history = manager.getHistoricalProcessExitReasons(context.getPackageName(), 0, MAX_EXITS);
                for (ApplicationExitInfo info : history) {
                    if (info.getTimestamp() <= cutoff) continue;
                    JSObject row = new JSObject();
                    row.put("timestamp", info.getTimestamp());
                    row.put("reason", info.getReason());
                    row.put("reasonLabel", reasonLabel(info.getReason()));
                    row.put("status", info.getStatus());
                    row.put("importance", info.getImportance());
                    row.put("pssKb", info.getPss());
                    row.put("rssKb", info.getRss());
                    row.put("description", clamp(info.getDescription(), 1000));
                    row.put("processName", clamp(info.getProcessName(), 240));
                    String trace = readTrace(info.getTraceInputStream());
                    if (!trace.isEmpty()) row.put("trace", trace);
                    result.put(row);
                }
            } catch (Throwable error) {
                JSObject row = new JSObject();
                row.put("error", clamp(error.getClass().getSimpleName() + ": " + error.getMessage(), 500));
                result.put(row);
            }
            return result;
        }
    }

    private static final class Api29 {
        static void begin(String name, int cookie) { Trace.beginAsyncSection(name, cookie); }
        static void end(String name, int cookie) { Trace.endAsyncSection(name, cookie); }
    }

    @PluginMethod
    public void recordBreadcrumb(PluginCall call) {
        String type = call.getString("type", "event");
        String level = call.getString("level", "info");
        String route = call.getString("route", "");
        String message = call.getString("message", "");
        String detailJson = call.getString("detailJson", "");
        appendBreadcrumb(getContext(), type, level, route, message, detailJson);
        if (crashlyticsAvailable()) crashlyticsLog(String.format(Locale.US, "[%s][%s] %s %s", level, type, route, message));
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("crashlytics", crashlyticsAvailable());
        call.resolve(result);
    }

    @PluginMethod
    public void recordNonFatal(PluginCall call) {
        String type = call.getString("type", "webview");
        String message = call.getString("message", "Erro não fatal do WebView");
        String route = call.getString("route", "");
        appendBreadcrumb(getContext(), type, "error", route, message, call.getString("detailJson", ""));
        if (crashlyticsAvailable()) crashlyticsRecord(new RuntimeException("SantaLuzia/" + type + ": " + clamp(message, 1000)));
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("crashlytics", crashlyticsAvailable());
        call.resolve(result);
    }

    @PluginMethod
    public void memorySnapshot(PluginCall call) {
        call.resolve(memorySnapshot(getContext()));
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put("applicationExitInfoAvailable", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R);
        result.put("perfettoTraceMarkersAvailable", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q);
        result.put("crashlyticsAvailable", crashlyticsAvailable());
        result.put("memory", memorySnapshot(getContext()));

        try {
            JSONArray breadcrumbs = new JSONArray(prefs().getString(KEY_BREADCRUMBS, "[]"));
            result.put("breadcrumbs", new JSArray(breadcrumbs.toString()));
        } catch (Throwable ignored) {
            result.put("breadcrumbs", new JSArray());
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            result.put("processExits", Api30.exits(getContext(), prefs().getLong(KEY_CLEAR_CUTOFF, 0L)));
        } else {
            result.put("processExits", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void beginTrace(PluginCall call) {
        String name = clamp(call.getString("name", "SantaLuzia"), 120);
        int cookie = call.getInt("cookie", 1);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) Api29.begin(name, cookie);
            call.resolve(new JSObject().put("ok", true).put("available", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q));
        } catch (Exception error) {
            call.reject("Falha ao iniciar marcador Perfetto.", "TRACE_BEGIN", error);
        }
    }

    @PluginMethod
    public void endTrace(PluginCall call) {
        String name = clamp(call.getString("name", "SantaLuzia"), 120);
        int cookie = call.getInt("cookie", 1);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) Api29.end(name, cookie);
            call.resolve(new JSObject().put("ok", true).put("available", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q));
        } catch (Exception error) {
            call.reject("Falha ao encerrar marcador Perfetto.", "TRACE_END", error);
        }
    }

    @PluginMethod
    public void clearHistory(PluginCall call) {
        try {
            prefs().edit()
                .putString(KEY_BREADCRUMBS, "[]")
                .putLong(KEY_CLEAR_CUTOFF, System.currentTimeMillis())
                .commit();
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception error) {
            call.reject("Falha ao limpar histórico profundo.", "DEEP_CLEAR", error);
        }
    }
}
