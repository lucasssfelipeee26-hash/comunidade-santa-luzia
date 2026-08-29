package br.com.comunidadesantaluzia.nativeapp.core.network

import br.com.comunidadesantaluzia.nativeapp.BuildConfig
import br.com.comunidadesantaluzia.nativeapp.core.session.SessionStore
import java.io.File
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

internal data class DownloadResult(
    val status: Int,
    val contentType: String?,
    val contentLength: Long,
    val errorBody: String = "",
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

    suspend fun downloadToFile(
        path: String,
        targetFile: File,
        authenticated: Boolean = true,
    ): DownloadResult = withContext(Dispatchers.IO) {
        val connection = openConnection("GET", path, authenticated)
        val tempFile = File(targetFile.parentFile, ".${targetFile.name}.${UUID.randomUUID()}.part")
        try {
            val status = connection.responseCode
            val contentType = connection.contentType?.substringBefore(';')?.trim()?.takeIf { it.isNotBlank() }
            val contentLength = connection.getHeaderFieldLong("Content-Length", -1L)
            updateCookieFrom(connection)

            if (status !in 200..299) {
                val error = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                return@withContext DownloadResult(status, contentType, contentLength, error)
            }

            targetFile.parentFile?.mkdirs()
            tempFile.parentFile?.mkdirs()
            connection.inputStream.buffered().use { input ->
                tempFile.outputStream().buffered().use { output ->
                    input.copyTo(output)
                    output.flush()
                }
            }
            check(tempFile.length() > 0L) { "Servidor retornou um arquivo vazio." }
            if (contentLength > 0 && tempFile.length() != contentLength) {
                error("Download incompleto: ${tempFile.length()} de $contentLength bytes.")
            }
            if (targetFile.exists() && !targetFile.delete()) {
                error("Não foi possível substituir o material local anterior.")
            }
            if (!tempFile.renameTo(targetFile)) {
                tempFile.copyTo(targetFile, overwrite = true)
                tempFile.delete()
            }
            DownloadResult(status, contentType, targetFile.length())
        } finally {
            if (tempFile.exists()) tempFile.delete()
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
        val setCookie = updateCookieFrom(connection)
        return HttpResult(status = status, body = responseBody, setCookie = setCookie)
    }

    private suspend fun updateCookieFrom(connection: HttpURLConnection): String? {
        val setCookie = connection.getHeaderField("Set-Cookie")
            ?.substringBefore(';')
            ?.takeIf { it.contains('=') }
        if (setCookie != null) sessionStore.updateCookie(setCookie)
        return setCookie
    }

    private fun escapeDisposition(value: String): String = value
        .replace("\\", "_")
        .replace("\"", "_")
        .replace("\r", "_")
        .replace("\n", "_")
}
