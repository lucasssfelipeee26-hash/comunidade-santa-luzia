package br.com.comunidadesantaluzia.nativeapp.features.journey

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material.icons.rounded.Quiz
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import br.com.comunidadesantaluzia.nativeapp.features.ranking.RankingScreen
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class QuizQuestion(val id: String, val prompt: String, val options: List<String>, val points: Int)
data class NativeQuiz(
    val id: String,
    val title: String,
    val description: String,
    val origin: String,
    val dateReference: String?,
    val answered: Boolean,
    val questions: List<QuizQuestion>,
)
data class QuizzesState(
    val quizzes: List<NativeQuiz> = emptyList(),
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)
data class ConstancyDay(val number: Int, val date: String, val received: Boolean, val today: Boolean)
data class ConstancyState(
    val title: String = "Constância de Luz",
    val pointsPerDay: Int = 2,
    val maxWeekly: Int = 14,
    val days: List<ConstancyDay> = emptyList(),
    val completedDays: Int = 0,
    val weekPoints: Int = 0,
    val receivedToday: Boolean = false,
    val completed: Boolean = false,
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

internal suspend fun loadQuizzes(container: AppContainer): QuizzesState =
    when (val result = container.repository.readLocalFirst("quizzes", "/api/quizzes", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val array = root.optJSONArray("quizzes") ?: JSONArray()
            val quizzes = buildList {
                repeat(array.length()) { index ->
                    val item = array.optJSONObject(index) ?: return@repeat
                    val questionsArray = item.optJSONArray("perguntas") ?: JSONArray()
                    val questions = buildList {
                        repeat(questionsArray.length()) { qIndex ->
                            val question = questionsArray.optJSONObject(qIndex) ?: return@repeat
                            val options = question.optJSONArray("opcoes") ?: JSONArray()
                            add(QuizQuestion(question.optString("id"), question.optString("enunciado"), List(options.length()) { options.optString(it) }, question.optInt("pontos")))
                        }
                    }
                    add(NativeQuiz(
                        id = item.optString("id"),
                        title = item.optString("titulo"),
                        description = item.optString("descricao"),
                        origin = item.optString("origem"),
                        dateReference = item.optString("data_referencia").takeIf { it.isNotBlank() && it != "null" },
                        answered = item.optBoolean("respondido"),
                        questions = questions,
                    ))
                }
            }
            QuizzesState(quizzes, result.fromCache, loading = false)
        }.getOrElse { QuizzesState(loading = false, error = "Os quizzes salvos estão em formato inválido.") }
        is RepositoryResult.Failure -> QuizzesState(loading = false, error = result.message)
        is RepositoryResult.Queued -> QuizzesState(loading = false, error = "A leitura dos quizzes não deve entrar em fila.")
    }

internal suspend fun loadConstancy(container: AppContainer): ConstancyState =
    when (val result = container.repository.readLocalFirst("constancia", "/api/constancia-luz", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val item = JSONObject(result.value).getJSONObject("constancia")
            val array = item.optJSONArray("dias") ?: JSONArray()
            val days = buildList {
                repeat(array.length()) { index ->
                    val day = array.optJSONObject(index) ?: return@repeat
                    add(ConstancyDay(day.optInt("numero"), day.optString("data"), day.optBoolean("recebido"), day.optBoolean("hoje")))
                }
            }
            ConstancyState(
                title = item.optString("titulo", "Constância de Luz"),
                pointsPerDay = item.optInt("pontosPorDia", 2),
                maxWeekly = item.optInt("maximoSemanal", 14),
                days = days,
                completedDays = item.optInt("diasConcluidos"),
                weekPoints = item.optInt("pontosSemana"),
                receivedToday = item.optBoolean("recebidoHoje"),
                completed = item.optBoolean("concluida"),
                fromCache = result.fromCache,
                loading = false,
            )
        }.getOrElse { ConstancyState(loading = false, error = "A Constância de Luz salva está em formato inválido.") }
        is RepositoryResult.Failure -> ConstancyState(loading = false, error = result.message)
        is RepositoryResult.Queued -> ConstancyState(loading = false, error = "A leitura da constância não deve entrar em fila.")
    }

private enum class JourneyTab { Quiz, Jewels, Ranking, Standalone }
private enum class StandaloneTab { Whatajong, Quizzes }
private fun NativeQuiz.isLiturgical(): Boolean = origin.contains("liturg", ignoreCase = true) || origin.contains("automatic", ignoreCase = true)

@Composable
internal fun JourneyScreen(container: AppContainer, onOpenLiturgy: () -> Unit) {
    var tab by remember { mutableStateOf(JourneyTab.Quiz) }
    var quizzes by remember { mutableStateOf(QuizzesState()) }
    var constancy by remember { mutableStateOf(ConstancyState()) }
    LaunchedEffect(Unit) { quizzes = loadQuizzes(container); constancy = loadConstancy(container) }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Jornada Litúrgica", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold)
        Text("Quiz, Joias da Luz, Ranking e desafios avulsos em uma única jornada.", style = MaterialTheme.typography.bodySmall)
        ConstancySummary(container, constancy) { constancy = it }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            JourneyTabChip("Quiz", tab == JourneyTab.Quiz, { tab = JourneyTab.Quiz }, Modifier.weight(1f))
            JourneyTabChip("Joias", tab == JourneyTab.Jewels, { tab = JourneyTab.Jewels }, Modifier.weight(1f))
            JourneyTabChip("Ranking", tab == JourneyTab.Ranking, { tab = JourneyTab.Ranking }, Modifier.weight(1f))
            JourneyTabChip("Avulsos", tab == JourneyTab.Standalone, { tab = JourneyTab.Standalone }, Modifier.weight(1f))
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (tab) {
                JourneyTab.Quiz -> LiturgicalQuizPanel(container, onOpenLiturgy)
                JourneyTab.Jewels -> JewelsGamePanel(container)
                JourneyTab.Ranking -> RankingScreen(container)
                JourneyTab.Standalone -> StandalonePanel(container, quizzes) { quizzes = it }
            }
        }
    }
}

