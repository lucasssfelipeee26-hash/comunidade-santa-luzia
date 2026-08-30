package br.com.comunidadesantaluzia.nativeapp.core.data

import br.com.comunidadesantaluzia.nativeapp.core.network.MultipartUpload
import br.com.comunidadesantaluzia.nativeapp.core.network.NativeHttpClient
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.core.session.SessionStore
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import org.json.JSONObject

sealed interface RepositoryResult<out T> {
    data class Success<T>(val value: T, val fromCache: Boolean = false) : RepositoryResult<T>
    data class Failure(val message: String, val status: Int? = null) : RepositoryResult<Nothing>
    data class Queued(val mutationId: String) : RepositoryResult<Nothing>
}

internal class SantaLuziaRepository(
    private val database: NativeDatabase,
    private val http: NativeHttpClient,
    private val sessionStore: SessionStore,
) {
    suspend fun login(login: String, password: String): RepositoryResult<NativeSession> {
        val payload = JSONObject()
            .put("usuario", login.trim())
            .put("senha", password)
            .toString()
        return try {
            val response = http.request("POST", "/api/auth/login", payload, authenticated = false)
            val json = JSONObject(response.body.ifBlank { "{}" })
            if (!response.successful || !json.optBoolean("ok")) {
                RepositoryResult.Failure(
                    json.optString("erro").ifBlank { "Não foi possível entrar." },
                    response.status,
                )
            } else {
                val user = json.getJSONObject("usuario")
                val session = NativeSession(
                    loggedIn = true,
                    userId = user.optString("id"),
                    userName = user.optString("nome"),
                    userType = user.optString("tipo"),
                    function = user.optString("funcao").takeIf { it.isNotBlank() && it != "null" },
                    sessionCookie = response.setCookie,
                )
                sessionStore.saveAuthenticatedSession(
                    userId = session.userId.orEmpty(),
                    userName = session.userName.orEmpty(),
                    userType = session.userType.orEmpty(),
                    function = session.function,
                    sessionCookie = response.setCookie,
                )
                RepositoryResult.Success(session)
            }
        } catch (_: IOException) {
            RepositoryResult.Failure("O primeiro acesso precisa de internet. Depois disso, a sessão salva continua disponível offline.")
        } catch (error: Exception) {
            RepositoryResult.Failure(error.message ?: "Falha inesperada no login.")
        }
    }

    suspend fun logout() {
        try {
            http.request("POST", "/api/auth/logout", "{}")
        } catch (_: Exception) {
            // Logout local nunca depende da rede.
        } finally {
            sessionStore.clear()
        }
    }

    suspend fun deleteOwnAccount(password: String, confirmation: String): RepositoryResult<Unit> = withContext(Dispatchers.IO) {
        if (confirmation.trim().uppercase() != "EXCLUIR") {
            return@withContext RepositoryResult.Failure("Digite EXCLUIR para confirmar.")
        }
        if (password.isBlank()) return@withContext RepositoryResult.Failure("Informe sua senha atual.")
        try {
            val payload = JSONObject()
                .put("senha", password)
                .put("confirmacao", "EXCLUIR")
                .toString()
            val response = http.request("POST", "/api/perfil/excluir", payload, authenticated = true)
            val json = runCatching { JSONObject(response.body.ifBlank { "{}" }) }.getOrElse { JSONObject() }
            if (!response.successful || !json.optBoolean("ok")) {
                RepositoryResult.Failure(
                    json.optString("erro").ifBlank { "Não foi possível excluir a conta." },
                    response.status,
                )
            } else {
                database.clearLocalUserData()
                sessionStore.clear()
                RepositoryResult.Success(Unit)
            }
        } catch (_: IOException) {
            RepositoryResult.Failure("A exclusão definitiva precisa de internet. Nenhum dado foi removido parcialmente.")
        } catch (error: Exception) {
            RepositoryResult.Failure(error.message ?: "Não foi possível excluir a conta.")
        }
    }

    suspend fun readLocalFirst(
        cacheKey: String,
        path: String,
        authenticated: Boolean = false,
    ): RepositoryResult<String> = withContext(Dispatchers.IO) {
        val resolvedCacheKey = resolveCacheKey(cacheKey, authenticated)
            ?: return@withContext RepositoryResult.Failure("Não há uma conta local válida para acessar este conteúdo salvo.")
        try {
            val response = http.request("GET", path, authenticated = authenticated)
            if (response.successful && response.body.isNotBlank()) {
                database.putDocument(resolvedCacheKey, response.body)
                RepositoryResult.Success(response.body, fromCache = false)
            } else {
                database.getDocument(resolvedCacheKey)?.let {
                    RepositoryResult.Success(it.payload, fromCache = true)
                } ?: RepositoryResult.Failure("Servidor respondeu ${response.status} e ainda não há dados salvos neste aparelho para esta conta.", response.status)
            }
        } catch (_: IOException) {
            database.getDocument(resolvedCacheKey)?.let {
                RepositoryResult.Success(it.payload, fromCache = true)
            } ?: RepositoryResult.Failure("Sem internet e sem cópia local disponível para esta conta nesta área.")
        } catch (error: Exception) {
            database.getDocument(resolvedCacheKey)?.let {
                RepositoryResult.Success(it.payload, fromCache = true)
            } ?: RepositoryResult.Failure(error.message ?: "Não foi possível carregar os dados.")
        }
    }

    suspend fun cachedDocumentForCurrentUser(cacheKey: String): CachedDocument? = withContext(Dispatchers.IO) {
        val resolved = resolveCacheKey(cacheKey, authenticated = true) ?: return@withContext null
        database.getDocument(resolved)
    }

    suspend fun mutate(
        method: String,
        path: String,
        payload: String?,
        optimisticCacheKey: String? = null,
        optimisticPayload: String? = null,
    ): RepositoryResult<String> = mutateLocalFirst(
        method = method,
        path = path,
        payload = payload,
        optimisticCacheKey = optimisticCacheKey,
        optimisticPayload = optimisticPayload,
    )

    suspend fun mutateOnlineOnly(
        method: String,
        path: String,
        payload: String?,
    ): RepositoryResult<String> = withContext(Dispatchers.IO) {
        try {
            val response = http.request(method, path, payload)
            if (response.successful) {
                RepositoryResult.Success(response.body)
            } else {
                val serverMessage = runCatching { JSONObject(response.body).optString("erro") }.getOrNull()
                    ?.takeIf { it.isNotBlank() }
                RepositoryResult.Failure(
                    serverMessage ?: "A alteração foi rejeitada pelo servidor (${response.status}).",
                    response.status,
                )
            }
        } catch (_: IOException) {
            RepositoryResult.Failure("Esta operação precisa de internet para evitar envio duplicado. Reconecte e tente novamente.")
        } catch (error: Exception) {
            RepositoryResult.Failure(error.message ?: "Não foi possível concluir a alteração online.")
        }
    }

    suspend fun mutateMultipartOnlineOnly(
        method: String,
        path: String,
        fields: Map<String, String>,
        fileField: String? = null,
        fileName: String? = null,
        mimeType: String? = null,
        fileBytes: ByteArray? = null,
    ): RepositoryResult<String> = withContext(Dispatchers.IO) {
        try {
            val upload = if (fileField != null && fileName != null && fileBytes != null) {
                MultipartUpload(fileField, fileName, mimeType.orEmpty(), fileBytes)
            } else null
            val response = http.requestMultipart(method, path, fields, upload)
            if (response.successful) {
                RepositoryResult.Success(response.body)
            } else {
                val serverMessage = runCatching { JSONObject(response.body).optString("erro") }.getOrNull()
                    ?.takeIf { it.isNotBlank() }
                RepositoryResult.Failure(
                    serverMessage ?: "O envio foi rejeitado pelo servidor (${response.status}).",
                    response.status,
                )
            }
        } catch (_: IOException) {
            RepositoryResult.Failure("Este envio precisa de internet. O arquivo não foi duplicado nem colocado em fila.")
        } catch (error: Exception) {
            RepositoryResult.Failure(error.message ?: "Não foi possível enviar os dados e o arquivo.")
        }
    }

    suspend fun mutateLocalFirst(
        method: String,
        path: String,
        payload: String?,
        optimisticCacheKey: String? = null,
        optimisticPayload: String? = null,
    ): RepositoryResult<String> = withContext(Dispatchers.IO) {
        val mayQueue = canQueueOffline(method, path, payload)
        val preserveOnAuthFailure = mayQueue && shouldPreserveOnAuthFailure(method, path, payload)
        val optimisticResolvedKey = optimisticCacheKey?.let { resolveCacheKey(it, authenticated = true) }
        fun commitOptimisticCache() {
            if (optimisticResolvedKey != null && optimisticPayload != null) {
                database.putDocument(optimisticResolvedKey, optimisticPayload)
            }
        }

        try {
            val response = http.request(method, path, payload)
            when {
                response.successful -> {
                    commitOptimisticCache()
                    RepositoryResult.Success(response.body)
                }
                mayQueue && (
                    response.status in 500..599 ||
                        response.status == 408 ||
                        response.status == 429 ||
                        (preserveOnAuthFailure && response.status in setOf(401, 403))
                ) -> {
                    val id = enqueueForCurrentUser(method, path, payload)
                        ?: return@withContext RepositoryResult.Failure("Não há uma conta local válida para guardar esta alteração offline.")
                    commitOptimisticCache()
                    RepositoryResult.Queued(id)
                }
                else -> {
                    val message = runCatching { JSONObject(response.body).optString("erro") }.getOrNull()
                        ?.takeIf { it.isNotBlank() }
                        ?: if (!mayQueue && (response.status in 500..599 || response.status == 408 || response.status == 429)) {
                            "Esta operação precisa ser confirmada online. Tente novamente quando a conexão estiver estável."
                        } else {
                            "A alteração foi rejeitada pelo servidor (${response.status})."
                        }
                    RepositoryResult.Failure(message, response.status)
                }
            }
        } catch (_: IOException) {
            if (mayQueue) {
                val id = enqueueForCurrentUser(method, path, payload)
                    ?: return@withContext RepositoryResult.Failure("Não há uma conta local válida para guardar esta alteração offline.")
                commitOptimisticCache()
                RepositoryResult.Queued(id)
            } else {
                RepositoryResult.Failure("Esta operação precisa de internet para evitar envio duplicado. Reconecte e tente novamente.")
            }
        } catch (error: Exception) {
            RepositoryResult.Failure(error.message ?: "Não foi possível concluir a alteração.")
        }
    }

    private suspend fun resolveCacheKey(cacheKey: String, authenticated: Boolean): String? {
        if (!authenticated) return cacheKey
        val session = sessionStore.session.first()
        val ownerUserId = session.userId?.takeIf { session.loggedIn && it.isNotBlank() } ?: return null
        return NativeDatabase.userDocumentKey(ownerUserId, cacheKey)
    }

    private suspend fun enqueueForCurrentUser(method: String, path: String, payload: String?): String? {
        val session = sessionStore.session.first()
        val ownerUserId = session.userId?.takeIf { session.loggedIn && it.isNotBlank() } ?: return null
        return database.enqueue(ownerUserId, method, path, payload)
    }

    private fun shouldPreserveOnAuthFailure(method: String, path: String, payload: String?): Boolean {
        val verb = method.uppercase()
        if (verb == "POST" && Regex("^/api/quizzes/[^/]+/responder$").matches(path)) {
            val body = runCatching { JSONObject(payload ?: "{}") }.getOrNull() ?: return false
            return body.optString("clientRequestId").isNotBlank() &&
                (body.optJSONArray("respostas")?.length() ?: 0) > 0
        }
        if (verb == "POST" && path == "/api/quizzes/liturgia/offline") {
            val body = runCatching { JSONObject(payload ?: "{}") }.getOrNull() ?: return false
            return body.optString("clientRequestId").isNotBlank() &&
                (body.optJSONArray("respostas")?.length() ?: 0) > 0
        }
        return false
    }

    private fun canQueueOffline(method: String, path: String, payload: String?): Boolean {
        val verb = method.uppercase()
        val body = runCatching { JSONObject(payload ?: "{}") }.getOrNull()

        // Allowlist: toda mutação nova começa como ONLINE-ONLY. Uma rota só entra
        // nesta lista depois de provar replay seguro/idempotente no contrato do servidor.

        // Publicação de Escala: o servidor persiste clientRequestId + fingerprint na própria
        // escala. Repetir exatamente a mesma publicação devolve o registro já criado.
        if (verb == "POST" && path == "/api/escalas") {
            val requestId = body?.optString("clientRequestId").orEmpty()
            val date = body?.optString("data").orEmpty()
            val time = body?.optString("horario").orEmpty()
            val celebrant = body?.optString("celebrante").orEmpty().trim()
            val people = body?.optJSONArray("pessoas")
            return Regex("^[A-Za-z0-9._:-]{8,120}$").matches(requestId) &&
                Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date) &&
                Regex("^(?:[01]\\d|2[0-3]):[0-5]\\d$").matches(time) &&
                celebrant.length in 2..120 &&
                people != null && people.length() <= 80
        }

        if (verb == "PUT" && Regex("^/api/escalas/[^/]+/minha-justificativa$").matches(path)) {
            val justification = body?.optString("justificativa").orEmpty().trim()
            return justification.length in 3..500
        }

        if (verb == "PUT" && Regex("^/api/formacoes/[^/]+/minha-presenca$").matches(path)) {
            val situation = body?.optString("situacao").orEmpty()
            val justification = body?.optString("justificativa").orEmpty().trim()
            return situation == "presente" || (situation == "justificada" && justification.length in 3..500)
        }

        if (verb == "PATCH" && path == "/api/perfil") {
            return body != null && body.length() > 0
        }

        if (verb == "POST" && path == "/api/notificacoes") {
            return when (body?.optString("action")) {
                "todas" -> true
                "lida" -> body.optString("id").isNotBlank()
                else -> false
            }
        }

        if (verb == "POST" && path == "/api/constancia-luz") {
            return Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(body?.optString("data").orEmpty())
        }

        if (verb == "POST" && path == "/api/jogo/whatajong/resultado") {
            val completedRound = body?.optInt("completedRound", 0) ?: 0
            val score = body?.optLong("score", -1L) ?: -1L
            return completedRound in 1..24 && score in 0L..50_000_000L
        }

        if (verb == "POST" && path == "/api/quizzes/liturgia/responder") return false

        if (verb == "POST" && Regex("^/api/quizzes/[^/]+/responder$").matches(path)) {
            val requestId = body?.optString("clientRequestId").orEmpty()
            val answers = body?.optJSONArray("respostas")
            return requestId.isNotBlank() && answers != null && answers.length() > 0
        }

        if (verb == "POST" && path == "/api/quizzes/liturgia/offline") {
            val dateIso = body?.optString("dataIso").orEmpty()
            val requestId = body?.optString("clientRequestId").orEmpty()
            val answers = body?.optJSONArray("respostas")
            return Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(dateIso) &&
                requestId.isNotBlank() &&
                answers != null && answers.length() > 0
        }

        if (verb == "POST" && path == "/api/ranking") {
            return body?.optString("action") == "reportar_atraso" &&
                body.optString("clientRequestId").isNotBlank()
        }

        return false
    }

    suspend fun warmEssentialCaches() {
        val essentials = listOf(
            "escalas" to "/api/escalas",
            "formacoes" to "/api/formacoes",
            "ranking" to "/api/ranking",
            "perfis" to "/api/perfis",
            "biblioteca" to "/api/biblioteca",
            "quizzes" to "/api/quizzes",
            "constancia" to "/api/constancia-luz",
            "notificacoes" to "/api/notificacoes",
        )
        essentials.forEach { (key, path) ->
            readLocalFirst(cacheKey = key, path = path, authenticated = key != "biblioteca")
        }
    }
}
