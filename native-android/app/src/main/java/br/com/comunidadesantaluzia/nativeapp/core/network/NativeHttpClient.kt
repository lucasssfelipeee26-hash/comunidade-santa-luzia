package br.com.comunidadesantaluzia.nativeapp.core.network

import br.com.comunidadesantaluzia.nativeapp.BuildConfig
import br.com.comunidadesantaluzia.nativeapp.core.session.SessionStore
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

internal data class HttpResult(
    val status: Int,
    val body: String,
    val setCookie: String? = null,
) {
    val successful: Boolean get() = status in 200..299
}

internal class NativeHttpClient(
    private val sessionStore: SessionStore,
) {
    suspend fun request(
        method: String,
        path: String,
        body: String? = null,
        authenticated: Boolean = true,
    ): HttpResult = withContext(Dispatchers.IO) {
        val base = BuildConfig.SYNC_BASE_URL.trimEnd('/')
        val normalizedPath = if (path.startsWith('/')) path else "/$path"
        val connection = (URL("$base$normalizedPath").openConnection() as HttpURLConnection).apply {
            requestMethod = method.uppercase()
            connectTimeout = 10_000
            readTimeout = 20_000
            useCaches = false
            doInput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "SantaLuziaNative/${BuildConfig.VERSION_NAME} Android")
            if (authenticated) {
                sessionStore.session.first().sessionCookie?.takeIf { it.isNotBlank() }?.let {
                    setRequestProperty("Cookie", it)
                }
            }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }

        try {
            if (body != null) {
                connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..399) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val setCookie = connection.getHeaderField("Set-Cookie")
                ?.substringBefore(';')
                ?.takeIf { it.contains('=') }
            if (setCookie != null) sessionStore.updateCookie(setCookie)
            HttpResult(status = status, body = responseBody, setCookie = setCookie)
        } finally {
            connection.disconnect()
        }
    }
}
