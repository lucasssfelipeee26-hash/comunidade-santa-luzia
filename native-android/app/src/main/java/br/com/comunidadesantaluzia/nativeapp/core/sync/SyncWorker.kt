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
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.notifications.NativeNotificationDispatcher
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.first
import org.json.JSONObject

internal class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as SantaLuziaApplication
        val container = app.container
        val dispatcher = NativeNotificationDispatcher(applicationContext, container.database)

        when (validateAuthenticatedSession(container)) {
            SessionValidation.LoggedOut -> return Result.success()
            SessionValidation.Retry -> return Result.retry()
            is SessionValidation.Active -> Unit
        }

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
                    isIdempotentReplay(mutation.method, mutation.path, response.status) -> {
                        container.database.completeMutation(mutation.id)
                        runCatching { container.repository.warmEssentialCaches() }
                        container.auditor.recordAsync(
                            "info",
                            "sync-idempotent-replay",
                            "Alteração offline já estava registrada no servidor",
                            "{\"path\":${JSONObject.quote(mutation.path)},\"status\":409}",
                        )
                    }
                    response.status == 401 -> {
                        container.database.failMutation(mutation.id, "HTTP 401: sessão não autenticada")
                        container.auditor.recordAsync(
                            "warning",
                            "sync-auth",
                            "Servidor recusou a sessão durante a sincronização",
                            "{\"path\":${JSONObject.quote(mutation.path)},\"status\":401}",
                        )
                        return when (validateAuthenticatedSession(container)) {
                            SessionValidation.LoggedOut -> Result.success()
                            SessionValidation.Retry -> Result.retry()
                            is SessionValidation.Active -> Result.retry()
                        }
                    }
                    response.status == 403 -> {
                        // 403 pode significar apenas que esta ação exige outro papel/permissão.
                        // Nunca encerramos a conta inteira por causa de uma operação isolada.
                        container.database.failMutation(mutation.id, "HTTP 403: ação sem autorização")
                        container.auditor.recordAsync(
                            "warning",
                            "sync-forbidden",
                            "Servidor recusou uma alteração sem invalidar a sessão local",
                            "{\"path\":${JSONObject.quote(mutation.path)},\"status\":403}",
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
                            "{\"path\":${JSONObject.quote(mutation.path)},\"status\":${response.status}}",
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
                    JSONObject().put("type", error.javaClass.name).put("message", error.message.orEmpty().take(500)).toString(),
                )
                return Result.retry()
            }
        }

        runCatching { container.repository.warmEssentialCaches() }
        runCatching { dispatcher.deliverUnreadFromCache() }
        return Result.success()
    }

    private suspend fun validateAuthenticatedSession(container: AppContainer): SessionValidation {
        val local = container.sessionStore.session.first()
        if (!local.loggedIn || local.userId.isNullOrBlank() || local.sessionCookie.isNullOrBlank()) {
            return SessionValidation.LoggedOut
        }

        val response = try {
            container.httpClient.request("GET", "/api/auth/me", authenticated = true)
        } catch (_: IOException) {
            return SessionValidation.Retry
        } catch (error: Exception) {
            container.auditor.recordAsync(
                "warning",
                "session-validation-exception",
                "Não foi possível validar a sessão com o servidor",
                JSONObject().put("type", error.javaClass.name).put("message", error.message.orEmpty().take(500)).toString(),
            )
            return SessionValidation.Retry
        }

        if (response.status == 401) {
            revokeLocalSession(container, "unauthorized", local.userId)
            return SessionValidation.LoggedOut
        }
        if (!response.successful) {
            // 403/5xx/429 e falhas transitórias não provam que a sessão foi revogada.
            return SessionValidation.Retry
        }

        val root = runCatching { JSONObject(response.body.ifBlank { "{}" }) }.getOrElse {
            container.auditor.recordAsync(
                "warning",
                "session-validation-invalid-json",
                "Servidor retornou uma validação de sessão inválida",
                JSONObject().put("status", response.status).toString(),
            )
            return SessionValidation.Retry
        }

        val authoritative = root.optJSONObject("sessao")
        if (authoritative == null) {
            revokeLocalSession(container, "server-session-null", local.userId)
            return SessionValidation.LoggedOut
        }

        val user = authoritative.optJSONObject("usuario")
        val serverUserId = user?.optString("id").orEmpty().trim()
        val serverUserName = user?.optString("nome").orEmpty().trim()
        val serverUserType = user?.optString("tipo").orEmpty().trim()
        val serverFunction = user?.optString("funcao")
            ?.takeIf { it.isNotBlank() && it != "null" }
        val serverStatus = user?.optString("status").orEmpty().trim().lowercase()

        if (serverUserId.isBlank() || serverUserId != local.userId) {
            revokeLocalSession(container, "identity-mismatch", local.userId)
            return SessionValidation.LoggedOut
        }
        if (serverUserType == "membro" && serverStatus != "aprovado") {
            revokeLocalSession(container, "member-status-$serverStatus", local.userId)
            return SessionValidation.LoggedOut
        }
        if (serverUserName.isBlank() || serverUserType.isBlank()) {
            return SessionValidation.Retry
        }

        // O GET /auth/me é a fonte autoritativa para mudança de nome, função e papel.
        // O cookie pode ter sido renovado pelo NativeHttpClient durante esta própria chamada.
        val refreshedCookie = container.sessionStore.session.first().sessionCookie
        container.sessionStore.saveAuthenticatedSession(
            userId = serverUserId,
            userName = serverUserName,
            userType = serverUserType,
            function = serverFunction,
            sessionCookie = refreshedCookie,
        )
        return SessionValidation.Active(serverUserId)
    }

    private suspend fun revokeLocalSession(container: AppContainer, reason: String, userId: String?) {
        // Limpa apenas autenticação. Cache e mutation_queue permanecem no SQLite para
        // não destruir trabalho feito offline antes de uma sessão expirar/revogar.
        container.sessionStore.clear()
        container.auditor.recordAsync(
            "warning",
            "session-revoked",
            "Sessão local encerrada após validação autoritativa",
            JSONObject().put("reason", reason).put("userId", userId.orEmpty()).toString(),
        )
    }

    private fun isIdempotentReplay(method: String, path: String, status: Int): Boolean {
        if (status != 409) return false
        if (method.equals("PUT", ignoreCase = true) && Regex("^/api/escalas/[^/]+/minha-justificativa$").matches(path)) {
            return true
        }
        if (method.equals("POST", ignoreCase = true) && path == "/api/quizzes/liturgia/offline") {
            return true
        }
        if (method.equals("POST", ignoreCase = true) && Regex("^/api/quizzes/[^/]+/responder$").matches(path)) {
            return true
        }
        if (method.equals("POST", ignoreCase = true) && path == "/api/ranking") {
            return true
        }
        return false
    }

    private sealed interface SessionValidation {
        data class Active(val userId: String) : SessionValidation
        data object LoggedOut : SessionValidation
        data object Retry : SessionValidation
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
