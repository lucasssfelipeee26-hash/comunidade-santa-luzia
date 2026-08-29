package br.com.comunidadesantaluzia.nativeapp.features.admin

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Publish
import androidx.compose.material.icons.rounded.Quiz
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.sync.SyncScheduler
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private data class AdminQuizQuestion(
    val id: String,
    val prompt: String,
    val optionA: String,
    val optionB: String,
    val optionC: String,
    val correct: Int,
    val points: String,
    val explanation: String,
)

private data class AdminQuiz(
    val id: String,
    val title: String,
    val description: String,
    val origin: String,
    val active: Boolean,
    val questions: List<AdminQuizQuestion>,
)

private data class AdminQuizState(
    val quizzes: List<AdminQuiz> = emptyList(),
    val loading: Boolean = true,
    val fromCache: Boolean = false,
    val error: String? = null,
)

private fun emptyQuestion(index: Int) = AdminQuizQuestion(
    id = "p-${index + 1}",
    prompt = "",
    optionA = "",
    optionB = "",
    optionC = "",
    correct = 0,
    points = "10",
    explanation = "",
)

private fun isQuizAdminOnline(context: Context): Boolean {
    val cm = context.getSystemService(ConnectivityManager::class.java) ?: return false
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}

private suspend fun loadAdminQuizzes(container: AppContainer): AdminQuizState =
    when (val result = container.repository.readLocalFirst("admin-quizzes", "/api/quizzes?admin=1", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val array = root.optJSONArray("quizzes") ?: JSONArray()
            val quizzes = buildList {
                repeat(array.length()) { index ->
                    val item = array.optJSONObject(index) ?: return@repeat
                    val questionsJson = item.optJSONArray("perguntas") ?: JSONArray()
                    val questions = buildList {
                        repeat(questionsJson.length()) { qIndex ->
                            val q = questionsJson.optJSONObject(qIndex) ?: return@repeat
                            val options = q.optJSONArray("opcoes") ?: JSONArray()
                            add(
                                AdminQuizQuestion(
                                    id = q.optString("id", "p-${qIndex + 1}"),
                                    prompt = q.optString("enunciado"),
                                    optionA = options.optString(0),
                                    optionB = options.optString(1),
                                    optionC = options.optString(2),
                                    correct = q.optInt("correta", 0).coerceIn(0, 2),
                                    points = q.optInt("pontos", 10).coerceIn(1, 100).toString(),
                                    explanation = q.optString("explicacao"),
                                ),
                            )
                        }
                    }
                    add(
                        AdminQuiz(
                            id = item.optString("id"),
                            title = item.optString("titulo"),
                            description = item.optString("descricao"),
                            origin = item.optString("origem", "manual"),
                            active = item.optBoolean("ativo"),
                            questions = questions,
                        ),
                    )
                }
            }
            AdminQuizState(quizzes = quizzes, loading = false, fromCache = result.fromCache)
        }.getOrElse { AdminQuizState(loading = false, error = "Os quizzes administrativos salvos estão em formato inválido.") }
        is RepositoryResult.Failure -> AdminQuizState(loading = false, error = result.message)
        is RepositoryResult.Queued -> AdminQuizState(loading = false, error = "A listagem de quizzes não deve entrar em fila.")
    }

