package br.com.comunidadesantaluzia.nativeapp.ui

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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.BugReport
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LibraryBooks
import androidx.compose.material.icons.rounded.Login
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Quiz
import androidx.compose.material.icons.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyDay
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyReading
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.core.sync.SyncScheduler
import br.com.comunidadesantaluzia.nativeapp.features.admin.AdminDataScreen
import br.com.comunidadesantaluzia.nativeapp.features.delays.DelaysScreen
import br.com.comunidadesantaluzia.nativeapp.features.formation.FormationScreen
import br.com.comunidadesantaluzia.nativeapp.features.journey.JourneyScreen
import br.com.comunidadesantaluzia.nativeapp.features.library.LibraryScreen
import br.com.comunidadesantaluzia.nativeapp.features.notifications.NotificationsScreen
import br.com.comunidadesantaluzia.nativeapp.features.profile.PrivateProfileScreen
import br.com.comunidadesantaluzia.nativeapp.features.profiles.ProfilesScreen
import br.com.comunidadesantaluzia.nativeapp.features.ranking.RankingScreen
import br.com.comunidadesantaluzia.nativeapp.features.records.RecordsScreen
import br.com.comunidadesantaluzia.nativeapp.features.scale.ScaleScreen
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaCream
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.launch
import org.json.JSONObject

enum class Route(val value: String) {
    Home("home"),
    Liturgy("liturgia"),
    LiturgyCenter("centro-liturgico"),
    Scale("escala"),
    Library("biblioteca"),
    Login("login"),
    Area("area"),
    Formation("formacao"),
    Journey("jornada"),
    Ranking("ranking"),
    Profiles("perfis"),
    Profile("perfil"),
    Delays("atrasos"),
    Records("registros"),
    Notifications("notificacoes"),
    Diagnostics("diagnostico"),
    Administration("administracao"),
}

private enum class NavMotion { Home, Liturgy, Scale, Library, Formation, Quiz, Login }

private data class NavItem(
    val route: Route,
    val label: String,
    val icon: ImageVector,
    val motion: NavMotion,
)

private val publicNavigation = listOf(
    NavItem(Route.Home, "Início", Icons.Rounded.Home, NavMotion.Home),
    NavItem(Route.Liturgy, "Liturgia", Icons.AutoMirrored.Rounded.MenuBook, NavMotion.Liturgy),
    NavItem(Route.Scale, "Escala", Icons.Rounded.CalendarMonth, NavMotion.Scale),
    NavItem(Route.Library, "Biblioteca", Icons.Rounded.LibraryBooks, NavMotion.Library),
    NavItem(Route.Login, "Entrar", Icons.Rounded.Login, NavMotion.Login),
)

private val authenticatedNavigation = listOf(
    NavItem(Route.Home, "Início", Icons.Rounded.Home, NavMotion.Home),
    NavItem(Route.Scale, "Escala", Icons.Rounded.CalendarMonth, NavMotion.Scale),
    NavItem(Route.Formation, "Formação", Icons.Rounded.School, NavMotion.Formation),
    NavItem(Route.Journey, "Quiz", Icons.Rounded.Quiz, NavMotion.Quiz),
)

