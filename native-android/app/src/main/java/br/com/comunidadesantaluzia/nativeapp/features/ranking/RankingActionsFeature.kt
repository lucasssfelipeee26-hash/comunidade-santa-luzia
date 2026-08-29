package br.com.comunidadesantaluzia.nativeapp.features.ranking

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.HowToReg
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private data class RankingMember(val id: String, val name: String, val role: String?)
private data class RankingOccurrence(
    val id: String,
    val userId: String,
    val userName: String,
    val date: String,
    val massTime: String,
    val arrivalLimit: String,
    val observation: String,
    val status: String,
    val reporterName: String?,
)
private data class RankingReaction(val occurrenceId: String, val emoji: String)
private data class RankingConfig(
    val formation: Int = 25,
    val liturgy: Int = 25,
    val punctuality: Int = 30,
    val recognition: Int = 20,
    val advanceMinutes: Int = 30,
)
private data class RankingActionsState(
    val year: Int = 0,
    val myId: String = "",
    val isModerator: Boolean = false,
    val members: List<RankingMember> = emptyList(),
    val occurrences: List<RankingOccurrence> = emptyList(),
    val reactions: List<RankingReaction> = emptyList(),
    val config: RankingConfig = RankingConfig(),
    val error: String? = null,
)

private suspend fun loadActions(container: AppContainer): RankingActionsState =
    when (val result = container.repository.readLocalFirst("ranking", "/api/ranking", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val me = root.optJSONObject("eu") ?: JSONObject()
            val membersJson = root.optJSONArray("membros") ?: JSONArray()
            val occurrencesJson = root.optJSONArray("ocorrencias") ?: JSONArray()
            val reactionsJson = root.optJSONArray("reacoes") ?: JSONArray()
            val configJson = root.optJSONObject("config") ?: JSONObject()
            val members = buildList {
                repeat(membersJson.length()) { index ->
                    val item = membersJson.optJSONObject(index) ?: return@repeat
                    add(
                        RankingMember(
                            id = item.optString("id"),
                            name = item.optString("nome"),
                            role = item.optString("funcao").takeIf { it.isNotBlank() && it != "null" },
                        ),
                    )
                }
            }
            val occurrences = buildList {
                repeat(occurrencesJson.length()) { index ->
                    val item = occurrencesJson.optJSONObject(index) ?: return@repeat
                    add(
                        RankingOccurrence(
                            id = item.optString("id"),
                            userId = item.optString("usuario_id"),
                            userName = item.optString("usuario_nome", "Membro"),
                            date = item.optString("data_missa"),
                            massTime = item.optString("horario_missa"),
                            arrivalLimit = item.optString("limite_chegada"),
                            observation = item.optString("observacao"),
                            status = item.optString("status"),
                            reporterName = item.optString("reportado_por_nome").takeIf { it.isNotBlank() && it != "null" },
                        ),
                    )
                }
            }
            val reactions = buildList {
                repeat(reactionsJson.length()) { index ->
                    val item = reactionsJson.optJSONObject(index) ?: return@repeat
                    add(RankingReaction(item.optString("ocorrencia_id"), item.optString("emoji")))
                }
            }
            RankingActionsState(
                year = root.optInt("ano"),
                myId = me.optString("id"),
                isModerator = me.optString("tipo") == "moderador",
                members = members,
                occurrences = occurrences,
                reactions = reactions,
                config = RankingConfig(
                    formation = configJson.optInt("peso_formacao", 25),
                    liturgy = configJson.optInt("peso_liturgia", 25),
                    punctuality = configJson.optInt("peso_pontualidade", 30),
                    recognition = configJson.optInt("peso_reconhecimento", 20),
                    advanceMinutes = configJson.optInt("minutos_antecedencia", 30),
                ),
            )
        }.getOrElse { RankingActionsState(error = "Não foi possível ler as ações do ranking.") }
        is RepositoryResult.Failure -> RankingActionsState(error = result.message)
        is RepositoryResult.Queued -> RankingActionsState(error = "A leitura do ranking não entra em fila.")
    }

