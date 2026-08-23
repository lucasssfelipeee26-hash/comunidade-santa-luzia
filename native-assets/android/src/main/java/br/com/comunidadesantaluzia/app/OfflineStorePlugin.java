package br.com.comunidadesantaluzia.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "OfflineStore")
public class OfflineStorePlugin extends Plugin {
    private static final String DB_NAME = "santa_luzia_local.db";
    private static final int DB_VERSION = 1;
    private static final String TABLE_DOCUMENTS = "documents";
    private static final String COL_KEY = "doc_key";
    private static final String COL_VALUE = "doc_value";
    private static final String COL_UPDATED_AT = "updated_at";

    private static final String KEY_SNAPSHOT = "snapshot";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_MIGRATION = "__legacy_shared_preferences_migrated_v1";

    private static final String LEGACY_PREFS = "santa_luzia_offline_store_v1";
    private static final String LEGACY_SNAPSHOT = "snapshot";
    private static final String LEGACY_QUEUE = "queue";

    private static final int MAX_SNAPSHOT_BYTES = 16_000_000;
    private static final int MAX_QUEUE_BYTES = 8_000_000;
    private static final int MAX_DOCUMENT_BYTES = 8_000_000;

    private LocalDatabase helper;
    private boolean migrationChecked = false;

    private static class LocalDatabase extends SQLiteOpenHelper {
        LocalDatabase(Context context) { super(context, DB_NAME, null, DB_VERSION); }
        @Override public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE IF NOT EXISTS " + TABLE_DOCUMENTS + " (" + COL_KEY + " TEXT PRIMARY KEY NOT NULL, " + COL_VALUE + " TEXT NOT NULL, " + COL_UPDATED_AT + " INTEGER NOT NULL)");
        }
        @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}
    }

    private synchronized LocalDatabase databaseHelper() {
        if (helper == null) helper = new LocalDatabase(getContext().getApplicationContext());
        return helper;
    }
    private SQLiteDatabase database() { return databaseHelper().getWritableDatabase(); }

    private String rawGet(SQLiteDatabase db, String key, String fallback) {
        try (Cursor cursor = db.query(TABLE_DOCUMENTS, new String[]{COL_VALUE}, COL_KEY + " = ?", new String[]{key}, null, null, null, "1")) {
            if (cursor.moveToFirst()) return cursor.getString(0);
            return fallback;
        }
    }

    private void rawPut(SQLiteDatabase db, String key, String value) {
        ContentValues values = new ContentValues();
        values.put(COL_KEY, key);
        values.put(COL_VALUE, value);
        values.put(COL_UPDATED_AT, System.currentTimeMillis());
        db.insertWithOnConflict(TABLE_DOCUMENTS, null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }

    private synchronized void migrateLegacyIfNeeded() {
        if (migrationChecked) return;
        SQLiteDatabase db = database();
        if ("1".equals(rawGet(db, KEY_MIGRATION, ""))) { migrationChecked = true; return; }
        SharedPreferences legacy = getContext().getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE);
        String snapshot = legacy.getString(LEGACY_SNAPSHOT, "");
        String queue = legacy.getString(LEGACY_QUEUE, "[]");
        db.beginTransaction();
        try {
            if (snapshot != null && !snapshot.isEmpty() && rawGet(db, KEY_SNAPSHOT, "").isEmpty()) rawPut(db, KEY_SNAPSHOT, snapshot);
            if (queue != null && !queue.isEmpty() && !"[]".equals(queue) && "[]".equals(rawGet(db, KEY_QUEUE, "[]"))) rawPut(db, KEY_QUEUE, queue);
            rawPut(db, KEY_MIGRATION, "1");
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        legacy.edit().clear().apply();
        migrationChecked = true;
    }

    private boolean validDocumentKey(String key) { return key != null && key.matches("[A-Za-z0-9:_\\-.]{1,100}"); }
    private int byteLength(String value) { if (value == null) return 0; try { return value.getBytes("UTF-8").length; } catch (Exception ignored) { return value.length(); } }

    private void saveValue(PluginCall call, String key, String value, int maxBytes) {
        if (value == null || byteLength(value) > maxBytes) { call.reject("Dado local inválido ou muito grande."); return; }
        try {
            migrateLegacyIfNeeded();
            rawPut(database(), key, value);
            JSObject result = new JSObject(); result.put("ok", true); result.put("savedAt", System.currentTimeMillis()); call.resolve(result);
        } catch (Exception error) { call.reject("Não foi possível salvar o dado local.", error); }
    }

    private String fallbackBeta8(SQLiteDatabase db, String key) {
        try {
            if ("local:session".equals(key)) {
                String raw = rawGet(db, "snapshot:auth", "");
                if (raw.isEmpty()) return "";
                JSONObject auth = new JSONObject(raw);
                JSONObject sessao = auth.optJSONObject("sessao");
                if (sessao == null || sessao.optJSONObject("usuario") == null) return "";
                JSONObject out = new JSONObject();
                out.put("usuario", sessao.optJSONObject("usuario"));
                out.put("tipo", sessao.optString("tipo", "membro"));
                out.put("savedAt", System.currentTimeMillis());
                return out.toString();
            }
            if ("local:perfil".equals(key)) {
                String raw = rawGet(db, "snapshot:perfil", "");
                if (raw.isEmpty() || "null".equals(raw)) return "";
                JSONObject out = new JSONObject(); out.put("perfil", new JSONObject(raw)); return out.toString();
            }
            if ("local:perfis".equals(key)) {
                String raw = rawGet(db, "snapshot:perfis", "");
                if (raw.isEmpty()) return "";
                JSONObject out = new JSONObject(); out.put("perfis", new JSONArray(raw)); return out.toString();
            }
            if ("local:formacoes".equals(key)) return rawGet(db, "snapshot:formacoes", "");
            if ("local:ranking".equals(key)) return rawGet(db, "snapshot:ranking", "");
            if ("local:escalas".equals(key)) return rawGet(db, "snapshot:escalas", "");
        } catch (Exception ignored) {}
        return "";
    }

    @com.getcapacitor.PluginMethod public void saveSnapshot(PluginCall call) { saveValue(call, KEY_SNAPSHOT, call.getString("snapshot", ""), MAX_SNAPSHOT_BYTES); }
    @com.getcapacitor.PluginMethod public void loadSnapshot(PluginCall call) {
        try { migrateLegacyIfNeeded(); JSObject result = new JSObject(); result.put("snapshot", rawGet(database(), KEY_SNAPSHOT, "")); call.resolve(result); }
        catch (Exception error) { call.reject("Não foi possível ler o estado offline.", error); }
    }
    @com.getcapacitor.PluginMethod public void saveQueue(PluginCall call) { saveValue(call, KEY_QUEUE, call.getString("queue", "[]"), MAX_QUEUE_BYTES); }
    @com.getcapacitor.PluginMethod public void loadQueue(PluginCall call) {
        try { migrateLegacyIfNeeded(); JSObject result = new JSObject(); result.put("queue", rawGet(database(), KEY_QUEUE, "[]")); call.resolve(result); }
        catch (Exception error) { call.reject("Não foi possível ler a fila offline.", error); }
    }

    @com.getcapacitor.PluginMethod public void saveDocument(PluginCall call) {
        String key = call.getString("key", "");
        if (!validDocumentKey(key) || key.startsWith("__")) { call.reject("Chave local inválida."); return; }
        saveValue(call, key, call.getString("value", ""), MAX_DOCUMENT_BYTES);
    }

    @com.getcapacitor.PluginMethod public void loadDocument(PluginCall call) {
        String key = call.getString("key", "");
        if (!validDocumentKey(key) || key.startsWith("__")) { call.reject("Chave local inválida."); return; }
        try {
            migrateLegacyIfNeeded();
            SQLiteDatabase db = database();
            String value = rawGet(db, key, "");
            if (value.isEmpty() && key.startsWith("local:")) {
                value = fallbackBeta8(db, key);
                if (!value.isEmpty()) rawPut(db, key, value);
            }
            JSObject result = new JSObject(); result.put("value", value); call.resolve(result);
        } catch (Exception error) { call.reject("Não foi possível ler o dado local.", error); }
    }

    @com.getcapacitor.PluginMethod public void removeDocument(PluginCall call) {
        String key = call.getString("key", "");
        if (!validDocumentKey(key) || key.startsWith("__")) { call.reject("Chave local inválida."); return; }
        try { migrateLegacyIfNeeded(); database().delete(TABLE_DOCUMENTS, COL_KEY + " = ?", new String[]{key}); JSObject result = new JSObject(); result.put("ok", true); call.resolve(result); }
        catch (Exception error) { call.reject("Não foi possível remover o dado local.", error); }
    }

    @com.getcapacitor.PluginMethod public void clear(PluginCall call) {
        try {
            database().delete(TABLE_DOCUMENTS, null, null);
            getContext().getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
            migrationChecked = false;
            JSObject result = new JSObject(); result.put("ok", true); call.resolve(result);
        } catch (Exception error) { call.reject("Não foi possível limpar os dados locais.", error); }
    }

    @Override protected void handleOnDestroy() { if (helper != null) { helper.close(); helper = null; } super.handleOnDestroy(); }
}
