package br.com.comunidadesantaluzia.nativeapp.features.journey

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material.icons.rounded.Lightbulb
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.ShoppingBag
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.math.max
import kotlin.random.Random
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.json.JSONObject

private const val WHATAJONG_TOTAL_ROUNDS = 24
private const val WHATAJONG_RANKING_ROUNDS = 15
private const val WHATAJONG_DAILY_LIMIT = 30
private val whatajongZone = ZoneId.of("America/Cuiaba")

private enum class WhatajongDifficulty(val api: String, val label: String) {
    Easy("facil", "Fácil"), Medium("medio", "Médio"), Hard("dificil", "Difícil")
}

private data class WhatajongTile(
    val id: String,
    val card: String,
    val label: String,
    val row: Int,
    val column: Int,
    val points: Int,
    val selected: Boolean = false,
    val removed: Boolean = false,
)

private data class WhatajongServerState(
    val round: Int = 0,
    val dailyPoints: Int = 0,
    val fromCache: Boolean = false,
)

private val basicCards = listOf(
    "bambu1" to "Bambu 1", "bambu2" to "Bambu 2", "bambu3" to "Bambu 3",
    "bambu4" to "Bambu 4", "bambu5" to "Bambu 5", "bambu6" to "Bambu 6",
    "circulo1" to "Círculo 1", "circulo2" to "Círculo 2", "circulo3" to "Círculo 3",
    "circulo4" to "Círculo 4", "circulo5" to "Círculo 5", "circulo6" to "Círculo 6",
    "caractere1" to "Caractere 1", "caractere2" to "Caractere 2", "caractere3" to "Caractere 3",
    "ventoN" to "Vento Norte", "ventoS" to "Vento Sul", "ventoL" to "Vento Leste", "ventoO" to "Vento Oeste",
    "dragaoR" to "Dragão Vermelho", "dragaoV" to "Dragão Verde", "dragaoB" to "Dragão Branco",
    "flor1" to "Flor de Ameixa", "flor2" to "Orquídea", "flor3" to "Crisântemo", "flor4" to "Bambu Florido",
)

private fun cardsMatch(a: String, b: String): Boolean {
    if (a.startsWith("flor") && b.startsWith("flor")) return true
    return a == b
}

private fun difficultyFor(round: Int): WhatajongDifficulty = when {
    round <= 8 -> WhatajongDifficulty.Easy
    round <= 16 -> WhatajongDifficulty.Medium
    else -> WhatajongDifficulty.Hard
}

private fun pairCount(round: Int): Int = when (difficultyFor(round)) {
    WhatajongDifficulty.Easy -> 8 + ((round - 1) / 3)
    WhatajongDifficulty.Medium -> 12 + ((round - 9) / 3)
    WhatajongDifficulty.Hard -> 15 + ((round - 17) / 2)
}.coerceAtMost(18)

private fun buildRound(round: Int, seedSalt: Int = 0): List<WhatajongTile> {
    val pairs = pairCount(round)
    val random = Random(round * 1009 + seedSalt * 9176)
    val chosen = basicCards.shuffled(random).take(pairs)
    val cards = chosen.flatMap { listOf(it, it) }.shuffled(random)
    val columns = when (difficultyFor(round)) {
        WhatajongDifficulty.Easy -> 6
        WhatajongDifficulty.Medium -> 7
        WhatajongDifficulty.Hard -> 8
    }
    return cards.mapIndexed { index, item ->
        WhatajongTile(
            id = "w-$round-$seedSalt-$index-${UUID.randomUUID()}",
            card = item.first,
            label = item.second,
            row = index / columns,
            column = index % columns,
            points = when {
                item.first.startsWith("dragao") -> 4
                item.first.startsWith("vento") -> 3
                item.first.startsWith("flor") -> 4
                else -> 1
            },
        )
    }
}

private fun isFree(tile: WhatajongTile, tiles: List<WhatajongTile>): Boolean {
    if (tile.removed) return false
    val alive = tiles.filterNot { it.removed }
    val left = alive.any { it.row == tile.row && it.column == tile.column - 1 }
    val right = alive.any { it.row == tile.row && it.column == tile.column + 1 }
    return !left || !right
}

private fun availablePair(tiles: List<WhatajongTile>): Pair<String, String>? {
    val free = tiles.filter { isFree(it, tiles) }
    for (i in free.indices) for (j in i + 1 until free.size) {
        if (cardsMatch(free[i].card, free[j].card)) return free[i].id to free[j].id
    }
    return null
}

private fun prefs(context: Context) = context.getSharedPreferences("santa_luzia_whatajong", Context.MODE_PRIVATE)
private fun localDate() = LocalDate.now(whatajongZone).toString()
private fun whatajongKey(ownerUserId: String, suffix: String) = "$suffix:user:$ownerUserId"

private fun readLocalRound(context: Context, ownerUserId: String): Int {
    val p = prefs(context)
    val dateKey = whatajongKey(ownerUserId, "date")
    val roundKey = whatajongKey(ownerUserId, "round")
    return if (p.getString(dateKey, "") == localDate()) p.getInt(roundKey, 0) else 0
}

