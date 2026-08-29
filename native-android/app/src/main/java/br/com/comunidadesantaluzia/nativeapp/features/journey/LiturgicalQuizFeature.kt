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
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgicalReadingProgress
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlin.math.ceil
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private data class LiturgicalQuizQuestion(
    val id: String,
    val prompt: String,
    val options: List<String>,
    val points: Int,
)

private data class LiturgicalQuizAttempt(
    val token: String,
    val title: String,
    val description: String,
    val expiresAt: Long,
    val durationSeconds: Int,
    val questions: List<LiturgicalQuizQuestion>,
)

private data class LiturgicalQuizCompleted(
    val hits: Int,
    val points: Int,
    val totalPoints: Int,
)

private sealed interface LiturgicalQuizLoad {
    data class Attempt(val value: LiturgicalQuizAttempt) : LiturgicalQuizLoad
    data class Completed(val value: LiturgicalQuizCompleted) : LiturgicalQuizLoad
    data class Failure(val message: String) : LiturgicalQuizLoad
}

private fun parseCompleted(json: JSONObject?): LiturgicalQuizCompleted {
    val item = json ?: JSONObject()
    return LiturgicalQuizCompleted(
        hits = item.optInt("acertos"),
        points = item.optInt("pontos"),
        totalPoints = item.optInt("total_pontos", item.optInt("totalPontos")),
    )
}

private suspend fun loadLiturgicalQuiz(container: AppContainer): LiturgicalQuizLoad = runCatching {
    val response = container.httpClient.request("GET", "/api/quizzes/liturgia", authenticated = true)
    val root = JSONObject(response.body.ifBlank { "{}" })
    if (!response.successful) {
        return@runCatching LiturgicalQuizLoad.Failure(
            root.optString("erro").ifBlank { "Não foi possível gerar o Quiz da Liturgia agora." },
        )
    }
    if (root.optBoolean("respondido")) {
        return@runCatching LiturgicalQuizLoad.Completed(parseCompleted(root.optJSONObject("resultado")))
    }

    val quiz = root.optJSONObject("quiz")
        ?: return@runCatching LiturgicalQuizLoad.Failure("O servidor não enviou uma tentativa válida do Quiz da Liturgia.")
    val questionsJson = quiz.optJSONArray("perguntas") ?: JSONArray()
    val questions = buildList {
        repeat(questionsJson.length()) { index ->
            val item = questionsJson.optJSONObject(index) ?: return@repeat
            val optionsJson = item.optJSONArray("opcoes") ?: JSONArray()
            add(
                LiturgicalQuizQuestion(
                    id = item.optString("id"),
                    prompt = item.optString("enunciado"),
                    options = List(optionsJson.length()) { optionsJson.optString(it) },
                    points = item.optInt("pontos"),
                ),
            )
        }
    }
    if (quiz.optString("token").isBlank() || questions.isEmpty()) {
        return@runCatching LiturgicalQuizLoad.Failure("A tentativa recebida está incompleta. Tente abrir o quiz novamente.")
    }
    LiturgicalQuizLoad.Attempt(
        LiturgicalQuizAttempt(
            token = quiz.optString("token"),
            title = quiz.optString("titulo", "Quiz da Liturgia de Hoje"),
            description = quiz.optString("descricao"),
            expiresAt = quiz.optLong("expiraEm"),
            durationSeconds = quiz.optInt("duracaoSegundos", 90),
            questions = questions,
        ),
    )
}.getOrElse {
    LiturgicalQuizLoad.Failure("Sem conexão para iniciar o quiz cronometrado. A Liturgia continua disponível offline.")
}

