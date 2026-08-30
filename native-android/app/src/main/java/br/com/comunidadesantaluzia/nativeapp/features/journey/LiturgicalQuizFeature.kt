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
import androidx.compose.material.icons.rounded.CloudDone
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
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyDay
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.io.IOException
import java.util.UUID
import kotlin.math.ceil
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private data class LiturgicalQuizQuestion(
    val id: String,
    val prompt: String,
    val options: List<String>,
    val points: Int,
    val correctIndex: Int? = null,
)

private data class LiturgicalQuizAttempt(
    val token: String,
    val title: String,
    val description: String,
    val expiresAt: Long,
    val durationSeconds: Int,
    val questions: List<LiturgicalQuizQuestion>,
    val offline: Boolean = false,
    val dateIso: String? = null,
    val userId: String? = null,
)

private data class LiturgicalQuizCompleted(
    val hits: Int,
    val points: Int,
    val totalPoints: Int,
    val offlinePending: Boolean = false,
)

private sealed interface LiturgicalQuizLoad {
    data class Attempt(val value: LiturgicalQuizAttempt) : LiturgicalQuizLoad
    data class Completed(val value: LiturgicalQuizCompleted) : LiturgicalQuizLoad
    data class Failure(val message: String) : LiturgicalQuizLoad
}

private data class GeneratedOptions(val values: List<String>, val correct: Int)

private fun parseCompleted(json: JSONObject?): LiturgicalQuizCompleted {
    val item = json ?: JSONObject()
    return LiturgicalQuizCompleted(
        hits = item.optInt("acertos", item.optInt("hits")),
        points = item.optInt("pontos", item.optInt("points")),
        totalPoints = item.optInt("total_pontos", item.optInt("totalPontos")),
        offlinePending = item.optBoolean("offline_pendente", item.optBoolean("offlinePending")),
    )
}

private fun completedCacheKey(userId: String, dateIso: String) = "quiz-liturgia:done:$userId:$dateIso"

private fun buildOptions(correct: String, others: List<String>, rotate: Int): GeneratedOptions {
    val base = mutableListOf(correct)
    others.filter { it.isNotBlank() && it != correct }.forEach { option ->
        if (base.size < 3 && option !in base) base += option
    }
    while (base.size < 3) {
        base += if (base.size == 1) "Não consta na Liturgia de hoje" else "Outra referência"
    }
    val amount = ((rotate % 3) + 3) % 3
    val values = base.drop(amount) + base.take(amount)
    return GeneratedOptions(values, values.indexOf(correct))
}

private fun generateOfflineQuestions(day: LiturgyDay): List<LiturgicalQuizQuestion> {
    val first = day.firstReading.firstOrNull()
    val psalm = day.psalm.firstOrNull()
    val second = day.secondReading.firstOrNull()
    val gospel = day.gospel.firstOrNull()
    val references = listOfNotNull(
        first?.reference?.takeIf { it.isNotBlank() },
        psalm?.reference?.takeIf { it.isNotBlank() },
        second?.reference?.takeIf { it.isNotBlank() },
        gospel?.reference?.takeIf { it.isNotBlank() },
    )
    return buildList {
        first?.reference?.takeIf { it.isNotBlank() }?.let { correct ->
            val options = buildOptions(correct, references.filter { it != correct }, 1)
            add(LiturgicalQuizQuestion("lit-1", "Qual é a referência da Primeira Leitura da Liturgia de hoje?", options.values, 10, options.correct))
        }
        psalm?.reference?.takeIf { it.isNotBlank() }?.let { correct ->
            val options = buildOptions(correct, references.filter { it != correct }, 2)
            add(LiturgicalQuizQuestion("lit-2", "Qual é a referência do Salmo Responsorial de hoje?", options.values, 10, options.correct))
        }
        psalm?.refrain?.takeIf { it.isNotBlank() }?.let { correct ->
            val options = buildOptions(correct, listOf("O Senhor é meu pastor e nada me faltará.", "Provai e vede como o Senhor é bom."), 1)
            add(LiturgicalQuizQuestion("lit-3", "Qual é o refrão do Salmo Responsorial apresentado na Liturgia de hoje?", options.values, 15, options.correct))
        }
        gospel?.reference?.takeIf { it.isNotBlank() }?.let { correct ->
            val options = buildOptions(correct, references.filter { it != correct }, 0)
            add(LiturgicalQuizQuestion("lit-4", "Qual é a referência do Evangelho proclamado hoje?", options.values, 15, options.correct))
        }
        day.liturgicalPeriod.takeIf { it.isNotBlank() }?.let { correct ->
            val options = buildOptions(correct, listOf("Tempo do Advento", "Tempo Pascal"), 2)
            add(LiturgicalQuizQuestion("lit-5", "Em qual período litúrgico está inserida a celebração de hoje?", options.values, 10, options.correct))
        }
    }
}

