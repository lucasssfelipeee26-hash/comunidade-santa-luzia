package br.com.comunidadesantaluzia.nativeapp.features.scale

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.rounded.EditNote
import androidx.compose.material.icons.rounded.FilterAlt
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.People
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.launch
import org.json.JSONObject

data class NativeScalePerson(val id: String?, val name: String, val role: String, val category: String)
data class NativeScaleJustification(val id: String, val text: String, val createdAt: Long)
data class NativeScale(
    val id: String,
    val date: String,
    val time: String,
    val celebrant: String,
    val people: List<NativeScalePerson>,
    val notes: String,
    val celebration: String?,
    val liturgicalSeason: String?,
    val liturgicalColor: String?,
    val sundayCycle: String?,
    val liturgicalDate: String?,
    val myJustification: NativeScaleJustification?,
)
data class ScaleState(
    val scales: List<NativeScale> = emptyList(),
    val userId: String? = null,
    val userType: String? = null,
    val rawPayload: String = "",
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

private fun String.nullableJsonString(): String? = takeIf { isNotBlank() && this != "null" }
private fun normalized(value: String?): String = value.orEmpty().lowercase(Locale("pt", "BR"))
    .replace(Regex("[áàâã]"), "a").replace(Regex("[éèê]"), "e")
    .replace(Regex("[íìî]"), "i").replace(Regex("[óòôõ]"), "o")
    .replace(Regex("[úùû]"), "u").replace("ç", "c").trim()
private fun prettyDate(value: String): String = runCatching {
    LocalDate.parse(value).format(DateTimeFormatter.ofPattern("EEEE, dd 'de' MMMM 'de' yyyy", Locale("pt", "BR")))
        .replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale("pt", "BR")) else it.toString() }
}.getOrDefault(value)

internal suspend fun loadScales(container: AppContainer): ScaleState = when (
    val result = container.repository.readLocalFirst("escalas", "/api/escalas", authenticated = true)
) {
    is RepositoryResult.Success -> parseScales(result.value, result.fromCache)
    is RepositoryResult.Failure -> ScaleState(loading = false, error = result.message)
    is RepositoryResult.Queued -> ScaleState(loading = false, error = "A leitura de escalas não deve entrar em fila.")
}

private fun parseScales(payload: String, fromCache: Boolean): ScaleState = runCatching {
    val root = JSONObject(payload)
    val array = root.optJSONArray("escalas")
    val scales = buildList {
        if (array != null) repeat(array.length()) { index ->
            val item = array.optJSONObject(index) ?: return@repeat
            val peopleArray = item.optJSONArray("pessoas")
            val people = buildList {
                if (peopleArray != null) repeat(peopleArray.length()) { pIndex ->
                    val person = peopleArray.optJSONObject(pIndex) ?: return@repeat
                    add(NativeScalePerson(
                        id = person.optString("id").nullableJsonString(),
                        name = person.optString("nome"),
                        role = person.optString("funcao"),
                        category = person.optString("categoria"),
                    ))
                }
            }
            val just = item.optJSONObject("minha_justificativa") ?: item.optJSONObject("minhaJustificativa")
            add(NativeScale(
                id = item.optString("id"), date = item.optString("data"), time = item.optString("horario"),
                celebrant = item.optString("celebrante"), people = people, notes = item.optString("observacoes"),
                celebration = item.optString("celebracao_liturgica").nullableJsonString() ?: item.optString("celebracaoLiturgica").nullableJsonString(),
                liturgicalSeason = item.optString("tempo_liturgico").nullableJsonString() ?: item.optString("tempoLiturgico").nullableJsonString(),
                liturgicalColor = item.optString("cor_liturgica").nullableJsonString() ?: item.optString("corLiturgica").nullableJsonString(),
                sundayCycle = item.optString("ciclo_dominical").nullableJsonString() ?: item.optString("cicloDominical").nullableJsonString(),
                liturgicalDate = item.optString("data_liturgica").nullableJsonString() ?: item.optString("dataLiturgica").nullableJsonString(),
                myJustification = just?.let {
                    NativeScaleJustification(
                        id = it.optString("id").ifBlank { "local-${item.optString("id")}" },
                        text = it.optString("justificativa").ifBlank { it.optString("texto") },
                        createdAt = it.optLong("criado_em", it.optLong("criadoEm", 0L)),
                    )
                },
            ))
        }
    }
    ScaleState(
        scales = scales,
        userId = root.optString("usuarioId").nullableJsonString() ?: root.optString("usuario_id").nullableJsonString(),
        userType = root.optString("tipoUsuario").nullableJsonString() ?: root.optString("tipo_usuario").nullableJsonString(),
        rawPayload = payload,
        fromCache = fromCache,
        loading = false,
    )
}.getOrElse { ScaleState(loading = false, error = "As escalas salvas estão em formato inválido.") }

