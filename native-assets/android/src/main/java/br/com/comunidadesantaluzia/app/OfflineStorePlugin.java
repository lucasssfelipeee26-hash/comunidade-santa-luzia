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

import java.io.File;

@CapacitorPlugin(name = "OfflineStore")
public class OfflineStorePlugin extends Plugin {
    private static final String DB_NAME = "santa_luzia_local.db";
    private static final int DB_VERSION = 2;
    private static final String TABLE_DOCUMENTS = "documents";
    private static final String TABLE_BACKUPS = "document_backups";
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

    private static void createDocumentsTable(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE_DOCUMENTS + " (" +
                COL_KEY + " TEXT PRIMARY KEY NOT NULL, " +
                COL_VALUE + " TEXT NOT NULL, " +
                COL_UPDATED_AT + " INTEGER NOT NULL" +
            ")"
        );
    }

    private static void createBackupsTable(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE_BACKUPS + " (" +
                COL_KEY + " TEXT PRIMARY KEY NOT NULL, " +
                COL_VALUE + " TEXT NOT NULL, " +
                COL_UPDATED_AT + " INTEGER NOT NULL" +
            ")"
        );
    }

    private static class LocalDatabase extends SQLiteOpenHelper {
        LocalDatabase(Context context) {
            super(context, DB_NAME, null, DB_VERSION);
            // WAL reduz bloqueios e mantém o journal separado até o commit.
            setWriteAheadLoggingEnabled(true);
        }

        @Override
        public void onConfigure(SQLiteDatabase db) {
            super.onConfigure(db);
            // FULL prioriza durabilidade: só confirma a escrita depois de o
            // SQLite solicitar sincronização do journal/dados ao armazenamento.
            db.execSQL("PRAGMA synchronous=FULL");
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            createDocumentsTable(db);
            createBackupsTable(db);
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            // Migração aditiva: nunca apagamos a tabela principal.
            if (oldVersion < 2) createBackupsTable(db);
        }
    }

    private synchronized LocalDatabase databaseHelper() {
        if (helper == null) helper = new LocalDatabase(getContext().getApplicationContext());
        return helper;
    }

    private SQLiteDatabase database() {
        return databaseHelper().getWritableDatabase();
    }

    private String rawGetFromTable(SQLiteDatabase db, String table, String key, String fallback) {
        try (Cursor cursor = db.query(
            table,
            new String[]{COL_VALUE},
            COL_KEY + " = ?",
            new String[]{key},
            null,
            null,
            null,
            "1"
        )) {
            if (cursor.moveToFirst()) return cursor.getString(0);
            return fallback;
        }
    }

    private String rawGet(SQLiteDatabase db, String key, String fallback) {
        return rawGetFromTable(db, TABLE_DOCUMENTS, key, fallback);
    }

    private void rawPutIntoTable(SQLiteDatabase db, String table, String key, String value) {
        ContentValues values = new ContentValues();
        values.put(COL_KEY, key);
        values.put(COL_VALUE, value);
        values.put(COL_UPDATED_AT, System.currentTimeMillis());
        long result = db.insertWithOnConflict(table, null, values, SQLiteDatabase.CONFLICT_REPLACE);
        if (result == -1L) throw new IllegalStateException("SQLite não confirmou a gravação em " + table + ".");
    }

    private void rawPut(SQLiteDatabase db, String key, String value) {
        rawPutIntoTable(db, TABLE_DOCUMENTS, key, value);
    }

    private void backupPreviousValue(SQLiteDatabase db, String key, String nextValue) {
        String previous = rawGet(db, key, null);
        if (previous == null || previous.equals(nextValue)) return;
        rawPutIntoTable(db, TABLE_BACKUPS, key, previous);
    }

    private synchronized void migrateLegacyIfNeeded() {
        if (migrationChecked) return;
        SQLiteDatabase db = database();
        if ("1".equals(rawGet(db, KEY_MIGRATION, ""))) {
            migrationChecked = true;
            return;
        }

        SharedPreferences legacy = getContext().getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE);
        String snapshot = legacy.getString(LEGACY_SNAPSHOT, "");
        String queue = legacy.getString(LEGACY_QUEUE, "[]");

        db.beginTransaction();
        try {
            if (snapshot != null && !snapshot.isEmpty() && rawGet(db, KEY_SNAPSHOT, "").isEmpty()) rawPut(db, KEY_SNAPSHOT, snapshot);
            if (queue != null && !queue.isEmpty() && !"[]".equals(queue) && "[]".equals(rawGet(db, KEY_QUEUE, "[]"))) rawPut(db, KEY_QUEUE, queue);
            rawPut(db, KEY_MIGRATION, "1");
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }

        legacy.edit().clear().apply();
        migrationChecked = true;
    }

    private boolean validDocumentKey(String key) {
        return key != null && key.matches("[A-Za-z0-9:_\\-.]{1,100}");
    }

    private int byteLength(String value) {
        if (value == null) return 0;
        try {
            return value.getBytes("UTF-8").length;
        } catch (Exception ignored) {
            return value.length();
        }
    }

    private void saveValue(PluginCall call, String key, String value, int maxBytes) {
        if (value == null || byteLength(value) > maxBytes) {
            call.reject("Dado local inválido ou muito grande.");
            return;
        }
        try {
            migrateLegacyIfNeeded();
            SQLiteDatabase db = database();
            db.beginTransaction();
            try {
                backupPreviousValue(db, key, value);
                rawPut(db, key, value);
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("savedAt", System.currentTimeMillis());
            result.put("backupAvailable", !rawGetFromTable(db, TABLE_BACKUPS, key, "").isEmpty());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível salvar o dado local.", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void saveSnapshot(PluginCall call) {
        saveValue(call, KEY_SNAPSHOT, call.getString("snapshot", ""), MAX_SNAPSHOT_BYTES);
    }

    @com.getcapacitor.PluginMethod
    public void loadSnapshot(PluginCall call) {
        try {
            migrateLegacyIfNeeded();
            JSObject result = new JSObject();
            result.put("snapshot", rawGet(database(), KEY_SNAPSHOT, ""));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível ler o estado offline.", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void saveQueue(PluginCall call) {
        saveValue(call, KEY_QUEUE, call.getString("queue", "[]"), MAX_QUEUE_BYTES);
    }

    @com.getcapacitor.PluginMethod
    public void loadQueue(PluginCall call) {
        try {
            migrateLegacyIfNeeded();
            JSObject result = new JSObject();
            result.put("queue", rawGet(database(), KEY_QUEUE, "[]"));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível ler a fila offline.", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void saveDocument(PluginCall call) {
        String key = call.getString("key", "");
        if (!validDocumentKey(key) || key.startsWith("__")) {
            call.reject("Chave local inválida.");
            return;
        }
        saveValue(call, key, call.getString("value", ""), MAX_DOCUMENT_BYTES);
    }

    @com.getcapacitor.PluginMethod
    public void loadDocument(PluginCall call) {
        String key = call.getString("key", "");
        if (!validDocumentKey(key) || key.startsWith("__")) {
            call.reject("Chave local inválida.");
            return;
        }
        try {
            migrateLegacyIfNeeded();
            JSObject result = new JSObject();
            result.put("value", rawGet(database(), key, ""));
            result.put("backupAvailable", !rawGetFromTable(database(), TABLE_BACKUPS, key, "").isEmpty());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível ler o dado local.", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void recoverDocument(PluginCall call) {
        String key = call.getString("key", "");
        if (!validDocumentKey(key) && !KEY_SNAPSHOT.equals(key) && !KEY_QUEUE.equals(key)) {
            call.reject("Chave local inválida.");
            return;
        }
        try {
            migrateLegacyIfNeeded();
            SQLiteDatabase db = database();
            String backup = rawGetFromTable(db, TABLE_BACKUPS, key, "");
            if (backup.isEmpty()) {
                call.reject("Nenhum backup local disponível para este dado.");
                return;
            }
            db.beginTransaction();
            try {
                String current = rawGet(db, key, "");
                rawPut(db, key, backup);
                if (!current.isEmpty()) rawPutIntoTable(db, TABLE_BACKUPS, key, current);
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("recoveredAt", System.currentTimeMillis());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível recuperar o backup local.", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void removeDocument(PluginCall call) {
        String key = call.getString("key", "");
        if (!validDocumentKey(key) || key.startsWith("__")) {
            call.reject("Chave local inválida.");
            return;
        }
        try {
            migrateLegacyIfNeeded();
            SQLiteDatabase db = database();
            db.beginTransaction();
            try {
                String current = rawGet(db, key, "");
                if (!current.isEmpty()) rawPutIntoTable(db, TABLE_BACKUPS, key, current);
                db.delete(TABLE_DOCUMENTS, COL_KEY + " = ?", new String[]{key});
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível remover o dado local.", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void health(PluginCall call) {
        try {
            migrateLegacyIfNeeded();
            SQLiteDatabase db = database();
            String integrity = "unknown";
            String journalMode = "unknown";
            int documents = 0;
            int backups = 0;
            try (Cursor cursor = db.rawQuery("PRAGMA integrity_check", null)) {
                if (cursor.moveToFirst()) integrity = cursor.getString(0);
            }
            try (Cursor cursor = db.rawQuery("PRAGMA journal_mode", null)) {
                if (cursor.moveToFirst()) journalMode = cursor.getString(0);
            }
            try (Cursor cursor = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_DOCUMENTS, null)) {
                if (cursor.moveToFirst()) documents = cursor.getInt(0);
            }
            try (Cursor cursor = db.rawQuery("SELECT COUNT(*) FROM " + TABLE_BACKUPS, null)) {
                if (cursor.moveToFirst()) backups = cursor.getInt(0);
            }
            File file = getContext().getDatabasePath(DB_NAME);
            JSObject result = new JSObject();
            result.put("ok", "ok".equalsIgnoreCase(integrity));
            result.put("integrity", integrity);
            result.put("journalMode", journalMode);
            result.put("version", DB_VERSION);
            result.put("documents", documents);
            result.put("backups", backups);
            result.put("sizeBytes", file.exists() ? file.length() : 0L);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível auditar o banco local.", error);
        }
    }

    @com.getcapacitor.PluginMethod
    public void clear(PluginCall call) {
        try {
            SQLiteDatabase db = database();
            db.beginTransaction();
            try {
                db.delete(TABLE_DOCUMENTS, null, null);
                db.delete(TABLE_BACKUPS, null, null);
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
            getContext().getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
            migrationChecked = false;
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível limpar os dados locais.", error);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (helper != null) {
            helper.close();
            helper = null;
        }
        super.handleOnDestroy();
    }
}
