package br.com.comunidadesantaluzia.nativeapp.features.liturgy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyArchiveDocument
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyArchiveMenuItem
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.OfflineLiturgyArchiveRepository
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal data class LiturgyFixedMenu(
    val title: String,
    val items: List<LiturgyArchiveMenuItem>,
)

private data class ResolvedFixedMenuItem(
    val source: LiturgyArchiveMenuItem,
    val document: LiturgyArchiveDocument?,
)

@Composable
internal fun FixedArchiveMenuContent(
    archive: OfflineLiturgyArchiveRepository,
    menu: LiturgyFixedMenu,
    onBack: () -> Unit,
    onDocument: (LiturgyArchiveDocument) -> Unit,
) {
    var resolved by remember(menu.title, menu.items) { mutableStateOf<List<ResolvedFixedMenuItem>>(emptyList()) }
    var loading by remember(menu.title, menu.items) { mutableStateOf(true) }

    LaunchedEffect(menu.title, menu.items) {
        loading = true
        resolved = withContext(Dispatchers.IO) {
            menu.items.map { source ->
                ResolvedFixedMenuItem(source, archive.documentByPath(source.category, source.path))
            }
        }
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Rounded.ArrowBack, contentDescription = "Voltar") }
                Column(Modifier.weight(1f)) {
                    Text(menu.title, style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("Menu da Central Litúrgica · conteúdo no aparelho", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (loading) {
            item {
                Row(Modifier.fillMaxWidth().padding(30.dp), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator()
                }
            }
        } else {
            items(resolved, key = { it.source.id }) { entry ->
                Card(
                    onClick = { entry.document?.let(onDocument) },
                    enabled = entry.document != null,
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.spacedBy(11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = null, tint = SantaGold)
                        Column(Modifier.weight(1f)) {
                            Text(entry.source.title, color = SantaWine, fontWeight = FontWeight.SemiBold)
                            if (entry.document == null) {
                                Text("Documento não localizado neste pacote", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        }
    }
}