@Composable
internal fun QuizAdminScreen(container: AppContainer, onBack: () -> Unit) {
    var state by remember { mutableStateOf(AdminQuizState()) }
    var editor by remember { mutableStateOf<AdminQuiz?>(null) }
    var creating by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<AdminQuiz?>(null) }
    var feedback by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    suspend fun refresh() {
        state = loadAdminQuizzes(container)
    }

    LaunchedEffect(Unit) { refresh() }

    if (creating || editor != null) {
        QuizEditor(
            initial = editor,
            working = working,
            feedback = feedback,
            onCancel = { creating = false; editor = null; feedback = "" },
            onSave = { title, description, active, questions ->
                if (!isQuizAdminOnline(context)) {
                    feedback = "Conecte o aparelho à internet para salvar ou publicar o Quiz avulso. O que você digitou foi mantido nesta tela."
                } else {
                    feedback = ""
                    working = true
                    scope.launch {
                        val payload = JSONObject().apply {
                            put("action", "salvar")
                            editor?.id?.takeIf { it.isNotBlank() }?.let { put("id", it) }
                            put("titulo", title)
                            put("descricao", description)
                            put("origem", editor?.origin?.takeIf { it != "liturgia" } ?: "manual")
                            put("ativo", active)
                            put("perguntas", JSONArray().apply {
                                questions.forEachIndexed { index, question ->
                                    put(JSONObject().apply {
                                        put("id", question.id.ifBlank { "p-${index + 1}" })
                                        put("enunciado", question.prompt)
                                        put("opcoes", JSONArray(listOf(question.optionA, question.optionB, question.optionC)))
                                        put("correta", question.correct)
                                        put("pontos", question.points.toIntOrNull()?.coerceIn(1, 100) ?: 10)
                                        if (question.explanation.isNotBlank()) put("explicacao", question.explanation)
                                    })
                                }
                            })
                        }.toString()
                        when (val result = container.repository.mutateOnlineOnly("POST", "/api/quizzes", payload)) {
                            is RepositoryResult.Success -> {
                                feedback = if (active) "Quiz avulso publicado. Os aparelhos conectados poderão baixá-lo e depois respondê-lo offline." else "Quiz salvo como rascunho/inativo."
                                creating = false
                                editor = null
                                refresh()
                                SyncScheduler.syncNow(container.appContext)
                            }
                            is RepositoryResult.Failure -> {
                                feedback = "${result.message} O conteúdo continua aberto para você tentar novamente."
                            }
                            is RepositoryResult.Queued -> feedback = "Publicação de Quiz avulso nunca entra na fila offline. O conteúdo continua aberto."
                        }
                        working = false
                    }
                }
            },
        )
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Rounded.ArrowBack, contentDescription = "Voltar") }
                Column(Modifier.weight(1f)) {
                    Text("Quizzes avulsos", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("Criação e publicação exigem internet. Depois de baixado, o quiz pode ser respondido offline.", style = MaterialTheme.typography.bodySmall)
                }
            }
            if (state.fromCache) {
                AssistChip(
                    onClick = {},
                    label = { Text("Lista administrativa salva · offline") },
                    leadingIcon = { Icon(Icons.Rounded.WifiOff, null) },
                )
            }
            if (feedback.isNotBlank()) Text(feedback, Modifier.padding(top = 6.dp), color = SantaWine, style = MaterialTheme.typography.bodySmall)
        }

        item {
            Button(
                onClick = {
                    if (!isQuizAdminOnline(context)) feedback = "Conecte o aparelho à internet para criar um novo Quiz avulso."
                    else {
                        feedback = ""
                        creating = true
                    }
                },
                enabled = !working,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Rounded.Add, null)
                Text(" Novo Quiz avulso")
            }
        }

        when {
            state.loading -> item {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
            state.error != null -> item {
                Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) }
            }
            state.quizzes.filterNot { it.origin == "liturgia" }.isEmpty() -> item {
                Card { Text("Nenhum Quiz avulso cadastrado.", Modifier.padding(18.dp)) }
            }
            else -> {
                val standalone = state.quizzes.filterNot { it.origin == "liturgia" }
                itemsIndexed(standalone, key = { _, item -> item.id }) { _, quiz ->
                    Card(shape = RoundedCornerShape(20.dp)) {
                        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(quiz.title, color = SantaWine, fontWeight = FontWeight.Bold)
                                    Text("${quiz.questions.size} pergunta(s) · ${if (quiz.active) "Publicado" else "Inativo"}", style = MaterialTheme.typography.bodySmall)
                                }
                                Icon(if (quiz.active) Icons.Rounded.CheckCircle else Icons.Rounded.Quiz, null, tint = SantaWine)
                            }
                            if (quiz.description.isNotBlank()) Text(quiz.description, style = MaterialTheme.typography.bodySmall)
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(
                                    onClick = {
                                        if (!isQuizAdminOnline(context)) feedback = "Conecte o aparelho à internet para editar um Quiz avulso."
                                        else {
                                            feedback = ""
                                            editor = quiz
                                        }
                                    },
                                    enabled = !working,
                                    modifier = Modifier.weight(1f),
                                ) { Icon(Icons.Rounded.Edit, null); Text(" Editar") }
                                OutlinedButton(
                                    onClick = {
                                        if (!isQuizAdminOnline(context)) feedback = "Conecte o aparelho à internet para excluir um Quiz avulso."
                                        else deleteTarget = quiz
                                    },
                                    enabled = !working,
                                    modifier = Modifier.weight(1f),
                                ) { Icon(Icons.Rounded.DeleteForever, null); Text(" Excluir") }
                            }
                        }
                    }
                }
            }
        }
    }

    deleteTarget?.let { quiz ->
        AlertDialog(
            onDismissRequest = { if (!working) deleteTarget = null },
            title = { Text("Excluir ${quiz.title}?") },
            text = { Text("A exclusão exige internet e não será guardada para envio posterior.") },
            confirmButton = {
                Button(enabled = !working, onClick = {
                    if (!isQuizAdminOnline(context)) {
                        feedback = "Conecte o aparelho à internet para excluir o Quiz avulso."
                        deleteTarget = null
                        return@Button
                    }
                    working = true
                    scope.launch {
                        val payload = JSONObject().put("action", "excluir").put("id", quiz.id).toString()
                        when (val result = container.repository.mutateOnlineOnly("POST", "/api/quizzes", payload)) {
                            is RepositoryResult.Success -> { feedback = "Quiz excluído."; deleteTarget = null; refresh() }
                            is RepositoryResult.Failure -> feedback = result.message
                            is RepositoryResult.Queued -> feedback = "Exclusão de quiz nunca entra na fila offline."
                        }
                        working = false
                    }
                }) { Text("Excluir") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun QuizEditor(
    initial: AdminQuiz?,
    working: Boolean,
    feedback: String,
    onCancel: () -> Unit,
    onSave: (String, String, Boolean, List<AdminQuizQuestion>) -> Unit,
) {
    var title by remember(initial?.id) { mutableStateOf(initial?.title.orEmpty()) }
    var description by remember(initial?.id) { mutableStateOf(initial?.description.orEmpty()) }
    var active by remember(initial?.id) { mutableStateOf(initial?.active ?: true) }
    var questions by remember(initial?.id) { mutableStateOf(initial?.questions?.takeIf { it.isNotEmpty() } ?: listOf(emptyQuestion(0))) }
    var validation by remember(initial?.id) { mutableStateOf("") }
    val context = LocalContext.current

    fun updateQuestion(index: Int, transform: (AdminQuizQuestion) -> AdminQuizQuestion) {
        questions = questions.toMutableList().also { list -> list[index] = transform(list[index]) }
    }

    val valid = title.trim().length >= 3 && questions.isNotEmpty() && questions.all {
        it.prompt.trim().length >= 3 && it.optionA.isNotBlank() && it.optionB.isNotBlank() && it.optionC.isNotBlank() &&
            (it.points.toIntOrNull() ?: 0) in 1..100
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onCancel, enabled = !working) { Icon(Icons.Rounded.ArrowBack, contentDescription = "Voltar") }
                Column {
                    Text(if (initial == null) "Novo Quiz avulso" else "Editar Quiz avulso", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("O servidor só receberá esta alteração se houver conexão.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (feedback.isNotBlank()) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) {
                    Text(feedback, Modifier.fillMaxWidth().padding(12.dp), color = SantaWine, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .12f))) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(title, { title = it.take(180) }, label = { Text("Título") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(description, { description = it.take(1200) }, label = { Text("Descrição") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = active, onCheckedChange = { active = it })
                        Column {
                            Text(if (active) "Publicar ao salvar" else "Salvar inativo", fontWeight = FontWeight.SemiBold)
                            Text(if (active) "Os membros conectados serão notificados." else "O quiz não aparecerá para os membros.", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }

        itemsIndexed(questions, key = { index, question -> "${question.id}-$index" }) { index, question ->
            Card(shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Pergunta ${index + 1}", color = SantaWine, fontWeight = FontWeight.Bold)
                        if (questions.size > 1) {
                            TextButton(onClick = { questions = questions.toMutableList().also { it.removeAt(index) } }, enabled = !working) { Text("Remover") }
                        }
                    }
                    OutlinedTextField(question.prompt, { value -> updateQuestion(index) { it.copy(prompt = value.take(800)) } }, label = { Text("Enunciado") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                    OutlinedTextField(question.optionA, { value -> updateQuestion(index) { it.copy(optionA = value.take(500)) } }, label = { Text("Alternativa A") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(question.optionB, { value -> updateQuestion(index) { it.copy(optionB = value.take(500)) } }, label = { Text("Alternativa B") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(question.optionC, { value -> updateQuestion(index) { it.copy(optionC = value.take(500)) } }, label = { Text("Alternativa C") }, modifier = Modifier.fillMaxWidth())
                    Text("Resposta correta", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        listOf("A", "B", "C").forEachIndexed { optionIndex, label ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(selected = question.correct == optionIndex, onClick = { updateQuestion(index) { it.copy(correct = optionIndex) } })
                                Text(label)
                            }
                        }
                    }
                    OutlinedTextField(question.points, { value -> updateQuestion(index) { it.copy(points = value.filter(Char::isDigit).take(3)) } }, label = { Text("Pontos (1 a 100)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(question.explanation, { value -> updateQuestion(index) { it.copy(explanation = value.take(1000)) } }, label = { Text("Explicação após resposta (opcional)") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                }
            }
        }

        item {
            OutlinedButton(
                onClick = { if (questions.size < 30) questions = questions + emptyQuestion(questions.size) },
                enabled = !working && questions.size < 30,
                modifier = Modifier.fillMaxWidth(),
            ) { Icon(Icons.Rounded.Add, null); Text(" Adicionar pergunta") }
        }

        if (validation.isNotBlank()) item { Text(validation, color = MaterialTheme.colorScheme.error) }

        item {
            Button(
                enabled = !working,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    validation = when {
                        !valid -> "Preencha o título e todas as perguntas com três alternativas e pontos entre 1 e 100."
                        !isQuizAdminOnline(context) -> "Conecte o aparelho à internet para publicar. O conteúdo digitado continuará nesta tela."
                        else -> ""
                    }
                    if (validation.isBlank()) onSave(title.trim(), description.trim(), active, questions)
                },
            ) {
                if (working) CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp))
                Icon(Icons.Rounded.Publish, null)
                Text(if (active) " Publicar Quiz" else " Salvar inativo")
            }
        }
    }
}
