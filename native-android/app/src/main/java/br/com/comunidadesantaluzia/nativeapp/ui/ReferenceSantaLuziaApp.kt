package br.com.comunidadesantaluzia.nativeapp.ui

import android.graphics.BitmapFactory
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LibraryBooks
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Login
import androidx.compose.material.icons.rounded.Quiz
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgicalReadingProgress
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyDay
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyReading
import br.com.comunidadesantaluzia.nativeapp.core.notifications.NotificationNavigationBus
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.core.sync.SyncScheduler
import br.com.comunidadesantaluzia.nativeapp.features.admin.AdminDataScreen
import br.com.comunidadesantaluzia.nativeapp.features.admin.LiturgyArchiveAdminScreen
import br.com.comunidadesantaluzia.nativeapp.features.admin.QuizAdminScreen
import br.com.comunidadesantaluzia.nativeapp.features.admin.ThemeAdminScreen
import br.com.comunidadesantaluzia.nativeapp.features.delays.DelaysScreen
import br.com.comunidadesantaluzia.nativeapp.features.formation.FormationScreen
import br.com.comunidadesantaluzia.nativeapp.features.journey.JourneyScreen
import br.com.comunidadesantaluzia.nativeapp.features.library.LibraryScreen
import br.com.comunidadesantaluzia.nativeapp.features.liturgy.LiturgyCenterScreen
import br.com.comunidadesantaluzia.nativeapp.features.notifications.NotificationsScreen
import br.com.comunidadesantaluzia.nativeapp.features.profile.PrivateProfileScreen
import br.com.comunidadesantaluzia.nativeapp.features.profiles.ProfilesScreen
import br.com.comunidadesantaluzia.nativeapp.features.ranking.RankingScreen
import br.com.comunidadesantaluzia.nativeapp.features.records.RecordsScreen
import br.com.comunidadesantaluzia.nativeapp.features.scale.ScaleScreen
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaCream
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGoldLight
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWineDark
import java.time.LocalDate
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.json.JSONObject

internal enum class ReferenceRoute(val value: String) {
    Home("reference-home"),
    Liturgy("reference-liturgia"),
    LiturgyCenter("reference-centro-liturgico"),
    Scale("reference-escala"),
    Library("reference-biblioteca"),
    Login("reference-login"),
    Area("reference-area"),
    Formation("reference-formacao"),
    Journey("reference-jornada"),
    Ranking("reference-ranking"),
    Profiles("reference-perfis"),
    Profile("reference-perfil"),
    Delays("reference-atrasos"),
    Records("reference-registros"),
    Notifications("reference-notificacoes"),
    Diagnostics("reference-diagnostico"),
    Administration("reference-administracao"),
    AdminQuizzes("reference-admin-quizzes"),
    ThemeAdmin("reference-admin-cores"),
    ArchiveAdmin("reference-admin-acervo"),
}

internal fun referenceRouteForHref(href: String): ReferenceRoute {
    val path = href.substringBefore('?').substringBefore('#').lowercase()
    return when {
        "diagnostico" in path -> ReferenceRoute.Diagnostics
        "/moderador/tema" in path || "/admin/cores" in path -> ReferenceRoute.ThemeAdmin
        "/moderador/ranking" in path || "/admin/quizzes" in path -> ReferenceRoute.AdminQuizzes
        "acervo-liturgico" in path || "/admin/acervo" in path -> ReferenceRoute.ArchiveAdmin
        "/admin/dados" in path || "/moderador/administracao" in path -> ReferenceRoute.Administration
        path.endsWith("/moderador") || path == "/admin" -> ReferenceRoute.Area
        "centro-liturgico" in path -> ReferenceRoute.LiturgyCenter
        "biblioteca" in path -> ReferenceRoute.Library
        "formacao" in path -> ReferenceRoute.Formation
        "atras" in path || "pontual" in path -> ReferenceRoute.Delays
        "perfis" in path -> ReferenceRoute.Profiles
        path.endsWith("/membro") -> ReferenceRoute.Area
        Regex("(^|/)perfil($|/)").containsMatchIn(path) -> ReferenceRoute.Profile
        "registro" in path || "presenca" in path -> ReferenceRoute.Records
        "notific" in path -> ReferenceRoute.Notifications
        "escala" in path -> ReferenceRoute.Scale
        listOf("quiz", "jornada", "missao", "joias", "whatajong", "constancia").any(path::contains) -> ReferenceRoute.Journey
        "ranking" in path -> ReferenceRoute.Ranking
        "liturgia" in path -> ReferenceRoute.Liturgy
        "area-restrita" in path -> ReferenceRoute.Area
        else -> ReferenceRoute.Home
    }
}