@Composable
internal fun LiturgicalQuizPanel(
    container: AppContainer,
    onOpenLiturgy: () -> Unit,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val readUnlocked = remember {
        LiturgicalReadingProgress.isRead(container.appContext, LiturgicalReadingProgress.todayCuiaba())
    }
    var attempt by remember { mutableStateOf<LiturgicalQuizAttempt?>(null) }
    var completed by remember { mutableStateOf<LiturgicalQuizCompleted?>(null) }
    var answers by remember { mutableStateOf<List<Int>>(emptyList()) }
    var remaining by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(readUnlocked) }
    var submitting by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var reloadKey by remember { mutableIntStateOf(0) }
    var invalidatedByLeaving by remember { mutableStateOf(false) }

    fun requestNewAttempt(reason: String = "") {
        attempt = null
        answers = emptyList()
        if (reason.isNotBlank()) message = reason
        reloadKey += 1
    }

    LaunchedEffect(readUnlocked, reloadKey) {
        if (!readUnlocked) {
            loading = false
            return@LaunchedEffect
        }
        loading = true
        error = ""
        when (val result = loadLiturgicalQuiz(container)) {
            is LiturgicalQuizLoad.Attempt -> {
                completed = null
                attempt = result.value
                answers = List(result.value.questions.size) { -1 }
                remaining = maxOf(
                    0,
                    ceil((result.value.expiresAt - System.currentTimeMillis()) / 1000.0).toInt(),
                )
            }

            is LiturgicalQuizLoad.Completed -> {
                attempt = null
                answers = emptyList()
                completed = result.value
            }

            is LiturgicalQuizLoad.Failure -> {
                attempt = null
                error = result.message
            }
        }
        loading = false
    }

    LaunchedEffect(attempt?.token) {
        val active = attempt ?: return@LaunchedEffect
        while (attempt?.token == active.token) {
            val seconds = maxOf(0, ceil((active.expiresAt - System.currentTimeMillis()) / 1000.0).toInt())
            remaining = seconds
            if (seconds <= 0) {
                requestNewAttempt("O tempo terminou. Uma nova tentativa foi gerada automaticamente.")
                break
            }
            delay(500)
        }
    }

    DisposableEffect(lifecycleOwner, readUnlocked, completed) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_STOP -> {
                    if (readUnlocked && attempt != null && completed == null) {
                        attempt = null
                        answers = emptyList()
                        invalidatedByLeaving = true
                    }
                }

                Lifecycle.Event.ON_START -> {
                    if (readUnlocked && invalidatedByLeaving && completed == null) {
                        invalidatedByLeaving = false
                        requestNewAttempt("Você saiu durante a tentativa. Um novo quiz foi gerado.")
                    }
                }

                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (message.isNotBlank()) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) {
                    Text(message, Modifier.padding(12.dp), color = SantaWine)
                }
            }
        }
        if (error.isNotBlank()) {
            item {
                Card {
                    Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(error, color = MaterialTheme.colorScheme.error)
                        if (readUnlocked) {
                            Button(onClick = { requestNewAttempt() }, modifier = Modifier.fillMaxWidth()) {
                                Text("Tentar novamente")
                            }
                        }
                    }
                }
            }
        }

        if (!readUnlocked) {
            item {
                Card(shape = RoundedCornerShape(22.dp)) {
                    Column(
                        Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(9.dp),
                    ) {
                        Icon(Icons.Rounded.AutoStories, null, tint = SantaWine)
                        Text(
                            "Leia a Liturgia de hoje",
                            style = MaterialTheme.typography.titleLarge,
                            color = SantaWine,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Ao concluir a leitura da Liturgia Diária, o Quiz Litúrgico cronometrado é liberado.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Button(onClick = onOpenLiturgy, modifier = Modifier.fillMaxWidth()) {
                            Text("Abrir Liturgia Diária")
                        }
                    }
                }
            }
        } else if (loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(42.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        } else {
            completed?.let { result ->
                item {
                    Card(
                        shape = RoundedCornerShape(22.dp),
                        colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f)),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(7.dp),
                        ) {
                            Icon(Icons.Rounded.CheckCircle, null, tint = SantaWine)
                            Text("Quiz de hoje concluído", color = SantaWine, fontWeight = FontWeight.Bold)
                            Text("${result.hits} acerto(s) · ${result.points} ponto(s)")
                            if (result.totalPoints > 0) {
                                Text("Total possível: ${result.totalPoints}", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }

            attempt?.let { active ->
                item {
                    Card(shape = RoundedCornerShape(22.dp)) {
                        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(active.title, color = SantaWine, fontWeight = FontWeight.Bold)
                                    if (active.description.isNotBlank()) {
                                        Text(active.description, style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                                AssistChip(
                                    onClick = {},
                                    label = { Text("%02d:%02d".format(remaining / 60, remaining % 60)) },
                                    leadingIcon = { Icon(Icons.Rounded.Timer, null) },
                                )
                            }
                            Text(
                                "A tentativa é validada pelo servidor e não é colocada na fila offline.",
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    }
                }

                itemsIndexed(active.questions, key = { _, question -> question.id }) { index, question ->
                    Card(shape = RoundedCornerShape(18.dp)) {
                        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text("${index + 1}. ${question.prompt}", fontWeight = FontWeight.Bold)
                            question.options.forEachIndexed { optionIndex, option ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    RadioButton(
                                        selected = answers.getOrNull(index) == optionIndex,
                                        onClick = {
                                            val updated = answers.toMutableList()
                                            if (index in updated.indices) {
                                                updated[index] = optionIndex
                                                answers = updated
                                            }
                                        },
                                    )
                                    Text(option)
                                }
                            }
                        }
                    }
                }

                item {
                    Button(
                        enabled = !submitting && remaining > 0 && answers.size == active.questions.size && answers.all { it >= 0 },
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            submitting = true
                            error = ""
                            scope.launch {
                                val payload = JSONObject()
                                    .put("token", active.token)
                                    .put("respostas", JSONArray(answers))
                                    .toString()
                                when (
                                    val result = container.repository.mutateOnlineOnly(
                                        "POST",
                                        "/api/quizzes/liturgia/responder",
                                        payload,
                                    )
                                ) {
                                    is RepositoryResult.Success -> {
                                        val root = runCatching { JSONObject(result.value) }.getOrNull()
                                        val outcome = parseCompleted(root?.optJSONObject("resultado"))
                                        completed = outcome
                                        attempt = null
                                        answers = emptyList()
                                        message = "Quiz concluído: ${outcome.hits} acerto(s) e ${outcome.points} ponto(s)."
                                    }

                                    is RepositoryResult.Failure -> {
                                        error = result.message
                                        requestNewAttempt()
                                    }

                                    is RepositoryResult.Queued -> {
                                        // mutateOnlineOnly nunca retorna fila; este ramo mantém o when exaustivo.
                                        error = "O quiz cronometrado não pode ser enviado pela fila offline."
                                        requestNewAttempt()
                                    }
                                }
                                submitting = false
                            }
                        },
                    ) {
                        if (submitting) {
                            CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp))
                        }
                        Text("Enviar respostas")
                    }
                }
            }
        }

        if (readUnlocked && !loading && attempt == null && completed == null && error.isBlank()) {
            item {
                AssistChip(
                    onClick = { requestNewAttempt() },
                    label = { Text("Gerar tentativa") },
                    leadingIcon = { Icon(Icons.Rounded.WifiOff, null) },
                )
            }
        }
    }
}
