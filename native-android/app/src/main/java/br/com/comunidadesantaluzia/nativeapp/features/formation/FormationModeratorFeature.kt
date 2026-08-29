package br.com.comunidadesantaluzia.nativeapp.features.formation

import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.HowToReg
import androidx.compose.material.icons.rounded.UploadFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

private data class FormationDraft(
    val title: String,
    val theme: String,
    val date: String,
    val time: String,
    val description: String,
    val status: String = "agendada",
    val cancellationReason: String = "",
)

private data class FormationUploadInfo(
    val name: String,
    val mime: String,
    val size: Long,
    val bytes: ByteArray,
)

private data class FormationParticipant(
    val id: String,
    val name: String,
    val function: String,
    val editable: Boolean,
    val lockReason: String?,
    val situation: String,
    val justification: String,
)

@Composable
internal fun FormationModeratorPanel(
    container: AppContainer,
    formations: List<NativeFormation>,
    onChanged: suspend () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var creating by remember { mutableStateOf(false) }
    var selectedFile by remember { mutableStateOf<Uri?>(null) }
    var editing by remember { mutableStateOf<NativeFormation?>(null) }
    var deleting by remember { mutableStateOf<NativeFormation?>(null) }
    var attendance by remember { mutableStateOf<NativeFormation?>(null) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> selectedFile = uri }

    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .12f)),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Administração da formação", color = SantaWine, fontWeight = FontWeight.Bold)
            Text("Publicação, materiais e alterações administrativas exigem confirmação do servidor.", style = MaterialTheme.typography.bodySmall)
            feedback?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = if (it.startsWith("Erro")) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface) }
            Button(onClick = { selectedFile = null; creating = true }, enabled = !busy) {
                Icon(Icons.Rounded.Add, null)
                Text("Nova formação", Modifier.padding(start = 7.dp))
            }
            formations.sortedByDescending { it.date }.take(10).forEach { formation ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${formation.date}${formation.time?.let { " · $it" }.orEmpty()} · ${formation.title}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        TextButton(onClick = { editing = formation }, enabled = !busy) { Icon(Icons.Rounded.Edit, null, Modifier.size(17.dp)); Text("Editar") }
                        TextButton(onClick = { attendance = formation }, enabled = !busy) { Icon(Icons.Rounded.HowToReg, null, Modifier.size(17.dp)); Text("Presenças") }
                        TextButton(onClick = { deleting = formation }, enabled = !busy) { Icon(Icons.Rounded.Delete, null, Modifier.size(17.dp)); Text("Excluir") }
                    }
                }
            }
            if (busy) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                Text("Salvando…", style = MaterialTheme.typography.bodySmall)
            }
        }
    }

    if (creating) {
        FormationEditorDialog(
            initial = null,
            selectedFile = selectedFile,
            onChooseFile = { picker.launch(arrayOf("application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.presentation")) },
            onDismiss = { creating = false; selectedFile = null },
            onSave = { draft ->
                scope.launch {
                    busy = true
                    val upload = selectedFile?.let { loadFormationUpload(context, it) }
                    if (upload != null && upload.size > 20L * 1024L * 1024L) {
                        feedback = "Erro: o material deve ter no máximo 20 MB."
                        busy = false
                        return@launch
                    }
                    val fields = mapOf(
                        "titulo" to draft.title,
                        "tema" to draft.theme,
                        "data" to draft.date,
                        "horario" to draft.time,
                        "descricao" to draft.description,
                        "status" to draft.status,
                        "motivo_cancelamento" to draft.cancellationReason,
                    )
                    when (val result = container.repository.mutateMultipartOnlineOnly(
                        method = "POST",
                        path = "/api/formacoes",
                        fields = fields,
                        fileField = upload?.let { "arquivo" },
                        fileName = upload?.name,
                        mimeType = upload?.mime,
                        fileBytes = upload?.bytes,
                    )) {
                        is RepositoryResult.Success -> {
                            feedback = "Formação publicada."
                            creating = false
                            selectedFile = null
                            onChanged()
                        }
                        is RepositoryResult.Failure -> feedback = "Erro: ${result.message}"
                        is RepositoryResult.Queued -> feedback = "Erro: publicação não pode ficar em fila offline."
                    }
                    busy = false
                }
            },
        )
    }

    editing?.let { formation ->
        FormationEditorDialog(
            initial = formation,
            selectedFile = null,
            onChooseFile = null,
            onDismiss = { editing = null },
            onSave = { draft ->
                scope.launch {
                    busy = true
                    val payload = JSONObject()
                        .put("titulo", draft.title)
                        .put("tema", draft.theme)
                        .put("data", draft.date)
                        .put("horario", draft.time)
                        .put("descricao", draft.description)
                        .toString()
                    when (val result = container.repository.mutateOnlineOnly("PATCH", "/api/formacoes/${formation.id}", payload)) {
                        is RepositoryResult.Success -> { feedback = "Formação atualizada."; editing = null; onChanged() }
                        is RepositoryResult.Failure -> feedback = "Erro: ${result.message}"
                        is RepositoryResult.Queued -> feedback = "Erro: edição não pode ficar em fila offline."
                    }
                    busy = false
                }
            },
            onStatus = { status, reason ->
                scope.launch {
                    busy = true
                    val payload = JSONObject().put("status", status).put("motivo_cancelamento", reason).toString()
                    when (val result = container.repository.mutateOnlineOnly("PATCH", "/api/formacoes/${formation.id}", payload)) {
                        is RepositoryResult.Success -> { feedback = "Status atualizado."; editing = null; onChanged() }
                        is RepositoryResult.Failure -> feedback = "Erro: ${result.message}"
                        is RepositoryResult.Queued -> feedback = "Erro: alteração não pode ficar em fila offline."
                    }
                    busy = false
                }
            },
        )
    }

    deleting?.let { formation ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Excluir formação?") },
            text = { Text("${formation.title} e o material anexado serão removidos definitivamente.") },
            confirmButton = {
                Button(onClick = {
                    scope.launch {
                        busy = true
                        when (val result = container.repository.mutateOnlineOnly("DELETE", "/api/formacoes/${formation.id}", null)) {
                            is RepositoryResult.Success -> { feedback = "Formação excluída."; deleting = null; onChanged() }
                            is RepositoryResult.Failure -> feedback = "Erro: ${result.message}"
                            is RepositoryResult.Queued -> feedback = "Erro: exclusão não pode ficar em fila offline."
                        }
                        busy = false
                    }
                }) { Text("Excluir") }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancelar") } },
        )
    }

    attendance?.let { formation ->
        FormationAttendanceDialog(
            container = container,
            formation = formation,
            onDismiss = { attendance = null },
            onSaved = {
                feedback = "Lista de presença atualizada."
                attendance = null
                scope.launch { onChanged() }
            },
        )
    }
}

