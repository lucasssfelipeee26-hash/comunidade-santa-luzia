package br.com.comunidadesantaluzia.nativeapp.features.journey

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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.LightMode
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
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class QuizQuestion(val id: String, val prompt: String, val options: List<String>, val points: Int)
data class NativeQuiz(val id: String, val title: String, val description: String, val origin: String, val dateReference: String?, val answered: Boolean, val questions: List<QuizQuestion>)
data class QuizzesState(val quizzes: List<NativeQuiz> = emptyList(), val fromCache: Boolean = false, val loading: Boolean = true, val error: String? = null)
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

internal suspend fun loadQuizzes(container: AppContainer): QuizzesState = when (val result = container.repository.readLocalFirst("quizzes", "/api/quizzes", authenticated = true)) {
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
                        val optionsJson = question.optJSONArray("opcoes") ?: JSONArray()
                        add(QuizQuestion(question.optString("id"), question.optString("enunciado"), List(optionsJson.length()) { optionsJson.optString(it) }, question.optInt("pontos")))
                    }
                }
                add(NativeQuiz(item.optString("id"), item.optString("titulo"), item.optString("descricao"), item.optString("origem"), item.optString("data_referencia").takeIf { it.isNotBlank() && it != "null" }, item.optBoolean("respondido"), questions))
            }
        }
        QuizzesState(quizzes = quizzes, fromCache = result.fromCache, loading = false)
    }.getOrElse { QuizzesState(loading = false, error = "Os quizzes salvos estão em formato inválido.") }
    is RepositoryResult.Failure -> QuizzesState(loading = false, error = result.message)
    is RepositoryResult.Queued -> QuizzesState(loading = false, error = "A leitura dos quizzes não deve entrar em fila.")
}

internal suspend fun loadConstancy(container: AppContainer): ConstancyState = when (val result = container.repository.readLocalFirst("constancia", "/api/constancia-luz", authenticated = true)) {
    is RepositoryResult.Success -> runCatching {
        val item = JSONObject(result.value).getJSONObject("constancia")
        val daysArray = item.optJSONArray("dias") ?: JSONArray()
        val days = buildList { repeat(daysArray.length()) { index -> val day = daysArray.optJSONObject(index) ?: return@repeat; add(ConstancyDay(day.optInt("numero"), day.optString("data"), day.optBoolean("recebido"), day.optBoolean("hoje"))) } }
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

private enum class JourneyTab { Quiz, Constancy }

@Composable
internal fun JourneyScreen(container: AppContainer) {
    var tab by remember { mutableStateOf(JourneyTab.Quiz) }
    var quizzes by remember { mutableStateOf(QuizzesState()) }
    var constancy by remember { mutableStateOf(ConstancyState()) }
    LaunchedEffect(Unit) { quizzes = loadQuizzes(container); constancy = loadConstancy(container) }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Jornada Litúrgica", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold)
        Text("Aprenda, mantenha sua Constância de Luz e some pontos no mesmo ranking da comunidade.", style = MaterialTheme.typography.bodySmall)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = tab == JourneyTab.Quiz, onClick = { tab = JourneyTab.Quiz }, label = { Text("Quiz") }, leadingIcon = { Icon(Icons.Rounded.Quiz, null) }, modifier = Modifier.weight(1f))
            FilterChip(selected = tab == JourneyTab.Constancy, onClick = { tab = JourneyTab.Constancy }, label = { Text("Constância") }, leadingIcon = { Icon(Icons.Rounded.LightMode, null) }, modifier = Modifier.weight(1f))
        }
        Box(Modifier.weight(1f)) {
            if (tab == JourneyTab.Quiz) QuizList(container, quizzes) { quizzes = it } else ConstancyPanel(container, constancy) { constancy = it }
        }
    }
}