@Composable
private fun JourneyTabChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    FilterChip(selected = selected, onClick = onClick, label = { Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1) }, modifier = modifier)
}

@Composable
private fun StandalonePanel(container: AppContainer, quizzes: QuizzesState, onReload: (QuizzesState) -> Unit) {
    var tab by remember { mutableStateOf(StandaloneTab.Whatajong) }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = tab == StandaloneTab.Whatajong,
                onClick = { tab = StandaloneTab.Whatajong },
                label = { Text("Whatajong") },
                leadingIcon = { Icon(Icons.Rounded.Casino, null) },
                modifier = Modifier.weight(1f),
            )
            FilterChip(
                selected = tab == StandaloneTab.Quizzes,
                onClick = { tab = StandaloneTab.Quizzes },
                label = { Text("Quizzes avulsos") },
                leadingIcon = { Icon(Icons.Rounded.Quiz, null) },
                modifier = Modifier.weight(1f),
            )
        }
        Box(Modifier.weight(1f)) {
            if (tab == StandaloneTab.Whatajong) WhatajongPanel(container)
            else QuizList(container, quizzes.copy(quizzes = quizzes.quizzes.filterNot { it.isLiturgical() }), "Nenhum quiz avulso disponível no momento.", onReload)
        }
    }
}

@Composable
private fun ConstancySummary(container: AppContainer, state: ConstancyState, onState: (ConstancyState) -> Unit) {
    val scope = rememberCoroutineScope()
    val today = remember { LocalDate.now(ZoneId.of("America/Cuiaba")).toString() }
    var feedback by remember { mutableStateOf("") }
    Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f)), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.AutoAwesome, null, tint = SantaWine)
                    Column {
                        Text(state.title, color = SantaWine, fontWeight = FontWeight.Bold)
                        if (!state.loading && state.error == null) Text("${state.completedDays}/7 dias · ${state.weekPoints}/${state.maxWeekly} pontos", style = MaterialTheme.typography.labelSmall)
                    }
                }
                if (state.fromCache) Text("offline", style = MaterialTheme.typography.labelSmall, color = SantaWine)
            }
            when {
                state.loading -> CircularProgressIndicator()
                state.error != null -> Text(state.error, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                state.receivedToday -> Text(if (state.completed) "Semana completa. Constância de hoje já registrada." else "Constância de hoje já registrada.", style = MaterialTheme.typography.bodySmall)
                else -> Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        val optimisticDays = state.days.map { if (it.date == today || it.today) it.copy(received = true) else it }
                        onState(state.copy(days = optimisticDays, receivedToday = true, completedDays = minOf(7, state.completedDays + 1), weekPoints = minOf(state.maxWeekly, state.weekPoints + state.pointsPerDay), fromCache = true))
                        scope.launch {
                            val payload = JSONObject().put("data", today).toString()
                            when (val result = container.repository.mutate("POST", "/api/constancia-luz", payload)) {
                                is RepositoryResult.Success -> { onState(loadConstancy(container)); feedback = "+${state.pointsPerDay} pontos de Constância registrados." }
                                is RepositoryResult.Queued -> feedback = "Constância salva no aparelho para sincronizar."
                                is RepositoryResult.Failure -> { feedback = result.message; onState(loadConstancy(container)) }
                            }
                        }
                    },
                ) { Text("Registrar Constância de hoje") }
            }
            if (feedback.isNotBlank()) Text(feedback, style = MaterialTheme.typography.labelSmall, color = SantaWine)
        }
    }
}

