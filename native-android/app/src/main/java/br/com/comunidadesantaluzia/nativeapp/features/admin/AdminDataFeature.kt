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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.Quiz
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material.icons.rounded.Upgrade
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class AdminMember(val id: String, val name: String, val username: String, val email: String, val role: String, val status: String)
data class AdminRankingLine(val userId: String, val name: String, val points: Int, val position: Int)
data class AdminDataState(
    val year: Int = 0,
    val members: List<AdminMember> = emptyList(),
    val ranking: List<AdminRankingLine> = emptyList(),
    val loading: Boolean = true,
    val fromCache: Boolean = false,
    val error: String? = null,
)

internal suspend fun loadAdminData(container: AppContainer): AdminDataState = when (val result = container.repository.readLocalFirst("admin-dados", "/api/app/admin-dados", authenticated = true)) {
    is RepositoryResult.Success -> runCatching {
        val root = JSONObject(result.value)
        val membersArray = root.optJSONArray("cadastros") ?: JSONArray()
        val rankingArray = root.optJSONArray("ranking") ?: JSONArray()
        val members = buildList { repeat(membersArray.length()) { index -> val i = membersArray.optJSONObject(index) ?: return@repeat; add(AdminMember(i.optString("id"), i.optString("nome"), i.optString("usuario"), i.optString("email"), i.optString("funcao"), i.optString("status"))) } }
        val ranking = buildList { repeat(rankingArray.length()) { index -> val i = rankingArray.optJSONObject(index) ?: return@repeat; add(AdminRankingLine(i.optString("usuarioId"), i.optString("nome"), i.optInt("pontos"), i.optInt("posicao"))) } }
        AdminDataState(root.optInt("ano"), members, ranking, loading = false, fromCache = result.fromCache)
    }.getOrElse { AdminDataState(loading = false, error = "Os dados administrativos salvos estão em formato inválido.") }
    is RepositoryResult.Failure -> AdminDataState(loading = false, error = result.message)
    is RepositoryResult.Queued -> AdminDataState(loading = false, error = "A leitura administrativa não deve entrar em fila.")
}

private fun isOnline(context: Context): Boolean {
    val cm = context.getSystemService(ConnectivityManager::class.java) ?: return false
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}

