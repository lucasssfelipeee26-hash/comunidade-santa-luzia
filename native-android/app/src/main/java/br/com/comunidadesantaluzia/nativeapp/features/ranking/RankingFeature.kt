package br.com.comunidadesantaluzia.nativeapp.features.ranking

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.MilitaryTech
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import org.json.JSONObject

data class RankingLine(
    val position: Int,
    val userId: String,
    val name: String,
    val role: String?,
    val photo: String?,
    val points: Int,
    val quizzes: Int,
    val hits: Int,
    val successRate: Int,
)
data class RankingState(
    val year: Int = 0,
    val myId: String? = null,
    val myName: String? = null,
    val myType: String? = null,
    val ranking: List<RankingLine> = emptyList(),
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

internal suspend fun loadRanking(container: AppContainer): RankingState {
    return when (val result = container.repository.readLocalFirst("ranking", "/api/ranking", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val me = root.optJSONObject("eu")
            val array = root.optJSONArray("ranking")
            val lines = buildList {
                if (array != null) repeat(array.length()) { index ->
                    val item = array.optJSONObject(index) ?: return@repeat
                    add(
                        RankingLine(
                            position = item.optInt("posicao", index + 1),
                            userId = item.optString("usuarioId"),
                            name = item.optString("nome"),
                            role = item.optString("funcao").takeIf { it.isNotBlank() && it != "null" },
                            photo = item.optString("foto").takeIf { it.isNotBlank() && it != "null" },
                            points = item.optInt("pontos"),
                            quizzes = item.optInt("quizzesRespondidos"),
                            hits = item.optInt("acertos"),
                            successRate = item.optInt("aproveitamento"),
                        ),
                    )
                }
            }
            RankingState(
                year = root.optInt("ano"),
                myId = me?.optString("id"),
                myName = me?.optString("nome"),
                myType = me?.optString("tipo"),
                ranking = lines,
                fromCache = result.fromCache,
                loading = false,
            )
        }.getOrElse { RankingState(loading = false, error = "O ranking salvo está em formato inválido.") }
        is RepositoryResult.Failure -> RankingState(loading = false, error = result.message)
        is RepositoryResult.Queued -> RankingState(loading = false, error = "A leitura do ranking não deve entrar em fila.")
    }
}

@Composable
internal fun RankingScreen(container: AppContainer) {
    var state by remember { mutableStateOf(RankingState()) }
    LaunchedEffect(Unit) { state = loadRanking(container) }
    val mine = remember(state.ranking, state.myId) { state.ranking.firstOrNull { it.userId == state.myId } }
    val podium = remember(state.ranking) { state.ranking.take(3) }
    val rest = remember(state.ranking) { state.ranking.drop(3) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("Classificação", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                Text("Pontuação da Jornada Litúrgica${if (state.year > 0) " · ${state.year}" else ""}", style = MaterialTheme.typography.bodySmall)
                if (state.fromCache) AssistChip(onClick = {}, label = { Text("Última classificação salva · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) })
            }
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            state.ranking.isEmpty() -> item { Card { Text("A classificação ainda não possui participantes.", Modifier.padding(20.dp)) } }
            else -> {
                mine?.let { line -> item { MyRankingCard(line) } }
                item {
                    Text("Pódio", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                        podium.forEach { line -> PodiumCard(line, Modifier.weight(1f), champion = line.position == 1) }
                    }
                }
                if (rest.isNotEmpty()) {
                    item { Text("Classificação completa", style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold) }
                    items(rest, key = { it.userId }) { line -> RankingRow(line, highlighted = line.userId == state.myId) }
                }
            }
        }
    }
}

@Composable
private fun MyRankingCard(line: RankingLine) {
    Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .14f)), shape = RoundedCornerShape(20.dp)) {
        Row(Modifier.fillMaxWidth().padding(15.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Sua posição", style = MaterialTheme.typography.labelSmall, color = SantaWine, fontWeight = FontWeight.Black)
                Text("${line.position}º · ${line.points} pontos", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                Text("${line.quizzes} quizzes · ${line.successRate}% de aproveitamento", style = MaterialTheme.typography.bodySmall)
            }
            Icon(Icons.Rounded.EmojiEvents, null, tint = SantaGold, modifier = Modifier.size(38.dp))
        }
    }
}

@Composable
private fun PodiumCard(line: RankingLine, modifier: Modifier, champion: Boolean) {
    val transition = rememberInfiniteTransition(label = "podium-${line.userId}")
    val turn by transition.animateFloat(
        initialValue = -5f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(tween(if (champion) 1700 else 2300), RepeatMode.Reverse),
        label = "avatar-turn",
    )
    Card(
        modifier = modifier.graphicsLayer { translationY = if (champion) -8f else 0f },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(22.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = if (champion) 5.dp else 2.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Icon(if (line.position == 1) Icons.Rounded.EmojiEvents else Icons.Rounded.MilitaryTech, null, tint = SantaGold, modifier = Modifier.size(if (champion) 34.dp else 26.dp).graphicsLayer { rotationY = turn })
            Box(
                modifier = Modifier.size(if (champion) 62.dp else 52.dp).clip(CircleShape).background(SantaWine.copy(alpha = .1f)).graphicsLayer { rotationY = turn },
                contentAlignment = Alignment.Center,
            ) { Text(initials(line.name), color = SantaWine, fontWeight = FontWeight.Black) }
            Text(line.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
            Text("${line.position}º", color = SantaWine, fontWeight = FontWeight.Black)
            Text("${line.points} pts", style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun RankingRow(line: RankingLine, highlighted: Boolean) {
    Card(colors = CardDefaults.cardColors(containerColor = if (highlighted) SantaGold.copy(alpha = .12f) else MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(SantaWine.copy(alpha = .08f)), contentAlignment = Alignment.Center) {
                Text("${line.position}º", color = SantaWine, fontWeight = FontWeight.Black)
            }
            Box(Modifier.size(42.dp).clip(CircleShape).background(SantaWine.copy(alpha = .1f)), contentAlignment = Alignment.Center) { Text(initials(line.name), color = SantaWine, fontWeight = FontWeight.Bold) }
            Column(Modifier.weight(1f)) {
                Text(line.name, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(line.role ?: "Participante", style = MaterialTheme.typography.bodySmall)
            }
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    Icon(Icons.Rounded.Star, null, Modifier.size(15.dp), tint = SantaGold)
                    Text(line.points.toString(), color = SantaWine, fontWeight = FontWeight.Black)
                }
                Text("${line.successRate}%", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

private fun initials(name: String): String = name.trim().split(Regex("\\s+")).filter(String::isNotBlank).take(2).joinToString("") { it.first().uppercase() }