@Composable
internal fun RankingActionsPanel(container: AppContainer, onRankingChanged: suspend () -> Unit) {
    val scope = rememberCoroutineScope()
    var state by remember { mutableStateOf(RankingActionsState()) }
    var refresh by remember { mutableIntStateOf(0) }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(refresh) { state = loadActions(container) }

    suspend fun perform(payload: JSONObject, success: String) {
        busy = true
        when (val result = container.repository.mutateOnlineOnly("POST", "/api/ranking", payload.toString())) {
            is RepositoryResult.Success -> {
                message = success
                refresh += 1
                onRankingChanged()
            }
            is RepositoryResult.Failure -> message = result.message
            is RepositoryResult.Queued -> message = "Esta ação precisa ser confirmada online."
        }
        busy = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Interações da equipe", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (message.isNotBlank()) {
            Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) {
                Text(message, Modifier.padding(12.dp), color = SantaWine)
            }
        }

        RecognitionCard(
            members = state.members.filter { it.id != state.myId },
            enabled = !busy,
            onRecognize = { memberId, category ->
                scope.launch {
                    perform(
                        JSONObject().put("action", "reconhecer").put("paraId", memberId).put("categoria", category),
                        "Reconhecimento enviado. Cada categoria pode ser usada uma vez por mês.",
                    )
                }
            },
        )

        val confirmed = state.occurrences.filter { it.status == "confirmado" }
        if (confirmed.isNotEmpty()) {
            Text("Pontualidade confirmada", style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold)
            confirmed.take(8).forEach { occurrence ->
                ReactionCard(
                    occurrence = occurrence,
                    reactions = state.reactions.filter { it.occurrenceId == occurrence.id },
                    enabled = !busy,
                    onReact = { emoji ->
                        scope.launch {
                            perform(
                                JSONObject().put("action", "reagir").put("ocorrenciaId", occurrence.id).put("emoji", emoji),
                                "Reação registrada.",
                            )
                        }
                    },
                )
            }
        }

        if (state.isModerator) {
            ModeratorRankingPanel(
                state = state,
                enabled = !busy,
                onModerate = { id, status ->
                    scope.launch {
                        perform(
                            JSONObject().put("action", "moderar_atraso").put("ocorrenciaId", id).put("status", status),
                            if (status == "confirmado") "Atraso confirmado." else "Relato rejeitado.",
                        )
                    }
                },
                onAdjust = { userId, points, reason ->
                    scope.launch {
                        perform(
                            JSONObject()
                                .put("action", "ajustar_pontos")
                                .put("usuarioId", userId)
                                .put("pontos", points)
                                .put("motivo", reason)
                                .put("ano", state.year),
                            "Ajuste de pontos salvo.",
                        )
                    }
                },
                onSaveConfig = { config ->
                    scope.launch {
                        perform(
                            JSONObject()
                                .put("action", "salvar_config")
                                .put("ano", state.year)
                                .put("peso_formacao", config.formation)
                                .put("peso_liturgia", config.liturgy)
                                .put("peso_pontualidade", config.punctuality)
                                .put("peso_reconhecimento", config.recognition)
                                .put("minutos_antecedencia", config.advanceMinutes),
                            "Configuração do ranking atualizada.",
                        )
                    }
                },
            )
        }
    }
}

@Composable
private fun RecognitionCard(
    members: List<RankingMember>,
    enabled: Boolean,
    onRecognize: (String, String) -> Unit,
) {
    val categories = listOf(
        "companheirismo" to "Companheirismo",
        "acolhimento" to "Acolhimento",
        "espirito_servico" to "Espírito de serviço",
        "disponibilidade" to "Disponibilidade",
    )
    var memberId by remember(members) { mutableStateOf(members.firstOrNull()?.id.orEmpty()) }
    var category by remember { mutableStateOf(categories.first().first) }

    Card(shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                androidx.compose.material3.Icon(Icons.Rounded.HowToReg, null, tint = SantaWine)
                Text("Reconhecer um colega", color = SantaWine, fontWeight = FontWeight.Bold)
            }
            Text("Escolha um colega e uma qualidade. Cada categoria pode ser concedida uma vez por mês.", style = MaterialTheme.typography.bodySmall)
            if (members.isEmpty()) {
                Text("Nenhum outro perfil aprovado disponível.")
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(members, key = { it.id }) { member ->
                        FilterChip(
                            selected = member.id == memberId,
                            onClick = { memberId = member.id },
                            label = { Text(member.name, maxLines = 1) },
                        )
                    }
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(categories, key = { it.first }) { item ->
                        FilterChip(
                            selected = item.first == category,
                            onClick = { category = item.first },
                            label = { Text(item.second, maxLines = 1) },
                        )
                    }
                }
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    enabled = enabled && memberId.isNotBlank(),
                    onClick = { onRecognize(memberId, category) },
                ) { Text("Enviar reconhecimento") }
            }
        }
    }
}

@Composable
private fun ReactionCard(
    occurrence: RankingOccurrence,
    reactions: List<RankingReaction>,
    enabled: Boolean,
    onReact: (String) -> Unit,
) {
    val emojis = listOf("⏰", "😅", "🙏", "✝️", "💛")
    Card(shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("${occurrence.userName} · ${occurrence.date} às ${occurrence.massTime}", fontWeight = FontWeight.Bold)
            Text("Limite de chegada: ${occurrence.arrivalLimit}", style = MaterialTheme.typography.bodySmall)
            if (occurrence.observation.isNotBlank()) Text(occurrence.observation, style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                emojis.forEach { emoji ->
                    val count = reactions.count { it.emoji == emoji }
                    OutlinedButton(enabled = enabled, onClick = { onReact(emoji) }) {
                        Text(if (count > 0) "$emoji $count" else emoji)
                    }
                }
            }
        }
    }
}

