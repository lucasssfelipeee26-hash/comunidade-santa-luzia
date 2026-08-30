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
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyBiennialResolver
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyCalendarResolver
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyOfficeHour
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgySanctoralResolver
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.OfflineLiturgyArchiveRepository
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private data class ResolvedOfficeItem(
    val label: String,
    val document: LiturgyArchiveDocument?,
    val usesProper: Boolean = false,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun OfficeTodayQuickLinks(
    archive: OfflineLiturgyArchiveRepository,
    onDocument: (LiturgyArchiveDocument) -> Unit,
) {
    val today = remember { LiturgicalReadingProgress.todayCuiaba() }
    val effectiveDate = remember(today) { today.takeIf { it.year == 2026 } ?: LocalDate.of(2026, 1, 1) }
    val celebration = remember(effectiveDate) { LiturgySanctoralResolver.celebration(effectiveDate) }
    var items by remember(effectiveDate, celebration?.key) { mutableStateOf<List<ResolvedOfficeItem>>(emptyList()) }
    var biennialDocument by remember(effectiveDate) { mutableStateOf<LiturgyArchiveDocument?>(null) }

    LaunchedEffect(effectiveDate, celebration?.key) {
        withContext(Dispatchers.IO) {
            items = buildList {
                add(
                    ResolvedOfficeItem(
                        label = "Invitatório",
                        document = archive.documentByPath("oficio", "oficio/invitatorio.html"),
                    ),
                )
                LiturgyOfficeHour.entries.forEach { hour ->
                    val properPath = LiturgyCalendarResolver.saintOfficePath(celebration?.key, hour)
                    val properDocument = properPath.takeIf { it.isNotBlank() }
                        ?.let { archive.documentByPath("oficio", it) }
                    val temporalPath = LiturgyCalendarResolver.temporalOfficePath(effectiveDate, hour)
                    val temporalDocument = archive.documentByPath("oficio", temporalPath)
                    add(
                        ResolvedOfficeItem(
                            label = hour.label,
                            document = properDocument ?: temporalDocument,
                            usesProper = properDocument != null,
                        ),
                    )
                }
            }
            biennialDocument = archive.documentByPath("oficio", LiturgyBiennialResolver.document(effectiveDate))
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "Ofício de hoje",
            style = MaterialTheme.typography.titleMedium,
            color = SantaWine,
            fontWeight = FontWeight.Bold,
        )
        celebration?.name?.let { name ->
            Text(name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        }
        Text(
            "Semana ${LiturgyCalendarResolver.psalterWeek(effectiveDate)} do Saltério · calendário do Brasil · acesso direto offline",
            style = MaterialTheme.typography.bodySmall,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items.forEach { item ->
                AssistChip(
                    onClick = { item.document?.let(onDocument) },
                    enabled = item.document != null,
                    leadingIcon = { Icon(Icons.Rounded.Schedule, contentDescription = null) },
                    label = { Text(if (item.usesProper) "${item.label} · Próprio" else item.label) },
                )
            }
            biennialDocument?.let { document ->
                AssistChip(
                    onClick = { onDocument(document) },
                    leadingIcon = { Icon(Icons.Rounded.Schedule, contentDescription = null) },
                    label = { Text(LiturgyBiennialResolver.title(effectiveDate)) },
                )
            }
        }
        Text(
            "O Próprio do santo ou da solenidade tem precedência quando existe no acervo; as demais horas usam automaticamente o temporal correto. A leitura bienal segue o ciclo par/ímpar da Beta.",
            style = MaterialTheme.typography.labelSmall,
        )
    }
}