@Composable
private fun FormationEditorDialog(
    initial: NativeFormation?,
    selectedFile: Uri?,
    onChooseFile: (() -> Unit)?,
    onDismiss: () -> Unit,
    onSave: (FormationDraft) -> Unit,
    onStatus: ((String, String) -> Unit)? = null,
) {
    var title by remember(initial?.id) { mutableStateOf(initial?.title.orEmpty()) }
    var theme by remember(initial?.id) { mutableStateOf(initial?.theme.orEmpty()) }
    var date by remember(initial?.id) { mutableStateOf(initial?.date.orEmpty()) }
    var time by remember(initial?.id) { mutableStateOf(initial?.time.orEmpty()) }
    var description by remember(initial?.id) { mutableStateOf(initial?.description.orEmpty()) }
    var cancelReason by remember(initial?.id) { mutableStateOf(initial?.cancellationReason.orEmpty()) }
    var error by remember(initial?.id) { mutableStateOf<String?>(null) }

    fun draft(): FormationDraft? {
        if (title.trim().length !in 3..180 || theme.trim().length !in 3..180) { error = "Título e tema precisam ter entre 3 e 180 caracteres."; return null }
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date)) { error = "Informe a data como AAAA-MM-DD."; return null }
        if (time.isNotBlank() && !Regex("^(?:[01]\\d|2[0-3]):[0-5]\\d$").matches(time)) { error = "Informe o horário como HH:MM."; return null }
        if (description.length > 4000) { error = "A descrição deve ter no máximo 4.000 caracteres."; return null }
        error = null
        return FormationDraft(title.trim(), theme.trim(), date.trim(), time.trim(), description.trim())
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "Publicar formação" else "Editar formação") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                item { OutlinedTextField(title, { title = it.take(180) }, Modifier.fillMaxWidth(), label = { Text("Título") }) }
                item { OutlinedTextField(theme, { theme = it.take(180) }, Modifier.fillMaxWidth(), label = { Text("Tema") }) }
                item { OutlinedTextField(date, { date = it.take(10) }, Modifier.fillMaxWidth(), label = { Text("Data · AAAA-MM-DD") }, singleLine = true) }
                item { OutlinedTextField(time, { time = it.take(5) }, Modifier.fillMaxWidth(), label = { Text("Horário · HH:MM") }, singleLine = true) }
                item { OutlinedTextField(description, { description = it.take(4000) }, Modifier.fillMaxWidth(), label = { Text("Descrição") }, minLines = 3, supportingText = { Text("${description.length}/4000") }) }
                if (onChooseFile != null) item {
                    OutlinedButton(onClick = onChooseFile, Modifier.fillMaxWidth()) {
                        Icon(Icons.Rounded.UploadFile, null)
                        Text(if (selectedFile == null) "Anexar material" else "Material selecionado", Modifier.padding(start = 7.dp))
                    }
                }
                if (initial != null && onStatus != null) {
                    item { Text("Status da formação", color = SantaWine, fontWeight = FontWeight.Bold) }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { onStatus("agendada", "") }) { Text("Agendada") }
                            OutlinedButton(onClick = { onStatus("concluida", "") }) { Text("Concluída") }
                        }
                    }
                    item { OutlinedTextField(cancelReason, { cancelReason = it.take(1000) }, Modifier.fillMaxWidth(), label = { Text("Motivo do cancelamento") }) }
                    item { OutlinedButton(onClick = { if (cancelReason.trim().length >= 3) onStatus("cancelada", cancelReason.trim()) else error = "Informe o motivo do cancelamento." }, Modifier.fillMaxWidth()) { Text("Cancelar formação") } }
                }
                error?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) } }
            }
        },
        confirmButton = { Button(onClick = { draft()?.let(onSave) }) { Text("Salvar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Fechar") } },
    )
}

