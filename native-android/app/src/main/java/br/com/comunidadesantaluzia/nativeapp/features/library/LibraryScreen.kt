package br.com.comunidadesantaluzia.nativeapp.features.library

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import org.json.JSONObject

data class NativeLibraryBook(
    val id: String,
    val title: String,
    val subtitle: String?,
    val author: String,
    val category: String,
    val saint: String?,
    val pages: Int?,
    val edition: String?,
    val period: String?,
    val description: String,
    val downloadUrl: String,
    val sourceUrl: String,
    val hosting: String,
    val featured: Boolean,
    val directDownload: Boolean,
)

data class LibraryState(
    val books: List<NativeLibraryBook> = emptyList(),
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

internal suspend fun loadLibrary(container: AppContainer): LibraryState {
    return when (val result = container.repository.readLocalFirst("biblioteca", "/api/biblioteca", authenticated = false)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val array = root.optJSONArray("livros")
            val books = buildList {
                if (array != null) repeat(array.length()) { index ->
                    val item = array.optJSONObject(index) ?: return@repeat
                    add(
                        NativeLibraryBook(
                            id = item.optString("id"),
                            title = item.optString("titulo"),
                            subtitle = item.optString("subtitulo").takeIf { it.isNotBlank() && it != "null" },
                            author = item.optString("autor"),
                            category = item.optString("categoria"),
                            saint = item.optString("santo").takeIf { it.isNotBlank() && it != "null" },
                            pages = if (item.isNull("paginas")) null else item.optInt("paginas").takeIf { it > 0 },
                            edition = item.optString("edicao").takeIf { it.isNotBlank() && it != "null" },
                            period = item.optString("periodo").takeIf { it.isNotBlank() && it != "null" },
                            description = item.optString("descricao"),
                            downloadUrl = item.optString("downloadUrl"),
                            sourceUrl = item.optString("fonteUrl"),
                            hosting = item.optString("hospedagem"),
                            featured = item.optBoolean("destaque"),
                            directDownload = item.optBoolean("downloadDireto"),
                        ),
                    )
                }
            }
            LibraryState(books = books, fromCache = result.fromCache, loading = false)
        }.getOrElse { LibraryState(loading = false, error = "O catálogo salvo está em formato inválido.") }
        is RepositoryResult.Failure -> LibraryState(loading = false, error = result.message)
        is RepositoryResult.Queued -> LibraryState(loading = false, error = "A leitura da biblioteca não deve entrar em fila.")
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun LibraryScreen(container: AppContainer) {
    var state by remember { mutableStateOf(LibraryState()) }
    var search by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Todos") }
    var reloadToken by remember { mutableStateOf(0) }

    LaunchedEffect(reloadToken) { state = loadLibrary(container) }

    val categories = remember(state.books) {
        listOf("Todos") + state.books.map { it.category }.filter { it.isNotBlank() }.distinct().sorted()
    }
    val filtered = remember(state.books, search, category) {
        val q = search.trim().lowercase()
        state.books.filter { book ->
            val categoryOk = category == "Todos" || book.category == category
            val haystack = listOfNotNull(book.title, book.subtitle, book.author, book.saint, book.category).joinToString(" ").lowercase()
            categoryOk && (q.isBlank() || haystack.contains(q))
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = SantaWine),
                shape = RoundedCornerShape(26.dp),
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("ACERVO PARA ESTUDO E FORMAÇÃO", style = MaterialTheme.typography.labelSmall, color = SantaGold, fontWeight = FontWeight.Black)
                    Text("Biblioteca Católica", style = MaterialTheme.typography.headlineMedium, color = SantaGold, fontWeight = FontWeight.Bold)
                    Text("O mesmo catálogo da Beta, pesquisável e mantido no cache local para continuar disponível sem internet.", color = MaterialTheme.colorScheme.onPrimary.copy(alpha = .88f))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Icon(Icons.Rounded.VerifiedUser, contentDescription = null, tint = SantaGold, modifier = Modifier.size(18.dp))
                        Text("Referência preservada para a fonte original", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimary)
                    }
                }
            }
        }
        item {
            if (state.fromCache) {
                AssistChip(onClick = {}, label = { Text("Biblioteca salva neste aparelho · modo offline") }, leadingIcon = { Icon(Icons.Rounded.AutoStories, null) })
            }
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                label = { Text("Pesquisar livro, autor, santo ou tema") },
            )
            Spacer(Modifier.size(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                categories.forEach { item ->
                    FilterChip(selected = category == item, onClick = { category = item }, label = { Text(item) })
                }
            }
        }
        when {
            state.loading -> item {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
            state.error != null -> item {
                Card {
                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error)
                        Button(onClick = { state = LibraryState(); reloadToken++ }) { Text("Tentar novamente") }
                    }
                }
            }
            filtered.isEmpty() -> item {
                Card { Text("Nenhuma obra encontrada com esses filtros.", Modifier.padding(22.dp)) }
            }
            else -> {
                item {
                    Text("${filtered.size} obra(s) encontrada(s)", style = MaterialTheme.typography.labelLarge, color = SantaWine, fontWeight = FontWeight.Bold)
                }
                items(filtered, key = { it.id }) { book -> LibraryBookCard(book) }
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = SantaGold.copy(alpha = .13f))) {
                        Text(
                            "Os PDFs continuam hospedados nas fontes originais. A versão nativa preserva os links de download e da fonte, sem copiar o acervo para o servidor da Comunidade Santa Luzia.",
                            Modifier.padding(16.dp),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LibraryBookCard(book: NativeLibraryBook) {
    val uriHandler = LocalUriHandler.current
    Card(shape = RoundedCornerShape(20.dp), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(
                modifier = Modifier.size(width = 86.dp, height = 132.dp).background(SantaWine, RoundedCornerShape(12.dp)).padding(10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.AutoStories, contentDescription = null, tint = SantaGold, modifier = Modifier.size(28.dp))
                    Text("Biblioteca\nCatólica", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(book.category.uppercase(), style = MaterialTheme.typography.labelSmall, color = SantaGold, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                    if (book.featured) Text("DESTAQUE", style = MaterialTheme.typography.labelSmall, color = SantaWine, fontWeight = FontWeight.Black)
                }
                Text(book.title, style = MaterialTheme.typography.titleMedium, color = SantaWine, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                book.subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                Text("Autor: ${book.author}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    book.edition?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
                    book.pages?.let { Text("$it págs.", style = MaterialTheme.typography.labelSmall) }
                    book.period?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
                }
                Text(book.description, style = MaterialTheme.typography.bodySmall, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { if (book.downloadUrl.startsWith("http")) uriHandler.openUri(book.downloadUrl) },
                        modifier = Modifier.weight(1f),
                        enabled = book.downloadUrl.startsWith("http"),
                    ) {
                        Icon(if (book.directDownload) Icons.Rounded.Download else Icons.Rounded.OpenInNew, null, Modifier.size(17.dp))
                        Spacer(Modifier.size(5.dp))
                        Text(if (book.directDownload) "Baixar" else "Abrir")
                    }
                    OutlinedButton(
                        onClick = { if (book.sourceUrl.startsWith("http")) uriHandler.openUri(book.sourceUrl) },
                        modifier = Modifier.weight(1f),
                        enabled = book.sourceUrl.startsWith("http"),
                    ) {
                        Icon(Icons.Rounded.OpenInNew, null, Modifier.size(17.dp))
                        Spacer(Modifier.size(5.dp))
                        Text("Fonte")
                    }
                }
            }
        }
    }
}
