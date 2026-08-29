package br.com.comunidadesantaluzia.nativeapp.core.data

import br.com.comunidadesantaluzia.nativeapp.core.network.NativeHttpClient
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.core.session.SessionStore
import java.io.IOException
import kotlinx.coroutines.Dispatchers
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

    suspend fun readLocalFirst(
        cacheKey: String,
        path: String,
        authenticated: Boolean = false,
    ): RepositoryResult<String> = withContext(Dispatchers.IO) {
        try {
            val response = http.request("GET", path, authenticated = authenticated)
            if (response.successful && response.body.isNotBlank()) {
                database.putDocument(cacheKey, response.body)
                RepositoryResult.Success(response.body, fromCache = false)
            } else {
                database.getDocument(cacheKey)?.let {
                    RepositoryResult.Success(it.payload, fromCache = true)
                } ?: RepositoryResult.Failure("Servidor respondeu ${response.status} e ainda não há dados salvos neste aparelho.", response.status)
            }
        } catch (_: IOException) {
            database.getDocument(cacheKey)?.let {
                RepositoryResult.Success(it.payload, fromCache = true)
            } ?: RepositoryResult.Failure("Sem internet e sem cópia local disponível para esta área.")
        } catch (error: Exception) {
            database.getDocument(cacheKey)?.let {
                RepositoryResult.Success(it.payload, fromCache = true)
            } ?: RepositoryResult.Failure(error.message ?: "Não foi possível carregar os dados.")
        }
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

    /**
     * Executa operações que não podem ser repetidas com segurança.
     * Nunca grava em fila offline e nunca aplica cache otimista antes da confirmação do servidor.
     */
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

    suspend fun mutateLocalFirst(
        method: String,
        path: String,
        payload: String?,
        optimisticCacheKey: String? = null,
        optimisticPayload: String? = null,
    ): RepositoryResult<String> = withContext(Dispatchers.IO) {
        val mayQueue = canQueueOffline(method, path)
        fun commitOptimisticCache() {
            if (optimisticCacheKey != null && optimisticPayload != null) {
                database.putDocument(optimisticCacheKey, optimisticPayload)
            }
        }

        try {
            val response = http.request(method, path, payload)
            when {
                response.successful -> {
                    commitOptimisticCache()
                    RepositoryResult.Success(response.body)
                }
                mayQueue && (response.status in 500..599 || response.status == 408 || response.status == 429) -> {
                    val id = database.enqueue(method, path, payload)
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
                val id = database.enqueue(method, path, payload)
                commitOptimisticCache()
                RepositoryResult.Queued(id)
            } else {
                RepositoryResult.Failure("Esta operação precisa de internet para evitar envio duplicado. Reconecte e tente novamente.")
            }
        } catch (error: Exception) {
            RepositoryResult.Failure(error.message ?: "Não foi possível concluir a alteração.")
        }
    }

    private fun canQueueOffline(method: String, path: String): Boolean {
        val verb = method.uppercase()
        // Respostas de quiz são de envio único e o backend ainda não oferece clientRequestId.
        // Enfileirar poderia repetir uma resposta já aceita caso apenas a resposta HTTP se perca.
        if (verb == "POST" && Regex("^/api/quizzes(?:/liturgia)?/[^/]+/responder$").matches(path)) return false
        if (verb == "POST" && path == "/api/quizzes/liturgia/responder") return false
        return true
    }

    suspend fun warmEssentialCaches() {
        val essentials = listOf(
            "escalas" to "/api/escalas",
            "formacoes" to "/api/formacoes",
            "ranking" to "/api/ranking",
            "perfis" to "/api/perfis",
            "biblioteca" to "/api/biblioteca",
        )
        essentials.forEach { (key, path) ->
            readLocalFirst(cacheKey = key, path = path, authenticated = key != "biblioteca")
        }
    }
}
