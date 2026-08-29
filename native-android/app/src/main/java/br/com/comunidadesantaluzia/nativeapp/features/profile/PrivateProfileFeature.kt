package br.com.comunidadesantaluzia.nativeapp.features.profile

import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.AddAPhoto
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.core.media.loadProfileBitmap
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaGold
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class PrivateProfile(
    val id: String,
    val name: String,
    val role: String,
    val birthDate: String,
    val vowsDate: String,
    val photo: String?,
    val bio: String,
)
data class PrivateProfileState(
    val profile: PrivateProfile? = null,
    val fromCache: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
)

internal suspend fun loadPrivateProfile(container: AppContainer): PrivateProfileState {
    return when (val result = container.repository.readLocalFirst("perfil", "/api/perfil", authenticated = true)) {
        is RepositoryResult.Success -> runCatching {
            val item = JSONObject(result.value).getJSONObject("perfil")
            PrivateProfileState(
                profile = PrivateProfile(
                    id = item.optString("id"),
                    name = item.optString("nome"),
                    role = item.optString("funcao"),
                    birthDate = item.optString("data_nascimento").takeUnless { it == "null" }.orEmpty(),
                    vowsDate = item.optString("data_votos").takeUnless { it == "null" }.orEmpty()
                        .ifBlank { item.optString("desde").takeUnless { it == "null" }.orEmpty() },
                    photo = item.optString("foto").takeIf { it.isNotBlank() && it != "null" },
                    bio = item.optString("bio"),
                ),
                fromCache = result.fromCache,
                loading = false,
            )
        }.getOrElse { PrivateProfileState(loading = false, error = "O perfil salvo está em formato inválido.") }
        is RepositoryResult.Failure -> PrivateProfileState(loading = false, error = result.message)
        is RepositoryResult.Queued -> PrivateProfileState(loading = false, error = "A leitura do perfil não deve entrar em fila.")
    }
}

private fun PrivateProfile.toCacheJson(): String = JSONObject().apply {
    put("perfil", JSONObject().apply {
        put("id", id); put("nome", name); put("funcao", role); put("data_nascimento", birthDate); put("data_votos", vowsDate); put("foto", photo); put("bio", bio)
    })
}.toString()

