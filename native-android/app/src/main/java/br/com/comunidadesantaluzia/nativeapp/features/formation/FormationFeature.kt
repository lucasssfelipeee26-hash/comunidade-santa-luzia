package br.com.comunidadesantaluzia.nativeapp.features.formation

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
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.BuildConfig
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class NativeFormationFile(val name: String, val mime: String, val size: Long)
data class NativeFormationPresence(val status: String, val justification: String?, val updatedAt: Long, val pending: Boolean = false)
data class NativeFormation(
    val id: String,
    val title: String,
    val theme: String,
    val date: String,
    val time: String?,
    val description: String,
    val status: String,
    val cancellationReason: String?,
    val file: NativeFormationFile?,
    val myPresence: NativeFormationPresence?,
)
data class FormationState(
    val formations: List<NativeFormation> = emptyList(),
    val userId: String? = null,
    val userType: String? = null,
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

internal suspend fun loadFormations(container: AppContainer): FormationState {
    return when (val result = container.repository.readLocalFirst("formacoes", "/api/formacoes", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            parseFormationState(result.value).copy(fromCache = result.fromCache, loading = false)
        }.getOrElse { FormationState(loading = false, error = "As formações salvas estão em formato inválido.") }
        is RepositoryResult.Failure -> FormationState(loading = false, error = result.message)
        is RepositoryResult.Queued -> FormationState(loading = false, error = "A leitura de formações não deve entrar em fila.")
    }
}

private fun parseFormationState(payload: String): FormationState {
    val root = JSONObject(payload)
    val array = root.optJSONArray("formacoes") ?: JSONArray()
    val items = buildList {
        repeat(array.length()) { index ->
            val item = array.optJSONObject(index) ?: return@repeat
            val fileJson = item.optJSONObject("arquivo")
            val presenceJson = item.optJSONObject("minha_presenca")
            add(
                NativeFormation(
                    id = item.optString("id"),
                    title = item.optString("titulo"),
                    theme = item.optString("tema"),
                    date = item.optString("data"),
                    time = item.optString("horario").jsonNullable(),
                    description = item.optString("descricao"),
                    status = item.optString("status", "agendada"),
                    cancellationReason = item.optString("motivo_cancelamento").jsonNullable(),
                    file = fileJson?.let {
                        NativeFormationFile(
                            name = it.optString("nome_original"),
                            mime = it.optString("mime"),
                            size = it.optLong("tamanho"),
                        )
                    },
                    myPresence = presenceJson?.let {
                        NativeFormationPresence(
                            status = it.optString("status"),
                            justification = it.optString("justificativa").jsonNullable(),
                            updatedAt = it.optLong("atualizado_em"),
                            pending = it.optBoolean("pendente"),
                        )
                    },
                ),
            )
        }
    }
    return FormationState(
        formations = items,
        userId = root.optString("usuarioId").jsonNullable(),
        userType = root.optString("tipoUsuario").jsonNullable(),
        loading = false,
    )
}

private fun String.jsonNullable(): String? = takeIf { isNotBlank() && this != "null" }

private fun FormationState.toCacheJson(): String = JSONObject().apply {
    put("usuarioId", userId)
    put("tipoUsuario", userType)
    put("formacoes", JSONArray().apply {
        formations.forEach { formation ->
            put(JSONObject().apply {
                put("id", formation.id)
                put("titulo", formation.title)
                put("tema", formation.theme)
                put("data", formation.date)
                put("horario", formation.time)
                put("descricao", formation.description)
                put("status", formation.status)
                put("motivo_cancelamento", formation.cancellationReason)
                put("arquivo", formation.file?.let { file -> JSONObject().apply {
                    put("nome_original", file.name); put("mime", file.mime); put("tamanho", file.size)
                } })
                put("minha_presenca", formation.myPresence?.let { presence -> JSONObject().apply {
                    put("status", presence.status); put("justificativa", presence.justification); put("atualizado_em", presence.updatedAt); put("pendente", presence.pending)
                } })
            })
        }
    })
}.toString()

@Composable
internal fun FormationScreen(container: AppContainer) {
    var state by remember { mutableStateOf(FormationState()) }
    val scope = rememberCoroutineScope()
    val today = remember { LocalDate.now().toString() }

    LaunchedEffect(Unit) { state = loadFormations(container) }

    val sorted = remember(state.formations) { state.formations.sortedBy { it.date } }
    val next = remember(sorted, today) { sorted.firstOrNull { it.date >= today && it.status != "cancelada" } ?: sorted.firstOrNull { it.date >= today } }
    val history = remember(sorted, today) { sorted.filter { it.date < today }.sortedByDescending { it.date } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (state.fromCache) item {
            Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .14f))) {
                Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.WifiOff, null, tint = SantaWine)
                    Text("As formações já sincronizadas continuam disponíveis neste aparelho.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item {
                Card { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error)
                    Button(onClick = { state = FormationState() }) { Text("Tentar novamente") }
                } }
            }
            else -> {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.CalendarMonth, null, tint = SantaWine)
                        Text("Próxima formação", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold)
                    }
                }
                item {
                    if (next == null) Card { Text("Nenhuma próxima formação publicada no momento.", Modifier.padding(20.dp)) }
                    else FormationCard(
                        item = next,
                        isFutureSection = true,
                        today = today,
                        onPresence = { situation, justification ->
                            val optimistic = state.copy(
                                formations = state.formations.map { formation ->
                                    if (formation.id == next.id) formation.copy(
                                        myPresence = NativeFormationPresence(situation, justification, System.currentTimeMillis(), pending = true),
                                    ) else formation
                                },
                            )
                            state = optimistic
                            scope.launch {
                                val payload = JSONObject().apply { put("situacao", situation); put("justificativa", justification.orEmpty()) }.toString()
                                val result = container.repository.mutate(
                                    method = "PUT",
                                    path = "/api/formacoes/${next.id}/minha-presenca",
                                    payload = payload,
                                    optimisticCacheKey = "formacoes",
                                    optimisticPayload = optimistic.toCacheJson(),
                                )
                                if (result is RepositoryResult.Success) state = loadFormations(container)
                            }
                        },
                    )
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.History, null, tint = SantaWine)
                        Text("Histórico de formações", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                    }
                }
                if (history.isEmpty()) item { Card { Text("As formações realizadas aparecerão aqui automaticamente depois da data.", Modifier.padding(20.dp)) } }
                else items(history, key = { it.id }) { formation -> FormationCard(formation, false, today, onPresence = { _, _ -> }) }
            }
        }
    }
}

