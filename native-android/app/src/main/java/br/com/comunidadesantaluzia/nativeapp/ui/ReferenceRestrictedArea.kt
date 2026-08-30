package br.com.comunidadesantaluzia.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Logout
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Quiz
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.features.profiles.NativeTeamProfile
import br.com.comunidadesantaluzia.nativeapp.features.profiles.loadProfiles
import br.com.comunidadesantaluzia.nativeapp.features.scale.NativeScale
import br.com.comunidadesantaluzia.nativeapp.features.scale.loadScales
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWineDark
import java.time.LocalDate
import kotlinx.coroutines.launch
import org.json.JSONObject

private data class ModeratorReferenceStats(
    val acolytes: Int = 0,
    val servers: Int = 0,
    val pending: Int? = null,
    val warnings: Int? = null,
)

@Composable
internal fun ReferenceRestrictedAreaScreen(
    container: AppContainer,
    session: NativeSession,
    onNavigate: (ReferenceRoute) -> Unit,
    onLogout: () -> Unit,
) {
    var confirmLogout by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize()) {
        ReferenceAreaHeader(
            session = session,
            onNavigate = onNavigate,
            onLogoutRequest = { confirmLogout = true },
        )
        if (session.userType == "moderador") {
            ModeratorReferenceDashboard(container, session, onNavigate)
        } else {
            MemberReferenceDashboard(container, session, onNavigate)
        }
    }

    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("Deseja sair?") },
            text = { Text("Os dados já sincronizados permanecem salvos no aparelho. Para voltar à Área Restrita será necessário entrar novamente.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmLogout = false
                    scope.launch {
                        container.repository.logout()
                        onLogout()
                    }
                }) { Text("Sim") }
            },
            dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Não") } },
        )
    }
}

