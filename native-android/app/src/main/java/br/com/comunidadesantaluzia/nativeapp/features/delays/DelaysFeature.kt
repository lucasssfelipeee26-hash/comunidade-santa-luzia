package br.com.comunidadesantaluzia.nativeapp.features.delays

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.PendingActions
import androidx.compose.material.icons.rounded.Report
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
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
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class DelayMember(val id: String, val name: String, val role: String)
data class DelayOccurrence(
    val id: String,
    val userId: String,
    val userName: String,
    val massDate: String,
    val massTime: String,
    val arrivalLimit: String,
    val note: String,
    val status: String,
    val reporterId: String?,
    val reporterName: String?,
    val pendingSync: Boolean = false,
)
data class DelaysState(
    val myId: String? = null,
    val myType: String? = null,
    val members: List<DelayMember> = emptyList(),
    val occurrences: List<DelayOccurrence> = emptyList(),
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
    val rawPayload: String? = null,
)

internal suspend fun loadDelays(container: AppContainer): DelaysState {
    return when (val result = container.repository.readLocalFirst("ranking", "/api/ranking", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val me = root.optJSONObject("eu")
            val membersArray = root.optJSONArray("membros") ?: JSONArray()
            val occurrencesArray = root.optJSONArray("ocorrencias") ?: JSONArray()
            val members = buildList {
                repeat(membersArray.length()) { index ->
                    val item = membersArray.optJSONObject(index) ?: return@repeat
                    add(DelayMember(item.optString("id"), item.optString("nome"), item.optString("funcao")))
                }
            }
            val occurrences = buildList {
                repeat(occurrencesArray.length()) { index ->
                    val item = occurrencesArray.optJSONObject(index) ?: return@repeat
                    add(
                        DelayOccurrence(
                            id = item.optString("id"),
                            userId = item.optString("usuario_id"),
                            userName = item.optString("usuario_nome"),
                            massDate = item.optString("data_missa"),
                            massTime = item.optString("horario_missa"),
                            arrivalLimit = item.optString("limite_chegada"),
                            note = item.optString("observacao"),
                            status = item.optString("status"),
                            reporterId = item.optString("reportado_por").takeIf { it.isNotBlank() && it != "null" },
                            reporterName = item.optString("reportado_por_nome").takeIf { it.isNotBlank() && it != "null" },
                        ),
                    )
                }
            }
            DelaysState(
                myId = me?.optString("id"),
                myType = me?.optString("tipo"),
                members = members,
                occurrences = occurrences.sortedByDescending { "${it.massDate} ${it.massTime}" },
                fromCache = result.fromCache,
                loading = false,
                rawPayload = result.value,
            )
        }.getOrElse { DelaysState(loading = false, error = "Os dados de atrasos salvos estão em formato inválido.") }
        is RepositoryResult.Failure -> DelaysState(loading = false, error = result.message)
        is RepositoryResult.Queued -> DelaysState(loading = false, error = "A leitura de atrasos não deve entrar em fila.")
    }
}

