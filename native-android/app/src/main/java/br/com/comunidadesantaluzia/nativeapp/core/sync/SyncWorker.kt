package br.com.comunidadesantaluzia.nativeapp.core.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.com.comunidadesantaluzia.nativeapp.SantaLuziaApplication
import br.com.comunidadesantaluzia.nativeapp.core.notifications.NativeNotificationDispatcher
import java.io.IOException
import java.util.concurrent.TimeUnit

internal class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as SantaLuziaApplication
        val container = app.container
        val dispatcher = NativeNotificationDispatcher(applicationContext, container.database)
        val pending = container.database.pendingMutations(limit = 100)
        if (pending.isEmpty()) {
            runCatching { container.repository.warmEssentialCaches() }
            runCatching { dispatcher.deliverUnreadFromCache() }
            return Result.success()
        }

        for (mutation in pending) {
            try {
                val response = container.httpClient.request(
                    method = mutation.method,
                    path = mutation.path,
                    body = mutation.payload,
                )
                when {
                    response.successful -> container.database.completeMutation(mutation.id)
                    response.status == 401 || response.status == 403 -> {
                        container.database.failMutation(mutation.id, "HTTP ${response.status}: sessão/autorização")
                        container.auditor.recordAsync(
                            "warning",
                            "sync-auth",
                            "Sincronização aguardando nova autenticação",
                            "{\"path\":${org.json.JSONObject.quote(mutation.path)},\"status\":${response.status}}",
                        )
                        return Result.success()
                    }
                    response.status in 400..499 && response.status != 408 && response.status != 429 -> {
                        container.database.failMutation(mutation.id, "HTTP ${response.status}: ${response.body.take(240)}")
                        container.auditor.recordAsync(
                            "error",
                            "sync-rejected",
                            "Servidor rejeitou alteração offline",
                            "{\"path\":${org.json.JSONObject.quote(mutation.path)},\"status\":${response.status}}",
                        )
                        // Mantemos o item para revisão; não descartamos silenciosamente dados locais.
                        return Result.success()
                    }
                    else -> {
                        container.database.failMutation(mutation.id, "HTTP ${response.status}")
                        return Result.retry()
                    }
                }
            } catch (_: IOException) {
                container.database.failMutation(mutation.id, "rede indisponível")
                return Result.retry()
            } catch (error: Exception) {
                container.database.failMutation(mutation.id, error.message ?: error.javaClass.simpleName)
                container.auditor.recordAsync(
                    "error",
                    "sync-exception",
                    "Falha interna na sincronização",
                    org.json.JSONObject().put("type", error.javaClass.name).put("message", error.message.orEmpty().take(500)).toString(),
                )
                return Result.retry()
            }
        }

        runCatching { container.repository.warmEssentialCaches() }
        runCatching { dispatcher.deliverUnreadFromCache() }
        return Result.success()
    }
}

internal object SyncScheduler {
    private const val PERIODIC_NAME = "santa-luzia-periodic-sync"
    private const val IMMEDIATE_NAME = "santa-luzia-immediate-sync"

    private val connectedConstraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    fun ensurePeriodicSync(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(connectedConstraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun syncNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(connectedConstraints)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            IMMEDIATE_NAME,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}
