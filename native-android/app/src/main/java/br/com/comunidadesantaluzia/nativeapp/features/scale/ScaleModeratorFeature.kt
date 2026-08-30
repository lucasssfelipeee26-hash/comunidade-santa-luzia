package br.com.comunidadesantaluzia.nativeapp.features.scale

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
import androidx.compose.material.icons.rounded.People
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.util.UUID
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private data class ScaleMemberOption(
    val id: String,
    val name: String,
    val function: String,
) {
    val category: String get() = if (function.equals("Acólito", ignoreCase = true)) "acolito" else "coroinha"
}

private val officialScaleRoles = listOf(
    "1º Cerimoniário",
    "2º Cerimoniário",
    "Cruciferário",
    "1º Ceroferário",
    "2º Ceroferário",
    "1º Mestre de Procissão",
    "2º Mestre de Procissão",
    "Turiferário",
    "Naviculário",
    "Librífero",
    "Auxiliar de Credência",
)

private fun optimisticScalePublication(
    cachedPayload: String?,
    requestId: String,
    requestPayload: String,
    members: List<ScaleMemberOption>,
): String? = runCatching {
    val root = JSONObject(cachedPayload ?: return@runCatching null)
    val scales = root.optJSONArray("escalas") ?: JSONArray().also { root.put("escalas", it) }
    val request = JSONObject(requestPayload)
    val peopleInput = request.optJSONArray("pessoas") ?: JSONArray()
    val people = JSONArray()
    repeat(peopleInput.length()) { index ->
        val item = peopleInput.optJSONObject(index) ?: return@repeat
        val id = item.optString("id")
        val member = members.firstOrNull { it.id == id }
        people.put(JSONObject().apply {
            put("id", id)
            put("nome", member?.name.orEmpty())
            put("categoria", item.optString("categoria"))
            put("funcao", item.optString("funcao"))
        })
    }
    scales.put(JSONObject().apply {
        put("id", "local-scale-$requestId")
        put("data", request.optString("data"))
        put("horario", request.optString("horario"))
        put("celebrante", request.optString("celebrante"))
        put("observacoes", request.optString("observacoes"))
        put("celebracao_liturgica", request.optString("celebracaoLiturgica").takeIf { it.isNotBlank() } ?: JSONObject.NULL)
        put("tempo_liturgico", request.optString("tempoLiturgico").takeIf { it.isNotBlank() } ?: JSONObject.NULL)
        put("cor_liturgica", request.optString("corLiturgica").takeIf { it.isNotBlank() } ?: JSONObject.NULL)
        put("ciclo_dominical", request.optString("cicloDominical").takeIf { it.isNotBlank() } ?: JSONObject.NULL)
        put("data_liturgica", request.optString("dataLiturgica").takeIf { it.isNotBlank() } ?: JSONObject.NULL)
        put("pessoas", people)
        put("minha_justificativa", JSONObject.NULL)
        put("sincronizacaoPendente", true)
    })
    root.toString()
}.getOrNull()

