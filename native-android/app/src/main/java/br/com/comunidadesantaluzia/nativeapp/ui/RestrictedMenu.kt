package br.com.comunidadesantaluzia.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.BugReport
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Dashboard
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine

private data class RestrictedMenuItem(val href: String, val label: String, val icon: ImageVector)

// Decisão final das Betas 15–18: menu do membro compacto, sem administração.
private val memberMenuItems = listOf(
    RestrictedMenuItem("/area-restrita/membro", "Meu perfil", Icons.Rounded.AccountCircle),
    RestrictedMenuItem("/area-restrita/atrasos", "Atrasos", Icons.Rounded.Schedule),
    RestrictedMenuItem("/area-restrita/ranking", "Jornada", Icons.Rounded.Quiz),
    RestrictedMenuItem("/escala", "Escala", Icons.Rounded.CalendarMonth),
    RestrictedMenuItem("/formacao", "Formação", Icons.Rounded.School),
)

// A administração permanece no menu do moderador e não no dashboard.
private val moderatorMenuItems = listOf(
    RestrictedMenuItem("/area-restrita/moderador", "Painel", Icons.Rounded.Dashboard),
    RestrictedMenuItem("/area-restrita/atrasos", "Atrasos", Icons.Rounded.Schedule),
    RestrictedMenuItem("/area-restrita/ranking", "Jornada", Icons.Rounded.Quiz),
    RestrictedMenuItem("/area-restrita/moderador/escala", "Escalas", Icons.Rounded.CalendarMonth),
    RestrictedMenuItem("/area-restrita/moderador/formacao", "Formação", Icons.Rounded.School),
    RestrictedMenuItem("/area-restrita/moderador/presencas", "Presenças", Icons.Rounded.VerifiedUser),
    RestrictedMenuItem("/area-restrita/moderador/registro", "Registro", Icons.Rounded.ReceiptLong),
    RestrictedMenuItem("/area-restrita/moderador/ranking", "Quizzes", Icons.Rounded.Quiz),
    RestrictedMenuItem("/area-restrita/moderador/tema", "Cores", Icons.Rounded.Palette),
    RestrictedMenuItem("/escala", "Escala pública", Icons.Rounded.CalendarMonth),
    RestrictedMenuItem("/admin/dados", "Dados", Icons.Rounded.AdminPanelSettings),
    RestrictedMenuItem("/admin/acervo-liturgico", "Acervo", Icons.Rounded.AutoStories),
    RestrictedMenuItem("/area-restrita/moderador/diagnostico", "Auditor", Icons.Rounded.BugReport),
)

@Composable
internal fun RestrictedMenuButton(session: NativeSession, onNavigateHref: (String) -> Unit) {
    if (!session.loggedIn) return
    var open by remember { mutableStateOf(false) }
    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surface, tonalElevation = 3.dp) {
        IconButton(onClick = { open = true }, modifier = Modifier.size(40.dp)) {
            Icon(Icons.Rounded.Menu, contentDescription = "Abrir navegação da Área Restrita", tint = SantaWine, modifier = Modifier.size(20.dp))
        }
    }
    if (open) {
        RestrictedMenuDialog(
            moderator = session.userType == "moderador",
            onDismiss = { open = false },
            onNavigate = { href -> open = false; onNavigateHref(href) },
        )
    }
}

@Composable
private fun RestrictedMenuDialog(moderator: Boolean, onDismiss: () -> Unit, onNavigate: (String) -> Unit) {
    val items = if (moderator) moderatorMenuItems else memberMenuItems
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = .98f),
            shadowElevation = 20.dp,
        ) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("NAVEGAÇÃO", color = SantaWine, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                        Text("Escolha uma área", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = onDismiss) { Icon(Icons.Rounded.Close, contentDescription = "Fechar navegação", tint = SantaWine) }
                }
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 510.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(items, key = { "${it.href}:${it.label}" }) { item ->
                        Card(
                            onClick = { onNavigate(item.href) },
                            shape = RoundedCornerShape(17.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .52f)),
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                                    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 2.dp) {
                                        Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                                            Icon(item.icon, contentDescription = null, tint = SantaWine, modifier = Modifier.size(20.dp))
                                        }
                                    }
                                }
                                Text(item.label, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, maxLines = 2)
                            }
                        }
                    }
                }
                if (moderator) {
                    Text("Administração e configurações ficam aqui — não no painel.", style = MaterialTheme.typography.labelSmall, color = SantaGold)
                }
            }
        }
    }
}
