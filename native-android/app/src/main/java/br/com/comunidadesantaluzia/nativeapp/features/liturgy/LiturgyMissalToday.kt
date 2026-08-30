package br.com.comunidadesantaluzia.nativeapp.features.liturgy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgicalReadingProgress
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyArchiveDocument
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyArchiveMenus
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyMissalResolver
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgySanctoralResolver
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.OfflineLiturgyArchiveRepository
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MissalTodayQuickLink(
    archive: OfflineLiturgyArchiveRepository,
    onDocument: (LiturgyArchiveDocument) -> Unit,
    onMenu: (LiturgyFixedMenu) -> Unit,
) {
    val today = remember { LiturgicalReadingProgress.todayCuiaba() }
    val effectiveDate = remember(today) { today.takeIf { it.year == 2026 } ?: LocalDate.of(2026, 1, 1) }
    val celebration = remember(effectiveDate) { LiturgySanctoralResolver.celebration(effectiveDate) }
    val path = remember(effectiveDate, celebration?.key) {
        LiturgyMissalResolver.document(effectiveDate, celebration?.key)
    }
    var document by remember(path) { mutableStateOf<LiturgyArchiveDocument?>(null) }

    LaunchedEffect(path) {
        document = if (path.isBlank()) null else withContext(Dispatchers.IO) {
            archive.documentByPath("missal", path)
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "Missal de hoje",
            style = MaterialTheme.typography.titleMedium,
            color = SantaWine,
            fontWeight = FontWeight.Bold,
        )
        celebration?.name?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            document?.let { current ->
                AssistChip(
                    onClick = { onDocument(current) },
                    leadingIcon = { Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = null) },
                    label = { Text("Próprio do dia") },
                )
            }
            AssistChip(
                onClick = { onMenu(LiturgyFixedMenu("Ordinário da Missa", LiturgyArchiveMenus.ordinaryMass)) },
                leadingIcon = { Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = null) },
                label = { Text("Ordinário") },
            )
            AssistChip(
                onClick = { onMenu(LiturgyFixedMenu("Orações Eucarísticas", LiturgyArchiveMenus.eucharisticPrayers)) },
                leadingIcon = { Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = null) },
                label = { Text("Orações Eucarísticas") },
            )
            AssistChip(
                onClick = { onMenu(LiturgyFixedMenu("Prefácios Próprios", LiturgyArchiveMenus.properPrefaces)) },
                leadingIcon = { Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = null) },
                label = { Text("Prefácios Próprios") },
            )
            AssistChip(
                onClick = { onMenu(LiturgyFixedMenu("Prefácios dos Tempos e Comuns", LiturgyArchiveMenus.temporalPrefaces)) },
                leadingIcon = { Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = null) },
                label = { Text("Prefácios dos Tempos") },
            )
        }
        if (document == null) {
            Text(
                "Não há um próprio diário específico no pacote para esta data; os menus do Missal e o acervo completo continuam disponíveis.",
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}