@Composable
internal fun ScaleModeratorPanel(
    container: AppContainer,
    scales: List<NativeScale>,
    onChanged: suspend () -> Unit,
) {
    var members by remember { mutableStateOf<List<ScaleMemberOption>>(emptyList()) }
    var membersError by remember { mutableStateOf<String?>(null) }
    var editor by remember { mutableStateOf<NativeScale?>(null) }
    var creating by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<NativeScale?>(null) }
    var feedback by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        when (val result = container.repository.readLocalFirst("perfis", "/api/perfis", authenticated = true)) {
            is RepositoryResult.Success -> members = parseScaleMembers(result.value)
            is RepositoryResult.Failure -> membersError = result.message
            is RepositoryResult.Queued -> membersError = "A lista da equipe não deve entrar em fila."
        }
    }

    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .12f)),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Rounded.People, null, tint = SantaWine)
                Column(Modifier.weight(1f)) {
                    Text("Gestão de escalas", color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("Nova escala pode ser publicada offline e sincroniza depois. Editar ou excluir ainda exige confirmação do servidor.", style = MaterialTheme.typography.bodySmall)
                }
            }
            membersError?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
            feedback?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Button(
                onClick = { creating = true; editor = null },
                enabled = members.isNotEmpty(),
            ) {
                Icon(Icons.Rounded.Add, null)
                Text("Nova escala", Modifier.padding(start = 7.dp))
            }
            scales.take(8).forEach { scale ->
                val pending = scale.id.startsWith("local-scale-")
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("${scale.date} · ${scale.time}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                        if (pending) Text("Aguardando sincronização", style = MaterialTheme.typography.labelSmall, color = SantaWine)
                    }
                    if (!pending) {
                        TextButton(onClick = { editor = scale; creating = false }) {
                            Icon(Icons.Rounded.Edit, null, Modifier.size(17.dp))
                            Text("Editar")
                        }
                        TextButton(onClick = { deleting = scale }) {
                            Icon(Icons.Rounded.Delete, null, Modifier.size(17.dp))
                            Text("Excluir")
                        }
                    }
                }
            }
        }
    }

    if (creating || editor != null) {
        ScaleEditorDialog(
            initial = editor,
            members = members,
            onDismiss = { creating = false; editor = null },
            onSave = { payload ->
                scope.launch {
                    feedback = null
                    val current = editor
                    val result = if (current == null) {
                        val requestId = UUID.randomUUID().toString()
                        val requestPayload = JSONObject(payload).put("clientRequestId", requestId).toString()
                        val cached = container.repository.cachedDocumentForCurrentUser("escalas")?.payload
                        val optimistic = optimisticScalePublication(cached, requestId, requestPayload, members)
                        container.repository.mutate(
                            method = "POST",
                            path = "/api/escalas",
                            payload = requestPayload,
                            optimisticCacheKey = optimistic?.let { "escalas" },
                            optimisticPayload = optimistic,
                        )
                    } else {
                        container.repository.mutateOnlineOnly("PATCH", "/api/escalas/${current.id}", payload)
                    }
                    when (result) {
                        is RepositoryResult.Success -> {
                            feedback = if (current == null) "Escala publicada." else "Escala atualizada."
                            creating = false
                            editor = null
                            onChanged()
                        }
                        is RepositoryResult.Failure -> feedback = result.message
                        is RepositoryResult.Queued -> {
                            feedback = "Escala salva neste aparelho e aguardando sincronização."
                            creating = false
                            editor = null
                            onChanged()
                        }
                    }
                }
            },
        )
    }

    deleting?.let { scale ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Excluir escala?") },
            text = { Text("A escala de ${scale.date} às ${scale.time} será removida definitivamente do servidor.") },
            confirmButton = {
                Button(onClick = {
                    scope.launch {
                        when (val result = container.repository.mutateOnlineOnly("DELETE", "/api/escalas/${scale.id}", null)) {
                            is RepositoryResult.Success -> {
                                feedback = "Escala excluída."
                                deleting = null
                                onChanged()
                            }
                            is RepositoryResult.Failure -> feedback = result.message
                            is RepositoryResult.Queued -> feedback = "Esta operação não pode ficar em fila offline."
                        }
                    }
                }) { Text("Excluir") }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancelar") } },
        )
    }
}

private fun parseScaleMembers(payload: String): List<ScaleMemberOption> = runCatching {
    val array = JSONObject(payload).optJSONArray("perfis") ?: JSONArray()
    buildList {
        repeat(array.length()) { index ->
            val item = array.optJSONObject(index) ?: return@repeat
            val function = item.optString("funcao")
            if (function.equals("Acólito", true) || function.equals("Coroinha", true)) {
                add(ScaleMemberOption(item.optString("id"), item.optString("nome"), function))
            }
        }
    }.filter { it.id.isNotBlank() && it.name.isNotBlank() }.sortedBy { it.name.lowercase() }
}.getOrDefault(emptyList())