@Composable
internal fun SantaLuziaApp(container: AppContainer) {
    val navController = rememberNavController()
    val session by container.sessionStore.session.collectAsStateWithLifecycle(initialValue = NativeSession())
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val hideBottom = currentRoute == Route.Login.value

    Scaffold(
        containerColor = SantaCream,
        bottomBar = {
            if (!hideBottom) {
                SantaBottomBar(
                    items = if (session.loggedIn) authenticatedNavigation else publicNavigation,
                    currentRoute = currentRoute,
                    onNavigate = { item ->
                        navController.navigate(item.route.value) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Route.Home.value,
            modifier = Modifier.padding(padding),
        ) {
            composable(Route.Home.value) { HomeScreen(onNavigate = { navController.navigate(it.value) }) }
            composable(Route.Liturgy.value) { LiturgyScreen(container) }
            composable(Route.LiturgyCenter.value) { LibraryScreen(container) }
            composable(Route.Scale.value) { ScaleScreen(container) }
            composable(Route.Library.value) { LibraryScreen(container) }
            composable(Route.Login.value) {
                LoginScreen(
                    container = container,
                    onSuccess = {
                        navController.navigate(Route.Area.value) {
                            popUpTo(Route.Login.value) { inclusive = true }
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(Route.Area.value) {
                AreaScreen(
                    session = session,
                    onNavigate = { navController.navigate(it.value) },
                    onLogout = {
                        navController.navigate(Route.Home.value) {
                            popUpTo(navController.graph.id) { inclusive = true }
                        }
                    },
                    container = container,
                )
            }
            composable(Route.Formation.value) { FormationScreen(container) }
            composable(Route.Journey.value) { JourneyScreen(container) }
            composable(Route.Ranking.value) { RankingScreen(container) }
            composable(Route.Profiles.value) { ProfilesScreen(container) }
            composable(Route.Profile.value) { PrivateProfileScreen(container) }
            composable(Route.Delays.value) { DelaysScreen(container) }
            composable(Route.Records.value) { RecordsScreen(container, session) }
            composable(Route.Notifications.value) { NotificationsScreen(container) }
            composable(Route.Diagnostics.value) { DiagnosticsScreen(container) }
            composable(Route.Administration.value) {
                if (session.userType == "moderador") AdminDataScreen(container)
                else AccessDeniedScreen()
            }
        }
    }
}

@Composable
private fun SantaBottomBar(items: List<NavItem>, currentRoute: String?, onNavigate: (NavItem) -> Unit) {
    NavigationBar(
        modifier = Modifier.navigationBarsPadding(),
        containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
        tonalElevation = 10.dp,
    ) {
        items.forEach { item ->
            val selected = currentRoute == item.route.value
            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(item) },
                icon = { AnimatedNavIcon(item.icon, item.motion, selected) },
                label = { Text(item.label, maxLines = 1) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                    selectedTextColor = SantaWine,
                    indicatorColor = SantaWine,
                    unselectedIconColor = SantaWine,
                ),
            )
        }
    }
}

@Composable
private fun AnimatedNavIcon(icon: ImageVector, motion: NavMotion, selected: Boolean) {
    val transition = rememberInfiniteTransition(label = "nav-${motion.name}")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(if (selected) 1200 else 1800), repeatMode = RepeatMode.Reverse),
        label = "phase",
    )
    val modifier = when (motion) {
        NavMotion.Home -> Modifier.graphicsLayer {
            translationY = -2.5f * phase
            scaleX = 0.96f + (0.07f * phase)
            scaleY = 0.96f + (0.07f * phase)
        }
        NavMotion.Scale -> Modifier.graphicsLayer {
            rotationY = -8f + (16f * phase)
            scaleX = 0.98f + (0.04f * phase)
            scaleY = 0.98f + (0.04f * phase)
        }
        NavMotion.Formation -> Modifier.graphicsLayer { rotationZ = -3f + (6f * phase) }
        NavMotion.Quiz -> Modifier.scale(0.94f + (0.10f * phase))
        NavMotion.Liturgy, NavMotion.Library -> Modifier.graphicsLayer { rotationY = -6f + (12f * phase) }
        NavMotion.Login -> Modifier.graphicsLayer { translationX = -1.5f + (3f * phase) }
    }
    Icon(imageVector = icon, contentDescription = null, modifier = modifier.size(24.dp))
}

@Composable
private fun HomeScreen(onNavigate: (Route) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(210.dp)
                    .clip(RoundedCornerShape(30.dp))
                    .background(Brush.linearGradient(colors = listOf(SantaWine, SantaWine.copy(alpha = 0.88f), SantaGold.copy(alpha = 0.75f))))
                    .padding(22.dp),
                contentAlignment = Alignment.BottomStart,
            ) {
                Column {
                    Text("Comunidade Santa Luzia", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("Acólitos e Coroinhas", color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.88f), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item { Text("Acessos rápidos", style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold) }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    HomeCard(Modifier.weight(1f), "Centro Litúrgico", "Acervo e formação", Icons.AutoMirrored.Rounded.MenuBook) { onNavigate(Route.LiturgyCenter) }
                    HomeCard(Modifier.weight(1f), "Escala do Dia", "Equipe e funções", Icons.Rounded.CalendarMonth) { onNavigate(Route.Scale) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    HomeCard(Modifier.weight(1f), "Biblioteca", "Conteúdo da comunidade", Icons.Rounded.LibraryBooks) { onNavigate(Route.Library) }
                    HomeCard(Modifier.weight(1f), "Liturgia Diária", "Leituras 100% offline", Icons.Rounded.AutoStories) { onNavigate(Route.Liturgy) }
                }
            }
        }
    }
}

@Composable
private fun HomeCard(modifier: Modifier, title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    Card(
        modifier = modifier,
        onClick = onClick,
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(46.dp).clip(CircleShape).background(SantaWine.copy(alpha = 0.09f)), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = SantaWine, modifier = Modifier.size(26.dp))
            }
            Text(title, fontWeight = FontWeight.Bold, color = SantaWine)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.68f))
        }
    }
}