private suspend fun buildOfflineLiturgicalQuiz(container: AppContainer): LiturgicalQuizLoad {
    val session = container.sessionStore.session.first()
    val userId = session.userId?.takeIf { session.loggedIn && it.isNotBlank() }
        ?: return LiturgicalQuizLoad.Failure("Faça o primeiro login com internet antes de usar o Quiz offline.")
    val date = LiturgicalReadingProgress.todayCuiaba()
    val dateIso = date.toString()
    container.database.getDocument(completedCacheKey(userId, dateIso))?.let { cached ->
        val root = runCatching { JSONObject(cached.payload) }.getOrNull()
        if (root != null) return LiturgicalQuizLoad.Completed(parseCompleted(root))
    }
    val day = container.liturgy.day(date)
        ?: return LiturgicalQuizLoad.Failure("A Liturgia local desta data ainda não está disponível para montar o Quiz offline.")
    val questions = generateOfflineQuestions(day)
    if (questions.size < 3) {
        return LiturgicalQuizLoad.Failure("A Liturgia local não possui dados suficientes para montar o Quiz de hoje.")
    }
    val duration = 90
    return LiturgicalQuizLoad.Attempt(
        LiturgicalQuizAttempt(
            token = "offline-liturgia-$dateIso-${UUID.randomUUID()}",
            title = "Quiz da Liturgia de Hoje",
            description = "Perguntas geradas no aparelho a partir da mesma Liturgia Diária disponível offline.",
            expiresAt = System.currentTimeMillis() + duration * 1_000L,
            durationSeconds = duration,
            questions = questions,
            offline = true,
            dateIso = dateIso,
            userId = userId,
        ),
    )
}

private suspend fun loadLiturgicalQuiz(container: AppContainer): LiturgicalQuizLoad {
    return try {
        val response = container.httpClient.request("GET", "/api/quizzes/liturgia", authenticated = true)
        if (!response.successful && (response.status >= 500 || response.status == 408 || response.status == 429)) {
            return buildOfflineLiturgicalQuiz(container)
        }
        val root = JSONObject(response.body.ifBlank { "{}" })
        if (!response.successful) {
            return LiturgicalQuizLoad.Failure(
                root.optString("erro").ifBlank { "Não foi possível gerar o Quiz da Liturgia agora." },
            )
        }
        if (root.optBoolean("respondido")) {
            return LiturgicalQuizLoad.Completed(parseCompleted(root.optJSONObject("resultado")))
        }

        val quiz = root.optJSONObject("quiz")
            ?: return LiturgicalQuizLoad.Failure("O servidor não enviou uma tentativa válida do Quiz da Liturgia.")
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
            return LiturgicalQuizLoad.Failure("A tentativa recebida está incompleta. Tente abrir o quiz novamente.")
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
    } catch (_: IOException) {
        buildOfflineLiturgicalQuiz(container)
    } catch (error: Exception) {
        val offline = runCatching { buildOfflineLiturgicalQuiz(container) }.getOrNull()
        offline ?: LiturgicalQuizLoad.Failure(error.message ?: "Não foi possível gerar o Quiz da Liturgia.")
    }
}

private fun calculateOfflineResult(attempt: LiturgicalQuizAttempt, answers: List<Int>): LiturgicalQuizCompleted? {
    if (!attempt.offline || answers.size != attempt.questions.size) return null
    if (answers.any { it < 0 }) return null
    var hits = 0
    var points = 0
    var total = 0
    attempt.questions.forEachIndexed { index, question ->
        val correct = question.correctIndex ?: return null
        if (answers[index] !in question.options.indices) return null
        total += question.points
        if (answers[index] == correct) {
            hits += 1
            points += question.points
        }
    }
    return LiturgicalQuizCompleted(hits, points, total, offlinePending = true)
}

private fun saveOfflineCompletion(container: AppContainer, userId: String, dateIso: String, result: LiturgicalQuizCompleted) {
    val payload = JSONObject()
        .put("acertos", result.hits)
        .put("pontos", result.points)
        .put("total_pontos", result.totalPoints)
        .put("offline_pendente", result.offlinePending)
        .toString()
    container.database.putDocument(completedCacheKey(userId, dateIso), payload)
    applyRankingOptimism(container, userId, result)
}