@Composable
private fun QuizList(container: AppContainer, state: QuizzesState, onState: (QuizzesState) -> Unit) {
    var active by remember { mutableStateOf<NativeQuiz?>(null) }
    var feedback by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 20.dp)) {
        if (state.fromCache) item { AssistChip(onClick = {}, label = { Text("Quizzes salvos · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) }) }
        if (feedback.isNotBlank()) item { Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) { Text(feedback, Modifier.padding(12.dp), color = SantaWine) } }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            state.quizzes.isEmpty() -> item { Card { Text("Nenhum quiz disponível no momento.", Modifier.padding(20.dp)) } }
            else -> items(state.quizzes.size) { index ->
                val quiz = state.quizzes[index]
                Card(shape = RoundedCornerShape(20.dp)) {
                    Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text(quiz.title, style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                        if (quiz.description.isNotBlank()) Text(quiz.description, style = MaterialTheme.typography.bodySmall)
                        Text("${quiz.questions.size} pergunta(s) · ${quiz.questions.sumOf { it.points }} ponto(s) possíveis", style = MaterialTheme.typography.labelSmall)
                        if (quiz.answered) AssistChip(onClick = {}, label = { Text("Já respondido") }, leadingIcon = { Icon(Icons.Rounded.CheckCircle, null) })
                        else Button(onClick = { active = quiz }, modifier = Modifier.fillMaxWidth()) { Text("Responder") }
                    }
                }
            }
        }
    }
    active?.let { quiz ->
        QuizDialog(quiz = quiz, onDismiss = { active = null }, onSubmit = { answers ->
            val optimistic = state.copy(quizzes = state.quizzes.map { if (it.id == quiz.id) it.copy(answered = true) else it }, fromCache = true)
            onState(optimistic); active = null
            scope.launch {
                val payload = JSONObject().apply { put("respostas", JSONArray(answers)) }.toString()
                when (val result = container.repository.mutate("POST", "/api/quizzes/${quiz.id}/responder", payload)) {
                    is RepositoryResult.Success -> {
                        val json = runCatching { JSONObject(result.value) }.getOrNull()
                        val r = json?.optJSONObject("resultado")
                        feedback = if (r != null) "Quiz concluído: ${r.optInt("acertos")} acerto(s) e ${r.optInt("pontos")} ponto(s)." else "Quiz concluído."
                        onState(loadQuizzes(container))
                    }
                    is RepositoryResult.Queued -> feedback = "Respostas salvas no aparelho. O resultado será calculado quando a internet voltar."
                    is RepositoryResult.Failure -> { feedback = result.message; onState(loadQuizzes(container)) }
                }
            }
        })
    }
}

@Composable
private fun QuizDialog(quiz: NativeQuiz, onDismiss: () -> Unit, onSubmit: (List<Int>) -> Unit) {
    val answers = remember(quiz.id) { mutableStateListOf<Int>().apply { repeat(quiz.questions.size) { add(-1) } } }
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(quiz.title) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(13.dp)) {
                itemsIndexed(quiz.questions) { index, question ->
                    Card {
                        Column(Modifier.padding(12.dp)) {
                            Text("${index + 1}. ${question.prompt}", fontWeight = FontWeight.Bold)
                            question.options.forEachIndexed { optionIndex, option ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    RadioButton(selected = answers[index] == optionIndex, onClick = { answers[index] = optionIndex })
                                    Text(option)
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { Button(enabled = answers.all { it >= 0 }, onClick = { onSubmit(answers.toList()) }) { Text("Enviar respostas") } },
        dismissButton = { Button(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun ConstancyPanel(container: AppContainer, state: ConstancyState, onState: (ConstancyState) -> Unit) {
    val scope = rememberCoroutineScope()
    var feedback by remember { mutableStateOf("") }
    val today = remember { LocalDate.now().toString() }
    LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 20.dp)) {
        if (state.fromCache) item { AssistChip(onClick = {}, label = { Text("Constância salva · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) }) }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            else -> {
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f)), shape = RoundedCornerShape(24.dp)) {
                        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) { Icon(Icons.Rounded.AutoAwesome, null, tint = SantaWine); Text(state.title, style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold) }
                            Text("${state.pointsPerDay} pontos por dia · máximo semanal de ${state.maxWeekly} pontos")
                            Text("${state.completedDays}/7 dias concluídos · ${state.weekPoints} pontos nesta semana", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                itemsIndexed(state.days) { _, day ->
                    Card {
                        Row(Modifier.fillMaxWidth().padding(13.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column { Text("Dia ${day.number}", fontWeight = FontWeight.Bold); Text(day.date, style = MaterialTheme.typography.bodySmall) }
                            AssistChip(onClick = {}, label = { Text(if (day.received) "+${state.pointsPerDay} pontos" else if (day.today) "Hoje" else "Pendente") }, leadingIcon = if (day.received) ({ Icon(Icons.Rounded.CheckCircle, null) }) else null)
                        }
                    }
                }
                if (!state.receivedToday) item {
                    Button(
                        onClick = {
                            val optimisticDays = state.days.map { if (it.date == today || it.today) it.copy(received = true) else it }
                            val optimistic = state.copy(days = optimisticDays, receivedToday = true, completedDays = minOf(7, state.completedDays + 1), weekPoints = state.weekPoints + state.pointsPerDay, fromCache = true)
                            onState(optimistic)
                            scope.launch {
                                val payload = JSONObject().apply { put("data", today) }.toString()
                                when (val result = container.repository.mutate("POST", "/api/constancia-luz", payload)) {
                                    is RepositoryResult.Success -> { onState(loadConstancy(container)); feedback = "Constância de hoje registrada: +${state.pointsPerDay} pontos." }
                                    is RepositoryResult.Queued -> feedback = "Constância registrada no aparelho. Os pontos serão sincronizados quando a internet voltar."
                                    is RepositoryResult.Failure -> { feedback = result.message; onState(loadConstancy(container)) }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Registrar Constância de hoje") }
                }
                if (state.completed) item { Card(colors = CardDefaults.cardColors(containerColor = SantaWine)) { Text("Semana completa! Você concluiu os 7 dias da Constância de Luz.", Modifier.padding(16.dp), color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold) } }
                if (feedback.isNotBlank()) item { Text(feedback, color = SantaWine, style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}