private enum class ReferenceNavMotion { Home, Scale, Formation, Quiz }
private data class ReferenceNavItem(val route: ReferenceRoute, val label: String, val icon: ImageVector, val motion: ReferenceNavMotion)
private val authenticatedReferenceNavigation = listOf(
    ReferenceNavItem(ReferenceRoute.Home, "Início", Icons.Rounded.Home, ReferenceNavMotion.Home),
    ReferenceNavItem(ReferenceRoute.Scale, "Escala", Icons.Rounded.CalendarMonth, ReferenceNavMotion.Scale),
    ReferenceNavItem(ReferenceRoute.Formation, "Formação", Icons.Rounded.School, ReferenceNavMotion.Formation),
    ReferenceNavItem(ReferenceRoute.Journey, "Quiz", Icons.Rounded.Quiz, ReferenceNavMotion.Quiz),
)
private val moderatorReferenceRoutes = setOf(
    ReferenceRoute.Administration,
    ReferenceRoute.AdminQuizzes,
    ReferenceRoute.ThemeAdmin,
    ReferenceRoute.ArchiveAdmin,
    ReferenceRoute.Diagnostics,
)
private val protectedReferenceRoutes = setOf(
    ReferenceRoute.Area,
    ReferenceRoute.Formation,
    ReferenceRoute.Journey,
    ReferenceRoute.Ranking,
    ReferenceRoute.Profiles,
    ReferenceRoute.Profile,
    ReferenceRoute.Delays,
    ReferenceRoute.Records,
    ReferenceRoute.Notifications,
    ReferenceRoute.Diagnostics,
) + moderatorReferenceRoutes

