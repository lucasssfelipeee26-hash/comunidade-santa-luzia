package br.com.comunidadesantaluzia.nativeapp.features.admin

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Database
import androidx.compose.material.icons.rounded.UploadFile
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.network.MultipartUpload
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

private const val MAX_ARCHIVE_BYTES = 30 * 1024 * 1024

private data class ArchiveStatus(
    val installed: Boolean = false,
    val total: Int = 0,
    val categories: Int = 0,
    val version: Int = 0,
    val files: Int = 0,
    val loading: Boolean = true,
    val fromCache: Boolean = false,
    val error: String? = null,
)

private data class SelectedTar(
    val uri: Uri,
    val name: String,
    val size: Long?,
)

private suspend fun loadArchiveStatus(container: AppContainer): ArchiveStatus {
    val userId = container.sessionStore.session.first().userId.orEmpty()
    val key = "user:${userId.ifBlank { "unknown" }}:admin-acervo-liturgico-status"
    return when (val result = container.repository.readLocalFirst(key, "/api/admin/acervo-liturgico", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            ArchiveStatus(
                installed = root.optBoolean("instalado", false),
                total = root.optInt("total", 0),
                categories = root.optInt("categorias", 0),
                version = root.optInt("versao", 0),
                files = root.optInt("arquivos", 0),
                loading = false,
                fromCache = result.fromCache,
            )
        }.getOrElse { ArchiveStatus(loading = false, error = "O status salvo do acervo está em formato inválido.") }
        is RepositoryResult.Failure -> ArchiveStatus(loading = false, error = result.message)
        is RepositoryResult.Queued -> ArchiveStatus(loading = false, error = "A leitura do acervo não deve entrar em fila.")
    }
}

@Composable
internal fun LiturgyArchiveAdminScreen(container: AppContainer, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf(ArchiveStatus()) }
    var selected by remember { mutableStateOf<SelectedTar?>(null) }
    var uploading by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf("") }
    var selectionError by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        runCatching {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val file = querySelectedTar(context, uri)
        selectionError = when {
            !file.name.lowercase().endsWith(".tar") -> "Selecione um pacote no formato .tar."
            file.size != null && file.size <= 0L -> "O pacote selecionado está vazio."
            file.size != null && file.size > MAX_ARCHIVE_BYTES -> "O pacote excede o limite de 30 MB."
            else -> null
        }
        selected = if (selectionError == null) file else null
        feedback = ""
    }

    LaunchedEffect(Unit) { status = loadArchiveStatus(container) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Icon(Icons.Rounded.Database, null, tint = SantaWine)
                    Column {
                        Text("Acervo Litúrgico Offline", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold)
                        Text("Instalação e atualização da biblioteca autorizada", style = MaterialTheme.typography.bodySmall)
                    }
                }
                OutlinedButton(onClick = onBack, enabled = !uploading) { Text("Voltar") }
            }
            Text("O pacote administrativo é enviado ao servidor para disponibilização aos usuários. Ele não entra na fila offline e não é armazenado no banco local do aplicativo.", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall)
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f)), shape = RoundedCornerShape(20.dp)) {
                Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.CenterStart) {
                    when {
                        status.loading -> CircularProgressIndicator(Modifier.size(28.dp))
                        status.installed -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Icon(Icons.Rounded.CheckCircle, null, tint = SantaWine)
                            Column {
                                Text("Acervo instalado", color = SantaWine, fontWeight = FontWeight.Bold)
                                Text("${status.total} documentos · ${status.categories} categorias · versão ${status.version.coerceAtLeast(1)}", style = MaterialTheme.typography.bodySmall)
                                if (status.files > 0) Text("${status.files} arquivo(s) no pacote persistente", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                        else -> Text(status.error ?: "Ainda não há um acervo completo instalado no volume persistente.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (status.fromCache) AssistChip(onClick = {}, label = { Text("Último status salvo · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) })
        }

        item {
            Card(shape = RoundedCornerShape(22.dp)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Rounded.UploadFile, null, tint = SantaWine, modifier = Modifier.size(34.dp))
                    Text("Selecionar pacote .tar", color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("Limite de 30 MB", style = MaterialTheme.typography.labelSmall)
                    selected?.let { file ->
                        Text(
                            buildString {
                                append(file.name)
                                file.size?.let { append(" · "); append(formatMegabytes(it)) }
                            },
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Button(onClick = { picker.launch(arrayOf("application/x-tar", "application/octet-stream", "*/*")) }, enabled = !uploading) {
                        Text(if (selected == null) "Escolher arquivo" else "Trocar arquivo")
                    }
                }
            }
        }

        selectionError?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) } }
        if (feedback.isNotBlank()) item { Text(feedback, color = SantaWine, style = MaterialTheme.typography.bodySmall) }

        item {
            Button(
                modifier = Modifier.fillMaxWidth(),
                enabled = selected != null && !uploading,
                onClick = {
                    val file = selected ?: return@Button
                    uploading = true
                    feedback = ""
                    selectionError = null
                    scope.launch {
                        val result = runCatching {
                            val bytes = readTarBytes(context, file.uri)
                            container.httpClient.requestMultipart(
                                method = "POST",
                                path = "/api/admin/acervo-liturgico",
                                fields = emptyMap(),
                                file = MultipartUpload(
                                    fieldName = "arquivo",
                                    fileName = file.name,
                                    mimeType = "application/x-tar",
                                    bytes = bytes,
                                ),
                                authenticated = true,
                            )
                        }
                        result.fold(
                            onSuccess = { response ->
                                if (response.successful) {
                                    status = loadArchiveStatus(container)
                                    selected = null
                                    feedback = "Acervo instalado/atualizado com sucesso: ${status.total} documentos em ${status.categories} categorias."
                                } else {
                                    val serverError = runCatching { JSONObject(response.body).optString("erro") }.getOrNull().orEmpty()
                                    feedback = serverError.ifBlank { "Não foi possível instalar o acervo (HTTP ${response.status})." }
                                }
                            },
                            onFailure = { error -> feedback = error.message ?: "Não foi possível ler ou enviar o pacote selecionado." },
                        )
                        uploading = false
                    }
                },
            ) {
                if (uploading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Icon(Icons.Rounded.UploadFile, null, Modifier.size(18.dp))
                Text(if (uploading) " Instalando acervo…" else " Instalar / atualizar acervo")
            }
        }
    }
}

private fun querySelectedTar(context: Context, uri: Uri): SelectedTar {
    var name = "acervo-liturgico.tar"
    var size: Long? = null
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (nameIndex >= 0) name = cursor.getString(nameIndex)?.takeIf { it.isNotBlank() } ?: name
            if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
        }
    }
    return SelectedTar(uri = uri, name = name, size = size)
}

private suspend fun readTarBytes(context: Context, uri: Uri): ByteArray = withContext(Dispatchers.IO) {
    val input = context.contentResolver.openInputStream(uri) ?: error("Não foi possível abrir o pacote selecionado.")
    input.use { stream ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(64 * 1024)
        var total = 0
        while (true) {
            val read = stream.read(buffer)
            if (read < 0) break
            total += read
            if (total > MAX_ARCHIVE_BYTES) error("O pacote excede o limite de 30 MB.")
            output.write(buffer, 0, read)
        }
        if (total <= 0) error("O pacote selecionado está vazio.")
        output.toByteArray()
    }
}

private fun formatMegabytes(bytes: Long): String = String.format(java.util.Locale("pt", "BR"), "%.1f MB", bytes / 1024.0 / 1024.0)
