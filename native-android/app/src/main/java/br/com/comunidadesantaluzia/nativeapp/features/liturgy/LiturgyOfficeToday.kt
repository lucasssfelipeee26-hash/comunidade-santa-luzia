package br.com.comunidadesantaluzia.nativeapp.features.liturgy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Schedule
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
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyCalendarResolver
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyOfficeHour
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.OfflineLiturgyArchiveRepository
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private data class ResolvedOfficeItem(
    val label: String,
    val document: LiturgyArchiveDocument?,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun OfficeTodayQuickLinks(
    archive: OfflineLiturgyArchiveRepository,
    onDocument: (LiturgyArchiveDocument) -> Unit,
) {
    val today = remember { LiturgicalReadingProgress.todayCuiaba() }
    val effectiveDate = remember(today) { today.takeIf { it.year == 2026 } ?: LocalDate.of(2026, 1, 1) }
    var items by remember(effectiveDate) { mutableStateOf<List<ResolvedOfficeItem>>(emptyList()) }

    LaunchedEffect(effectiveDate) {
        items = withContext(Dispatchers.IO) {
            buildList {
                add(
                    ResolvedOfficeItem(
                        label = "Invitatório",
                        document = archive.documentByPath("oficio", "oficio/invitatorio.html"),
                    ),
                )
                LiturgyOfficeHour.entries.forEach { hour ->
                    val path = LiturgyCalendarResolver.temporalOfficePath(effectiveDate, hour)
                    add(ResolvedOfficeItem(hour.label, archive.documentByPath("oficio", path)))
                }
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "Ofício temporal de hoje",
            style = MaterialTheme.typography.titleMedium,
            color = SantaWine,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "Semana ${LiturgyCalendarResolver.psalterWeek(effectiveDate)} do Saltério · acesso direto offline",
            style = MaterialTheme.typography.bodySmall,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items.forEach { item ->
                AssistChip(
                    onClick = { item.document?.let(onDocument) },
                    enabled = item.document != null,
                    leadingIcon = { Icon(Icons.Rounded.Schedule, contentDescription = null) },
                    label = { Text(item.label) },
                )
            }
        }
        Text(
            "Quando houver próprio de santo ou solenidade, ele terá precedência assim que o calendário próprio brasileiro estiver totalmente ligado ao resolvedor nativo.",
            style = MaterialTheme.typography.labelSmall,
        )
    }
}