@Composable
private fun ScaleEditorDialog(
    initial: NativeScale?,
    members: List<ScaleMemberOption>,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var date by remember(initial?.id) { mutableStateOf(initial?.date.orEmpty()) }
    var time by remember(initial?.id) { mutableStateOf(initial?.time.orEmpty()) }
    var celebrant by remember(initial?.id) { mutableStateOf(initial?.celebrant.orEmpty()) }
    var celebration by remember(initial?.id) { mutableStateOf(initial?.celebration.orEmpty()) }
    var season by remember(initial?.id) { mutableStateOf(initial?.liturgicalSeason.orEmpty()) }
    var color by remember(initial?.id) { mutableStateOf(initial?.liturgicalColor.orEmpty()) }
    var cycle by remember(initial?.id) { mutableStateOf(initial?.sundayCycle.orEmpty()) }
    var liturgicalDate by remember(initial?.id) { mutableStateOf(initial?.liturgicalDate.orEmpty()) }
    var notes by remember(initial?.id) { mutableStateOf(initial?.notes.orEmpty()) }
    var formError by remember(initial?.id) { mutableStateOf<String?>(null) }
    val assignments = remember(initial?.id) {
        mutableStateMapOf<String, String>().apply {
            initial?.people?.forEach { person -> if (!person.id.isNullOrBlank() && person.role.isNotBlank()) put(person.id, person.role) }
        }
    }

    fun validateAndBuild(): String? {
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date)) { formError = "Informe a data como AAAA-MM-DD."; return null }
        if (!Regex("^(?:[01]\\d|2[0-3]):[0-5]\\d$").matches(time)) { formError = "Informe um horário válido no formato HH:MM."; return null }
        if (celebrant.trim().length !in 2..120) { formError = "Informe o sacerdote celebrante."; return null }
        if (notes.length > 1200) { formError = "As observações devem ter no máximo 1.200 caracteres."; return null }
        val selectedRoles = assignments.values.filter(String::isNotBlank)
        if (selectedRoles.size != selectedRoles.distinct().size) { formError = "Cada função só pode ser atribuída a uma pessoa."; return null }
        val people = JSONArray()
        assignments.forEach { (memberId, role) ->
            if (role.isNotBlank()) {
                val member = members.firstOrNull { it.id == memberId } ?: return@forEach
                people.put(JSONObject().put("id", member.id).put("categoria", member.category).put("funcao", role))
            }
        }
        formError = null
        return JSONObject()
            .put("data", date.trim())
            .put("horario", time.trim())
            .put("celebrante", celebrant.trim())
            .put("observacoes", notes.trim())
            .put("celebracaoLiturgica", celebration.trim())
            .put("tempoLiturgico", season.trim())
            .put("corLiturgica", color.trim())
            .put("cicloDominical", cycle.trim())
            .put("dataLiturgica", liturgicalDate.trim())
            .put("pessoas", people)
            .toString()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "Publicar escala" else "Editar escala") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                item { OutlinedTextField(date, { date = it.take(10) }, Modifier.fillMaxWidth(), label = { Text("Data · AAAA-MM-DD") }, singleLine = true) }
                item { OutlinedTextField(time, { time = it.take(5) }, Modifier.fillMaxWidth(), label = { Text("Horário · HH:MM") }, singleLine = true) }
                item { OutlinedTextField(celebrant, { celebrant = it.take(120) }, Modifier.fillMaxWidth(), label = { Text("Celebrante") }, singleLine = true) }
                item { OutlinedTextField(celebration, { celebration = it.take(180) }, Modifier.fillMaxWidth(), label = { Text("Celebração litúrgica") }) }
                item { OutlinedTextField(season, { season = it.take(180) }, Modifier.fillMaxWidth(), label = { Text("Tempo litúrgico") }) }
                item { OutlinedTextField(color, { color = it.take(180) }, Modifier.fillMaxWidth(), label = { Text("Cor litúrgica") }) }
                item { OutlinedTextField(cycle, { cycle = it.take(180) }, Modifier.fillMaxWidth(), label = { Text("Ciclo dominical") }) }
                item { OutlinedTextField(liturgicalDate, { liturgicalDate = it.take(10) }, Modifier.fillMaxWidth(), label = { Text("Data litúrgica · opcional") }) }
                item { OutlinedTextField(notes, { notes = it.take(1200) }, Modifier.fillMaxWidth(), label = { Text("Observações") }, minLines = 2, supportingText = { Text("${notes.length}/1200") }) }
                item { Text("Equipe e funções", color = SantaWine, fontWeight = FontWeight.Bold) }
                items(members, key = { it.id }) { member ->
                    MemberRoleSelector(
                        member = member,
                        selectedRole = assignments[member.id].orEmpty(),
                        usedRoles = assignments.filterKeys { it != member.id }.values.toSet(),
                        onRole = { role -> if (role.isBlank()) assignments.remove(member.id) else assignments[member.id] = role },
                    )
                }
                formError?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) } }
            }
        },
        confirmButton = {
            Button(onClick = { validateAndBuild()?.let(onSave) }) { Text(if (initial == null) "Publicar" else "Salvar") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun MemberRoleSelector(
    member: ScaleMemberOption,
    selectedRole: String,
    usedRoles: Set<String>,
    onRole: (String) -> Unit,
) {
    var expanded by remember(member.id) { mutableStateOf(false) }
    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .55f))) {
        Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(member.name, fontWeight = FontWeight.SemiBold)
            Text(member.function, style = MaterialTheme.typography.labelSmall)
            Column {
                OutlinedButton(onClick = { expanded = true }, Modifier.fillMaxWidth()) {
                    Text(selectedRole.ifBlank { "Não escalado" })
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    DropdownMenuItem(text = { Text("Não escalado") }, onClick = { onRole(""); expanded = false })
                    officialScaleRoles.forEach { role ->
                        DropdownMenuItem(
                            text = { Text(if (role in usedRoles) "$role · em uso" else role) },
                            enabled = role !in usedRoles,
                            onClick = { onRole(role); expanded = false },
                        )
                    }
                }
            }
        }
    }
}