private fun saveLocalRound(context: Context, ownerUserId: String, round: Int) {
    prefs(context).edit()
        .putString(whatajongKey(ownerUserId, "date"), localDate())
        .putInt(whatajongKey(ownerUserId, "round"), round.coerceIn(0, WHATAJONG_TOTAL_ROUNDS))
        .apply()
}

private suspend fun loadWhatajongServer(container: AppContainer, ownerUserId: String): WhatajongServerState =
    when (val result = container.repository.readLocalFirst("whatajong-resultado:$ownerUserId", "/api/jogo/whatajong/resultado", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val json = JSONObject(result.value)
            WhatajongServerState(
                round = json.optInt("rodadaServidor"),
                dailyPoints = json.optInt("pontosTotalDia"),
                fromCache = result.fromCache,
            )
        }.getOrDefault(WhatajongServerState(fromCache = result.fromCache))
        else -> WhatajongServerState(fromCache = true)
    }

@Composable
internal fun WhatajongPanel(container: AppContainer) {
    val session by container.sessionStore.session.collectAsStateWithLifecycle(initialValue = NativeSession())
    val ownerUserId = session.userId?.trim()?.takeIf { session.loggedIn && it.isNotBlank() }
    if (ownerUserId == null) {
        Card(shape = RoundedCornerShape(20.dp)) {
            Text("Entre na sua conta para salvar e sincronizar a jornada Whatajong.", Modifier.padding(18.dp))
        }
        return
    }

    val context = container.appContext
    val scope = rememberCoroutineScope()
    var server by remember(ownerUserId) { mutableStateOf(WhatajongServerState()) }
    var round by remember(ownerUserId) { mutableIntStateOf(max(1, readLocalRound(context, ownerUserId) + 1)) }
    var score by remember(ownerUserId) { mutableIntStateOf(0) }
    var coins by remember(ownerUserId) { mutableIntStateOf(3) }
    var shuffleSeed by remember(ownerUserId) { mutableIntStateOf(0) }
    var feedback by remember(ownerUserId) { mutableStateOf("Toque em duas peças iguais que estejam livres nas laterais.") }
    var hintPair by remember(ownerUserId) { mutableStateOf<Pair<String, String>?>(null) }
    val tiles = remember(ownerUserId) { mutableStateListOf<WhatajongTile>() }

    fun resetBoard(targetRound: Int, newSeed: Int = shuffleSeed) {
        tiles.clear()
        tiles.addAll(buildRound(targetRound, newSeed))
        hintPair = null
    }

    LaunchedEffect(ownerUserId) {
        server = loadWhatajongServer(container, ownerUserId)
        val local = readLocalRound(context, ownerUserId)
        val completed = max(local, server.round).coerceAtMost(WHATAJONG_TOTAL_ROUNDS)
        if (completed > local) saveLocalRound(context, ownerUserId, completed)
        round = (completed + 1).coerceAtMost(WHATAJONG_TOTAL_ROUNDS)
        resetBoard(round)
    }

    fun completeRound(completedRound: Int) {
        saveLocalRound(context, ownerUserId, completedRound)
        val difficulty = difficultyFor(completedRound)
        scope.launch {
            val currentSession = container.sessionStore.session.first()
            if (!currentSession.loggedIn || currentSession.userId != ownerUserId) {
                feedback = "Rodada mantida somente na conta que a concluiu. Entre novamente nessa conta para sincronizar."
                return@launch
            }
            val payload = JSONObject()
                .put("score", score)
                .put("completedRound", completedRound)
                .put("difficulty", difficulty.api)
                .toString()
            when (val result = container.repository.mutate("POST", "/api/jogo/whatajong/resultado", payload)) {
                is RepositoryResult.Success -> {
                    val json = runCatching { JSONObject(result.value) }.getOrNull()
                    server = server.copy(
                        round = json?.optInt("rodadaServidor", completedRound) ?: completedRound,
                        dailyPoints = json?.optInt("pontosTotalDia", server.dailyPoints) ?: server.dailyPoints,
                        fromCache = false,
                    )
                    feedback = if (completedRound >= WHATAJONG_TOTAL_ROUNDS) {
                        "Jornada Whatajong concluída: 24 rodadas completas."
                    } else {
                        "Rodada $completedRound concluída e sincronizada."
                    }
                }
                is RepositoryResult.Queued -> feedback = "Rodada $completedRound salva no aparelho e aguardando sincronização."
                is RepositoryResult.Failure -> feedback = result.message
            }
        }
        if (completedRound < WHATAJONG_TOTAL_ROUNDS) {
            round = completedRound + 1
            shuffleSeed = 0
            resetBoard(round, 0)
        }
    }

    fun tap(tile: WhatajongTile) {
        if (!isFree(tile, tiles)) {
            feedback = "Essa peça ainda está bloqueada. Libere um dos lados primeiro."
            return
        }
        hintPair = null
        val selected = tiles.firstOrNull { it.selected && !it.removed }
        if (selected == null) {
            val index = tiles.indexOfFirst { it.id == tile.id }
            if (index >= 0) tiles[index] = tile.copy(selected = true)
            return
        }
        if (selected.id == tile.id) {
            val index = tiles.indexOfFirst { it.id == tile.id }
            if (index >= 0) tiles[index] = tile.copy(selected = false)
            return
        }
        if (cardsMatch(selected.card, tile.card)) {
            val a = tiles.indexOfFirst { it.id == selected.id }
            val b = tiles.indexOfFirst { it.id == tile.id }
            if (a >= 0) tiles[a] = tiles[a].copy(selected = false, removed = true)
            if (b >= 0) tiles[b] = tiles[b].copy(selected = false, removed = true)
            score += selected.points + tile.points
            coins += if (selected.card.startsWith("dragao")) 1 else 0
            val remaining = tiles.count { !it.removed }
            feedback = if (remaining == 0) "Tabuleiro limpo!" else "+${selected.points + tile.points} pontos · $remaining peças restantes"
            if (remaining == 0) completeRound(round)
            else if (availablePair(tiles) == null) feedback = "Sem pares livres. Use Embaralhar para continuar."
        } else {
            val old = tiles.indexOfFirst { it.id == selected.id }
            val next = tiles.indexOfFirst { it.id == tile.id }
            if (old >= 0) tiles[old] = tiles[old].copy(selected = false)
            if (next >= 0) tiles[next] = tiles[next].copy(selected = true)
            feedback = "As peças não formam um par."
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f)), shape = RoundedCornerShape(20.dp)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Icon(Icons.Rounded.Casino, null, tint = SantaWine)
                        Column {
                            Text("Whatajong", color = SantaWine, fontWeight = FontWeight.Black)
                            Text("Rodada $round/$WHATAJONG_TOTAL_ROUNDS · ${difficultyFor(round).label}", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    if (server.fromCache) AssistChip(onClick = {}, label = { Text("offline") })
                }
                Text("Pontuação da sessão: $score · Moedas: $coins", fontWeight = FontWeight.SemiBold)
                Text("Ranking hoje: ${server.dailyPoints}/$WHATAJONG_DAILY_LIMIT pontos · pontua até a rodada $WHATAJONG_RANKING_ROUNDS.", style = MaterialTheme.typography.bodySmall)
                Text(feedback, style = MaterialTheme.typography.bodySmall)
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = {
                    val pair = availablePair(tiles)
                    if (pair == null) feedback = "Não há par livre neste momento. Embaralhe o tabuleiro."
                    else { hintPair = pair; feedback = "Dica destacada por alguns instantes." }
                },
                modifier = Modifier.weight(1f),
            ) { Icon(Icons.Rounded.Lightbulb, null); Text(" Dica") }
            OutlinedButton(
                onClick = {
                    if (coins < 2) feedback = "Você precisa de 2 moedas para embaralhar."
                    else {
                        coins -= 2
                        shuffleSeed += 1
                        val aliveCards = tiles.filterNot { it.removed }.map { it.card to it.label }.shuffled(Random(round * 311 + shuffleSeed))
                        var cursor = 0
                        tiles.indices.forEach { index ->
                            if (!tiles[index].removed) {
                                val pair = aliveCards[cursor++]
                                tiles[index] = tiles[index].copy(card = pair.first, label = pair.second, selected = false)
                            }
                        }
                        hintPair = null
                        feedback = "Tabuleiro embaralhado por 2 moedas."
                    }
                },
                modifier = Modifier.weight(1f),
            ) { Icon(Icons.Rounded.Refresh, null); Text(" Embaralhar") }
        }

        Card(shape = RoundedCornerShape(22.dp)) {
            FlowRow(
                modifier = Modifier.fillMaxWidth().padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                tiles.forEach { tile ->
                    val free = isFree(tile, tiles)
                    AnimatedVisibility(visible = !tile.removed) {
                        Card(
                            modifier = Modifier
                                .size(width = 72.dp, height = 86.dp)
                                .clickable(enabled = free) { tap(tile) },
                            shape = RoundedCornerShape(10.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = when {
                                    tile.selected -> SantaGold.copy(alpha = .48f)
                                    hintPair?.let { tile.id == it.first || tile.id == it.second } == true -> SantaGold.copy(alpha = .30f)
                                    free -> MaterialTheme.colorScheme.surface
                                    else -> MaterialTheme.colorScheme.surfaceVariant
                                },
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = if (free) 4.dp else 1.dp),
                        ) {
                            Box(Modifier.fillMaxSize().padding(5.dp), contentAlignment = Alignment.Center) {
                                Text(tile.label, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .55f))) {
            Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Rounded.ShoppingBag, null, tint = SantaWine)
                    Text("Poderes e oficina", color = SantaWine, fontWeight = FontWeight.Bold)
                }
                Text("Dragões rendem moedas. Use as moedas para reorganizar o tabuleiro quando não houver pares livres.", style = MaterialTheme.typography.bodySmall)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Rounded.AutoAwesome, null, Modifier.size(17.dp), tint = SantaWine)
                    Text("As 24 rodadas funcionam sem internet; resultados ficam na fila persistente da sua conta e sincronizam em ordem.", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}