@Composable
internal fun ReferenceSantaLuziaApp(container: AppContainer) {
    val navController = rememberNavController()
    val session by container.sessionStore.session.collectAsStateWithLifecycle(initialValue = NativeSession())
    val notificationHref by NotificationNavigationBus.href.collectAsStateWithLifecycle()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    var afterLoginRoute by remember { mutableStateOf<ReferenceRoute?>(null) }
    var sessionReady by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        container.sessionStore.session.first()
        sessionReady = true
    }

    LaunchedEffect(notificationHref, sessionReady, session.loggedIn, session.userType) {
        val href = notificationHref ?: return@LaunchedEffect
        if (!sessionReady) return@LaunchedEffect
        var destination = referenceRouteForHref(href)
        if (destination in moderatorReferenceRoutes && session.loggedIn && session.userType != "moderador") destination = ReferenceRoute.Area
        if (destination in protectedReferenceRoutes && !session.loggedIn) {
            afterLoginRoute = destination
            navController.navigate(ReferenceRoute.Login.value) { launchSingleTop = true }
        } else {
            navController.navigate(destination.value) { launchSingleTop = true }
        }
        NotificationNavigationBus.consume(href)
    }

    Scaffold(
        containerColor = SantaCream,
        bottomBar = {
            if (session.loggedIn && currentRoute != ReferenceRoute.Login.value) {
                ReferenceBottomBar(
                    items = authenticatedReferenceNavigation,
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
            startDestination = ReferenceRoute.Home.value,
            modifier = Modifier.padding(padding),
        ) {
            composable(ReferenceRoute.Home.value) {
                ReferenceHomeScreen(
                    loggedIn = session.loggedIn,
                    onNavigate = { route -> navController.navigate(route.value) { launchSingleTop = true } },
                )
            }
            composable(ReferenceRoute.Liturgy.value) {
                ReferenceDailyLiturgyScreen(container) {
                    if (session.loggedIn) navController.navigate(ReferenceRoute.Journey.value)
                    else {
                        afterLoginRoute = ReferenceRoute.Journey
                        navController.navigate(ReferenceRoute.Login.value)
                    }
                }
            }
            composable(ReferenceRoute.LiturgyCenter.value) { LiturgyCenterScreen(container) }
            composable(ReferenceRoute.Scale.value) { ScaleScreen(container) }
            composable(ReferenceRoute.Library.value) { LibraryScreen(container) }
            composable(ReferenceRoute.Login.value) {
                ReferenceLoginScreen(
                    container = container,
                    onSuccess = {
                        val destination = afterLoginRoute ?: ReferenceRoute.Area
                        afterLoginRoute = null
                        navController.navigate(destination.value) {
                            popUpTo(ReferenceRoute.Login.value) { inclusive = true }
                        }
                    },
                    onVisitor = {
                        afterLoginRoute = null
                        navController.navigate(ReferenceRoute.Home.value) {
                            popUpTo(ReferenceRoute.Login.value) { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable(ReferenceRoute.Area.value) {
                if (!session.loggedIn) {
                    LaunchedEffect(Unit) { afterLoginRoute = ReferenceRoute.Area; navController.navigate(ReferenceRoute.Login.value) { launchSingleTop = true } }
                } else {
                    ReferenceRestrictedAreaScreen(
                        container = container,
                        session = session,
                        onNavigate = { navController.navigate(it.value) { launchSingleTop = true } },
                        onLogout = {
                            navController.navigate(ReferenceRoute.Home.value) {
                                popUpTo(navController.graph.id) { inclusive = true }
                            }
                        },
                    )
                }
            }
            composable(ReferenceRoute.Formation.value) { FormationScreen(container) }
            composable(ReferenceRoute.Journey.value) { JourneyScreen(container, onOpenLiturgy = { navController.navigate(ReferenceRoute.Liturgy.value) }) }
            composable(ReferenceRoute.Ranking.value) { RankingScreen(container) }
            composable(ReferenceRoute.Profiles.value) { ProfilesScreen(container) }
            composable(ReferenceRoute.Profile.value) { PrivateProfileScreen(container) }
            composable(ReferenceRoute.Delays.value) { DelaysScreen(container) }
            composable(ReferenceRoute.Records.value) { RecordsScreen(container, session) }
            composable(ReferenceRoute.Notifications.value) { NotificationsScreen(container) }
            composable(ReferenceRoute.Diagnostics.value) {
                if (session.userType == "moderador") ReferenceDiagnosticsScreen(container) else ReferenceAccessDeniedScreen()
            }
            composable(ReferenceRoute.Administration.value) {
                if (session.userType == "moderador") AdminDataScreen(container) else ReferenceAccessDeniedScreen()
            }
            composable(ReferenceRoute.AdminQuizzes.value) {
                if (session.userType == "moderador") QuizAdminScreen(container, onBack = { navController.popBackStack() }) else ReferenceAccessDeniedScreen()
            }
            composable(ReferenceRoute.ThemeAdmin.value) {
                if (session.userType == "moderador") ThemeAdminScreen(container, onBack = { navController.popBackStack() }) else ReferenceAccessDeniedScreen()
            }
            composable(ReferenceRoute.ArchiveAdmin.value) {
                if (session.userType == "moderador") LiturgyArchiveAdminScreen(container, onBack = { navController.popBackStack() }) else ReferenceAccessDeniedScreen()
            }
        }
    }
}

@Composable
private fun ReferenceBottomBar(items: List<ReferenceNavItem>, currentRoute: String?, onNavigate: (ReferenceNavItem) -> Unit) {
    NavigationBar(modifier = Modifier.navigationBarsPadding(), containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 8.dp) {
        items.forEach { item ->
            val selected = currentRoute == item.route.value
            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(item) },
                icon = { ReferenceAnimatedNavIcon(item.icon, item.motion, selected) },
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
private fun ReferenceAnimatedNavIcon(icon: ImageVector, motion: ReferenceNavMotion, selected: Boolean) {
    val transition = rememberInfiniteTransition(label = "reference-${motion.name}")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(if (selected) 1200 else 1800), repeatMode = RepeatMode.Reverse),
        label = "phase",
    )
    val modifier = when (motion) {
        ReferenceNavMotion.Home -> Modifier.graphicsLayer { translationY = -2.2f * phase; scaleX = .96f + .07f * phase; scaleY = .96f + .07f * phase }
        ReferenceNavMotion.Scale -> Modifier.graphicsLayer { rotationY = -8f + 16f * phase }
        ReferenceNavMotion.Formation -> Modifier.graphicsLayer { rotationZ = -3f + 6f * phase }
        ReferenceNavMotion.Quiz -> Modifier.scale(.94f + .10f * phase)
    }
    Icon(icon, contentDescription = null, modifier = modifier.size(24.dp))
}

@Composable
private fun ReferenceHomeScreen(loggedIn: Boolean, onNavigate: (ReferenceRoute) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        item { ReferencePublicHeader(loggedIn = loggedIn, onNavigate = onNavigate) }
        item { ReferenceHero() }
        item {
            Column(Modifier.padding(horizontal = 14.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Acessos rápidos", color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ReferenceHomeCard(Modifier.weight(1f), "Centro Litúrgico", Icons.AutoMirrored.Rounded.MenuBook) { onNavigate(ReferenceRoute.LiturgyCenter) }
                    ReferenceHomeCard(Modifier.weight(1f), "Escala do Dia", Icons.Rounded.CalendarMonth) { onNavigate(ReferenceRoute.Scale) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ReferenceHomeCard(Modifier.weight(1f), "Biblioteca", Icons.Rounded.LibraryBooks) { onNavigate(ReferenceRoute.Library) }
                    ReferenceHomeCard(Modifier.weight(1f), "Liturgia Diária", Icons.Rounded.AutoStories) { onNavigate(ReferenceRoute.Liturgy) }
                }
            }
        }
    }
}

@Composable
private fun ReferencePublicHeader(loggedIn: Boolean, onNavigate: (ReferenceRoute) -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 3.dp) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.size(42.dp).clip(CircleShape).background(SantaWine.copy(alpha = .09f)), contentAlignment = Alignment.Center) {
                Text("SL", color = SantaWine, fontWeight = FontWeight.Black)
            }
            Column(Modifier.weight(1f)) {
                Text("COMUNIDADE SANTA LUZIA", color = SantaWine, fontWeight = FontWeight.Black, style = MaterialTheme.typography.labelLarge)
                Text("Acólitos e Coroinhas São Padre Pio", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            OutlinedButton(onClick = { onNavigate(if (loggedIn) ReferenceRoute.Area else ReferenceRoute.Login) }) {
                Icon(if (loggedIn) Icons.Rounded.Home else Icons.Rounded.Lock, contentDescription = null, modifier = Modifier.size(17.dp))
                Text(if (loggedIn) " PAINEL" else " ÁREA RESTRITA", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun ReferenceHero() {
    val image = rememberReferenceAsset("reference/hero-adoracao.jpg")
    Box(
        modifier = Modifier.fillMaxWidth().height(330.dp).background(SantaWineDark),
        contentAlignment = Alignment.BottomStart,
    ) {
        if (image != null) {
            Image(bitmap = image, contentDescription = "Adoração diante do Santíssimo Sacramento", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(SantaWineDark.copy(alpha = .94f), SantaWine.copy(alpha = .55f), SantaWine.copy(alpha = .10f)))))
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("ACÓLITOS E COROINHAS SÃO PADRE PIO", color = SantaGoldLight, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
            Text("Servir a Deus", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text("é reinar com Ele", color = SantaGoldLight, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Formando corações para o altar e para a vida, com reverência, fé e amor a Jesus Eucarístico.", color = MaterialTheme.colorScheme.onPrimary.copy(alpha = .92f), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun rememberReferenceAsset(path: String): ImageBitmap? {
    val context = androidx.compose.ui.platform.LocalContext.current
    return remember(path) {
        runCatching { context.assets.open(path).use { BitmapFactory.decodeStream(it)?.asImageBitmap() } }.getOrNull()
    }
}

@Composable
private fun ReferenceHomeCard(modifier: Modifier, title: String, icon: ImageVector, onClick: () -> Unit) {
    Card(
        modifier = modifier,
        onClick = onClick,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(SantaWine.copy(alpha = .08f)), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = SantaWine, modifier = Modifier.size(22.dp))
            }
            Text(title, color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun ReferenceLoginScreen(container: AppContainer, onSuccess: () -> Unit, onVisitor: () -> Unit) {
    var login by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 5.dp),
            ) {
                Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(68.dp).clip(CircleShape).background(SantaWine.copy(alpha = .09f)), contentAlignment = Alignment.Center) {
                        Text("SL", color = SantaWine, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
                    }
                    Text("Bem-vindo ao Santa Luzia", color = SantaWine, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text("Entre para acessar sua Área Restrita", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
                    OutlinedTextField(value = login, onValueChange = { login = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Usuário ou e-mail") }, singleLine = true)
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Senha") },
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(if (passwordVisible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility, contentDescription = if (passwordVisible) "Ocultar senha" else "Mostrar senha")
                            }
                        },
                    )
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy && login.isNotBlank() && password.isNotBlank(),
                        onClick = {
                            scope.launch {
                                busy = true; message = null
                                when (val result = container.repository.login(login, password)) {
                                    is RepositoryResult.Success -> { SyncScheduler.syncNow(container.appContext); onSuccess() }
                                    is RepositoryResult.Failure -> message = result.message
                                    is RepositoryResult.Queued -> message = "O primeiro login precisa de internet. Depois, sua sessão e seus dados ficam disponíveis offline."
                                }
                                busy = false
                            }
                        },
                    ) {
                        Icon(Icons.Rounded.Login, contentDescription = null)
                        Text(if (busy) " Entrando…" else " Entrar")
                    }
                    OutlinedButton(onClick = onVisitor, modifier = Modifier.fillMaxWidth()) { Text("Continuar como visitante") }
                    AuthActions(container)
                    message?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
                    Text("Após o primeiro acesso válido, o aplicativo mantém a sessão e os dados essenciais no aparelho e sincroniza novamente quando houver conexão.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
                }
            }
        }
    }
}

@Composable
private fun ReferenceDailyLiturgyScreen(container: AppContainer, onFinishReading: () -> Unit) {
    val today = remember { LiturgicalReadingProgress.todayCuiaba() }
    var selectedDate by remember { mutableStateOf(today.takeIf { it.year == 2026 } ?: LocalDate.of(2026, 1, 1)) }
    val day = remember(selectedDate) { container.liturgy.day(selectedDate) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { selectedDate = selectedDate.minusDays(1) }, enabled = selectedDate > LocalDate.of(2026, 1, 1)) { Text("Anterior") }
                Text(selectedDate.toString(), color = SantaWine, fontWeight = FontWeight.Bold)
                OutlinedButton(onClick = { selectedDate = selectedDate.plusDays(1) }, enabled = selectedDate < LocalDate.of(2026, 12, 31)) { Text("Próxima") }
            }
        }
        if (day == null) item { Card { Text("Liturgia não encontrada no acervo local.", Modifier.padding(16.dp)) } }
        else {
            item { ReferenceLiturgyHeader(day) }
            item { ReferencePrayerCard("Oração da Coleta", day.collect) }
            referenceReadingItems("Primeira Leitura", day.firstReading)
            referenceReadingItems("Salmo", day.psalm)
            referenceReadingItems("Segunda Leitura", day.secondReading)
            referenceReadingItems("Evangelho", day.gospel)
            item { ReferencePrayerCard("Oração sobre as Oferendas", day.offerings) }
            item { ReferencePrayerCard("Oração depois da Comunhão", day.communion) }
            if (selectedDate == today) item {
                Button(modifier = Modifier.fillMaxWidth(), onClick = { LiturgicalReadingProgress.markRead(container.appContext, today); onFinishReading() }) {
                    Icon(Icons.Rounded.Quiz, contentDescription = null); Text(" Concluir leitura e abrir Quiz")
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.referenceReadingItems(title: String, readings: List<LiturgyReading>) {
    if (readings.isEmpty()) return
    item { Text(title, color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium) }
    items(readings.size) { index -> ReferenceReadingCard(readings[index]) }
}

@Composable
private fun ReferenceLiturgyHeader(day: LiturgyDay) {
    Card(colors = CardDefaults.cardColors(containerColor = SantaWine), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(day.displayDate, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = .84f))
            Text(day.celebration, color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            if (day.color.isNotBlank()) Text("Cor litúrgica: ${day.color}", color = SantaGoldLight)
        }
    }
}

@Composable
private fun ReferencePrayerCard(title: String, text: String) {
    if (text.isBlank()) return
    Card { Column(Modifier.padding(15.dp)) { Text(title, color = SantaWine, fontWeight = FontWeight.Bold); Spacer(Modifier.height(7.dp)); Text(text) } }
}

@Composable
private fun ReferenceReadingCard(reading: LiturgyReading) {
    Card { Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(reading.title, fontWeight = FontWeight.SemiBold); Text(reading.reference, color = SantaWine, fontWeight = FontWeight.Bold); Text(reading.text) } }
}

@Composable
private fun ReferenceDiagnosticsScreen(container: AppContainer) {
    var report by remember { mutableStateOf(container.auditor.runSelfAudit()) }
    var message by remember { mutableStateOf<String?>(null) }
    var lastReport by remember { mutableStateOf<java.io.File?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Auditor Santa Luzia", color = SantaWine, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold) }
        item { Text("Auditoria nativa em Kotlin: interface, navegação, banco local, fila, desempenho e integridade.", style = MaterialTheme.typography.bodyMedium) }
        item {
            val summary = report.optJSONObject("summary") ?: JSONObject()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReferenceMetric("Erros", summary.optInt("errors"), Modifier.weight(1f))
                ReferenceMetric("Alertas", summary.optInt("warnings"), Modifier.weight(1f))
                ReferenceMetric("Fila", report.optJSONObject("queue")?.optInt("pending") ?: 0, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { report = container.auditor.runSelfAudit(); message = "Auditoria concluída." }) { Text("Executar") }
                OutlinedButton(onClick = { lastReport = container.auditor.exportReport(); message = "Relatório técnico gerado." }) { Text("Gerar relatório") }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = lastReport?.isFile == true, onClick = { val file = lastReport; message = if (file != null && container.auditor.shareReport(file)) "Compartilhamento aberto." else "Não foi possível compartilhar." }) { Text("Compartilhar") }
                OutlinedButton(onClick = { container.auditor.clearHistory(); lastReport = null; report = container.auditor.runSelfAudit(); message = "Histórico técnico limpo." }) { Text("Limpar histórico") }
            }
        }
        message?.let { item { Text(it, color = SantaWine) } }
        item { Text("Banco local: ${report.optJSONObject("database")?.optString("integrity") ?: "?"}") }
    }
}

@Composable
private fun ReferenceMetric(label: String, value: Int, modifier: Modifier) {
    Card(modifier) { Column(Modifier.padding(11.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(value.toString(), color = SantaWine, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); Text(label, style = MaterialTheme.typography.labelSmall) } }
}

@Composable
private fun ReferenceAccessDeniedScreen() {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card { Text("Esta área é exclusiva para moderadores.", Modifier.padding(20.dp), color = SantaWine, fontWeight = FontWeight.Bold) }
    }
}
