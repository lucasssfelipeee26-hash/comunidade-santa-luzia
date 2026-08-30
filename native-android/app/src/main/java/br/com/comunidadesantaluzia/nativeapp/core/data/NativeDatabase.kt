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
    val ownerUserId: String?,
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
              owner_user_id TEXT NOT NULL,
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
        db.execSQL("CREATE INDEX mutation_queue_owner_created_idx ON mutation_queue(owner_user_id, created_at)")
        createAuditEventsTable(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        var version = oldVersion
        if (version == 1) {
            // v1 não vinculava a fila offline a uma conta. Preservamos as linhas antigas,
            // mas elas ficam em quarentena (owner_user_id NULL) e nunca são reproduzidas
            // automaticamente sob uma conta diferente.
            db.execSQL("ALTER TABLE mutation_queue ADD COLUMN owner_user_id TEXT")
            db.execSQL("CREATE INDEX IF NOT EXISTS mutation_queue_owner_created_idx ON mutation_queue(owner_user_id, created_at)")
            version = 2
        }
        check(version == newVersion) {
            "Migração SQLite ausente: $oldVersion -> $newVersion (parou em $version)"
        }
    }

    private fun createAuditEventsTable(db: SQLiteDatabase) {
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

    fun enqueue(ownerUserId: String, method: String, path: String, payload: String?): String {
        require(ownerUserId.isNotBlank()) { "Uma alteração offline precisa ter um usuário proprietário." }
        val id = UUID.randomUUID().toString()
        val values = ContentValues().apply {
            put("id", id)
            put("owner_user_id", ownerUserId)
            put("method", method.uppercase())
            put("path", path)
            put("payload", payload)
            put("created_at", System.currentTimeMillis())
            put("attempts", 0)
        }
        writableDatabase.insertOrThrow("mutation_queue", null, values)
        return id
    }

    fun pendingMutationsForOwner(ownerUserId: String, limit: Int = 100): List<PendingMutation> {
        if (ownerUserId.isBlank()) return emptyList()
        return queryPendingMutations(
            selection = "owner_user_id = ?",
            selectionArgs = arrayOf(ownerUserId),
            limit = limit,
        )
    }

    private fun queryPendingMutations(
        selection: String?,
        selectionArgs: Array<String>?,
        limit: Int,
    ): List<PendingMutation> {
        val result = mutableListOf<PendingMutation>()
        readableDatabase.query(
            "mutation_queue",
            arrayOf("id", "owner_user_id", "method", "path", "payload", "created_at", "attempts", "last_error"),
            selection,
            selectionArgs,
            null,
            null,
            "created_at ASC",
            limit.coerceIn(1, 500).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result += PendingMutation(
                    id = cursor.getString(0),
                    ownerUserId = if (cursor.isNull(1)) null else cursor.getString(1),
                    method = cursor.getString(2),
                    path = cursor.getString(3),
                    payload = if (cursor.isNull(4)) null else cursor.getString(4),
                    createdAt = cursor.getLong(5),
                    attempts = cursor.getInt(6),
                    lastError = if (cursor.isNull(7)) null else cursor.getString(7),
                )
            }
        }
        return result
    }

    fun quarantinedMutationCount(): Int = readableDatabase.rawQuery(
        "SELECT COUNT(*) FROM mutation_queue WHERE owner_user_id IS NULL OR trim(owner_user_id) = ''",
        null,
    ).use { cursor ->
        if (cursor.moveToFirst()) cursor.getInt(0) else 0
    }

    fun completeMutation(id: String) {
        writableDatabase.delete("mutation_queue", "id = ?", arrayOf(id))
    }

    fun failMutation(id: String, error: String) {
        writableDatabase.execSQL(
            "UPDATE mutation_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?",
            arrayOf<Any?>(error.take(400), id),
        )
    }

    fun queueSize(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM mutation_queue", null).use { cursor ->
        if (cursor.moveToFirst()) cursor.getInt(0) else 0
    }

    fun integrityCheck(): String = readableDatabase.rawQuery("PRAGMA integrity_check", null).use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else "unknown"
    }

    fun clearLocalUserData() {
        writableDatabase.beginTransaction()
        try {
            writableDatabase.delete("mutation_queue", null, null)
            writableDatabase.delete("documents", null, null)
            writableDatabase.delete("audit_events", null, null)
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
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
                arrayOf<Any?>(signature, level, type, message.take(600), detail?.take(4000), at, at),
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
        const val DATABASE_VERSION = 2

        fun userDocumentKey(userId: String, cacheKey: String): String {
            require(userId.isNotBlank()) { "Cache autenticado precisa de proprietário." }
            require(cacheKey.isNotBlank()) { "Chave de cache não pode ser vazia." }
            return "user:${userId.trim()}:$cacheKey"
        }
    }
}