@Composable
private fun FormationAttendanceDialog(
    container: AppContainer,
    formation: NativeFormation,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var participants by remember(formation.id) { mutableStateOf<List<FormationParticipant>>(emptyList()) }
    var loading by remember(formation.id) { mutableStateOf(true) }
    var error by remember(formation.id) { mutableStateOf<String?>(null) }
    var saving by remember(formation.id) { mutableStateOf(false) }

    LaunchedEffect(formation.id) {
        when (val result = container.repository.readLocalFirst("formacao-presencas-${formation.id}", "/api/formacoes/${formation.id}/presencas", authenticated = true)) {
            is RepositoryResult.Success -> participants = parseParticipants(result.value)
            is RepositoryResult.Failure -> error = result.message
            is RepositoryResult.Queued -> error = "A lista de presença não deve entrar em fila."
        }
        loading = false
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Presenças · ${formation.title}") },
        text = {
            when {
                loading -> CircularProgressIndicator()
                error != null -> Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(participants, key = { it.id }) { participant ->
                        ParticipantPresenceEditor(participant) { updated ->
                            participants = participants.map { if (it.id == updated.id) updated else it }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !loading && !saving && error == null,
                onClick = {
                    scope.launch {
                        saving = true
                        val array = JSONArray()
                        participants.filter { it.editable }.forEach { participant ->
                            array.put(JSONObject()
                                .put("usuarioId", participant.id)
                                .put("situacao", participant.situation)
                                .put("justificativa", if (participant.situation == "justificada") participant.justification.trim() else ""))
                        }
                        val payload = JSONObject().put("presencas", array).toString()
                        when (val result = container.repository.mutateOnlineOnly("PUT", "/api/formacoes/${formation.id}/presencas", payload)) {
                            is RepositoryResult.Success -> onSaved()
                            is RepositoryResult.Failure -> error = result.message
                            is RepositoryResult.Queued -> error = "A lista administrativa não pode ficar em fila offline."
                        }
                        saving = false
                    }
                },
            ) { Text(if (saving) "Salvando…" else "Salvar lista") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Fechar") } },
    )
}

@Composable
private fun ParticipantPresenceEditor(
    participant: FormationParticipant,
    onChange: (FormationParticipant) -> Unit,
) {
    var expanded by remember(participant.id) { mutableStateOf(false) }
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .55f))) {
        Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(participant.name, fontWeight = FontWeight.SemiBold)
            Text(participant.function, style = MaterialTheme.typography.labelSmall)
            if (!participant.editable) {
                Text(participant.lockReason ?: "Registro protegido.", style = MaterialTheme.typography.bodySmall)
            } else {
                Column {
                    OutlinedButton(onClick = { expanded = true }, Modifier.fillMaxWidth()) { Text(presenceLabel(participant.situation)) }
                    DropdownMenu(expanded, { expanded = false }) {
                        listOf("nao_registrado", "presente", "falta", "justificada").forEach { situation ->
                            DropdownMenuItem(text = { Text(presenceLabel(situation)) }, onClick = { onChange(participant.copy(situation = situation)); expanded = false })
                        }
                    }
                }
                if (participant.situation == "justificada") {
                    OutlinedTextField(
                        value = participant.justification,
                        onValueChange = { onChange(participant.copy(justification = it.take(500))) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Justificativa") },
                    )
                }
            }
        }
    }
}

private fun parseParticipants(payload: String): List<FormationParticipant> = runCatching {
    val array = JSONObject(payload).optJSONArray("participantes") ?: JSONArray()
    buildList {
        repeat(array.length()) { index ->
            val item = array.optJSONObject(index) ?: return@repeat
            add(FormationParticipant(
                id = item.optString("id"),
                name = item.optString("nome"),
                function = item.optString("funcao"),
                editable = item.optBoolean("editavel", true),
                lockReason = item.optString("motivo_bloqueio").takeIf { it.isNotBlank() && it != "null" },
                situation = item.optString("situacao", "nao_registrado"),
                justification = item.optString("justificativa"),
            ))
        }
    }
}.getOrDefault(emptyList())

private fun presenceLabel(value: String): String = when (value) {
    "presente" -> "Presente"
    "falta" -> "Falta"
    "justificada" -> "Falta justificada"
    else -> "Não registrado"
}

private suspend fun loadFormationUpload(context: Context, uri: Uri): FormationUploadInfo? = withContext(Dispatchers.IO) {
    runCatching {
        var name = "material"
        var size = -1L
        val cursor: Cursor? = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = it.getColumnIndex(OpenableColumns.SIZE)
                if (nameIndex >= 0) name = it.getString(nameIndex) ?: name
                if (sizeIndex >= 0 && !it.isNull(sizeIndex)) size = it.getLong(sizeIndex)
            }
        }
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@runCatching null
        if (size < 0) size = bytes.size.toLong()
        FormationUploadInfo(name = name.take(240), mime = context.contentResolver.getType(uri).orEmpty(), size = size, bytes = bytes)
    }.getOrNull()
}