@Composable
private fun LiturgyScreen(container: AppContainer) {
    var selectedDate by remember { mutableStateOf(LocalDate.now().let { if (it.year == 2026) it else LocalDate.of(2026, 1, 1) }) }
    val day = remember(selectedDate) { container.liturgy.day(selectedDate) }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { selectedDate = selectedDate.minusDays(1) }, enabled = selectedDate > LocalDate.of(2026, 1, 1)) { Text("Anterior") }
                Text(selectedDate.toString(), fontWeight = FontWeight.Bold, color = SantaWine)
                OutlinedButton(onClick = { selectedDate = selectedDate.plusDays(1) }, enabled = selectedDate < LocalDate.of(2026, 12, 31)) { Text("Próxima") }
            }
        }
        if (day == null) item { Text("Liturgia não encontrada no acervo local.") }
        else {
            item { LiturgyHeader(day) }
            item { PrayerCard("Oração da Coleta", day.collect) }
            readingItems("Primeira Leitura", day.firstReading)
            readingItems("Salmo", day.psalm)
            readingItems("Segunda Leitura", day.secondReading)
            readingItems("Evangelho", day.gospel)
            item { PrayerCard("Oração sobre as Oferendas", day.offerings) }
            item { PrayerCard("Oração depois da Comunhão", day.communion) }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.readingItems(title: String, readings: List<LiturgyReading>) {
    if (readings.isEmpty()) return
    item { Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = SantaWine) }
    items(readings.size) { index -> ReadingCard(readings[index]) }
}

@Composable
private fun LiturgyHeader(day: LiturgyDay) {
    Card(colors = CardDefaults.cardColors(containerColor = SantaWine)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(day.displayDate, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.82f))
            Text(day.celebration, color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            if (day.color.isNotBlank()) Text("Cor litúrgica: ${day.color}", color = SantaGold)
        }
    }
}

@Composable
private fun PrayerCard(title: String, text: String) {
    if (text.isBlank()) return
    Card { Column(Modifier.padding(16.dp)) { Text(title, fontWeight = FontWeight.Bold, color = SantaWine); Spacer(Modifier.height(8.dp)); Text(text) } }
}

@Composable
private fun ReadingCard(reading: LiturgyReading) {
    Card { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { Text(reading.title, fontWeight = FontWeight.SemiBold); Text(reading.reference, color = SantaWine, fontWeight = FontWeight.Bold); Text(reading.text) } }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun LoginScreen(container: AppContainer, onSuccess: () -> Unit, onBack: () -> Unit) {
    var login by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Scaffold(
        topBar = { TopAppBar(title = { Text("Acesso à Área Restrita") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Rounded.Home, contentDescription = "Voltar") } }) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(20.dp), verticalArrangement = Arrangement.Center) {
            Text("Santa Luzia", style = MaterialTheme.typography.headlineLarge, color = SantaWine, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(20.dp))
            OutlinedTextField(value = login, onValueChange = { login = it }, label = { Text("Usuário ou e-mail") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Senha") }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation())
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {
                    scope.launch {
                        busy = true
                        message = null
                        when (val result = container.repository.login(login, password)) {
                            is RepositoryResult.Success -> {
                                SyncScheduler.syncNow((container.javaClass.getDeclaredField("appContext").apply { isAccessible = true }.get(container) as android.content.Context))
                                onSuccess()
                            }
                            is RepositoryResult.Failure -> message = result.message
                            is RepositoryResult.Queued -> message = "Login não pode ser colocado em fila. Conecte-se à internet."
                        }
                        busy = false
                    }
                },
                enabled = !busy && login.isNotBlank() && password.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (busy) "Entrando…" else "Entrar") }
            message?.let { Text(it, Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.error) }
        }
    }
}