private fun payloadWithJustification(raw: String, scaleId: String, text: String): String? = runCatching {
    val root = JSONObject(raw)
    val scales = root.optJSONArray("escalas") ?: return@runCatching null
    repeat(scales.length()) { index ->
        val item = scales.optJSONObject(index) ?: return@repeat
        if (item.optString("id") == scaleId) {
            item.put("minha_justificativa", JSONObject()
                .put("id", "local-$scaleId")
                .put("justificativa", text)
                .put("criado_em", System.currentTimeMillis()))
        }
    }
    root.toString()
}.getOrNull()

private enum class ScaleTab { Upcoming, History }

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ScaleScreen(container: AppContainer) {
    var state by remember { mutableStateOf(ScaleState()) }
    var tab by remember { mutableStateOf(ScaleTab.Upcoming) }
    var dateFilter by remember { mutableStateOf("") }
    var seasonFilter by remember { mutableStateOf("Todos") }
    var seasonMenu by remember { mutableStateOf(false) }
    var savingScaleId by remember { mutableStateOf<String?>(null) }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { state = loadScales(container) }

    val today = remember { LocalDate.now().toString() }
    val upcoming = remember(state.scales, today) { state.scales.filter { it.date >= today }.sortedBy { "${it.date} ${it.time}" }.take(24) }
    val history = remember(state.scales, today) { state.scales.filter { it.date < today }.sortedByDescending { "${it.date} ${it.time}" }.take(120) }
    val seasons = remember(history) { listOf("Todos") + history.mapNotNull { it.liturgicalSeason?.trim()?.takeIf(String::isNotBlank) }.distinct().sorted() }
    val filtersActive = dateFilter.isNotBlank() || seasonFilter != "Todos"
    val filteredHistory = remember(history, dateFilter, seasonFilter) {
        history.filter { (dateFilter.isBlank() || it.date == dateFilter.trim()) && (seasonFilter == "Todos" || normalized(it.liturgicalSeason) == normalized(seasonFilter)) }
    }
    val shown = if (tab == ScaleTab.Upcoming) upcoming else if (filtersActive) filteredHistory else history.take(6)

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = if (state.fromCache) SantaGold.copy(alpha = .14f) else MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(18.dp)) {
                Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Icon(if (state.fromCache) Icons.Rounded.WifiOff else Icons.Rounded.CheckCircle, null, tint = SantaWine)
                    Text(if (state.fromCache) "Sem conexão: mostrando escalas e histórico salvos neste aparelho." else "Escalas atualizadas e salvas no aparelho para consulta sem internet.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        actionMessage?.let { message -> item { Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .14f))) { Text(message, Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall) } } }
        if (state.userType == "moderador" && !state.loading) {
            item {
                ScaleModeratorPanel(container = container, scales = state.scales) {
                    state = loadScales(container)
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = tab == ScaleTab.Upcoming,
                    onClick = { tab = ScaleTab.Upcoming },
                    label = { Text("Próximas (${upcoming.size})") },
                    modifier = Modifier.weight(1f),
                    leadingIcon = { Icon(Icons.Rounded.CalendarMonth, null) },
                )
                FilterChip(
                    selected = tab == ScaleTab.History,
                    onClick = { tab = ScaleTab.History },
                    label = { Text("Histórico (${history.size})") },
                    modifier = Modifier.weight(1f),
                    leadingIcon = { Icon(Icons.Rounded.History, null) },
                )
            }
        }
        if (tab == ScaleTab.History) item {
            Card(shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) { Icon(Icons.Rounded.Search, null, tint = SantaWine); Text("Encontrar escala antiga", color = SantaWine, fontWeight = FontWeight.Bold) }
                    OutlinedTextField(dateFilter, { dateFilter = it.take(10) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Data · AAAA-MM-DD") })
                    Box {
                        OutlinedButton({ seasonMenu = true }, Modifier.fillMaxWidth()) { Icon(Icons.Rounded.FilterAlt, null); Spacer(Modifier.size(7.dp)); Text("Tempo litúrgico: $seasonFilter", maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        DropdownMenu(seasonMenu, { seasonMenu = false }) { seasons.forEach { season -> DropdownMenuItem({ Text(season) }, { seasonFilter = season; seasonMenu = false }) } }
                    }
                    if (filtersActive) {
                        OutlinedButton({ dateFilter = ""; seasonFilter = "Todos" }) { Text("Limpar filtros") }
                        Text("${filteredHistory.size} escala(s) encontrada(s).", style = MaterialTheme.typography.bodySmall)
                    } else Text("Mostrando somente as ${minOf(6, history.size)} escalas anteriores mais recentes. Use a data ou o tempo litúrgico para localizar as demais.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error); Button({ scope.launch { state = ScaleState(); state = loadScales(container) } }) { Text("Tentar novamente") } } } }
            shown.isEmpty() -> item { Card { Text(if (tab == ScaleTab.Upcoming) "Nenhuma escala publicada para hoje ou para os próximos dias." else "Nenhuma escala histórica corresponde aos filtros informados.", Modifier.padding(22.dp)) } }
            else -> items(shown, key = { it.id }) { scale ->
                ScaleCard(scale, tab == ScaleTab.History, state.userId, savingScaleId == scale.id) { text ->
                    scope.launch {
                        val trimmed = text.trim()
                        if (trimmed.length !in 3..500) { actionMessage = "A justificativa deve ter entre 3 e 500 caracteres."; return@launch }
                        if (scale.myJustification != null) { actionMessage = "Esta escala já possui uma justificativa enviada."; return@launch }
                        if (scale.people.none { it.id != null && it.id == state.userId }) { actionMessage = "Somente quem está escalado pode enviar justificativa."; return@launch }
                        savingScaleId = scale.id
                        val optimistic = payloadWithJustification(state.rawPayload, scale.id, trimmed)
                        when (val result = container.repository.mutate(
                            method = "PUT",
                            path = "/api/escalas/${scale.id}/minha-justificativa",
                            payload = JSONObject().put("justificativa", trimmed).toString(),
                            optimisticCacheKey = optimistic?.let { "escalas" },
                            optimisticPayload = optimistic,
                        )) {
                            is RepositoryResult.Success -> { actionMessage = "Justificativa enviada."; state = loadScales(container) }
                            is RepositoryResult.Queued -> {
                                val local = NativeScaleJustification("local-${scale.id}", trimmed, System.currentTimeMillis())
                                state = state.copy(scales = state.scales.map { if (it.id == scale.id) it.copy(myJustification = local) else it }, rawPayload = optimistic ?: state.rawPayload, fromCache = true)
                                actionMessage = "Sem conexão: justificativa salva no aparelho e aguardando sincronização."
                            }
                            is RepositoryResult.Failure -> actionMessage = when (result.status) {
                                409 -> "Esta escala já possui uma justificativa registrada no servidor. Atualize para conferir."
                                403 -> "O servidor não autorizou a justificativa para esta escala."
                                else -> result.message
                            }
                        }
                        savingScaleId = null
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ScaleCard(scale: NativeScale, historical: Boolean, currentUserId: String?, saving: Boolean, onSubmit: (String) -> Unit) {
    val mine = remember(scale.people, currentUserId) { scale.people.firstOrNull { it.id != null && it.id == currentUserId } }
    var text by remember(scale.id) { mutableStateOf("") }
    var formOpen by remember(scale.id) { mutableStateOf(false) }
    Card(shape = RoundedCornerShape(22.dp), elevation = CardDefaults.cardElevation(defaultElevation = if (historical) 1.dp else 3.dp)) {
        Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (historical) AssistChip({}, { Text("Histórico") }, leadingIcon = { Icon(Icons.Rounded.History, null) })
            scale.celebration?.let { celebration ->
                Text("CELEBRAÇÃO LITÚRGICA", style = MaterialTheme.typography.labelSmall, color = SantaGold, fontWeight = FontWeight.Black)
                Text(celebration, style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                Text(listOfNotNull(scale.liturgicalSeason, scale.sundayCycle?.let { "Ano $it" }, scale.liturgicalColor?.let { "Cor $it" }).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text(prettyDate(scale.date), style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold); Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) { Icon(Icons.Rounded.Schedule, null, Modifier.size(17.dp), tint = SantaWine); Text(scale.time, fontWeight = FontWeight.SemiBold) } }
                Icon(Icons.Rounded.CalendarMonth, null, tint = SantaGold, modifier = Modifier.size(30.dp))
            }
            if (scale.celebrant.isNotBlank()) Text("Celebrante: ${scale.celebrant}", fontWeight = FontWeight.SemiBold)
            mine?.let { Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .14f))) { Text("Você está nesta escala · ${it.role}", Modifier.padding(12.dp), color = SantaWine, fontWeight = FontWeight.Bold) } }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Icon(Icons.Rounded.People, null, Modifier.size(18.dp), tint = SantaWine); Text("Equipe e funções", fontWeight = FontWeight.Bold, color = SantaWine) }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { scale.people.sortedWith(compareBy({ it.category }, { it.role })).forEach { AssistChip({}, { Text("${it.role}: ${it.name}") }) } }
            if (scale.notes.isNotBlank()) { Text("Observações", fontWeight = FontWeight.Bold, color = SantaWine); Text(scale.notes, style = MaterialTheme.typography.bodySmall) }
            scale.myJustification?.let { just -> Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) { Column(Modifier.padding(12.dp)) { Text("Sua justificativa", fontWeight = FontWeight.Bold); Text(just.text, style = MaterialTheme.typography.bodySmall) } } }
            if (!historical && mine != null && scale.myJustification == null) {
                if (!formOpen) OutlinedButton({ formOpen = true }, enabled = !saving) { Icon(Icons.Rounded.EditNote, null); Spacer(Modifier.size(7.dp)); Text("Enviar justificativa") }
                else {
                    OutlinedTextField(text, { text = it.take(500) }, Modifier.fillMaxWidth(), label = { Text("Justificativa") }, supportingText = { Text("${text.length}/500 · mínimo 3 caracteres") }, minLines = 3, enabled = !saving)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton({ formOpen = false }, enabled = !saving) { Text("Cancelar") }
                        Button({ onSubmit(text) }, enabled = !saving && text.trim().length in 3..500) { if (saving) { CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp); Spacer(Modifier.size(7.dp)) }; Text(if (saving) "Salvando…" else "Confirmar") }
                    }
                }
            }
        }
    }
}