@Composable
private fun FormationCard(
    item: NativeFormation,
    isFutureSection: Boolean,
    today: String,
    onPresence: (String, String?) -> Unit,
) {
    var dialog by remember(item.id) { mutableStateOf<String?>(null) }
    var justification by remember(item.id) { mutableStateOf("") }
    val uri = LocalUriHandler.current
    val cancelled = item.status == "cancelada"
    val canMarkToday = isFutureSection && item.date == today && !cancelled
    val canJustify = isFutureSection && item.date >= today && !cancelled

    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(item.date + (item.time?.let { " · $it" } ?: ""), style = MaterialTheme.typography.labelMedium, color = SantaGold, fontWeight = FontWeight.Black)
            Text(item.title, style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
            Text("Tema: ${item.theme}", fontWeight = FontWeight.SemiBold)
            if (item.description.isNotBlank()) Text(item.description, style = MaterialTheme.typography.bodySmall)
            if (cancelled) {
                AssistChip(onClick = {}, label = { Text("CANCELADA") })
                item.cancellationReason?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
            item.myPresence?.let { presence ->
                val label = when (presence.status) { "presente" -> "Presente"; "justificada" -> "Falta justificada"; else -> "Faltou" }
                Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) {
                    Column(Modifier.padding(11.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Rounded.CheckCircle, null, Modifier.size(18.dp), tint = SantaWine)
                            Text(label, color = SantaWine, fontWeight = FontWeight.Bold)
                            if (presence.pending) Text("· aguardando sincronização", style = MaterialTheme.typography.labelSmall)
                        }
                        presence.justification?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                    }
                }
            }
            if (canMarkToday && item.myPresence == null) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { dialog = "presente" }, modifier = Modifier.weight(1f)) { Text("Estou presente") }
                    OutlinedButton(onClick = { dialog = "justificada" }, modifier = Modifier.weight(1f)) { Text("Justificar falta") }
                }
            } else if (canJustify && item.myPresence == null) {
                OutlinedButton(onClick = { dialog = "justificada" }, modifier = Modifier.fillMaxWidth()) { Text("Justificar falta antecipadamente") }
            }
            item.file?.let { file ->
                OutlinedButton(
                    onClick = { uri.openUri("${BuildConfig.SYNC_BASE_URL}/api/formacoes/${item.id}/download") },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Rounded.Download, null)
                    Spacer(Modifier.size(7.dp))
                    Text("Baixar ${file.name}")
                }
            }
            if (isFutureSection && item.date > today && item.myPresence == null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Rounded.Schedule, null, Modifier.size(17.dp))
                    Text("A presença será liberada no dia da formação.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }

    if (dialog != null) {
        AlertDialog(
            onDismissRequest = { dialog = null },
            title = { Text(if (dialog == "presente") "Confirmar presença" else "Justificar falta") },
            text = {
                if (dialog == "justificada") OutlinedTextField(
                    value = justification,
                    onValueChange = { if (it.length <= 500) justification = it },
                    label = { Text("Motivo da justificativa") },
                    modifier = Modifier.fillMaxWidth(),
                ) else Text("Confirma que você está presente nesta formação?")
            },
            confirmButton = {
                TextButton(
                    enabled = dialog == "presente" || justification.trim().length >= 3,
                    onClick = {
                        val selected = dialog ?: return@TextButton
                        onPresence(selected, justification.trim().takeIf { selected == "justificada" })
                        dialog = null
                    },
                ) { Text("Confirmar") }
            },
            dismissButton = { TextButton(onClick = { dialog = null }) { Text("Cancelar") } },
        )
    }
}
