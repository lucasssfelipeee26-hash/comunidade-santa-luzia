package br.com.comunidadesantaluzia.nativeapp.features.admin

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

internal data class SiteThemeOption(
    val id: String,
    val name: String,
    val description: String,
    val colors: List<String>,
)

private data class SiteThemeState(
    val savedId: String = "manto-rubi",
    val options: List<SiteThemeOption> = fallbackThemes,
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

private val fallbackThemes = listOf(
    SiteThemeOption("manto-rubi", "Manto Rubi + Dourado", "Vermelho rubi inspirado no manto de Santa Luzia, com detalhes dourados.", listOf("#7b1326", "#5a0b18", "#d4af37")),
    SiteThemeOption("bordo-ouro", "Bordô + Ouro", "Uma combinação mais sóbria, com bordô profundo e ouro antigo.", listOf("#5d1020", "#3b0710", "#c99a2e")),
    SiteThemeOption("marfim-rubi", "Marfim + Rubi", "Tema claro com rubi nos destaques e dourado suave.", listOf("#8a2035", "#fffaf2", "#d8b45a")),
    SiteThemeOption("vinho-dourado", "Vinho Escuro + Dourado", "Tema solene para o site público, com vinho escuro e dourado luminoso.", listOf("#490b17", "#2f060d", "#dfbb55")),
)

private suspend fun loadSiteTheme(container: AppContainer): SiteThemeState =
    when (val result = container.repository.readLocalFirst("site-theme", "/api/configuracao/tema", authenticated = false)) {
        is RepositoryResult.Success -> runCatching {
            val root = JSONObject(result.value)
            val optionsJson = root.optJSONArray("opcoes") ?: JSONArray()
            val parsed = buildList {
                repeat(optionsJson.length()) { index ->
                    val item = optionsJson.optJSONObject(index) ?: return@repeat
                    val colorsJson = item.optJSONArray("cores") ?: JSONArray()
                    val colors = List(colorsJson.length()) { colorsJson.optString(it) }.filter { it.matches(Regex("^#[0-9a-fA-F]{6}$")) }
                    val id = item.optString("id")
                    if (id.isNotBlank() && colors.size >= 3) {
                        add(SiteThemeOption(id, item.optString("nome", id), item.optString("descricao"), colors.take(3)))
                    }
                }
            }
            val options = parsed.ifEmpty { fallbackThemes }
            val saved = root.optString("tema", "manto-rubi").takeIf { value -> options.any { it.id == value } } ?: options.first().id
            SiteThemeState(saved, options, result.fromCache, loading = false)
        }.getOrElse { SiteThemeState(loading = false, error = "A configuração de cores salva está em formato inválido.") }
        is RepositoryResult.Failure -> SiteThemeState(options = fallbackThemes, loading = false, fromCache = true, error = result.message)
        is RepositoryResult.Queued -> SiteThemeState(options = fallbackThemes, loading = false, error = "A leitura do tema não deve entrar em fila.")
    }

@Composable
internal fun ThemeAdminScreen(container: AppContainer, onBack: () -> Unit) {
    var state by remember { mutableStateOf(SiteThemeState()) }
    var selectedId by remember { mutableStateOf("manto-rubi") }
    var feedback by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        state = loadSiteTheme(container)
        selectedId = state.savedId
    }

    val selected = state.options.firstOrNull { it.id == selectedId } ?: fallbackThemes.first()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Icon(Icons.Rounded.Palette, null, tint = SantaWine)
                    Column {
                        Text("Cores do Site", style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold)
                        Text("Temas inspirados em Santa Luzia", style = MaterialTheme.typography.bodySmall)
                    }
                }
                OutlinedButton(onClick = onBack) { Text("Voltar") }
            }
            Text("A escolha altera somente o site público. A Área Restrita permanece clara e não muda com esta configuração.", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall)
            if (state.fromCache) AssistChip(onClick = {}, label = { Text("Última configuração salva · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) })
        }

        if (state.loading) {
            item { Box(Modifier.fillMaxWidth().padding(36.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
        } else {
            item { ThemePreview(selected) }
            state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) } }
            items(state.options, key = { it.id }) { option ->
                ThemeOptionCard(
                    option = option,
                    selected = option.id == selectedId,
                    saved = option.id == state.savedId,
                    onClick = { selectedId = option.id; feedback = "" },
                )
            }
            if (feedback.isNotBlank()) item { Text(feedback, color = SantaWine, style = MaterialTheme.typography.bodySmall) }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        modifier = Modifier.weight(1f),
                        enabled = !saving && selectedId != state.savedId,
                        onClick = { selectedId = state.savedId; feedback = "Seleção restaurada para o tema atualmente salvo." },
                    ) {
                        Icon(Icons.Rounded.RestartAlt, null, Modifier.size(18.dp))
                        Text(" Restaurar")
                    }
                    Button(
                        modifier = Modifier.weight(1f),
                        enabled = !saving && selectedId != state.savedId,
                        onClick = {
                            saving = true
                            feedback = ""
                            scope.launch {
                                val payload = JSONObject().put("tema", selectedId).toString()
                                when (val result = container.repository.mutateOnlineOnly("POST", "/api/configuracao/tema", payload)) {
                                    is RepositoryResult.Success -> {
                                        state = loadSiteTheme(container)
                                        selectedId = state.savedId
                                        feedback = "Tema salvo. A nova paleta agora vale para o site público."
                                    }
                                    is RepositoryResult.Failure -> feedback = result.message
                                    is RepositoryResult.Queued -> feedback = "Alteração global de tema não pode ficar em fila offline."
                                }
                                saving = false
                            }
                        },
                    ) {
                        Icon(Icons.Rounded.Save, null, Modifier.size(18.dp))
                        Text(if (saving) " Salvando…" else " Salvar tema")
                    }
                }
            }
        }
    }
}

