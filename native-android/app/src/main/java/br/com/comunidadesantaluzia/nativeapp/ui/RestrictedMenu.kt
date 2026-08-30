package br.com.comunidadesantaluzia.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.BugReport
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.Quiz
import androidx.compose.material.icons.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine

private data class RestrictedMenuItem(
    val href: String,
    val label: String,
    val icon: ImageVector,
)

private val memberMenuItems = listOf(
    RestrictedMenuItem("/area-restrita/perfil", "Meu perfil", Icons.Rounded.AccountCircle),
    RestrictedMenuItem("/area-restrita/perfis", "Perfis", Icons.Rounded.Groups),
    RestrictedMenuItem("/area-restrita/atrasos", "Atrasos", Icons.Rounded.Schedule),
    RestrictedMenuItem("/area-restrita/jornada", "Jornada", Icons.Rounded.Quiz),
)

// Os 11 atalhos seguem a organização do ModeradorMenu da Beta 18.
private val moderatorMenuItems = listOf(
    RestrictedMenuItem("/area-restrita/perfis", "Perfis", Icons.Rounded.Groups),
    RestrictedMenuItem("/area-restrita/atrasos", "Atrasos", Icons.Rounded.Schedule),
    RestrictedMenuItem("/area-restrita/jornada", "Jornada", Icons.Rounded.Quiz),
    RestrictedMenuItem("/escala", "Escalas", Icons.Rounded.CalendarMonth),
    RestrictedMenuItem("/formacao", "Formação", Icons.Rounded.School),
    RestrictedMenuItem("/area-restrita/presencas", "Presenças", Icons.Rounded.VerifiedUser),
    RestrictedMenuItem("/area-restrita/registro", "Registro", Icons.Rounded.ReceiptLong),
    RestrictedMenuItem("/admin/quizzes", "Quizzes", Icons.Rounded.Quiz),
    RestrictedMenuItem("/admin/dados", "Dados", Icons.Rounded.AdminPanelSettings),
    RestrictedMenuItem("/admin/cores", "Cores", Icons.Rounded.Palette),
    RestrictedMenuItem("/area-restrita/diagnostico", "Diagnóstico", Icons.Rounded.BugReport),
)

@Composable
internal fun RestrictedMenuButton(
    session: NativeSession,
    onNavigateHref: (String) -> Unit,
) {
    if (!session.loggedIn) return
    var open by remember { mutableStateOf(false) }

    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
        tonalElevation = 6.dp,
        shadowElevation = 6.dp,
    ) {
        IconButton(onClick = { open = true }, modifier = Modifier.size(44.dp)) {
            Icon(Icons.Rounded.Menu, contentDescription = "Abrir navegação da Área Restrita", tint = SantaWine)
        }
    }

    if (open) {
        RestrictedMenuDialog(
            moderator = session.userType == "moderador",
            onDismiss = { open = false },
            onNavigate = { href ->
                open = false
                onNavigateHref(href)
            },
        )
    }
}

@Composable
private fun RestrictedMenuDialog(
    moderator: Boolean,
    onDismiss: () -> Unit,
    onNavigate: (String) -> Unit,
) {
    val items = if (moderator) moderatorMenuItems else memberMenuItems
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
            shadowElevation = 18.dp,
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Navegação", color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text("Ferramentas do seu acesso", style = MaterialTheme.typography.bodySmall)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Rounded.Close, contentDescription = "Fechar navegação", tint = SantaWine)
                    }
                }
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    items(items, key = { "${it.href}:${it.label}" }) { item ->
                        Card(
                            onClick = { onNavigate(item.href) },
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.48f)),
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 5.dp, vertical = 11.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(7.dp),
                            ) {
                                Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) {
                                    Surface(
                                        shape = RoundedCornerShape(15.dp),
                                        color = MaterialTheme.colorScheme.surface,
                                        shadowElevation = 2.dp,
                                    ) {
                                        Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                                            Icon(item.icon, contentDescription = null, tint = SantaWine, modifier = Modifier.size(21.dp))
                                        }
                                    }
                                }
                                Text(
                                    item.label,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    maxLines = 2,
                                )
                            }
                        }
                    }
                }
                if (moderator) {
                    Text(
                        "Área Restrita clara · administração e configurações ficam no menu, como na Beta 18.",
                        style = MaterialTheme.typography.labelSmall,
                        color = SantaGold.copy(alpha = 0.95f),
                    )
                }
            }
        )
    }
}