@Composable
private fun ModeratorRankingPanel(
    state: RankingActionsState,
    enabled: Boolean,
    onModerate: (String, String) -> Unit,
    onAdjust: (String, Int, String) -> Unit,
    onSaveConfig: (RankingConfig) -> Unit,
) {
    val pending = state.occurrences.filter { it.status == "pendente" }
    var adjustmentMember by remember(state.members) { mutableStateOf(state.members.firstOrNull()?.id.orEmpty()) }
    var adjustmentPoints by remember { mutableStateOf("") }
    var adjustmentReason by remember { mutableStateOf("") }
    var formation by remember(state.config) { mutableStateOf(state.config.formation.toString()) }
    var liturgy by remember(state.config) { mutableStateOf(state.config.liturgy.toString()) }
    var punctuality by remember(state.config) { mutableStateOf(state.config.punctuality.toString()) }
    var recognition by remember(state.config) { mutableStateOf(state.config.recognition.toString()) }
    var advance by remember(state.config) { mutableStateOf(state.config.advanceMinutes.toString()) }

    Text("Moderação do ranking", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)

    if (pending.isNotEmpty()) {
        Text("Relatos aguardando decisão", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        pending.forEach { occurrence ->
            Card(shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${occurrence.userName} · ${occurrence.date}", fontWeight = FontWeight.Bold)
                    Text("Missa ${occurrence.massTime} · limite ${occurrence.arrivalLimit}", style = MaterialTheme.typography.bodySmall)
                    occurrence.reporterName?.let { Text("Relatado por: $it", style = MaterialTheme.typography.labelSmall) }
                    if (occurrence.observation.isNotBlank()) Text(occurrence.observation, style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(enabled = enabled, onClick = { onModerate(occurrence.id, "confirmado") }, modifier = Modifier.weight(1f)) { Text("Confirmar") }
                        OutlinedButton(enabled = enabled, onClick = { onModerate(occurrence.id, "rejeitado") }, modifier = Modifier.weight(1f)) { Text("Rejeitar") }
                    }
                }
            }
        }
    }

    Card(shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text("Ajuste manual de pontos", color = SantaWine, fontWeight = FontWeight.Bold)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(state.members, key = { it.id }) { member ->
                    FilterChip(
                        selected = member.id == adjustmentMember,
                        onClick = { adjustmentMember = member.id },
                        label = { Text(member.name, maxLines = 1) },
                    )
                }
            }
            OutlinedTextField(
                value = adjustmentPoints,
                onValueChange = { adjustmentPoints = it.filter { ch -> ch.isDigit() || ch == '-' }.take(4) },
                label = { Text("Pontos (-100 a 100)") },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = adjustmentReason,
                onValueChange = { adjustmentReason = it.take(300) },
                label = { Text("Motivo") },
                modifier = Modifier.fillMaxWidth(),
            )
            val points = adjustmentPoints.toIntOrNull()
            Button(
                enabled = enabled && adjustmentMember.isNotBlank() && points != null && points in -100..100 && adjustmentReason.trim().length in 3..300,
                onClick = {
                    onAdjust(adjustmentMember, points ?: 0, adjustmentReason.trim())
                    adjustmentPoints = ""
                    adjustmentReason = ""
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Salvar ajuste") }
        }
    }

    Card(shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                androidx.compose.material3.Icon(Icons.Rounded.Settings, null, tint = SantaWine)
                Text("Pesos do ranking", color = SantaWine, fontWeight = FontWeight.Bold)
            }
            Text("Os quatro pesos precisam somar 100. A antecedência aceita de 10 a 120 minutos.", style = MaterialTheme.typography.bodySmall)
            WeightField("Formação", formation) { formation = it }
            WeightField("Liturgia", liturgy) { liturgy = it }
            WeightField("Pontualidade", punctuality) { punctuality = it }
            WeightField("Reconhecimento", recognition) { recognition = it }
            OutlinedTextField(
                value = advance,
                onValueChange = { advance = it.filter(Char::isDigit).take(3) },
                label = { Text("Antecedência (minutos)") },
                modifier = Modifier.fillMaxWidth(),
            )
            val values = listOf(formation, liturgy, punctuality, recognition).map { it.toIntOrNull() }
            val advanceValue = advance.toIntOrNull()
            val valid = values.all { it != null && it in 0..100 } && values.filterNotNull().sum() == 100 && advanceValue != null && advanceValue in 10..120
            Button(
                enabled = enabled && valid,
                onClick = {
                    onSaveConfig(
                        RankingConfig(
                            formation = formation.toInt(),
                            liturgy = liturgy.toInt(),
                            punctuality = punctuality.toInt(),
                            recognition = recognition.toInt(),
                            advanceMinutes = advance.toInt(),
                        ),
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Salvar configuração") }
        }
    }
}

@Composable
private fun WeightField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(it.filter(Char::isDigit).take(3)) },
        label = { Text("$label (%)") },
        modifier = Modifier.fillMaxWidth(),
    )
}
