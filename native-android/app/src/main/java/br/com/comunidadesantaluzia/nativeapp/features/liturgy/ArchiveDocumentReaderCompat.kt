package br.com.comunidadesantaluzia.nativeapp.features.liturgy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyArchiveDocument
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine

/**
 * Ponte de compatibilidade para estados Compose delegados nullable.
 *
 * O leitor original recebe documento não-nulo. Nas ramificações em que o estado
 * `selectedDocument` é checado antes da chamada, o compilador atual não permite
 * smart-cast de propriedades delegadas. Esta sobrecarga preserva o mesmo leitor
 * visual e aceita o estado nullable sem alterar o fluxo de navegação.
 */
@Composable
internal fun ArchiveDocumentReader(
    document: LiturgyArchiveDocument?,
    onBack: () -> Unit,
    nullableStateCompat: Unit = Unit,
) {
    val resolved = document ?: return
    val text = remember(resolved.id, resolved.path) { resolved.readableText() }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Rounded.ArrowBack, contentDescription = "Voltar")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        resolved.title.ifBlank { "Documento litúrgico" },
                        style = MaterialTheme.typography.titleLarge,
                        color = SantaWine,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        resolved.path,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        item {
            Card {
                SelectionContainer {
                    Text(
                        text.ifBlank { "Este documento não possui texto legível no pacote interno." },
                        modifier = Modifier.padding(17.dp),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }
    }
}
