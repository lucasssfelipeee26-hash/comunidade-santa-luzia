package br.com.comunidadesantaluzia.nativeapp.features.profiles

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.MilitaryTech
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class NativeProfileRanking(
    val position: Int,
    val points: Int,
    val answered: Int,
    val hits: Int,
    val successRate: Int,
)

data class NativeTeamProfile(
    val id: String,
    val name: String,
    val function: String,
    val since: String?,
    val photo: String?,
    val bio: String,
    val ranking: NativeProfileRanking?,
)

data class ProfilesState(
    val profiles: List<NativeTeamProfile> = emptyList(),
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

internal suspend fun loadProfiles(container: AppContainer): ProfilesState {
    return when (val result = container.repository.readLocalFirst("perfis", "/api/perfis", authenticated = true)) {
        is RepositoryResult.Success -> {
            runCatching {
                val root = JSONObject(result.value)
                val array = root.optJSONArray("perfis")
                val profiles = buildList {
                    if (array != null) {
                        repeat(array.length()) { index ->
                            val item = array.optJSONObject(index) ?: return@repeat
                            val rankingJson = item.optJSONObject("ranking")
                            add(
                                NativeTeamProfile(
                                    id = item.optString("id"),
                                    name = item.optString("nome"),
                                    function = item.optString("funcao"),
                                    since = item.optString("desde").takeIf { it.isNotBlank() && it != "null" },
                                    photo = item.optString("foto").takeIf { it.isNotBlank() && it != "null" },
                                    bio = item.optString("bio"),
                                    ranking = rankingJson?.let {
                                        NativeProfileRanking(
                                            position = it.optInt("posicao"),
                                            points = it.optInt("pontos"),
                                            answered = it.optInt("quizzesRespondidos"),
                                            hits = it.optInt("acertos"),
                                            successRate = it.optInt("aproveitamento"),
                                        )
                                    },
                                ),
                            )
                        }
                    }
                }
                ProfilesState(profiles = profiles, fromCache = result.fromCache, loading = false)
            }.getOrElse { ProfilesState(loading = false, error = "Os perfis salvos estão em formato inválido.") }
        }
        is RepositoryResult.Failure -> ProfilesState(loading = false, error = result.message)
        is RepositoryResult.Queued -> ProfilesState(loading = false, error = "A leitura de perfis não deve entrar em fila.")
    }
}

@Composable
internal fun ProfilesScreen(container: AppContainer) {
    var state by remember { mutableStateOf(ProfilesState()) }
    var search by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<NativeTeamProfile?>(null) }

    LaunchedEffect(Unit) { state = loadProfiles(container) }

    val filtered = remember(state.profiles, search) {
        val query = search.trim().lowercase()
        if (query.isBlank()) state.profiles
        else state.profiles.filter { profile ->
            "${profile.name} ${profile.function} ${profile.bio}".lowercase().contains(query)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text("Perfis da equipe", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = SantaWine)
                Text(
                    if (state.fromCache) "Perfis salvos neste aparelho · modo offline" else "Deslize para o lado como nos Status ou pesquise pelo nome.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = .68f),
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                    label = { Text("Buscar perfil por nome") },
                )
            }
        }

        when {
            state.loading -> item {
                Box(Modifier.fillMaxWidth().padding(36.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
            state.error != null -> item {
                Card(Modifier.padding(horizontal = 16.dp)) { Text(state.error.orEmpty(), Modifier.padding(16.dp)) }
            }
            filtered.isEmpty() -> item {
                Text("Nenhum perfil encontrado.", Modifier.fillMaxWidth().padding(24.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
            else -> item {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(filtered, key = { it.id }) { profile ->
                        ProfileStatusBubble(profile = profile, onClick = { selected = profile })
                    }
                }
            }
        }
    }

    selected?.let { profile ->
        ProfileDialog(profile = profile, onClose = { selected = null })
    }
}

@Composable
private fun ProfileStatusBubble(profile: NativeTeamProfile, onClick: () -> Unit) {
    Column(
        modifier = Modifier.size(width = 84.dp, height = 106.dp).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(68.dp)
                .clip(CircleShape)
                .background(SantaGold)
                .padding(2.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surface)
                .padding(2.dp),
            contentAlignment = Alignment.Center,
        ) {
            ProfilePhoto(source = profile.photo, name = profile.name, circular = true)
        }
        Text(
            shortName(profile.name),
            modifier = Modifier.padding(top = 5.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            profile.ranking?.let { "${it.position}º · ${it.points} pts" } ?: profile.function,
            style = MaterialTheme.typography.labelSmall,
            color = SantaWine,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ProfileDialog(profile: NativeTeamProfile, onClose: () -> Unit) {
    Dialog(onDismissRequest = onClose) {
        Surface(
            modifier = Modifier.fillMaxWidth().fillMaxHeight(.88f),
            shape = RoundedCornerShape(28.dp),
            tonalElevation = 8.dp,
        ) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 18.dp, top = 10.dp, end = 8.dp, bottom = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("PERFIL DA EQUIPE", style = MaterialTheme.typography.labelSmall, color = SantaWine, fontWeight = FontWeight.Bold)
                        Text(profile.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                    }
                    IconButton(onClick = onClose) { Icon(Icons.Rounded.Close, contentDescription = "Fechar perfil", tint = SantaWine) }
                }
                HorizontalDivider()
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(.46f)
                                .aspectRatio(4f / 5f)
                                .border(3.dp, SantaGold, RoundedCornerShape(22.dp))
                                .padding(4.dp)
                                .clip(RoundedCornerShape(17.dp))
                                .background(SantaWine.copy(alpha = .07f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            ProfilePhoto(source = profile.photo, name = profile.name, circular = false)
                        }
                    }
                    item { Text(profile.name, style = MaterialTheme.typography.headlineSmall, color = SantaWine, fontWeight = FontWeight.Bold) }
                    item { Text("${profile.function}${profile.since?.let { " · desde ${formatSince(it)}" } ?: ""}", fontWeight = FontWeight.SemiBold) }
                    item {
                        Card(Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) {
                                Text("Recado", style = MaterialTheme.typography.labelMedium, color = SantaWine, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(6.dp))
                                Text(profile.bio.ifBlank { "Este membro ainda não adicionou um recado." })
                            }
                        }
                    }
                    item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ProfileStat(Icons.Rounded.EmojiEvents, profile.ranking?.position?.let { "${it}º" } ?: "—", "Classificação", Modifier.weight(1f))
                            ProfileStat(Icons.Rounded.MilitaryTech, (profile.ranking?.points ?: 0).toString(), "Pontos", Modifier.weight(1f))
                            ProfileStat(Icons.Rounded.Verified, "${profile.ranking?.successRate ?: 0}%", "Aproveitamento", Modifier.weight(1f))
                        }
                    }
                    item {
                        Text(
                            "Faltas, advertências, justificativas e observações continuam privadas.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = .64f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileStat(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, label: String, modifier: Modifier) {
    Card(modifier) {
        Column(Modifier.fillMaxWidth().padding(vertical = 12.dp, horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null, tint = SantaWine)
            Text(value, fontWeight = FontWeight.Bold, color = SantaWine)
            Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ProfilePhoto(source: String?, name: String, circular: Boolean) {
    val bitmap by produceState<ImageBitmap?>(initialValue = null, source) {
        value = source?.let { loadBitmap(it) }
    }
    val shape = if (circular) CircleShape else RoundedCornerShape(16.dp)
    if (bitmap != null) {
        Image(
            bitmap = bitmap!!,
            contentDescription = "Foto de $name",
            modifier = Modifier.fillMaxSize().clip(shape),
            contentScale = if (circular) ContentScale.Crop else ContentScale.Fit,
        )
    } else {
        Box(Modifier.fillMaxSize().clip(shape).background(SantaWine.copy(alpha = .10f)), contentAlignment = Alignment.Center) {
            Text(initials(name), color = SantaWine, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
    }
}

private suspend fun loadBitmap(source: String): ImageBitmap? = withContext(Dispatchers.IO) {
    runCatching {
        val bytes = when {
            source.startsWith("data:image/") -> Base64.decode(source.substringAfter("base64,"), Base64.DEFAULT)
            source.startsWith("https://") -> URL(source).openStream().use { it.readBytes() }
            else -> return@runCatching null
        }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
    }.getOrNull()
}

private fun initials(name: String): String = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }
private fun shortName(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when (parts.size) {
        0 -> "Perfil"
        1 -> parts.first()
        else -> "${parts.first()} ${parts.last()}"
    }
}
private fun formatSince(value: String): String {
    val parts = value.split('-')
    if (parts.size < 2) return value
    val month = parts.getOrNull(1)?.toIntOrNull() ?: return value
    val names = listOf("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro")
    return "${names.getOrElse(month - 1) { parts[1] }} de ${parts[0]}"
}