@Composable
private fun QuizList(container: AppContainer, state: QuizzesState, emptyMessage: String, onReload: (QuizzesState) -> Unit) {
    var active by remember { mutableStateOf<NativeQuiz?>(null) }
    var feedback by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 20.dp)) {
        if (state.fromCache) item { AssistChip(onClick = {}, label = { Text("Conteúdo salvo · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) }) }
        if (feedback.isNotBlank()) item { Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) { Text(feedback, Modifier.padding(12.dp), color = SantaWine) } }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error, Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            state.quizzes.isEmpty() -> item { Card { Text(emptyMessage, Modifier.padding(20.dp)) } }
            else -> itemsIndexed(state.quizzes, key = { _, quiz -> quiz.id }) { _, quiz ->
                Card(shape = RoundedCornerShape(20.dp)) {
                    Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text(quiz.title, style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                        if (quiz.description.isNotBlank()) Text(quiz.description, style = MaterialTheme.typography.bodySmall)
                        quiz.dateReference?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
                        Text("${quiz.questions.size} pergunta(s) · ${quiz.questions.sumOf { it.points }} ponto(s) possíveis", style = MaterialTheme.typography.labelSmall)
                        if (quiz.answered) AssistChip(onClick = {}, label = { Text("Já respondido") }, leadingIcon = { Icon(Icons.Rounded.CheckCircle, null) })
                        else Button(onClick = { active = quiz }, modifier = Modifier.fillMaxWidth()) { Text("Responder") }
                    }
                }
            }
        }
    }
    active?.let { quiz ->
        QuizDialog(quiz, { active = null }) { answers ->
            active = null
            scope.launch {
                val payload = JSONObject().put("respostas", JSONArray(answers)).toString()
                when (val result = container.repository.mutateOnlineOnly("POST", "/api/quizzes/${quiz.id}/responder", payload)) {
                    is RepositoryResult.Success -> {
                        val outcome = runCatching { JSONObject(result.value).optJSONObject("resultado") }.getOrNull()
                        feedback = if (outcome != null) "Quiz concluído: ${outcome.optInt("acertos")} acerto(s) e ${outcome.optInt("pontos")} ponto(s)." else "Quiz concluído."
                        onReload(loadQuizzes(container))
                    }
                    is RepositoryResult.Failure -> { feedback = result.message; onReload(loadQuizzes(container)) }
                    is RepositoryResult.Queued -> feedback = "O quiz avulso precisa ser confirmado online."
                }
            }
        }
    }
}

@Composable
private fun QuizDialog(quiz: NativeQuiz, onDismiss: () -> Unit, onSubmit: (List<Int>) -> Unit) {
    val answers = remember(quiz.id) { mutableStateListOf<Int>().apply { repeat(quiz.questions.size) { add(-1) } } }
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(quiz.title) },
        text = { LazyColumn(verticalArrangement = Arrangement.spacedBy(13.dp)) {
            itemsIndexed(quiz.questions) { index, question ->
                Card { Column(Modifier.padding(12.dp)) {
                    Text("${index + 1}. ${question.prompt}", fontWeight = FontWeight.Bold)
                    question.options.forEachIndexed { optionIndex, option ->
                        Row(verticalAlignment = Alignment.CenterVertically) { RadioButton(answers[index] == optionIndex, { answers[index] = optionIndex }); Text(option) }
                    }
                } }
            }
        } },
        confirmButton = { Button(enabled = answers.all { it >= 0 }, onClick = { onSubmit(answers.toList()) }) { Text("Enviar respostas") } },
        dismissButton = { Button(onClick = onDismiss) { Text("Cancelar") } },
    )
}
