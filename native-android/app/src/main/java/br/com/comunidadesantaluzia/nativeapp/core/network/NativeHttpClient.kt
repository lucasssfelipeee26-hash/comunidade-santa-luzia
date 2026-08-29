package br.com.comunidadesantaluzia.nativeapp.core.network

import br.com.comunidadesantaluzia.nativeapp.BuildConfig
import br.com.comunidadesantaluzia.nativeapp.core.session.SessionStore
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
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

internal data class MultipartUpload(
    val fieldName: String,
    val fileName: String,
    val mimeType: String,
    val bytes: ByteArray,
)

internal class NativeHttpClient(
    private val sessionStore: SessionStore,
) {
    suspend fun request(
        method: String,
        path: String,
        body: String? = null,
        authenticated: Boolean = true,
    ): HttpResult = withContext(Dispatchers.IO) {
        val connection = openConnection(method, path, authenticated).apply {
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }

        try {
            if (body != null) {
                connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body) }
            }
            readResult(connection)
        } finally {
            connection.disconnect()
        }
    }

    suspend fun requestMultipart(
        method: String,
        path: String,
        fields: Map<String, String>,
        file: MultipartUpload? = null,
        authenticated: Boolean = true,
    ): HttpResult = withContext(Dispatchers.IO) {
        val boundary = "SantaLuzia-${UUID.randomUUID()}"
        val connection = openConnection(method, path, authenticated).apply {
            doOutput = true
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
        }

        try {
            connection.outputStream.buffered().use { output ->
                fun writeText(value: String) = output.write(value.toByteArray(Charsets.UTF_8))
                fields.forEach { (name, value) ->
                    writeText("--$boundary\r\n")
                    writeText("Content-Disposition: form-data; name=\"${escapeDisposition(name)}\"\r\n")
                    writeText("Content-Type: text/plain; charset=utf-8\r\n\r\n")
                    writeText(value)
                    writeText("\r\n")
                }
                file?.let { upload ->
                    writeText("--$boundary\r\n")
                    writeText(
                        "Content-Disposition: form-data; name=\"${escapeDisposition(upload.fieldName)}\"; filename=\"${escapeDisposition(upload.fileName)}\"\r\n",
                    )
                    writeText("Content-Type: ${upload.mimeType.ifBlank { "application/octet-stream" }}\r\n")
                    writeText("Content-Transfer-Encoding: binary\r\n\r\n")
                    output.write(upload.bytes)
                    writeText("\r\n")
                }
                writeText("--$boundary--\r\n")
                output.flush()
            }
            readResult(connection)
        } finally {
            connection.disconnect()
        }
    }

    private suspend fun openConnection(method: String, path: String, authenticated: Boolean): HttpURLConnection {
        val base = BuildConfig.SYNC_BASE_URL.trimEnd('/')
        val normalizedPath = if (path.startsWith('/')) path else "/$path"
        return (URL("$base$normalizedPath").openConnection() as HttpURLConnection).apply {
            requestMethod = method.uppercase()
            connectTimeout = 10_000
            readTimeout = 30_000
            useCaches = false
            doInput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "SantaLuziaNative/${BuildConfig.VERSION_NAME} Android")
            setRequestProperty("X-Santa-Luzia-Native", "1")
            if (authenticated) {
                sessionStore.session.first().sessionCookie?.takeIf { it.isNotBlank() }?.let {
                    setRequestProperty("Cookie", it)
                }
            }
        }
    }

    private suspend fun readResult(connection: HttpURLConnection): HttpResult {
        val status = connection.responseCode
        val stream = if (status in 200..399) connection.inputStream else connection.errorStream
        val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        val setCookie = connection.getHeaderField("Set-Cookie")
            ?.substringBefore(';')
            ?.takeIf { it.contains('=') }
        if (setCookie != null) sessionStore.updateCookie(setCookie)
        return HttpResult(status = status, body = responseBody, setCookie = setCookie)
    }

    private fun escapeDisposition(value: String): String = value
        .replace("\\", "_")
        .replace("\"", "_")
        .replace("\r", "_")
        .replace("\n", "_")
}
