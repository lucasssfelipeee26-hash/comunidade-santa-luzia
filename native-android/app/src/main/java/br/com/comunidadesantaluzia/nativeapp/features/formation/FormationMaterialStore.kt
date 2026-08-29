package br.com.comunidadesantaluzia.nativeapp.features.formation

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import br.com.comunidadesantaluzia.nativeapp.BuildConfig
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import java.io.File
import java.io.IOException
import org.json.JSONObject

internal sealed interface FormationMaterialResult {
    data class Success(val file: File, val mime: String) : FormationMaterialResult
    data class Failure(val message: String, val status: Int? = null) : FormationMaterialResult
}

internal object FormationMaterialStore {
    private const val DIRECTORY = "formation-materials"

    fun cachedFile(context: Context, formationId: String, meta: NativeFormationFile): File? {
        val file = targetFile(context, formationId, meta.name)
        if (!file.isFile || file.length() <= 0L) return null
        if (meta.size > 0L && file.length() != meta.size) {
            file.delete()
            return null
        }
        return file
    }

    suspend fun ensureDownloaded(
        context: Context,
        container: AppContainer,
        formationId: String,
        meta: NativeFormationFile,
    ): FormationMaterialResult {
        cachedFile(context, formationId, meta)?.let {
            return FormationMaterialResult.Success(it, meta.mime.ifBlank { guessMime(it.name) })
        }

        val target = targetFile(context, formationId, meta.name)
        return try {
            val result = container.httpClient.downloadToFile(
                path = "/api/formacoes/$formationId/download",
                targetFile = target,
                authenticated = true,
            )
            if (result.successful) {
                FormationMaterialResult.Success(
                    file = target,
                    mime = meta.mime.ifBlank { result.contentType ?: guessMime(target.name) },
                )
            } else {
                target.delete()
                val serverMessage = runCatching {
                    JSONObject(result.errorBody.ifBlank { "{}" }).optString("erro")
                }.getOrNull()?.takeIf { it.isNotBlank() }
                val message = when (result.status) {
                    401, 403 -> "Sua sessão precisa ser renovada para baixar este material. Entre novamente quando estiver conectado."
                    404 -> "Este material não está mais disponível no servidor."
                    else -> serverMessage ?: "Não foi possível baixar o material agora (HTTP ${result.status})."
                }
                FormationMaterialResult.Failure(message, result.status)
            }
        } catch (_: IOException) {
            FormationMaterialResult.Failure("Sem internet. Este material ainda não foi salvo neste aparelho.")
        } catch (error: Exception) {
            FormationMaterialResult.Failure(error.message ?: "Não foi possível salvar o material da formação.")
        }
    }

    fun open(context: Context, file: File, mime: String): Boolean {
        if (!file.isFile) return false
        val uri = FileProvider.getUriForFile(
            context,
            "${BuildConfig.APPLICATION_ID}.files",
            file,
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mime.ifBlank { guessMime(file.name) })
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        }
    }

    private fun targetFile(context: Context, formationId: String, originalName: String): File {
        val directory = File(context.filesDir, "$DIRECTORY/${safeSegment(formationId)}")
        return File(directory, safeFileName(originalName))
    }

    private fun safeSegment(value: String): String = value
        .replace(Regex("[^A-Za-z0-9._-]"), "_")
        .take(120)
        .ifBlank { "formation" }

    private fun safeFileName(value: String): String {
        val cleaned = value.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[^A-Za-z0-9._ -]"), "_")
            .trim()
            .take(180)
        return cleaned.ifBlank { "material.bin" }
    }

    private fun guessMime(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "pdf" -> "application/pdf"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "mp3" -> "audio/mpeg"
        "mp4" -> "video/mp4"
        "txt" -> "text/plain"
        "doc" -> "application/msword"
        "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        "ppt" -> "application/vnd.ms-powerpoint"
        "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        else -> "application/octet-stream"
    }
}