private fun applyRankingOptimism(container: AppContainer, userId: String, result: LiturgicalQuizCompleted) {
    val rankingKey = "user:$userId:ranking"
    val cached = container.database.getDocument(rankingKey) ?: return
    val root = runCatching { JSONObject(cached.payload) }.getOrNull() ?: return
    val array = root.optJSONArray("ranking") ?: return
    val rows = buildList {
        repeat(array.length()) { index ->
            val row = array.optJSONObject(index) ?: return@repeat
            if (row.optString("usuarioId") == userId) {
                row.put("pontos", row.optInt("pontos") + result.points)
                row.put("quizzesRespondidos", row.optInt("quizzesRespondidos") + 1)
                row.put("acertos", row.optInt("acertos") + result.hits)
                row.put("offline_pendente", true)
            }
            add(row)
        }
    }.sortedByDescending { it.optInt("pontos") }
    val next = JSONArray()
    rows.forEachIndexed { index, row ->
        row.put("posicao", index + 1)
        next.put(row)
    }
    root.put("ranking", next)
    container.database.putDocument(rankingKey, root.toString(), updatedAt = cached.updatedAt)
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
        error = ""
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
                remaining = maxOf(0, ceil((result.value.expiresAt - System.currentTimeMillis()) / 1000.0).toInt())
                if (result.value.offline) {
                    message = "Sem conexão: o quiz foi gerado no aparelho e será sincronizado quando a internet voltar."
                }
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
                            Button(onClick = { requestNewAttempt() }, modifier = Modifier.fillMaxWidth()) { Text("Tentar novamente") }
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
                        Text("Leia a Liturgia de hoje", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                        Text("Ao concluir a leitura da Liturgia Diária, o Quiz Litúrgico cronometrado é liberado.", style = MaterialTheme.typography.bodySmall)
                        Button(onClick = onOpenLiturgy, modifier = Modifier.fillMaxWidth()) { Text("Abrir Liturgia Diária") }
                    }
                }
            }
        } else if (loading) {
            item { Box(Modifier.fillMaxWidth().padding(42.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
        } else {
            completed?.let { result ->
                item {
                    Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) {
                        Column(
                            Modifier.fillMaxWidth().padding(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(7.dp),
                        ) {
                            Icon(if (result.offlinePending) Icons.Rounded.WifiOff else Icons.Rounded.CheckCircle, null, tint = SantaWine)
                            Text("Quiz de hoje concluído", color = SantaWine, fontWeight = FontWeight.Bold)
                            Text("${result.hits} acerto(s) · ${result.points} ponto(s)")
                            if (result.totalPoints > 0) Text("Total possível: ${result.totalPoints}", style = MaterialTheme.typography.labelSmall)
                            if (result.offlinePending) Text("Resultado salvo no aparelho · sincronização pendente", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            attempt?.let { active ->
                item {
                    Card(shape = RoundedCornerShape(22.dp)) {
                        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(active.title, color = SantaWine, fontWeight = FontWeight.Bold)
                                    if (active.description.isNotBlank()) Text(active.description, style = MaterialTheme.typography.bodySmall)
                                }
                                AssistChip(
                                    onClick = {},
                                    label = { Text("%02d:%02d".format(remaining / 60, remaining % 60)) },
                                    leadingIcon = { Icon(Icons.Rounded.Timer, null) },
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(if (active.offline) Icons.Rounded.WifiOff else Icons.Rounded.CloudDone, null, tint = SantaWine)
                                Text(
                                    if (active.offline) "Tentativa local segura; o servidor validará a mesma data na sincronização."
                                    else "Tentativa online validada pelo servidor.",
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
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
                                if (active.offline) {
                                    val localOutcome = calculateOfflineResult(active, answers)
                                    val dateIso = active.dateIso
                                    val userId = active.userId
                                    if (localOutcome == null || dateIso.isNullOrBlank() || userId.isNullOrBlank()) {
                                        error = "A tentativa offline ficou inválida. Gere uma nova tentativa."
                                        requestNewAttempt()
                                    } else {
                                        val clientRequestId = "quiz-liturgia-${UUID.randomUUID()}"
                                        val payload = JSONObject()
                                            .put("dataIso", dateIso)
                                            .put("respostas", JSONArray(answers))
                                            .put("clientRequestId", clientRequestId)
                                            .toString()
                                        when (val sync = container.repository.mutate("POST", "/api/quizzes/liturgia/offline", payload)) {
                                            is RepositoryResult.Success -> {
                                                val root = runCatching { JSONObject(sync.value) }.getOrNull()
                                                val serverOutcome = root?.optJSONObject("resultado")?.let(::parseCompleted)
                                                val outcome = serverOutcome ?: localOutcome.copy(offlinePending = false)
                                                saveOfflineCompletion(container, userId, dateIso, outcome.copy(offlinePending = false))
                                                completed = outcome.copy(offlinePending = false)
                                                message = "Quiz concluído e sincronizado: ${outcome.hits} acerto(s) e ${outcome.points} ponto(s)."
                                            }
                                            is RepositoryResult.Queued -> {
                                                saveOfflineCompletion(container, userId, dateIso, localOutcome)
                                                completed = localOutcome
                                                message = "Quiz concluído no aparelho. A pontuação será confirmada automaticamente quando a internet voltar."
                                            }
                                            is RepositoryResult.Failure -> error = sync.message
                                        }
                                        if (error.isBlank()) {
                                            attempt = null
                                            answers = emptyList()
                                        }
                                    }
                                } else {
                                    val payload = JSONObject().put("token", active.token).put("respostas", JSONArray(answers)).toString()
                                    when (val result = container.repository.mutateOnlineOnly("POST", "/api/quizzes/liturgia/responder", payload)) {
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
                                            error = "A tentativa online usa token temporário e não pode ser reenviada depois."
                                            requestNewAttempt()
                                        }
                                    }
                                }
                                submitting = false
                            }
                        },
                    ) {
                        if (submitting) CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp))
                        Text(if (active.offline) "Concluir e sincronizar" else "Enviar respostas")
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
