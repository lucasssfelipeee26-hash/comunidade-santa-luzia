package br.com.comunidadesantaluzia.nativeapp.features.liturgy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoStories
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
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyArchiveDocument
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyDay
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyDayContentResolver
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.OfflineLiturgyArchiveRepository
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private data class TodayDocumentLink(
    val label: String,
    val document: LiturgyArchiveDocument,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TodayArchiveQuickLinks(
    archive: OfflineLiturgyArchiveRepository,
    date: LocalDate,
    day: LiturgyDay,
    onDocument: (LiturgyArchiveDocument) -> Unit,
) {
    var links by remember(date, day.celebration) { mutableStateOf<List<TodayDocumentLink>>(emptyList()) }

    LaunchedEffect(date, day.celebration) {
        links = withContext(Dispatchers.IO) {
            buildList {
                fun addIfPresent(label: String, category: String, path: String) {
                    if (path.isBlank()) return
                    archive.documentByPath(category, path)?.let { add(TodayDocumentLink(label, it)) }
                }

                val gospel = day.gospel.firstOrNull()
                addIfPresent(
                    "Evangelho e Lectio Divina",
                    "evangelho",
                    LiturgyDayContentResolver.gospelDocument(gospel?.reference, gospel?.title),
                )
                addIfPresent(
                    "Lecionário do dia",
                    "lecionario",
                    LiturgyDayContentResolver.lectionaryDocument(day.firstReading, day.secondReading, day.gospel),
                )
                addIfPresent(
                    "Catequese de Laudes",
                    "catequeses",
                    LiturgyDayContentResolver.catechesisDocument(date, "laudes"),
                )
                addIfPresent(
                    "Catequese de Vésperas",
                    "catequeses",
                    LiturgyDayContentResolver.catechesisDocument(date, "vesperas"),
                )
                addIfPresent(
                    "Rosário do dia",
                    "rosario",
                    LiturgyDayContentResolver.rosaryDocument(date),
                )
            }
        }
    }

    if (links.isEmpty()) return

    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "Conteúdo relacionado de hoje",
            style = MaterialTheme.typography.titleMedium,
            color = SantaWine,
            fontWeight = FontWeight.Bold,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            links.forEach { link ->
                AssistChip(
                    onClick = { onDocument(link.document) },
                    leadingIcon = { Icon(Icons.Rounded.AutoStories, contentDescription = null) },
                    label = { Text(link.label) },
                )
            }
        }
    }
}