@Composable
internal fun PrivateProfileScreen(container: AppContainer) {
    var state by remember { mutableStateOf(PrivateProfileState()) }
    var name by remember { mutableStateOf("") }
    var birth by remember { mutableStateOf("") }
    var vows by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<String?>(null) }
    var feedback by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        state = loadPrivateProfile(container)
        state.profile?.let { p -> name = p.name; birth = p.birthDate; vows = p.vowsDate; bio = p.bio; photo = p.photo }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val data = withContext(Dispatchers.IO) {
                runCatching {
                    val mime = context.contentResolver.getType(uri).orEmpty().lowercase()
                    if (mime !in setOf("image/jpeg", "image/jpg", "image/png", "image/webp")) return@runCatching null
                    val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
                        val buffer = ByteArray(1_050_000)
                        var total = 0
                        while (total < buffer.size) {
                            val read = input.read(buffer, total, buffer.size - total)
                            if (read <= 0) break
                            total += read
                        }
                        if (total > 1_000_000) null else buffer.copyOf(total)
                    } ?: return@runCatching null
                    "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
                }.getOrNull()
            }
            if (data == null) feedback = "Escolha uma imagem JPEG, PNG ou WebP de até 1 MB."
            else { photo = data; feedback = "Nova foto pronta para salvar." }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text("Meu perfil", style = MaterialTheme.typography.headlineMedium, color = SantaWine, fontWeight = FontWeight.Bold)
            Text("Informações pessoais e recado público", style = MaterialTheme.typography.bodySmall)
            if (state.fromCache) AssistChip(onClick = {}, label = { Text("Perfil salvo neste aparelho · offline") }, leadingIcon = { Icon(Icons.Rounded.WifiOff, null) })
        }
        when {
            state.loading -> item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            state.error != null -> item { Card { Text(state.error.orEmpty(), Modifier.padding(18.dp), color = MaterialTheme.colorScheme.error) } }
            state.profile != null -> {
                item {
                    Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            ProfileImage(photo = photo, name = name)
                            Text(state.profile?.role.orEmpty(), color = SantaWine, fontWeight = FontWeight.SemiBold)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(onClick = { picker.launch("image/*") }) {
                                    Icon(Icons.Rounded.AddAPhoto, null, Modifier.size(18.dp)); Text(" Alterar foto")
                                }
                                if (photo != null) OutlinedButton(onClick = { photo = null }) { Text("Remover") }
                            }
                        }
                    }
                }
                item {
                    Card(shape = RoundedCornerShape(24.dp)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedTextField(value = name, onValueChange = { if (it.length <= 100) name = it }, label = { Text("Nome") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(value = birth, onValueChange = { birth = it.take(10) }, label = { Text("Data de nascimento · AAAA-MM-DD") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(value = vows, onValueChange = { vows = it.take(10) }, label = { Text("Data de profissão dos votos · AAAA-MM-DD") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(
                                value = bio,
                                onValueChange = { if (it.length <= 280) bio = it },
                                label = { Text("Recado / bio") },
                                supportingText = { Text("${bio.length}/280 · emojis são permitidos") },
                                modifier = Modifier.fillMaxWidth(),
                                minLines = 3,
                            )
                            Button(
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !saving && name.trim().length >= 2,
                                onClick = {
                                    val base = state.profile ?: return@Button
                                    val updated = base.copy(name = name.trim(), birthDate = birth.trim(), vowsDate = vows.trim(), bio = bio.trim(), photo = photo)
                                    val payload = JSONObject().apply {
                                        put("nome", updated.name); put("dataNascimento", updated.birthDate); put("dataVotos", updated.vowsDate); put("foto", updated.photo); put("bio", updated.bio)
                                    }.toString()
                                    state = state.copy(profile = updated, fromCache = true)
                                    saving = true; feedback = ""
                                    scope.launch {
                                        when (val result = container.repository.mutate("PATCH", "/api/perfil", payload, "perfil", updated.toCacheJson())) {
                                            is RepositoryResult.Success -> { state = loadPrivateProfile(container); feedback = "Perfil atualizado." }
                                            is RepositoryResult.Queued -> feedback = "Alterações salvas no aparelho e aguardando sincronização."
                                            is RepositoryResult.Failure -> feedback = result.message
                                        }
                                        saving = false
                                    }
                                },
                            ) {
                                Icon(Icons.Rounded.Save, null, Modifier.size(18.dp)); Text(if (saving) " Salvando..." else " Salvar alterações")
                            }
                            if (feedback.isNotBlank()) Text(feedback, style = MaterialTheme.typography.bodySmall, color = SantaWine)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileImage(photo: String?, name: String) {
    val context = LocalContext.current
    val bitmap by produceState<ImageBitmap?>(initialValue = null, photo) {
        value = loadProfileBitmap(context.applicationContext, photo)
    }
    if (bitmap != null) {
        Image(bitmap = bitmap!!, contentDescription = "Foto do perfil", modifier = Modifier.size(112.dp).clip(CircleShape), contentScale = ContentScale.Crop)
    } else {
        Box(Modifier.size(112.dp).clip(CircleShape).background(SantaWine.copy(alpha = .1f)), contentAlignment = Alignment.Center) {
            if (name.isBlank()) Icon(Icons.Rounded.AccountCircle, null, tint = SantaWine, modifier = Modifier.size(58.dp))
            else Text(name.trim().split(Regex("\\s+")).take(2).joinToString("") { it.first().uppercase() }, color = SantaWine, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black)
        }
    }
}
