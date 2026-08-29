package br.com.comunidadesantaluzia.nativeapp.features.liturgy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.Church
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgicalReadingProgress
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyArchiveDocument
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyDay
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.LiturgyReading
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.OfflineLiturgyArchiveRepository
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private enum class CenterSection(val label: String) {
    Today("Hoje"), Office("Ofício"), Liturgy("Liturgia"), Missal("Missal"), More("Mais")
}

private data class CenterCategory(val id: String, val label: String)

private val liturgyCategories = listOf(
    CenterCategory("evangelho", "Evangelhos e Lectio Divina"),
    CenterCategory("lecionario", "Lecionário"),
)

private val moreCategories = listOf(
    CenterCategory("rosario", "Santo Rosário"),
    CenterCategory("salterio", "Saltério"),
    CenterCategory("catequeses", "Catequeses"),
    CenterCategory("comentarios", "Comentários"),
    CenterCategory("geral", "Documentos gerais"),
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun LiturgyCenterScreen(container: AppContainer) {
    val context = LocalContext.current
    val archive = remember { OfflineLiturgyArchiveRepository(context.applicationContext) }
    var section by remember { mutableStateOf(CenterSection.Today) }
    var categoryId by remember { mutableStateOf("oficio") }
    var selectedDocument by remember { mutableStateOf<LiturgyArchiveDocument?>(null) }

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Rounded.Church, contentDescription = null, tint = SantaWine)
                Column {
                    Text("Central Litúrgica", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text("Acervo iLiturgia completo no aparelho", style = MaterialTheme.typography.bodySmall)
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                CenterSection.entries.forEach { item ->
                    FilterChip(
                        selected = section == item,
                        onClick = {
                            section = item
                            selectedDocument = null
                            categoryId = when (item) {
                                CenterSection.Office -> "oficio"
                                CenterSection.Liturgy -> "evangelho"
                                CenterSection.Missal -> "missal"
                                CenterSection.More -> "rosario"
                                CenterSection.Today -> categoryId
                            }
                        },
                        label = { Text(item.label) },
                    )
                }
            }
        }

        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (section) {
                CenterSection.Today -> TodayCenterContent(container)
                CenterSection.Office -> ArchiveCategoryContent(archive, "oficio", "Liturgia das Horas / Ofício", selectedDocument) { selectedDocument = it }
                CenterSection.Missal -> ArchiveCategoryContent(archive, "missal", "Missal e ritos", selectedDocument) { selectedDocument = it }
                CenterSection.Liturgy -> {
                    CategoryGroupContent(
                        archive = archive,
                        categories = liturgyCategories,
                        selectedCategory = categoryId,
                        onCategory = { categoryId = it; selectedDocument = null },
                        selectedDocument = selectedDocument,
                        onDocument = { selectedDocument = it },
                    )
                }
                CenterSection.More -> {
                    CategoryGroupContent(
                        archive = archive,
                        categories = moreCategories,
                        selectedCategory = categoryId,
                        onCategory = { categoryId = it; selectedDocument = null },
                        selectedDocument = selectedDocument,
                        onDocument = { selectedDocument = it },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CategoryGroupContent(
    archive: OfflineLiturgyArchiveRepository,
    categories: List<CenterCategory>,
    selectedCategory: String,
    onCategory: (String) -> Unit,
    selectedDocument: LiturgyArchiveDocument?,
    onDocument: (LiturgyArchiveDocument?) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        FlowRow(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            categories.forEach { category ->
                FilterChip(selected = selectedCategory == category.id, onClick = { onCategory(category.id) }, label = { Text(category.label) })
            }
        }
        val label = categories.firstOrNull { it.id == selectedCategory }?.label.orEmpty()
        Box(Modifier.weight(1f)) {
            ArchiveCategoryContent(archive, selectedCategory, label, selectedDocument, onDocument)
        }
    }
}

@Composable
private fun ArchiveCategoryContent(
    archive: OfflineLiturgyArchiveRepository,
    categoryId: String,
    label: String,
    selectedDocument: LiturgyArchiveDocument?,
    onDocument: (LiturgyArchiveDocument?) -> Unit,
) {
    if (selectedDocument != null) {
        ArchiveDocumentReader(selectedDocument, onBack = { onDocument(null) })
        return
    }

    var documents by remember(categoryId) { mutableStateOf<List<LiturgyArchiveDocument>>(emptyList()) }
    var loading by remember(categoryId) { mutableStateOf(true) }
    var error by remember(categoryId) { mutableStateOf<String?>(null) }
    var search by remember(categoryId) { mutableStateOf("") }

    LaunchedEffect(categoryId) {
        loading = true
        error = null
        runCatching { withContext(Dispatchers.IO) { archive.documents(categoryId) } }
            .onSuccess { documents = it }
            .onFailure { error = "Não foi possível abrir esta parte do acervo interno." }
        loading = false
    }

    val filtered = remember(documents, search) {
        val q = search.trim().lowercase()
        if (q.isBlank()) documents.take(400)
        else documents.asSequence().filter { doc ->
            doc.title.lowercase().contains(q) || doc.path.lowercase().contains(q) || doc.text.lowercase().contains(q) || doc.html.lowercase().contains(q)
        }.take(400).toList()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(label, style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
            val total = archive.categories.firstOrNull { it.id == categoryId }?.total ?: documents.size
            Text("$total documento(s) empacotados para uso offline.", style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                singleLine = true,
                leadingIcon = { Icon(Icons.Rounded.Search, null) },
                label = { Text("Pesquisar neste acervo") },
            )
        }
        when {
            loading -> item { Box(Modifier.fillMaxWidth().padding(36.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            error != null -> item { Card { Text(error.orEmpty(), Modifier.padding(16.dp), color = MaterialTheme.colorScheme.error) } }
            filtered.isEmpty() -> item { Card { Text("Nenhum documento encontrado.", Modifier.padding(16.dp)) } }
            else -> {
                item {
                    if (documents.size > 400 && search.isBlank()) {
                        AssistChip(onClick = {}, label = { Text("Mostrando os primeiros 400 · use a busca para localizar qualquer documento") })
                    }
                }
                items(filtered, key = { "${it.id}:${it.path}" }) { doc ->
                    Card(onClick = { onDocument(doc) }) {
                        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.AutoMirrored.Rounded.MenuBook, contentDescription = null, tint = SantaGold)
                            Column(Modifier.weight(1f)) {
                                Text(doc.title.ifBlank { doc.path }, color = SantaWine, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Text(doc.path, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ArchiveDocumentReader(document: LiturgyArchiveDocument, onBack: () -> Unit) {
    val text = remember(document.id, document.path) { document.readableText() }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Rounded.ArrowBack, contentDescription = "Voltar") }
                Column(Modifier.weight(1f)) {
                    Text(document.title.ifBlank { "Documento litúrgico" }, style = MaterialTheme.typography.titleLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text(document.path, style = MaterialTheme.typography.labelSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
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

@Composable
private fun TodayCenterContent(container: AppContainer) {
    val today = remember { LiturgicalReadingProgress.todayCuiaba() }
    val effectiveDate = remember(today) { today.takeIf { it.year == 2026 } ?: LocalDate.of(2026, 1, 1) }
    val day = remember(effectiveDate) { container.liturgy.day(effectiveDate) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card {
                Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.Schedule, null, tint = SantaWine)
                        Text(day?.displayDate ?: effectiveDate.toString(), color = SantaWine, fontWeight = FontWeight.Bold)
                    }
                    Text(day?.celebration ?: "Liturgia diária", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    if (day?.color?.isNotBlank() == true) Text("Cor litúrgica: ${day.color}", style = MaterialTheme.typography.bodySmall)
                    if (today.year != 2026) Text("O pacote integral disponível nesta versão corresponde ao ano litúrgico de 2026.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (day == null) {
            item { Card { Text("A liturgia deste dia não foi localizada no pacote offline.", Modifier.padding(17.dp)) } }
        } else {
            readingItems("Primeira Leitura", day.firstReading)
            readingItems("Salmo", day.psalm)
            readingItems("Segunda Leitura", day.secondReading)
            readingItems("Evangelho", day.gospel)
            prayerItem("Oração da coleta", day.collect)
            prayerItem("Oração sobre as oferendas", day.offerings)
            prayerItem("Oração depois da comunhão", day.communion)
        }
        item {
            Card {
                Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Rounded.AutoStories, null, tint = SantaGold)
                    Text("Ofício, Missal, Rosário, Saltério, catequeses, comentários, Evangelhos/Lectio Divina e Lecionário também estão dentro deste APK.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.readingItems(title: String, readings: List<LiturgyReading>) {
    if (readings.isEmpty()) return
    item { Text(title, style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold) }
    items(readings) { reading ->
        Card {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (reading.title.isNotBlank()) Text(reading.title, fontWeight = FontWeight.SemiBold)
                if (reading.reference.isNotBlank()) Text(reading.reference, color = SantaWine, style = MaterialTheme.typography.labelLarge)
                SelectionContainer { Text(reading.text, style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.prayerItem(title: String, text: String) {
    if (text.isBlank()) return
    item {
        Card {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(title, color = SantaWine, fontWeight = FontWeight.Bold)
                SelectionContainer { Text(text, style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}
