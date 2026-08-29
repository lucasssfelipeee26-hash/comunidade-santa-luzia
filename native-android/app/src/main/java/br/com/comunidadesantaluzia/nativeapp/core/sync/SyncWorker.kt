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
                    isAlreadyAppliedJustification(mutation.method, mutation.path, response.status) -> {
                        // O PUT de justificativa é semanticamente de envio único. Se a primeira
                        // requisição chegou ao servidor mas a resposta se perdeu, o replay pode
                        // voltar 409. Nesse endpoint específico isso significa "já aplicado".
                        container.database.completeMutation(mutation.id)
                        // Reconcilia imediatamente o cache otimista com o servidor. Isso é
                        // importante porque uma mutação posterior pode encerrar este ciclo por
                        // autenticação/validação antes do warmEssentialCaches() do final.
                        runCatching { container.repository.warmEssentialCaches() }
                        container.auditor.recordAsync(
                            "info",
                            "sync-idempotent-replay",
                            "Justificativa offline já estava registrada no servidor",
                            "{\"path\":${org.json.JSONObject.quote(mutation.path)},\"status\":409}",
                        )
                    }
                    response.status == 401 || response.status == 403 -> {
                        container.database.failMutation(mutation.id, "HTTP ${response.status}: sessão/autorização")
                        container.auditor.recordAsync(
                            "warning",
                            "sync-auth",
                            "Sincronização aguardando nova autenticação",
                            "{\"path\":${org.json.JSONObject.quote(mutation.path)},\"status\":${response.status}}",
                        )
                        runCatching { container.repository.warmEssentialCaches() }
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
                        runCatching { container.repository.warmEssentialCaches() }
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

    private fun isAlreadyAppliedJustification(method: String, path: String, status: Int): Boolean =
        status == 409 &&
            method.equals("PUT", ignoreCase = true) &&
            Regex("^/api/escalas/[^/]+/minha-justificativa$").matches(path)
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
