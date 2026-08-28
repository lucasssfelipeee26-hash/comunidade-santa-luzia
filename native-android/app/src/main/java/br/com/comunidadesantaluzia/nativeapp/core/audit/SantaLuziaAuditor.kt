package br.com.comunidadesantaluzia.nativeapp.core.audit

import android.app.Activity
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Debug
import android.os.StrictMode
import android.view.Choreographer
import br.com.comunidadesantaluzia.nativeapp.BuildConfig
import br.com.comunidadesantaluzia.nativeapp.core.data.NativeDatabase
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class SantaLuziaAuditor(
    private val context: Context,
    private val database: NativeDatabase,
) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "santa-luzia-auditor").apply { isDaemon = true }
    }
    private var frameMonitor: FrameMonitor? = null
    private var previousUncaughtHandler: Thread.UncaughtExceptionHandler? = null

    fun install() {
        installCrashCapture()
        installStrictModeCapture()
        record("info", "auditor-start", "Auditor Santa Luzia nativo inicializado")
    }

    fun attach(activity: Activity) {
        if (frameMonitor != null) return
        frameMonitor = FrameMonitor { frameMs ->
            when {
                frameMs >= 120 -> recordAsync("error", "frame-jank", "Frame extremamente lento", "{\"frameMs\":$frameMs}")
                frameMs >= 50 -> recordAsync("warning", "frame-jank", "Frame lento detectado", "{\"frameMs\":$frameMs}")
            }
        }.also { it.start() }
    }

    fun detach() {
        frameMonitor?.stop()
        frameMonitor = null
    }

    fun record(level: String, type: String, message: String, detail: String? = null) {
        val signature = signatureFor(level, type, message)
        database.upsertAuditEvent(
            signature = signature,
            level = level,
            type = type,
            message = message,
            detail = detail,
        )
    }

    fun recordAsync(level: String, type: String, message: String, detail: String? = null) {
        executor.execute { record(level, type, message, detail) }
    }

    fun runSelfAudit(): JSONObject {
        val integrity = runCatching { database.integrityCheck() }.getOrElse { "error:${it.javaClass.simpleName}" }
        val queueSize = runCatching { database.queueSize() }.getOrDefault(-1)
        val events = JSONArray(database.auditEventsJson())
        val uniqueErrors = (0 until events.length()).count { events.getJSONObject(it).optString("level") == "error" }
        val uniqueWarnings = (0 until events.length()).count { events.getJSONObject(it).optString("level") == "warning" }
        val network = networkState()
        val report = JSONObject().apply {
            put("schema", "santa-luzia-native-audit-v1")
            put("version", BuildConfig.VERSION_NAME)
            put("generatedAt", System.currentTimeMillis())
            put("database", JSONObject().apply {
                put("integrity", integrity)
                put("ok", integrity.equals("ok", ignoreCase = true))
            })
            put("queue", JSONObject().apply {
                put("pending", queueSize)
            })
            put("network", network)
            put("performance", JSONObject().apply {
                put("nativeHeapBytes", Debug.getNativeHeapAllocatedSize())
                put("runtimeUsedBytes", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory())
            })
            put("summary", JSONObject().apply {
                put("errors", uniqueErrors)
                put("warnings", uniqueWarnings)
                put("eventsUnique", events.length())
            })
            put("events", events)
            put("privacy", "Relatório técnico local: sem senha, cookie de sessão ou conteúdo de campos de formulário.")
        }
        if (!integrity.equals("ok", ignoreCase = true)) {
            record("error", "sqlite-integrity", "SQLite não retornou integridade OK", "{\"result\":${JSONObject.quote(integrity)}}")
        }
        if (queueSize > 100) {
            record("warning", "sync-queue-large", "Fila de sincronização acima de 100 itens", "{\"pending\":$queueSize}")
        }
        return report
    }

    fun exportReport(): File {
        val directory = File(context.filesDir, "diagnosticos").apply { mkdirs() }
        val file = File(directory, "Santa-Luzia-Diagnostico-${System.currentTimeMillis()}.json")
        file.writeText(runSelfAudit().toString(2), Charsets.UTF_8)
        return file
    }

    fun clearHistory() {
        database.clearAuditEvents()
        File(context.filesDir, "diagnosticos").listFiles()?.forEach { runCatching { it.delete() } }
    }

    fun shutdown() {
        detach()
        executor.shutdownNow()
        previousUncaughtHandler?.let { Thread.setDefaultUncaughtExceptionHandler(it) }
    }

    private fun networkState(): JSONObject {
        val manager = context.getSystemService(ConnectivityManager::class.java)
        val network = manager.activeNetwork
        val capabilities = network?.let(manager::getNetworkCapabilities)
        val connected = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        return JSONObject().apply {
            put("connected", connected)
            put("validated", capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true)
            put("wifi", capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true)
            put("cellular", capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true)
        }
    }

    private fun installCrashCapture() {
        if (previousUncaughtHandler != null) return
        previousUncaughtHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching {
                record(
                    level = "error",
                    type = "uncaught-exception",
                    message = "${throwable.javaClass.simpleName}: ${throwable.message.orEmpty()}".take(600),
                    detail = JSONObject().put("thread", thread.name).put("stack", throwable.stackTraceToString().take(6000)).toString(),
                )
            }
            previousUncaughtHandler?.uncaughtException(thread, throwable)
        }
    }

    private fun installStrictModeCapture() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
        val listener = StrictMode.OnThreadViolationListener { violation ->
            recordAsync(
                "warning",
                "strict-mode-thread",
                violation.javaClass.simpleName,
                JSONObject().put("message", violation.message.orEmpty().take(1000)).toString(),
            )
        }
        StrictMode.setThreadPolicy(
            StrictMode.ThreadPolicy.Builder()
                .detectNetwork()
                .detectDiskWrites()
                .penaltyListener(executor, listener)
                .build(),
        )
        StrictMode.setVmPolicy(
            StrictMode.VmPolicy.Builder()
                .detectLeakedClosableObjects()
                .penaltyListener(executor) { violation ->
                    recordAsync(
                        "warning",
                        "strict-mode-vm",
                        violation.javaClass.simpleName,
                        JSONObject().put("message", violation.message.orEmpty().take(1000)).toString(),
                    )
                }
                .build(),
        )
    }

    private fun signatureFor(level: String, type: String, message: String): String {
        val normalized = "$level|$type|${message.replace(Regex("\\b\\d{2,}\\b"), "#").take(500)}"
        return MessageDigest.getInstance("SHA-256")
            .digest(normalized.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
            .take(24)
    }

    private class FrameMonitor(
        private val onSlowFrame: (Long) -> Unit,
    ) : Choreographer.FrameCallback {
        private var running = false
        private var previousNanos = 0L

        fun start() {
            if (running) return
            running = true
            Choreographer.getInstance().postFrameCallback(this)
        }

        fun stop() {
            running = false
            Choreographer.getInstance().removeFrameCallback(this)
        }

        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            if (previousNanos != 0L) {
                val frameMs = (frameTimeNanos - previousNanos) / 1_000_000L
                if (frameMs >= 50) onSlowFrame(frameMs)
            }
            previousNanos = frameTimeNanos
            Choreographer.getInstance().postFrameCallback(this)
        }
    }
}
