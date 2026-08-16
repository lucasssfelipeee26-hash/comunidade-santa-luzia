package br.com.comunidadesantaluzia.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OfflineStore")
public class OfflineStorePlugin extends Plugin {
    private static final String PREFS = "santa_luzia_offline_store_v1";
    private static final String SNAPSHOT = "snapshot";
    private static final String QUEUE = "queue";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @com.getcapacitor.PluginMethod
    public void saveSnapshot(PluginCall call) {
        String snapshot = call.getString("snapshot", "");
        if (snapshot == null || snapshot.length() > 6_000_000) {
            call.reject("Snapshot offline inválido ou muito grande.");
            return;
        }
        prefs().edit().putString(SNAPSHOT, snapshot).apply();
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("savedAt", System.currentTimeMillis());
        call.resolve(result);
    }

    @com.getcapacitor.PluginMethod
    public void loadSnapshot(PluginCall call) {
        JSObject result = new JSObject();
        result.put("snapshot", prefs().getString(SNAPSHOT, ""));
        call.resolve(result);
    }

    @com.getcapacitor.PluginMethod
    public void saveQueue(PluginCall call) {
        String queue = call.getString("queue", "[]");
        if (queue == null || queue.length() > 1_500_000) {
            call.reject("Fila offline inválida ou muito grande.");
            return;
        }
        prefs().edit().putString(QUEUE, queue).apply();
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @com.getcapacitor.PluginMethod
    public void loadQueue(PluginCall call) {
        JSObject result = new JSObject();
        result.put("queue", prefs().getString(QUEUE, "[]"));
        call.resolve(result);
    }

    @com.getcapacitor.PluginMethod
    public void clear(PluginCall call) {
        prefs().edit().clear().apply();
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }
}