@Composable
internal fun DelaysScreen(container: AppContainer) {
    var state by remember { mutableStateOf(DelaysState()) }
    var selectedMember by remember { mutableStateOf<DelayMember?>(null) }
    var memberMenu by remember { mutableStateOf(false) }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var time by remember { mutableStateOf("18:00") }
    var note by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { state = loadDelays(container) }
    val availableMembers = remember(state.members, state.myId) { state.members.filter { it.id != state.myId } }
    val isModerator = state.myType == "moderador"

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("Atrasos", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                Text("Qualquer membro pode relatar. A moderação decide se o atraso é confirmado ou rejeitado.", style = MaterialTheme.typography.bodySmall)
                if (state.fromCache) AssistChip(onClick = {}, label = { Text("Dados salvos · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) })
            }
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            else -> {
                item {
                    Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                Icon(Icons.Rounded.Report, null, tint = SantaWine)
                                Text("Reportar colega que chegou atrasado", color = SantaWine, fontWeight = FontWeight.Bold)
                            }
                            Box {
                                OutlinedButton(onClick = { memberMenu = true }, modifier = Modifier.fillMaxWidth()) {
                                    Text(selectedMember?.let { "${it.name} · ${it.role}" } ?: "Selecionar membro")
                                }
                                DropdownMenu(expanded = memberMenu, onDismissRequest = { memberMenu = false }) {
                                    availableMembers.forEach { member ->
                                        DropdownMenuItem(text = { Text("${member.name} · ${member.role}") }, onClick = { selectedMember = member; memberMenu = false })
                                    }
                                }
                            }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(value = date, onValueChange = { date = it.take(10) }, label = { Text("Data") }, singleLine = true, modifier = Modifier.weight(1f))
                                OutlinedTextField(value = time, onValueChange = { time = it.take(5) }, label = { Text("Horário") }, singleLine = true, modifier = Modifier.weight(1f))
                            }
                            OutlinedTextField(value = note, onValueChange = { if (it.length <= 300) note = it }, label = { Text("Observação (opcional)") }, modifier = Modifier.fillMaxWidth())
                            Button(
                                enabled = selectedMember != null && Regex("\\d{4}-\\d{2}-\\d{2}").matches(date) && Regex("\\d{2}:\\d{2}").matches(time),
                                onClick = {
                                    val member = selectedMember ?: return@Button
                                    val requestId = "native:${UUID.randomUUID()}"
                                    val tempId = "pending:$requestId"
                                    val occurrence = DelayOccurrence(tempId, member.id, member.name, date, time, "—", note.trim(), "pendente", state.myId, "Você", pendingSync = true)
                                    state = state.copy(occurrences = listOf(occurrence) + state.occurrences)
                                    scope.launch {
                                        val payload = JSONObject().apply {
                                            put("action", "reportar_atraso")
                                            put("usuarioId", member.id)
                                            put("dataMissa", date)
                                            put("horarioMissa", time)
                                            put("observacao", note.trim())
                                            put("clientRequestId", requestId)
                                        }.toString()
                                        when (container.repository.mutate("POST", "/api/ranking", payload)) {
                                            is RepositoryResult.Success -> { feedback = "Relato enviado ao moderador para confirmação."; state = loadDelays(container) }
                                            is RepositoryResult.Queued -> feedback = "Relato salvo no aparelho. Ele será enviado quando a internet voltar."
                                            is RepositoryResult.Failure -> feedback = "Não foi possível registrar o relato."
                                        }
                                    }
                                    note = ""
                                },
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text("Enviar relato") }
                            if (feedback.isNotBlank()) Text(feedback, style = MaterialTheme.typography.bodySmall, color = SantaWine)
                        }
                    }
                }
                item {
                    Text(if (isModerator) "Relatos para moderação" else "Relatos visíveis para você", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                }
                val visible = if (isModerator) state.occurrences.sortedWith(compareBy<DelayOccurrence> { it.status != "pendente" }.thenByDescending { it.massDate }) else state.occurrences
                if (visible.isEmpty()) item { Card { Text("Nenhum relato de atraso disponível.", Modifier.padding(20.dp)) } }
                else items(visible, key = { it.id }) { occurrence ->
                    DelayCard(
                        occurrence = occurrence,
                        isModerator = isModerator,
                        onModerate = { status ->
                            scope.launch {
                                val payload = JSONObject().apply { put("action", "moderar_atraso"); put("ocorrenciaId", occurrence.id); put("status", status) }.toString()
                                val optimistic = state.copy(occurrences = state.occurrences.map { if (it.id == occurrence.id) it.copy(status = status, pendingSync = true) else it })
                                state = optimistic
                                when (container.repository.mutate("POST", "/api/ranking", payload)) {
                                    is RepositoryResult.Success -> state = loadDelays(container)
                                    is RepositoryResult.Queued -> feedback = "Decisão salva e aguardando sincronização."
                                    is RepositoryResult.Failure -> { feedback = "Não foi possível salvar a decisão."; state = loadDelays(container) }
                                }
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun DelayCard(occurrence: DelayOccurrence, isModerator: Boolean, onModerate: (String) -> Unit) {
    val statusLabel = when (occurrence.status) { "confirmado" -> "Confirmado"; "rejeitado" -> "Rejeitado"; else -> "Aguardando moderação" }
    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(occurrence.userName, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("${occurrence.massDate} · missa às ${occurrence.massTime}", style = MaterialTheme.typography.bodySmall)
                }
                Icon(if (occurrence.status == "confirmado") Icons.Rounded.CheckCircle else Icons.Rounded.PendingActions, null, tint = if (occurrence.status == "confirmado") SantaGold else SantaWine)
            }
            if (occurrence.arrivalLimit.isNotBlank() && occurrence.arrivalLimit != "—") {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Icon(Icons.Rounded.Schedule, null, Modifier.size(16.dp))
                    Text("Limite de chegada: ${occurrence.arrivalLimit}", style = MaterialTheme.typography.bodySmall)
                }
            }
            occurrence.reporterName?.let { Text("Reportado por: $it", style = MaterialTheme.typography.bodySmall) }
            if (occurrence.note.isNotBlank()) Text(occurrence.note, style = MaterialTheme.typography.bodySmall)
            AssistChip(onClick = {}, label = { Text(statusLabel + if (occurrence.pendingSync) " · sincronizando" else "") })
            if (isModerator && occurrence.status == "pendente" && !occurrence.id.startsWith("pending:")) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { onModerate("confirmado") }, modifier = Modifier.weight(1f)) { Text("Confirmar atraso") }
                    OutlinedButton(onClick = { onModerate("rejeitado") }, modifier = Modifier.weight(1f)) { Text("Rejeitar") }
                }
            }
        }
    }
}
