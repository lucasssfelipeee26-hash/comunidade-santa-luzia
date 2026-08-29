package br.com.comunidadesantaluzia.nativeapp.features.notifications

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

data class NativeNotification(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val href: String?,
    val createdAt: Long,
    val readAt: Long?,
)
data class NotificationsState(
    val notifications: List<NativeNotification> = emptyList(),
    val unread: Int = 0,
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

internal suspend fun loadNotifications(container: AppContainer): NotificationsState = when (val result = container.repository.readLocalFirst("notificacoes", "/api/notificacoes", authenticated = true)) {
    is RepositoryResult.Success -> runCatching {
        val root = JSONObject(result.value)
        val array = root.optJSONArray("notificacoes") ?: JSONArray()
        val items = buildList {
            repeat(array.length()) { index ->
                val item = array.optJSONObject(index) ?: return@repeat
                add(
                    NativeNotification(
                        id = item.optString("id"),
                        type = item.optString("tipo"),
                        title = item.optString("titulo"),
                        message = item.optString("mensagem"),
                        href = item.optString("href").takeIf { it.isNotBlank() && it != "null" },
                        createdAt = item.optLong("criado_em"),
                        readAt = if (item.isNull("lida_em")) null else item.optLong("lida_em").takeIf { it > 0 },
                    ),
                )
            }
        }
        NotificationsState(items.sortedByDescending { it.createdAt }, root.optInt("naoLidas", items.count { it.readAt == null }), result.fromCache, false)
    }.getOrElse { NotificationsState(loading = false, error = "As notificações salvas estão em formato inválido.") }
    is RepositoryResult.Failure -> NotificationsState(loading = false, error = result.message)
    is RepositoryResult.Queued -> NotificationsState(loading = false, error = "A leitura de notificações não deve entrar em fila.")
}

private fun NotificationsState.toCacheJson(): String = JSONObject().apply {
    put("naoLidas", unread)
    put("notificacoes", JSONArray().apply {
        notifications.forEach { notification ->
            put(JSONObject().apply {
                put("id", notification.id)
                put("tipo", notification.type)
                put("titulo", notification.title)
                put("mensagem", notification.message)
                put("href", notification.href)
                put("criado_em", notification.createdAt)
                if (notification.readAt == null) put("lida_em", JSONObject.NULL) else put("lida_em", notification.readAt)
            })
        }
    })
}.toString()

@Composable
internal fun NotificationsScreen(container: AppContainer) {
    var state by remember { mutableStateOf(NotificationsState()) }
    var feedback by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { state = loadNotifications(container) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Notificações", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("${state.unread} não lida(s)", style = MaterialTheme.typography.bodySmall)
                }
                if (state.unread > 0) Button(onClick = {
                    val optimistic = state.copy(
                        notifications = state.notifications.map { it.copy(readAt = it.readAt ?: System.currentTimeMillis()) },
                        unread = 0,
                        fromCache = true,
                    )
                    state = optimistic
                    scope.launch {
                        when (
                            val result = container.repository.mutate(
                                "POST",
                                "/api/notificacoes",
                                JSONObject().put("action", "todas").toString(),
                                optimisticCacheKey = "notificacoes",
                                optimisticPayload = optimistic.toCacheJson(),
                            )
                        ) {
                            is RepositoryResult.Success -> state = loadNotifications(container)
                            is RepositoryResult.Queued -> {
                                feedback = "Leitura salva no aparelho e aguardando sincronização."
                                SyncScheduler.syncNow(container.appContext)
                            }
                            is RepositoryResult.Failure -> {
                                feedback = result.message
                                state = loadNotifications(container)
                            }
                        }
                    }
                }) { Icon(Icons.Rounded.DoneAll, null); Text(" Todas") }
            }
            if (state.fromCache) AssistChip(onClick = {}, label = { Text("Central salva · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) })
            if (feedback.isNotBlank()) Text(feedback, style = MaterialTheme.typography.bodySmall, color = SantaWine)
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            state.notifications.isEmpty() -> item { Card { Text("Nenhuma notificação no momento.", Modifier.padding(20.dp)) } }
            else -> items(state.notifications, key = { it.id }) { notification ->
                NotificationCard(notification) {
                    if (notification.readAt != null) return@NotificationCard
                    val optimistic = state.copy(
                        notifications = state.notifications.map { if (it.id == notification.id) it.copy(readAt = System.currentTimeMillis()) else it },
                        unread = (state.unread - 1).coerceAtLeast(0),
                        fromCache = true,
                    )
                    state = optimistic
                    scope.launch {
                        val body = JSONObject().put("action", "lida").put("id", notification.id).toString()
                        when (
                            val result = container.repository.mutate(
                                "POST",
                                "/api/notificacoes",
                                body,
                                optimisticCacheKey = "notificacoes",
                                optimisticPayload = optimistic.toCacheJson(),
                            )
                        ) {
                            is RepositoryResult.Success -> state = loadNotifications(container)
                            is RepositoryResult.Queued -> {
                                feedback = "Leitura salva no aparelho e aguardando sincronização."
                                SyncScheduler.syncNow(container.appContext)
                            }
                            is RepositoryResult.Failure -> {
                                feedback = result.message
                                state = loadNotifications(container)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationCard(notification: NativeNotification, onRead: () -> Unit) {
    Card(
        onClick = onRead,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = if (notification.readAt == null) SantaGold.copy(alpha = .14f) else MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Rounded.Notifications, null, tint = SantaWine)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(notification.title, color = SantaWine, fontWeight = FontWeight.Bold)
                Text(notification.message, style = MaterialTheme.typography.bodySmall)
                Text(notification.type.uppercase(), style = MaterialTheme.typography.labelSmall, color = SantaWine)
            }
        }
    }
}
