package br.com.comunidadesantaluzia.nativeapp.features.journey

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.VolumeOff
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.io.IOException
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import kotlin.random.Random

private const val BOARD_SIZE = 8
private const val BOARD_COUNT = BOARD_SIZE * BOARD_SIZE
private const val RANKING_LIMIT = 35
private const val PREFS = "santa_luzia_joias_v1"
private const val STATE_KEY = "state"
private const val PENDING_KEY = "pending"
private const val SOUND_KEY = "sound"
private const val RECORD_KEY = "record"

private val liturgicalPieceNames = listOf(
    "Cruz",
    "Cálice",
    "Turíbulo",
    "Naveta",
    "Missal",
    "Vela",
    "Galhetas",
    "Alfaias",
)

// Os glifos são deliberadamente simples para permanecerem nítidos em qualquer aparelho,
// sem depender de imagens externas ou de rede. Cada um representa um objeto litúrgico.
private val liturgicalSymbols = listOf("✝", "♙", "♨", "◒", "▣", "♢", "⚗", "✦")

private data class JewelState(
    val board: List<Int>,
    val phaseScore: Int,
    val totalScore: Int,
    val level: Int,
    val moves: Int,
)

private data class PendingJewelResult(
    val score: Int,
    val level: Int,
    val completedPhase: Int,
    val mode: String,
    val savedAt: Long,
)

private fun typeCount(level: Int) = when {
    level < 3 -> 6
    level < 5 -> 7
    else -> 8
}
private fun phaseTarget(level: Int) = 780 + max(0, level - 1) * 260
private fun phaseMoves(level: Int) = max(20, 28 - ((level - 1) / 3))
private fun accumulatedBonus(phase: Int): Int = when {
    phase <= 0 -> 0
    phase <= 5 -> intArrayOf(0, 3, 7, 12, 18, 25)[phase]
    else -> min(RANKING_LIMIT, 25 + (phase - 5) * 2)
}
private fun phaseName(level: Int) = when (level) {
    1 -> "Cruz Processional"
    2 -> "Cálice e Altar"
    3 -> "Incenso"
    4 -> "Missal"
    5 -> "Luz do Altar"
    else -> "Serviço Litúrgico $level"
}
private fun phaseCall(level: Int) = when (level) {
    1 -> "Comece servindo com atenção"
    2 -> "Ganhe ritmo e precisão"
    3 -> "Forme combinações maiores"
    4 -> "Domine as cascatas"
    5 -> "Complete o conjunto litúrgico"
    else -> "Continue avançando na Jornada"
}
private fun phaseMode(level: Int) = if (level <= 5) "Joias da Luz · etapa $level de 5 · ${phaseName(level)}" else "Joias da Luz · serviço $level"

private fun adjacent(a: Int, b: Int): Boolean {
    val ar = a / BOARD_SIZE
    val ac = a % BOARD_SIZE
    val br = b / BOARD_SIZE
    val bc = b % BOARD_SIZE
    return abs(ar - br) + abs(ac - bc) == 1
}

private fun swap(board: List<Int>, a: Int, b: Int): List<Int> = board.toMutableList().also {
    val tmp = it[a]
    it[a] = it[b]
    it[b] = tmp
}

private fun matches(board: List<Int>): Set<Int> {
    val found = linkedSetOf<Int>()
    for (r in 0 until BOARD_SIZE) {
        var start = 0
        while (start < BOARD_SIZE) {
            val type = board[r * BOARD_SIZE + start]
            var end = start + 1
            while (end < BOARD_SIZE && board[r * BOARD_SIZE + end] == type) end++
            if (type >= 0 && end - start >= 3) for (c in start until end) found += r * BOARD_SIZE + c
            start = end
        }
    }
    for (c in 0 until BOARD_SIZE) {
        var start = 0
        while (start < BOARD_SIZE) {
            val type = board[start * BOARD_SIZE + c]
            var end = start + 1
            while (end < BOARD_SIZE && board[end * BOARD_SIZE + c] == type) end++
            if (type >= 0 && end - start >= 3) for (r in start until end) found += r * BOARD_SIZE + c
            start = end
        }
    }
    return found
}

