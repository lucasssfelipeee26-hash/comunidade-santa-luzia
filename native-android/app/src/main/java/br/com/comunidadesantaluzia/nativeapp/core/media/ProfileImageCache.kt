package br.com.comunidadesantaluzia.nativeapp.core.media

import android.content.Context
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.URL
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val MAX_PROFILE_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * Carrega fotos de perfil sem tornar a interface dependente da rede.
 *
 * - data:image/... é decodificado diretamente, porque já viaja dentro do payload cacheado;
 * - https:// é salvo em filesDir/profile-image-cache após o primeiro download;
 * - quando estiver offline, o último arquivo válido continua sendo usado.
 */
internal suspend fun loadProfileBitmap(context: Context, source: String?): ImageBitmap? = withContext(Dispatchers.IO) {
    if (source.isNullOrBlank()) return@withContext null

    val bytes = when {
        source.startsWith("data:image/", ignoreCase = true) -> decodeDataUri(source)
        source.startsWith("https://", ignoreCase = true) -> loadRemoteWithPersistentCache(context, source)
        else -> null
    } ?: return@withContext null

    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
}

private fun decodeDataUri(source: String): ByteArray? = runCatching {
    val encoded = source.substringAfter("base64,", missingDelimiterValue = "")
    if (encoded.isBlank()) return@runCatching null
    Base64.decode(encoded, Base64.DEFAULT).takeIf { it.size <= MAX_PROFILE_IMAGE_BYTES }
}.getOrNull()

private fun loadRemoteWithPersistentCache(context: Context, source: String): ByteArray? {
    val cacheDir = File(context.filesDir, "profile-image-cache").apply { mkdirs() }
    val target = File(cacheDir, "${sha256(source)}.img")

    readValidFile(target)?.let { return it }

    val downloaded = runCatching {
        URL(source).openConnection().apply {
            connectTimeout = 6_000
            readTimeout = 8_000
            useCaches = true
        }.getInputStream().use(::readBounded)
    }.getOrNull() ?: return readValidFile(target)

    runCatching {
        val temp = File(cacheDir, "${target.name}.tmp")
        temp.writeBytes(downloaded)
        if (target.exists()) target.delete()
        if (!temp.renameTo(target)) {
            target.writeBytes(downloaded)
            temp.delete()
        }
    }

    return downloaded
}

private fun readValidFile(file: File): ByteArray? = runCatching {
    if (!file.isFile || file.length() <= 0L || file.length() > MAX_PROFILE_IMAGE_BYTES) return@runCatching null
    file.readBytes()
}.getOrNull()

private fun readBounded(input: java.io.InputStream): ByteArray? {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(16 * 1024)
    var total = 0
    while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        total += read
        if (total > MAX_PROFILE_IMAGE_BYTES) return null
        output.write(buffer, 0, read)
    }
    return output.toByteArray().takeIf { it.isNotEmpty() }
}

private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { byte -> "%02x".format(byte) }