@Composable
internal fun AdminDataScreen(container: AppContainer) {
    var showQuizAdmin by remember { mutableStateOf(false) }
    if (showQuizAdmin) {
        QuizAdminScreen(container = container, onBack = { showQuizAdmin = false })
        return
    }

    var state by remember { mutableStateOf(AdminDataState()) }
    var deleteTarget by remember { mutableStateOf<AdminMember?>(null) }
    var promoteTarget by remember { mutableStateOf<AdminMember?>(null) }
    var resetOpen by remember { mutableStateOf(false) }
    var confirmation by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    suspend fun refresh() {
        state = loadAdminData(container)
    }

    suspend fun changeStatus(member: AdminMember, status: String) {
        working = true
        val payload = JSONObject().put("status", status).toString()
        when (val result = container.repository.mutateOnlineOnly("PATCH", "/api/membros/${member.id}/status", payload)) {
            is RepositoryResult.Success -> {
                feedback = if (status == "aprovado") "${member.name} foi aprovado." else "Cadastro de ${member.name} recusado."
                refresh()
            }
            is RepositoryResult.Failure -> feedback = result.message
            is RepositoryResult.Queued -> feedback = "Mudanças de status precisam ser confirmadas online."
        }
        working = false
    }

    LaunchedEffect(Unit) { state = loadAdminData(container) }

    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Rounded.Security, null, tint = SantaWine)
                Column { Text("Administração de dados", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold); Text("Área exclusiva da moderação", style = MaterialTheme.typography.bodySmall) }
            }
            if (state.fromCache) Text("Visualizando a última cópia administrativa salva neste aparelho.", Modifier.padding(top = 6.dp), style = MaterialTheme.typography.labelSmall)
            if (feedback.isNotBlank()) Text(feedback, Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall, color = SantaWine)
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f)), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.Quiz, null, tint = SantaWine)
                        Column {
                            Text("Quizzes avulsos", color = SantaWine, fontWeight = FontWeight.Bold)
                            Text("Criar, editar, publicar ou excluir. Publicação exige internet.", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Button(onClick = { showQuizAdmin = true }, modifier = Modifier.fillMaxWidth()) { Text("Gerenciar quizzes avulsos") }
                }
            }
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            else -> {
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f)), shape = RoundedCornerShape(20.dp)) {
                        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Ranking ${state.year}", color = SantaWine, fontWeight = FontWeight.Bold)
                            Text("${state.ranking.size} participante(s). A zeragem cria ajustes compensatórios e preserva o histórico.", style = MaterialTheme.typography.bodySmall)
                            OutlinedButton(onClick = { confirmation = ""; resetOpen = true }, enabled = !working) { Icon(Icons.Rounded.RestartAlt, null); Text(" Zerar ranking") }
                        }
                    }
                }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("Cadastros de membros (${state.members.size})", style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                        Text("Aprovação, recusa e promoção exigem conexão porque alteram o nível de acesso.", style = MaterialTheme.typography.labelSmall)
                    }
                }
                items(state.members, key = { it.id }) { member ->
                    Card(shape = RoundedCornerShape(18.dp)) {
                        Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Column(Modifier.weight(1f)) {
                                    Text(member.name, fontWeight = FontWeight.Bold, color = SantaWine)
                                    Text("${member.role} · ${member.status}", style = MaterialTheme.typography.bodySmall)
                                    if (member.email.isNotBlank()) Text(member.email, style = MaterialTheme.typography.labelSmall)
                                }
                                OutlinedButton(onClick = { confirmation = ""; deleteTarget = member }, enabled = !working) {
                                    Icon(Icons.Rounded.DeleteForever, null, Modifier.size(18.dp)); Text(" Excluir")
                                }
                            }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                if (member.status != "aprovado") {
                                    Button(
                                        onClick = { scope.launch { changeStatus(member, "aprovado") } },
                                        enabled = !working,
                                        modifier = Modifier.weight(1f),
                                    ) { Icon(Icons.Rounded.CheckCircle, null, Modifier.size(17.dp)); Text(" Aprovar") }
                                }
                                if (member.status != "recusado") {
                                    OutlinedButton(
                                        onClick = { scope.launch { changeStatus(member, "recusado") } },
                                        enabled = !working,
                                        modifier = Modifier.weight(1f),
                                    ) { Icon(Icons.Rounded.Block, null, Modifier.size(17.dp)); Text(" Recusar") }
                                }
                            }
                            if (member.status == "aprovado" && (member.role.equals("Acólito", true) || member.role.equals("Coroinha", true))) {
                                OutlinedButton(
                                    onClick = { promoteTarget = member },
                                    enabled = !working,
                                    modifier = Modifier.fillMaxWidth(),
                                ) { Icon(Icons.Rounded.Upgrade, null, Modifier.size(18.dp)); Text(" Promover a moderador") }
                            }
                        }
                    }
                }
            }
        }
    }

    promoteTarget?.let { member ->
        AlertDialog(
            onDismissRequest = { promoteTarget = null },
            title = { Text("Promover ${member.name}?") },
            text = { Text("O cadastro passará a ter acesso de moderador nas próximas requisições. Esta mudança exige confirmação do servidor.") },
            confirmButton = {
                Button(enabled = !working, onClick = {
                    working = true
                    scope.launch {
                        when (val result = container.repository.mutateOnlineOnly("PATCH", "/api/membros/${member.id}/promover", "{}")) {
                            is RepositoryResult.Success -> { feedback = "${member.name} agora é moderador."; promoteTarget = null; refresh() }
                            is RepositoryResult.Failure -> feedback = result.message
                            is RepositoryResult.Queued -> feedback = "A promoção precisa ser confirmada online."
                        }
                        working = false
                    }
                }) { Text("Promover") }
            },
            dismissButton = { TextButton(onClick = { promoteTarget = null }) { Text("Cancelar") } },
        )
    }

    deleteTarget?.let { member ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Excluir cadastro de ${member.name}?") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(9.dp)) { Text("Esta operação é destrutiva e não entra na fila offline. Digite EXCLUIR para confirmar."); OutlinedTextField(value = confirmation, onValueChange = { confirmation = it }, label = { Text("Confirmação") }) } },
            confirmButton = {
                Button(enabled = confirmation.trim().uppercase() == "EXCLUIR" && !working, onClick = {
                    if (!isOnline(context)) { feedback = "Conecte o aparelho à internet para excluir um cadastro."; deleteTarget = null; return@Button }
                    working = true
                    scope.launch {
                        val body = JSONObject().apply { put("action", "excluir_cadastro"); put("usuarioId", member.id); put("confirmacao", "EXCLUIR") }.toString()
                        val response = runCatching { container.httpClient.request("POST", "/api/app/admin-dados", body, authenticated = true) }.getOrNull()
                        if (response?.successful == true) { feedback = "Cadastro de ${member.name} excluído."; state = loadAdminData(container) }
                        else feedback = runCatching { JSONObject(response?.body.orEmpty()).optString("erro") }.getOrDefault("Não foi possível excluir o cadastro.")
                        working = false; deleteTarget = null
                    }
                }) { Text("Excluir definitivamente") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancelar") } },
        )
    }

    if (resetOpen) {
        AlertDialog(
            onDismissRequest = { resetOpen = false },
            title = { Text("Zerar ranking ${state.year}?") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(9.dp)) { Text("Digite ZERAR. Esta operação exige internet e não é enfileirada offline."); OutlinedTextField(value = confirmation, onValueChange = { confirmation = it }, label = { Text("Confirmação") }) } },
            confirmButton = {
                Button(enabled = confirmation.trim().uppercase() == "ZERAR" && !working, onClick = {
                    if (!isOnline(context)) { feedback = "Conecte o aparelho à internet para zerar o ranking."; resetOpen = false; return@Button }
                    working = true
                    scope.launch {
                        val body = JSONObject().apply { put("action", "resetar_ranking"); put("ano", state.year); put("confirmacao", "ZERAR") }.toString()
                        val response = runCatching { container.httpClient.request("POST", "/api/app/admin-dados", body, authenticated = true) }.getOrNull()
                        if (response?.successful == true) { feedback = "Ranking ${state.year} zerado com histórico preservado."; state = loadAdminData(container) }
                        else feedback = runCatching { JSONObject(response?.body.orEmpty()).optString("erro") }.getOrDefault("Não foi possível zerar o ranking.")
                        working = false; resetOpen = false
                    }
                }) { Text("Zerar ranking") }
            },
            dismissButton = { TextButton(onClick = { resetOpen = false }) { Text("Cancelar") } },
        )
    }
}