@Composable
private fun ThemePreview(theme: SiteThemeOption) {
    val primary = themeColor(theme.colors.getOrElse(0) { "#7b1326" })
    val accent = themeColor(theme.colors.getOrElse(2) { "#d4af37" })
    Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column {
            Column(Modifier.fillMaxWidth().background(primary).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("PRÉVIA DO SITE PÚBLICO", style = MaterialTheme.typography.labelSmall, color = accent, fontWeight = FontWeight.Black)
                Text("Comunidade Santa Luzia", style = MaterialTheme.typography.titleLarge, color = accent, fontWeight = FontWeight.Bold)
                Text("Acólitos e Coroinhas São Padre Pio", color = Color.White.copy(alpha = .85f), style = MaterialTheme.typography.bodySmall)
            }
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text(theme.name, color = primary, fontWeight = FontWeight.Bold)
                Text(theme.description, style = MaterialTheme.typography.bodySmall)
                Text("Botão de exemplo", Modifier.padding(top = 10.dp).clip(RoundedCornerShape(8.dp)).background(primary).padding(horizontal = 12.dp, vertical = 8.dp), color = Color.White, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ThemeOptionCard(option: SiteThemeOption, selected: Boolean, saved: Boolean, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().then(if (selected) Modifier.border(2.dp, SantaWine, RoundedCornerShape(20.dp)) else Modifier),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(option.name, color = SantaWine, fontWeight = FontWeight.Bold)
                    Text(option.description, style = MaterialTheme.typography.bodySmall)
                }
                if (selected) Icon(Icons.Rounded.CheckCircle, "Selecionado", tint = SantaWine)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                option.colors.take(3).forEach { color ->
                    Box(Modifier.weight(1f).size(height = 36.dp, width = 1.dp).clip(RoundedCornerShape(8.dp)).background(themeColor(color)))
                }
            }
            Text(if (saved) "Tema atual" else if (selected) "Selecionado" else "Ver prévia", style = MaterialTheme.typography.labelSmall, color = SantaWine)
        }
    }
}

private fun themeColor(hex: String): Color = runCatching { Color(AndroidColor.parseColor(hex)) }.getOrDefault(SantaWine)