private fun hasMove(board: List<Int>): Boolean {
    for (i in board.indices) {
        val r = i / BOARD_SIZE
        val c = i % BOARD_SIZE
        val candidates = buildList {
            if (c < BOARD_SIZE - 1) add(i + 1)
            if (r < BOARD_SIZE - 1) add(i + BOARD_SIZE)
        }
        for (j in candidates) if (matches(swap(board, i, j)).isNotEmpty()) return true
    }
    return false
}

private fun initialBoard(level: Int): List<Int> {
    repeat(80) {
        val board = MutableList(BOARD_COUNT) { -1 }
        for (i in 0 until BOARD_COUNT) {
            val options = (0 until typeCount(level)).shuffled()
            val r = i / BOARD_SIZE
            val c = i % BOARD_SIZE
            board[i] = options.firstOrNull { type ->
                !(c >= 2 && board[i - 1] == type && board[i - 2] == type) &&
                    !(r >= 2 && board[i - BOARD_SIZE] == type && board[i - BOARD_SIZE * 2] == type)
            } ?: options.first()
        }
        if (matches(board).isEmpty() && hasMove(board)) return board
    }
    return MutableList(BOARD_COUNT) { Random.nextInt(typeCount(level)) }
}

private fun collapse(board: List<Int>, level: Int): List<Int> {
    val result = MutableList(BOARD_COUNT) { -1 }
    for (c in 0 until BOARD_SIZE) {
        val column = mutableListOf<Int>()
        for (r in BOARD_SIZE - 1 downTo 0) board[r * BOARD_SIZE + c].takeIf { it >= 0 }?.let(column::add)
        var k = 0
        for (r in BOARD_SIZE - 1 downTo 0) {
            result[r * BOARD_SIZE + c] = if (k < column.size) column[k++] else Random.nextInt(typeCount(level))
        }
    }
    return result
}

private fun encodeState(state: JewelState): String = JSONObject()
    .put("board", JSONArray(state.board))
    .put("phaseScore", state.phaseScore)
    .put("totalScore", state.totalScore)
    .put("level", state.level)
    .put("moves", state.moves)
    .toString()

private fun decodeState(raw: String?): JewelState? = runCatching {
    if (raw.isNullOrBlank()) return@runCatching null
    val json = JSONObject(raw)
    val array = json.getJSONArray("board")
    if (array.length() != BOARD_COUNT) return@runCatching null
    val board = List(BOARD_COUNT) { array.optInt(it, -1) }
    val level = max(1, json.optInt("level", 1))
    if (board.any { it !in 0 until typeCount(level) } || matches(board).isNotEmpty() || !hasMove(board)) return@runCatching null
    JewelState(board, max(0, json.optInt("phaseScore")), max(0, json.optInt("totalScore")), level, max(0, json.optInt("moves", phaseMoves(level))))
}.getOrNull()

private fun readPending(raw: String?): MutableList<PendingJewelResult> = runCatching {
    val array = JSONArray(raw ?: "[]")
    buildList {
        repeat(array.length()) { index ->
            val item = array.optJSONObject(index) ?: return@repeat
            val level = item.optInt("level")
            val completed = item.optInt("completedPhase")
            if (level == completed + 1 && level >= 1 && completed >= 0) add(PendingJewelResult(
                score = max(0, item.optInt("score")), level = level, completedPhase = completed,
                mode = item.optString("mode", "Joias da Luz").take(80), savedAt = item.optLong("savedAt", System.currentTimeMillis()),
            ))
        }
    }.groupBy { it.completedPhase }.map { (_, values) -> values.maxBy { it.savedAt } }
        .sortedBy { it.completedPhase }.take(20).toMutableList()
}.getOrElse { mutableListOf() }

