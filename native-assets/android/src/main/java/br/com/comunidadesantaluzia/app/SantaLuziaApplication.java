package br.com.comunidadesantaluzia.app;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Process;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.PrintWriter;
import java.io.StringWriter;

public class SantaLuziaApplication extends Application {
    private static final String MOTION_BETA_PACKAGE = "br.com.comunidadesantaluzia.motionbeta";
    private static final String PREFS = "santa_luzia_deep_diagnostics_v1";
    private static final String KEY_FATAL_CRASHES = "fatal_crashes";
    private static final int MAX_FATAL_CRASHES = 12;
    private Thread.UncaughtExceptionHandler previousHandler;

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        if (MOTION_BETA_PACKAGE.equals(base.getPackageName())) installFatalRecorder();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        if (MOTION_BETA_PACKAGE.equals(getPackageName())) {
            DeepDiagnosticsPlugin.recordLifecycle(this, "application-onCreate", "pid=" + Process.myPid());
        }
    }

    private void installFatalRecorder() {
        previousHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                persistFatal(thread, error);
            } catch (Throwable ignored) {
                // O gravador jamais pode substituir a exceção original.
            }

            if (previousHandler != null) {
                previousHandler.uncaughtException(thread, error);
            } else {
                Process.killProcess(Process.myPid());
                System.exit(10);
            }
        });

        DeepDiagnosticsPlugin.recordLifecycle(this, "fatal-recorder-installed", "pid=" + Process.myPid());
    }

    private void persistFatal(Thread thread, Throwable error) {
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray existing;
        try {
            existing = new JSONArray(prefs.getString(KEY_FATAL_CRASHES, "[]"));
        } catch (Throwable ignored) {
            existing = new JSONArray();
        }

        JSONObject row = new JSONObject();
        try {
            row.put("timestamp", System.currentTimeMillis());
            row.put("elapsedRealtime", SystemClock.elapsedRealtime());
            row.put("pid", Process.myPid());
            row.put("threadName", thread == null ? "" : thread.getName());
            row.put("threadId", thread == null ? -1L : thread.getId());
            row.put("exceptionClass", error == null ? "" : error.getClass().getName());
            row.put("message", clamp(error == null ? "" : error.getMessage(), 1200));
            row.put("stackTrace", clamp(stack(error), 32000));
        } catch (Throwable ignored) {}

        existing.put(row);
        JSONArray trimmed = new JSONArray();
        int start = Math.max(0, existing.length() - MAX_FATAL_CRASHES);
        for (int i = start; i < existing.length(); i++) {
            try { trimmed.put(existing.get(i)); } catch (Throwable ignored) {}
        }
        prefs.edit().putString(KEY_FATAL_CRASHES, trimmed.toString()).commit();
    }

    private static String stack(Throwable error) {
        if (error == null) return "";
        StringWriter writer = new StringWriter();
        PrintWriter printer = new PrintWriter(writer);
        error.printStackTrace(printer);
        printer.flush();
        return writer.toString();
    }

    private static String clamp(String value, int max) {
        if (value == null) return "";
        String clean = value
            .replaceAll("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]+", "Bearer [redigido]")
            .replaceAll("(?i)(password|senha|token|authorization|cookie)(\\s*[:=]\\s*)[^,;\\s}]+", "$1$2[redigido]")
            .replaceAll("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", "[email-redigido]");
        return clean.length() > max ? clean.substring(0, max) + "…" : clean;
    }
}
