package br.com.comunidadesantaluzia.nativeapp.core.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID

internal data class CachedDocument(
    val key: String,
    val payload: String,
    val updatedAt: Long,
    val etag: String?,
)

internal data class PendingMutation(
    val id: String,
    val method: String,
    val path: String,
    val payload: String?,
    val createdAt: Long,
    val attempts: Int,
    val lastError: String?,
)

internal class NativeDatabase(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        db.setForeignKeyConstraintsEnabled(true)
        db.enableWriteAheadLogging()
        db.execSQL("PRAGMA synchronous=FULL")
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE documents (
              key TEXT PRIMARY KEY NOT NULL,
              payload TEXT NOT NULL,
              updated_at INTEGER NOT NULL,
              etag TEXT
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE mutation_queue (
              id TEXT PRIMARY KEY NOT NULL,
              method TEXT NOT NULL,
              path TEXT NOT NULL,
              payload TEXT,
              created_at INTEGER NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0,
              last_error TEXT
            )
            """.trimIndent(),
        )
        db.execSQL("CREATE INDEX mutation_queue_created_idx ON mutation_queue(created_at)")
        db.execSQL(
            """
            CREATE TABLE audit_events (
              signature TEXT PRIMARY KEY NOT NULL,
              level TEXT NOT NULL,
              type TEXT NOT NULL,
              message TEXT NOT NULL,
              detail TEXT,
              occurrences INTEGER NOT NULL DEFAULT 1,
              first_at INTEGER NOT NULL,
              last_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // A migração nativa nunca usa destructiveMigration. Cada mudança de schema
        // deverá ter um passo explícito antes de alterar DATABASE_VERSION.
        check(oldVersion == newVersion) {
            "Migração SQLite ausente: $oldVersion -> $newVersion"
        }
    }

    fun putDocument(key: String, payload: String, etag: String? = null, updatedAt: Long = System.currentTimeMillis()) {
        writableDatabase.beginTransaction()
        try {
            val values = ContentValues().apply {
                put("key", key)
                put("payload", payload)
                put("updated_at", updatedAt)
                put("etag", etag)
            }
            writableDatabase.insertWithOnConflict("documents", null, values, SQLiteDatabase.CONFLICT_REPLACE)
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    fun getDocument(key: String): CachedDocument? {
        readableDatabase.query(
            "documents",
            arrayOf("key", "payload", "updated_at", "etag"),
            "key = ?",
            arrayOf(key),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            return CachedDocument(
                key = cursor.getString(0),
                payload = cursor.getString(1),
                updatedAt = cursor.getLong(2),
                etag = if (cursor.isNull(3)) null else cursor.getString(3),
            )
        }
    }

    fun enqueue(method: String, path: String, payload: String?): String {
        val id = UUID.randomUUID().toString()
        val values = ContentValues().apply {
            put("id", id)
            put("method", method.uppercase())
            put("path", path)
            put("payload", payload)
            put("created_at", System.currentTimeMillis())
            put("attempts", 0)
        }
        writableDatabase.insertOrThrow("mutation_queue", null, values)
        return id
    }

    fun pendingMutations(limit: Int = 100): List<PendingMutation> {
        val result = mutableListOf<PendingMutation>()
        readableDatabase.query(
            "mutation_queue",
            arrayOf("id", "method", "path", "payload", "created_at", "attempts", "last_error"),
            null,
            null,
            null,
            null,
            "created_at ASC",
            limit.coerceIn(1, 500).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result += PendingMutation(
                    id = cursor.getString(0),
                    method = cursor.getString(1),
                    path = cursor.getString(2),
                    payload = if (cursor.isNull(3)) null else cursor.getString(3),
                    createdAt = cursor.getLong(4),
                    attempts = cursor.getInt(5),
                    lastError = if (cursor.isNull(6)) null else cursor.getString(6),
                )
            }
        }
        return result
    }

    fun completeMutation(id: String) {
        writableDatabase.delete("mutation_queue", "id = ?", arrayOf(id))
    }

    fun failMutation(id: String, error: String) {
        val values = ContentValues().apply {
            put("last_error", error.take(400))
        }
        writableDatabase.execSQL(
            "UPDATE mutation_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?",
            arrayOf(error.take(400), id),
        )
    }

    fun queueSize(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM mutation_queue", null).use { cursor ->
        if (cursor.moveToFirst()) cursor.getInt(0) else 0
    }

    fun integrityCheck(): String = readableDatabase.rawQuery("PRAGMA integrity_check", null).use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else "unknown"
    }

    fun clearAuditEvents() {
        writableDatabase.delete("audit_events", null, null)
    }

    fun upsertAuditEvent(
        signature: String,
        level: String,
        type: String,
        message: String,
        detail: String?,
        at: Long = System.currentTimeMillis(),
    ) {
        writableDatabase.beginTransaction()
        try {
            writableDatabase.execSQL(
                """
                INSERT INTO audit_events(signature, level, type, message, detail, occurrences, first_at, last_at)
                VALUES(?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(signature) DO UPDATE SET
                  level = excluded.level,
                  type = excluded.type,
                  message = excluded.message,
                  detail = excluded.detail,
                  occurrences = audit_events.occurrences + 1,
                  last_at = excluded.last_at
                """.trimIndent(),
                arrayOf(signature, level, type, message.take(600), detail?.take(4000), at, at),
            )
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    fun auditEventsJson(): String {
        val rows = mutableListOf<String>()
        readableDatabase.rawQuery(
            "SELECT signature, level, type, message, detail, occurrences, first_at, last_at FROM audit_events ORDER BY last_at DESC",
            null,
        ).use { cursor ->
            while (cursor.moveToNext()) {
                rows += org.json.JSONObject().apply {
                    put("signature", cursor.getString(0))
                    put("level", cursor.getString(1))
                    put("type", cursor.getString(2))
                    put("message", cursor.getString(3))
                    put("detail", if (cursor.isNull(4)) org.json.JSONObject.NULL else cursor.getString(4))
                    put("occurrences", cursor.getInt(5))
                    put("firstAt", cursor.getLong(6))
                    put("lastAt", cursor.getLong(7))
                }.toString()
            }
        }
        return "[${rows.joinToString(",")}]"
    }

    companion object {
        const val DATABASE_NAME = "santa-luzia-native.db"
        const val DATABASE_VERSION = 1
    }
}