private fun writePending(list: List<PendingJewelResult>): String = JSONArray().apply {
    list.sortedBy { it.completedPhase }.take(20).forEach { p ->
        put(JSONObject().put("score", p.score).put("level", p.level).put("completedPhase", p.completedPhase).put("mode", p.mode).put("savedAt", p.savedAt))
    }
}.toString()

@Composable
internal fun JewelsGamePanel(container: AppContainer) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS, 0) }
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val restored = remember { decodeState(prefs.getString(STATE_KEY, null)) }
    var board by remember { mutableStateOf(restored?.board ?: initialBoard(1)) }
    var phaseScore by remember { mutableIntStateOf(restored?.phaseScore ?: 0) }
    var totalScore by remember { mutableIntStateOf(restored?.totalScore ?: 0) }
    var level by remember { mutableIntStateOf(restored?.level ?: 1) }
    var moves by remember { mutableIntStateOf(restored?.moves ?: phaseMoves(1)) }
    var selected by remember { mutableStateOf<Int?>(null) }
    var exploding by remember { mutableStateOf(emptySet<Int>()) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("Toque em duas peças vizinhas. Combine 3 ou mais símbolos litúrgicos iguais.") }
    var rankingMessage by remember { mutableStateOf("") }
    var sound by remember { mutableStateOf(prefs.getBoolean(SOUND_KEY, true)) }
    var offline by remember { mutableStateOf(false) }
    var record by remember { mutableIntStateOf(prefs.getInt(RECORD_KEY, 0)) }
    val target = phaseTarget(level)

    fun tone(kind: String) {
        if (!sound) return
        runCatching {
            val generator = ToneGenerator(AudioManager.STREAM_MUSIC, 24)
            val tone = when (kind) {
                "error" -> ToneGenerator.TONE_PROP_NACK
                "phase" -> ToneGenerator.TONE_PROP_ACK
                "combo" -> ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD
                else -> ToneGenerator.TONE_PROP_BEEP
            }
            generator.startTone(tone, if (kind == "phase") 180 else 90)
            android.os.Handler(context.mainLooper).postDelayed({ generator.release() }, 240)
        }
    }

    fun persist() {
        prefs.edit().putString(STATE_KEY, encodeState(JewelState(board, phaseScore, totalScore, level, moves))).apply()
    }

    fun savePending(result: PendingJewelResult) {
        val pending = readPending(prefs.getString(PENDING_KEY, null)).filter { it.completedPhase != result.completedPhase }.toMutableList()
        pending += result
        prefs.edit().putString(PENDING_KEY, writePending(pending)).apply()
    }

    suspend fun sendResult(result: PendingJewelResult): Pair<Boolean, Int?> {
        return try {
            val payload = JSONObject().put("score", result.score).put("level", result.level).put("completedPhase", result.completedPhase).put("mode", result.mode).toString()
            val response = container.httpClient.request("POST", "/api/jogo/caminho-da-luz/resultado", payload)
            val json = runCatching { JSONObject(response.body.ifBlank { "{}" }) }.getOrDefault(JSONObject())
            if (response.successful) {
                offline = false
                val totalDay = json.optInt("pontosTotalDia")
                val limit = json.optInt("limiteDiario", RANKING_LIMIT)
                rankingMessage = if (json.optBoolean("jaContabilizado")) "Ranking do jogo hoje: $totalDay/$limit." else "+${json.optInt("pontosAdicionados", json.optInt("pontosRanking"))} no ranking · total do jogo hoje: $totalDay/$limit."
                true to null
            } else if (response.status == 409 && json.optInt("faseEsperada") > 0) {
                false to json.optInt("faseEsperada")
            } else {
                rankingMessage = json.optString("erro").ifBlank { "Pontuação guardada no aparelho para sincronizar depois." }
                false to null
            }
        } catch (_: IOException) {
            offline = true
            rankingMessage = "Pontuação guardada neste aparelho. Sincroniza quando a internet voltar."
            false to null
        } catch (_: Exception) {
            rankingMessage = "Pontuação guardada neste aparelho. Sincroniza quando a conexão estabilizar."
            false to null
        }
    }

    suspend fun syncPending() {
        var queue = readPending(prefs.getString(PENDING_KEY, null))
        var protection = 0
        while (queue.isNotEmpty() && protection++ < 20) {
            val item = queue.first()
            val (ok, expected) = sendResult(item)
            if (ok) {
                queue.removeAt(0)
                prefs.edit().putString(PENDING_KEY, writePending(queue)).apply()
                continue
            }
            if (expected != null && expected > 0 && expected < item.completedPhase) {
                queue.add(0, item.copy(level = expected + 1, completedPhase = expected, mode = "Joias da Luz · sincronização offline", savedAt = System.currentTimeMillis()))
                prefs.edit().putString(PENDING_KEY, writePending(queue)).apply()
                continue
            }
            break
        }
    }

    suspend fun resolveCascade(start: List<Int>): Triple<List<Int>, Int, Int> {
        var current = start
        var round = 0
        var gain = 0
        while (round < 14) {
            val found = matches(current)
            if (found.isEmpty()) break
            round++
            gain += found.size * 30 * min(round, 4) + max(0, found.size - 3) * 12
            exploding = found
            delay(180)
            val removed = current.toMutableList().also { list -> found.forEach { list[it] = -1 } }
            board = removed
            exploding = emptySet()
            delay(45)
            current = collapse(removed, level)
            board = current
            delay(185)
        }
        tone(if (round > 1) "combo" else "match")
        haptics.performHapticFeedback(if (round > 1) HapticFeedbackType.LongPress else HapticFeedbackType.TextHandleMove)
        return Triple(current, gain, round)
    }

    suspend fun attemptSwap(origin: Int, destination: Int) {
        if (busy || moves <= 0 || !adjacent(origin, destination)) return
        busy = true
        selected = null
        val original = board
        val changed = swap(board, origin, destination)
        board = changed
        delay(125)
        if (matches(changed).isEmpty()) {
            board = original
            tone("error")
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            message = "Essa troca não cria uma combinação. Alinhe 3 ou mais símbolos iguais."
            busy = false
            return
        }
        moves -= 1
        val (resolved, gain, cascades) = resolveCascade(changed)
        board = resolved
        phaseScore += gain
        totalScore += gain
        message = if (cascades > 1) "Combo x$cascades! Cascata litúrgica." else "Boa combinação! +$gain pontos."
        val completedScore = phaseScore
        val completedTotal = totalScore
        if (completedScore >= target) {
            val completed = level
            val next = level + 1
            tone("phase")
            val result = PendingJewelResult(completedTotal, next, completed, phaseMode(next), System.currentTimeMillis())
            val (ok, _) = sendResult(result)
            if (!ok) savePending(result)
            if (offline) rankingMessage = "Bônus local estimado: ${accumulatedBonus(completed)}/$RANKING_LIMIT · aguardando servidor."
            message = if (completed <= 5) "${phaseName(completed)} concluída. Avançando para ${phaseName(next)}." else "Serviço $completed concluído. +2 no ranking até o limite diário."
            delay(480)
            level = next
            phaseScore = 0
            moves = phaseMoves(next)
            board = initialBoard(next)
        } else if (moves <= 0) {
            record = max(record, totalScore)
            prefs.edit().putInt(RECORD_KEY, record).remove(STATE_KEY).apply()
            message = "Fim da rodada. Reinicie para tentar um novo recorde."
        } else if (!hasMove(board)) {
            board = initialBoard(level)
            message = "Sem jogadas possíveis. Embaralhamos as peças sem gastar movimento."
        }
        persist()
        busy = false
    }

    LaunchedEffect(Unit) { syncPending() }
    LaunchedEffect(board, phaseScore, totalScore, level, moves) { if (moves > 0) persist() }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SantaWine),
            shape = RoundedCornerShape(24.dp),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("JOIAS DA LUZ · ${if (level <= 5) "ETAPA $level DE 5" else "JORNADA $level"}", style = MaterialTheme.typography.labelSmall, color = SantaGold, fontWeight = FontWeight.Black)
                        Text(phaseName(level), style = MaterialTheme.typography.headlineSmall, color = Color.White, fontWeight = FontWeight.Bold)
                        Text(phaseCall(level), style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = .8f))
                    }
                    IconButton(onClick = { sound = !sound; prefs.edit().putBoolean(SOUND_KEY, sound).apply() }) {
                        Icon(if (sound) Icons.Rounded.VolumeUp else Icons.Rounded.VolumeOff, "Som", tint = SantaGold)
                    }
                }
                LinearProgressIndicator(progress = { min(1f, phaseScore.toFloat() / target.toFloat()) }, modifier = Modifier.fillMaxWidth())
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("$phaseScore / $target", color = Color.White, fontWeight = FontWeight.Bold)
                    Text("$moves movimentos", color = Color.White)
                }
                Text("Total: $totalScore · Recorde: $record", color = Color.White.copy(alpha = .75f), style = MaterialTheme.typography.labelMedium)
            }
        }

        if (offline) AssistChip(onClick = {}, label = { Text("Jogo offline · resultado aguardando sincronização") }, leadingIcon = { Icon(Icons.Rounded.CloudOff, null) })
        if (rankingMessage.isNotBlank()) Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) { Text(rankingMessage, Modifier.padding(10.dp), color = SantaWine, style = MaterialTheme.typography.bodySmall) }

        LazyVerticalGrid(
            columns = GridCells.Fixed(BOARD_SIZE),
            modifier = Modifier.fillMaxWidth().aspectRatio(1f),
            userScrollEnabled = false,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            itemsIndexed(board) { index, type ->
                val isSelected = selected == index
                val isExploding = index in exploding
                val animatedScale by animateFloatAsState(if (isExploding) .25f else if (isSelected) 1.12f else 1f, label = "liturgical-piece-scale")
                Box(
                    modifier = Modifier
                        .aspectRatio(1f)
                        .scale(animatedScale)
                        .background(if (isSelected) SantaGold.copy(alpha = .28f) else MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp))
                        .then(if (isSelected) Modifier.border(2.dp, SantaGold, RoundedCornerShape(10.dp)) else Modifier)
                        .clickable(enabled = !busy && moves > 0 && type >= 0) {
                            val previous = selected
                            when {
                                previous == null -> { selected = index; haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
                                previous == index -> selected = null
                                adjacent(previous, index) -> scope.launch { attemptSwap(previous, index) }
                                else -> selected = index
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    if (type >= 0) Text(
                        liturgicalSymbols[type],
                        style = MaterialTheme.typography.headlineSmall,
                        color = when (type) {
                            0 -> SantaWine
                            1 -> Color(0xFFD6A441)
                            2 -> Color(0xFF8D6E63)
                            3 -> Color(0xFF3B69D9)
                            4 -> Color(0xFF7A4D9B)
                            5 -> Color(0xFFE49A3B)
                            6 -> Color(0xFF3DB6BA)
                            else -> Color(0xFF8BBDCC)
                        },
                        fontWeight = FontWeight.Black,
                    )
                }
            }
        }

        Text(message, style = MaterialTheme.typography.bodySmall, color = SantaWine)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                modifier = Modifier.weight(1f),
                onClick = {
                    level = 1; phaseScore = 0; totalScore = 0; moves = phaseMoves(1); board = initialBoard(1); selected = null; busy = false
                    message = "Nova jornada iniciada. Combine 3 ou mais símbolos litúrgicos."
                    prefs.edit().remove(STATE_KEY).apply()
                },
            ) { Icon(Icons.Rounded.Refresh, null); Spacer(Modifier.size(6.dp)); Text("Reiniciar") }
            Button(modifier = Modifier.weight(1f), onClick = { scope.launch { syncPending() } }) { Icon(Icons.Rounded.AutoAwesome, null); Spacer(Modifier.size(6.dp)); Text("Sincronizar") }
        }
        Text(
            "Peças litúrgicas: ${liturgicalPieceNames.take(typeCount(level)).joinToString(" · ")}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