@Composable
private fun AreaScreen(
    session: NativeSession,
    onNavigate: (Route) -> Unit,
    onLogout: () -> Unit,
    container: AppContainer,
) {
    var confirmLogout by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Área Restrita", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text(session.userName ?: "Usuário")
                }
                IconButton(onClick = { confirmLogout = true }) { Icon(Icons.Rounded.Login, contentDescription = "Sair", tint = SantaWine) }
            }
        }
        item { AreaAction("Meu perfil", Icons.Rounded.AccountCircle) { onNavigate(Route.Profile) } }
        item { AreaAction("Perfis da equipe", Icons.Rounded.Groups) { onNavigate(Route.Profiles) } }
        item { AreaAction("Formação", Icons.Rounded.School) { onNavigate(Route.Formation) } }
        item { AreaAction("Jornada Litúrgica", Icons.Rounded.Quiz) { onNavigate(Route.Journey) } }
        item { AreaAction("Ranking", Icons.Rounded.WorkspacePremium) { onNavigate(Route.Ranking) } }
        item { AreaAction("Atrasos", Icons.Rounded.Schedule) { onNavigate(Route.Delays) } }
        item { AreaAction("Registros", Icons.Rounded.ReceiptLong) { onNavigate(Route.Records) } }
        item { AreaAction("Notificações", Icons.Rounded.Notifications) { onNavigate(Route.Notifications) } }
        item { AreaAction("Auditor Santa Luzia", Icons.Rounded.BugReport) { onNavigate(Route.Diagnostics) } }
        if (session.userType == "moderador") item { AreaAction("Administração de dados", Icons.Rounded.AdminPanelSettings) { onNavigate(Route.Administration) } }
    }
    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("Deseja sair?") },
            text = { Text("Os dados já sincronizados permanecem no aparelho, mas será necessário entrar novamente para acessar a área restrita.") },
            confirmButton = { TextButton(onClick = { confirmLogout = false; scope.launch { container.repository.logout(); onLogout() } }) { Text("Sim") } },
            dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Não") } },
        )
    }
}

@Composable
private fun AreaAction(title: String, icon: ImageVector, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(icon, contentDescription = null, tint = SantaWine)
            Text(title, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun AccessDeniedScreen() {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card { Text("Esta área é exclusiva para moderadores.", Modifier.padding(20.dp), color = SantaWine, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun DiagnosticsScreen(container: AppContainer) {
    var report by remember { mutableStateOf(container.auditor.runSelfAudit()) }
    var message by remember { mutableStateOf<String?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Auditor Santa Luzia", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold) }
        item { Text("Auditoria nativa em Kotlin. Sem GlitchTip/Sentry como dependência do aplicativo.") }
        item {
            val summary = report.optJSONObject("summary") ?: JSONObject()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Metric("Erros", summary.optInt("errors"), Modifier.weight(1f))
                Metric("Alertas", summary.optInt("warnings"), Modifier.weight(1f))
                Metric("Fila", report.optJSONObject("queue")?.optInt("pending") ?: 0, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { report = container.auditor.runSelfAudit(); message = "Auditoria concluída." }) { Icon(Icons.Rounded.BugReport, null); Text(" Executar") }
                OutlinedButton(onClick = { val file = container.auditor.exportReport(); message = "Relatório gerado: ${file.name}" }) { Text("Gerar relatório") }
            }
        }
        item { OutlinedButton(onClick = { container.auditor.clearHistory(); report = container.auditor.runSelfAudit(); message = "Histórico técnico limpo." }) { Text("Limpar histórico") } }
        message?.let { item { Text(it, color = SantaWine) } }
        item { Text("Banco: ${report.optJSONObject("database")?.optString("integrity") ?: "?"}") }
    }
}

@Composable
private fun Metric(label: String, value: Int, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = SantaWine)
            Text(label, style = MaterialTheme.typography.labelSmall)
        }
    }
}