@Composable
private fun ReferenceAreaHeader(
    session: NativeSession,
    onNavigate: (ReferenceRoute) -> Unit,
    onLogoutRequest: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 4.dp,
        tonalElevation = 1.dp,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(
                        "Área Restrita",
                        color = SantaWine,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleLarge,
                    )
                    if (session.userType == "moderador") {
                        Surface(shape = RoundedCornerShape(999.dp), color = SantaGold.copy(alpha = .22f)) {
                            Text("Moderador", Modifier.padding(horizontal = 8.dp, vertical = 3.dp), color = SantaWineDark, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Text(
                    if (session.userType == "moderador") "Acólitos e Coroinhas" else "${session.function ?: "Membro"} · ${session.userName ?: "Santa Luzia"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton(onClick = { onNavigate(ReferenceRoute.Notifications) }) {
                BadgedBox(badge = { Badge() }) {
                    Icon(Icons.Rounded.Notifications, contentDescription = "Notificações", tint = SantaWine)
                }
            }
            RestrictedMenuButton(
                session = session,
                onNavigateHref = { href -> onNavigate(referenceRouteForHref(href)) },
            )
            IconButton(onClick = onLogoutRequest) {
                Icon(Icons.Rounded.Logout, contentDescription = "Sair da Área Restrita", tint = SantaWine)
            }
        }
    }
}

@Composable
private fun MemberReferenceDashboard(
    container: AppContainer,
    session: NativeSession,
    onNavigate: (ReferenceRoute) -> Unit,
) {
    var profiles by remember { mutableStateOf<List<NativeTeamProfile>>(emptyList()) }
    var profilesOffline by remember { mutableStateOf(false) }
    var nextCommitment by remember { mutableStateOf<NativeScale?>(null) }

    LaunchedEffect(session.userId) {
        val profileState = loadProfiles(container)
        profiles = profileState.profiles
        profilesOffline = profileState.fromCache
        val scales = loadScales(container).scales
        val today = LocalDate.now().toString()
        nextCommitment = scales
            .filter { it.date >= today && it.people.any { p -> p.id == session.userId } }
            .sortedBy { "${it.date} ${it.time}" }
            .firstOrNull()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 12.dp, top = 14.dp, end = 12.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            ProfileSummaryCard(session = session, onClick = { onNavigate(ReferenceRoute.Profile) })
        }
        item {
            NextCommitmentCard(nextCommitment = nextCommitment, onOpenScale = { onNavigate(ReferenceRoute.Scale) })
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CompactDashboardAction("Formação", "Presença e materiais", Icons.Rounded.School, Modifier.weight(1f)) { onNavigate(ReferenceRoute.Formation) }
                CompactDashboardAction("Jornada", "Quiz, jogo e ranking", Icons.Rounded.Quiz, Modifier.weight(1f)) { onNavigate(ReferenceRoute.Journey) }
                CompactDashboardAction("Atrasos", "Relatar e acompanhar", Icons.Rounded.Schedule, Modifier.weight(1f)) { onNavigate(ReferenceRoute.Delays) }
            }
        }
        item {
            TeamReferenceRail(profiles = profiles, fromCache = profilesOffline, onOpenProfiles = { onNavigate(ReferenceRoute.Profiles) })
        }
        item {
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Justificar uma ausência", color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text("A justificativa fica vinculada à escala correspondente e é enviada ao moderador. Ela não aparece no perfil público.", style = MaterialTheme.typography.bodySmall)
                    OutlinedButton(onClick = { onNavigate(ReferenceRoute.Scale) }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Rounded.CalendarMonth, contentDescription = null)
                        Text(" Abrir minhas escalas")
                    }
                }
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().background(SantaWine.copy(alpha = .035f), RoundedCornerShape(14.dp)).padding(12.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Rounded.Lock, contentDescription = null, tint = SantaWine, modifier = Modifier.size(18.dp))
                Text(
                    "Registros administrativos são privados. Faltas, advertências, justificativas e observações ficam somente com os moderadores.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ModeratorReferenceDashboard(
    container: AppContainer,
    session: NativeSession,
    onNavigate: (ReferenceRoute) -> Unit,
) {
    var profiles by remember { mutableStateOf<List<NativeTeamProfile>>(emptyList()) }
    var stats by remember { mutableStateOf(ModeratorReferenceStats()) }
    var fromCache by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val profileState = loadProfiles(container)
        profiles = profileState.profiles
        fromCache = profileState.fromCache
        stats = loadModeratorStats(container, profiles)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 12.dp, top = 14.dp, end = 12.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { ProfileSummaryCard(session = session, onClick = { onNavigate(ReferenceRoute.Profile) }) }
        if (fromCache) item { AssistChip(onClick = {}, label = { Text("Painel salvo no aparelho · offline") }) }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ModeratorStat("Acólitos", stats.acolytes.toString(), Modifier.weight(1f))
                ModeratorStat("Coroinhas", stats.servers.toString(), Modifier.weight(1f))
                ModeratorStat("Aguardando", stats.pending?.toString() ?: "—", Modifier.weight(1f))
                ModeratorStat("Advertências", stats.warnings?.toString() ?: "—", Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ModeratorShortcut("Atrasos", "Relatos e confirmações", Icons.Rounded.Schedule, Modifier.weight(1f)) { onNavigate(ReferenceRoute.Delays) }
                ModeratorShortcut("Presenças", "Formações da equipe", Icons.Rounded.VerifiedUser, Modifier.weight(1f)) { onNavigate(ReferenceRoute.Records) }
            }
        }
        item { TeamReferenceRail(profiles = profiles, fromCache = fromCache, onOpenProfiles = { onNavigate(ReferenceRoute.Profiles) }) }
        item {
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .09f))) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text("Administração", color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("Escalas, formação, registros, quizzes, cores, dados, acervo e Auditor ficam no menu de três barras, como na última Beta aprovada. Eles não são despejados no dashboard.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

private suspend fun loadModeratorStats(container: AppContainer, profiles: List<NativeTeamProfile>): ModeratorReferenceStats {
    val pending = when (val result = container.repository.readLocalFirst("membros", "/api/membros", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val array = JSONObject(result.value).optJSONArray("membros")
            if (array == null) null else (0 until array.length()).count { index ->
                array.optJSONObject(index)?.optString("status")?.lowercase() == "pendente"
            }
        }.getOrNull()
        else -> null
    }
    val warnings = when (val result = container.repository.readLocalFirst("registros", "/api/registros", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val array = root.optJSONArray("registros") ?: root.optJSONArray("advertencias")
            if (array == null) null else (0 until array.length()).count { index ->
                val item = array.optJSONObject(index)
                item?.optString("tipo")?.lowercase()?.contains("advert") == true || item?.has("advertencia") == true
            }
        }.getOrNull()
        else -> null
    }
    return ModeratorReferenceStats(
        acolytes = profiles.count { it.function.equals("Acólito", ignoreCase = true) },
        servers = profiles.count { it.function.equals("Coroinha", ignoreCase = true) },
        pending = pending,
        warnings = warnings,
    )
}

@Composable
private fun ProfileSummaryCard(session: NativeSession, onClick: () -> Unit) {
    Card(onClick = onClick, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Box(Modifier.size(46.dp).background(SantaWine.copy(alpha = .09f), CircleShape), contentAlignment = Alignment.Center) {
                Text(initials(session.userName.orEmpty()), color = SantaWine, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.weight(1f)) {
                Text("Meu perfil", color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Text(session.userName ?: "Usuário", maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(session.function ?: if (session.userType == "moderador") "Moderador" else "Membro", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = SantaWine)
        }
    }
}

@Composable
private fun NextCommitmentCard(nextCommitment: NativeScale?, onOpenScale: () -> Unit) {
    Card(onClick = onOpenScale, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .10f))) {
        Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Rounded.CalendarMonth, contentDescription = null, tint = SantaWine)
            Column(Modifier.weight(1f)) {
                Text("Meu próximo compromisso", color = SantaWine, fontWeight = FontWeight.Bold)
                if (nextCommitment == null) Text("Nenhuma escala futura encontrada neste aparelho.", style = MaterialTheme.typography.bodySmall)
                else {
                    Text("${nextCommitment.date} · ${nextCommitment.time}", fontWeight = FontWeight.SemiBold)
                    Text(nextCommitment.celebration ?: nextCommitment.celebrant.ifBlank { "Escala publicada" }, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = SantaWine)
        }
    }
}

@Composable
private fun CompactDashboardAction(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(horizontal = 9.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Box(Modifier.size(34.dp).background(SantaWine.copy(alpha = .08f), RoundedCornerShape(11.dp)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = SantaWine, modifier = Modifier.size(18.dp)) }
            Text(title, color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
            Text(subtitle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
        }
    }
}

@Composable
private fun ModeratorShortcut(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.padding(11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            Box(Modifier.size(38.dp).background(MaterialTheme.colorScheme.secondaryContainer, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = SantaWine, modifier = Modifier.size(19.dp)) }
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                Text(subtitle, style = MaterialTheme.typography.labelSmall, maxLines = 2, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun ModeratorStat(label: String, value: String, modifier: Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(13.dp)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 7.dp, vertical = 9.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
private fun TeamReferenceRail(profiles: List<NativeTeamProfile>, fromCache: Boolean, onOpenProfiles: () -> Unit) {
    Card(shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Equipe", color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text(if (fromCache) "Perfis salvos · offline" else "Deslize para o lado como nos Status", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                TextButton(onClick = onOpenProfiles) { Text("Buscar") }
            }
            if (profiles.isEmpty()) {
                Text("Os perfis aparecerão aqui depois da primeira sincronização.", Modifier.padding(horizontal = 12.dp), style = MaterialTheme.typography.bodySmall)
            } else {
                LazyRow(contentPadding = PaddingValues(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                    items(profiles.take(18), key = { it.id }) { profile ->
                        Column(
                            modifier = Modifier.size(width = 72.dp, height = 92.dp).clickable(onClick = onOpenProfiles),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                Modifier.size(58.dp).background(SantaGold, CircleShape).padding(2.dp).background(MaterialTheme.colorScheme.surface, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(initials(profile.name), color = SantaWine, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(shortName(profile.name), style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(profile.ranking?.let { "${it.position}º" } ?: profile.function, style = MaterialTheme.typography.labelSmall, color = SantaWine, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
}

private fun initials(name: String): String = name.trim().split(Regex("\\s+")).filter(String::isNotBlank).take(2).joinToString("") { it.first().uppercase() }.ifBlank { "SL" }
private fun shortName(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter(String::isNotBlank)
    return when (parts.size) {
        0 -> "Perfil"
        1 -> parts.first()
        else -> "${parts.first()} ${parts.last()}"
    }
}
