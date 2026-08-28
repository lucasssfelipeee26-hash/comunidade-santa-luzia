package br.com.comunidadesantaluzia.nativeapp.features.records

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class MemberRecord(val id: String, val type: String, val date: String, val description: String, val createdAt: Long)
data class RecordsMember(
    val id: String,
    val name: String,
    val role: String,
    val status: String,
    val records: List<MemberRecord>,
)
data class RecordsState(
    val members: List<RecordsMember> = emptyList(),
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

private val recordTypes = listOf("advertencias", "justificativas", "faltas", "observacoes")
private fun labelFor(type: String) = when (type) {
    "advertencias" -> "Advertências"
    "justificativas" -> "Justificativas"
    "faltas" -> "Faltas"
    else -> "Observações"
}

private fun parseMember(item: JSONObject): RecordsMember {
    val records = buildList {
        recordTypes.forEach { type ->
            val array = item.optJSONArray(type) ?: JSONArray()
            repeat(array.length()) { index ->
                val row = array.optJSONObject(index) ?: return@repeat
                add(MemberRecord(row.optString("id"), type, row.optString("data"), row.optString("descricao"), row.optLong("criadoEm")))
            }
        }
    }.sortedByDescending { it.createdAt }
    return RecordsMember(item.optString("id"), item.optString("nome"), item.optString("funcao"), item.optString("status"), records)
}

internal suspend fun loadRecords(container: AppContainer, session: NativeSession): RecordsState {
    val moderator = session.userType == "moderador"
    val path = if (moderator) "/api/membros" else "/api/membros/${session.userId}"
    val key = if (moderator) "membros:registros" else "membro:${session.userId}:registros"
    return when (val result = container.repository.readLocalFirst(key, path, authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val members = if (moderator) {
                val array = root.optJSONArray("membros") ?: JSONArray()
                buildList { repeat(array.length()) { index -> array.optJSONObject(index)?.let { add(parseMember(it)) } } }
            } else listOf(parseMember(root.getJSONObject("membro")))
            RecordsState(members = members, fromCache = result.fromCache, loading = false)
        }.getOrElse { RecordsState(loading = false, error = "Os registros salvos estão em formato inválido.") }
        is RepositoryResult.Failure -> RecordsState(loading = false, error = result.message)
        is RepositoryResult.Queued -> RecordsState(loading = false, error = "A leitura dos registros não deve entrar em fila.")
    }
}

@Composable
internal fun RecordsScreen(container: AppContainer, session: NativeSession) {
    var state by remember { mutableStateOf(RecordsState()) }
    var selectedMemberId by remember { mutableStateOf(session.userId.orEmpty()) }
    var memberMenu by remember { mutableStateOf(false) }
    var selectedType by remember { mutableStateOf(if (session.userType == "moderador") "advertencias" else "justificativas") }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var description by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        state = loadRecords(container, session)
        if (session.userType == "moderador" && selectedMemberId.isBlank()) selectedMemberId = state.members.firstOrNull()?.id.orEmpty()
    }
    val selectedMember = state.members.firstOrNull { it.id == selectedMemberId } ?: state.members.firstOrNull()
    val canAdd = selectedMember != null && (session.userType == "moderador" || selectedType == "justificativas")

    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item {
            Text(if (session.userType == "moderador") "Registros da equipe" else "Meus registros", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold)
            Text("Faltas, justificativas, advertências e observações são dados privados.", style = MaterialTheme.typography.bodySmall)
            if (state.fromCache) AssistChip(onClick = {}, label = { Text("Registros salvos · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) })
            if (feedback.isNotBlank()) Text(feedback, Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall, color = SantaWine)
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            else -> {
                if (session.userType == "moderador") item {
                    Box {
                        OutlinedButton(onClick = { memberMenu = true }, modifier = Modifier.fillMaxWidth()) { Text(selectedMember?.let { "${it.name} · ${it.role}" } ?: "Selecionar membro") }
                        DropdownMenu(expanded = memberMenu, onDismissRequest = { memberMenu = false }) {
                            state.members.forEach { member -> DropdownMenuItem(text = { Text("${member.name} · ${member.role}") }, onClick = { selectedMemberId = member.id; memberMenu = false }) }
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        recordTypes.forEach { type ->
                            FilterChip(selected = selectedType == type, onClick = { selectedType = type }, label = { Text(labelFor(type)) }, modifier = Modifier.weight(1f))
                        }
                    }
                }
                if (canAdd) item {
                    Card(shape = RoundedCornerShape(20.dp)) {
                        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Icon(Icons.Rounded.Add, null, tint = SantaWine); Text("Novo registro", color = SantaWine, fontWeight = FontWeight.Bold) }
                            OutlinedTextField(value = date, onValueChange = { date = it.take(10) }, label = { Text("Data · AAAA-MM-DD") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = description, onValueChange = { if (it.length <= 2000) description = it }, label = { Text("Descrição") }, minLines = 3, modifier = Modifier.fillMaxWidth())
                            Button(
                                enabled = selectedMember != null && Regex("\\d{4}-\\d{2}-\\d{2}").matches(date) && description.trim().length >= 3,
                                onClick = {
                                    val member = selectedMember ?: return@Button
                                    val payload = JSONObject().apply { put("tipo", selectedType); put("data", date); put("descricao", description.trim()) }.toString()
                                    scope.launch {
                                        when (val result = container.repository.mutate("POST", "/api/membros/${member.id}/registros", payload)) {
                                            is RepositoryResult.Success -> { feedback = "Registro salvo."; state = loadRecords(container, session); description = "" }
                                            is RepositoryResult.Queued -> { feedback = "Registro salvo no aparelho e aguardando sincronização."; description = "" }
                                            is RepositoryResult.Failure -> feedback = result.message
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text("Salvar ${labelFor(selectedType).lowercase()}") }
                        }
                    }
                }
                val list = selectedMember?.records?.filter { it.type == selectedType }.orEmpty()
                if (list.isEmpty()) item { Card { Text("Nenhum registro em ${labelFor(selectedType).lowercase()}.", Modifier.padding(18.dp)) } }
                else items(list, key = { it.id }) { record ->
                    Card(shape = RoundedCornerShape(18.dp)) {
                        Row(Modifier.fillMaxWidth().padding(13.dp), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.Description, null, tint = SantaWine)
                            Column(Modifier.weight(1f)) { Text(record.date, fontWeight = FontWeight.Bold, color = SantaWine); Text(record.description, style = MaterialTheme.typography.bodySmall) }
                            if (session.userType == "moderador") OutlinedButton(onClick = {
                                val member = selectedMember ?: return@OutlinedButton
                                scope.launch {
                                    when (val result = container.repository.mutate("DELETE", "/api/membros/${member.id}/registros/${record.id}", null)) {
                                        is RepositoryResult.Success -> { feedback = "Registro excluído."; state = loadRecords(container, session) }
                                        is RepositoryResult.Queued -> feedback = "Exclusão salva e aguardando sincronização."
                                        is RepositoryResult.Failure -> feedback = result.message
                                    }
                                }
                            }) { Icon(Icons.Rounded.Delete, null) }
                        }
                    }
                }
            }
        }
    }
}
