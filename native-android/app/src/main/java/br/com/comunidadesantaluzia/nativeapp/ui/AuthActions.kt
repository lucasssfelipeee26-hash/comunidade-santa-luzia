package br.com.comunidadesantaluzia.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.data.RepositoryResult
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaWine
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
internal fun AuthActions(container: AppContainer) {
    var registerOpen by remember { mutableStateOf(false) }
    var recoveryOpen by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { registerOpen = true }, modifier = Modifier.weight(1f)) { Text("Criar cadastro") }
        TextButton(onClick = { recoveryOpen = true }, modifier = Modifier.weight(1f)) { Text("Esqueci a senha") }
    }
    if (registerOpen) RegisterDialog(container) { registerOpen = false }
    if (recoveryOpen) RecoveryDialog(container) { recoveryOpen = false }
}

@Composable
private fun RegisterDialog(container: AppContainer, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var birthDate by remember { mutableStateOf("") }
    var vowsDate by remember { mutableStateOf("") }
    var function by remember { mutableStateOf("Coroinha") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(if (success) "Cadastro enviado" else "Novo cadastro") },
        text = {
            if (success) {
                Text("Seu cadastro foi criado e está aguardando aprovação da moderação. Depois da aprovação, entre normalmente com seu usuário e senha.")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { OutlinedTextField(name, { name = it.take(100) }, Modifier.fillMaxWidth(), label = { Text("Nome completo") }) }
                    item { OutlinedTextField(username, { username = it.lowercase().take(30) }, Modifier.fillMaxWidth(), label = { Text("Usuário") }, singleLine = true) }
                    item { OutlinedTextField(email, { email = it.take(254) }, Modifier.fillMaxWidth(), label = { Text("E-mail de recuperação") }, singleLine = true) }
                    item { OutlinedTextField(birthDate, { birthDate = it.take(10) }, Modifier.fillMaxWidth(), label = { Text("Nascimento · AAAA-MM-DD") }, singleLine = true) }
                    item { OutlinedTextField(vowsDate, { vowsDate = it.take(10) }, Modifier.fillMaxWidth(), label = { Text("Data de votos · opcional") }, singleLine = true) }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { function = "Coroinha" }, modifier = Modifier.weight(1f)) { Text(if (function == "Coroinha") "✓ Coroinha" else "Coroinha") }
                            OutlinedButton(onClick = { function = "Acólito" }, modifier = Modifier.weight(1f)) { Text(if (function == "Acólito") "✓ Acólito" else "Acólito") }
                        }
                    }
                    item { OutlinedTextField(password, { password = it.take(128) }, Modifier.fillMaxWidth(), label = { Text("Senha · mínimo 8") }, visualTransformation = PasswordVisualTransformation(), singleLine = true) }
                    message?.let { item { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) } }
                }
            }
        },
        confirmButton = {
            if (success) Button(onClick = onDismiss) { Text("Fechar") }
            else Button(
                enabled = !busy,
                onClick = {
                    val userRegex = Regex("^[a-z0-9][a-z0-9._-]{2,29}$")
                    when {
                        name.trim().length !in 2..100 -> message = "Informe seu nome completo."
                        !userRegex.matches(username.trim()) -> message = "O usuário precisa ter 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado."
                        !email.contains("@") -> message = "Informe um e-mail válido."
                        !Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(birthDate) -> message = "Informe a data de nascimento como AAAA-MM-DD."
                        vowsDate.isNotBlank() && !Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(vowsDate) -> message = "Informe a data de votos como AAAA-MM-DD ou deixe em branco."
                        password.length !in 8..128 -> message = "A senha deve ter entre 8 e 128 caracteres."
                        else -> scope.launch {
                            busy = true
                            message = null
                            val payload = JSONObject()
                                .put("nome", name.trim())
                                .put("usuario", username.trim())
                                .put("email", email.trim())
                                .put("senha", password)
                                .put("funcao", function)
                                .put("dataNascimento", birthDate)
                                .put("dataVotos", vowsDate)
                                .toString()
                            when (val result = container.repository.mutateOnlineOnly("POST", "/api/auth/cadastro", payload)) {
                                is RepositoryResult.Success -> success = true
                                is RepositoryResult.Failure -> message = result.message
                                is RepositoryResult.Queued -> message = "O cadastro precisa de internet."
                            }
                            busy = false
                        }
                    }
                },
            ) { Text(if (busy) "Enviando…" else "Criar cadastro") }
        },
        dismissButton = { if (!success) TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancelar") } },
    )
}

@Composable
private fun RecoveryDialog(container: AppContainer, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(1) }
    var identifier by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(if (step == 1) "Recuperar senha" else if (step == 2) "Código de recuperação" else "Senha alterada") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                when (step) {
                    1 -> {
                        Text("Informe seu usuário ou e-mail. Se a conta possuir e-mail de recuperação, será enviado um código de 6 dígitos.")
                        OutlinedTextField(identifier, { identifier = it.take(254) }, Modifier.fillMaxWidth(), label = { Text("Usuário ou e-mail") }, singleLine = true)
                    }
                    2 -> {
                        Text("O código expira em 15 minutos.")
                        OutlinedTextField(code, { code = it.filter(Char::isDigit).take(6) }, Modifier.fillMaxWidth(), label = { Text("Código de 6 dígitos") }, singleLine = true)
                        OutlinedTextField(newPassword, { newPassword = it.take(128) }, Modifier.fillMaxWidth(), label = { Text("Nova senha") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
                        OutlinedTextField(confirmPassword, { confirmPassword = it.take(128) }, Modifier.fillMaxWidth(), label = { Text("Confirmar nova senha") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
                    }
                    else -> Text("Senha alterada com sucesso. Você já pode entrar com a nova senha.", color = SantaWine)
                }
                message?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = if (step == 3) SantaWine else MaterialTheme.colorScheme.onSurface) }
            }
        },
        confirmButton = {
            when (step) {
                1 -> Button(
                    enabled = !busy && identifier.isNotBlank(),
                    onClick = {
                        scope.launch {
                            busy = true
                            message = null
                            val payload = JSONObject().put("login", identifier.trim()).toString()
                            when (val result = container.repository.mutateOnlineOnly("POST", "/api/auth/recuperar-senha/solicitar", payload)) {
                                is RepositoryResult.Success -> {
                                    message = runCatching { JSONObject(result.value).optString("mensagem") }.getOrNull()?.takeIf(String::isNotBlank)
                                    step = 2
                                }
                                is RepositoryResult.Failure -> message = result.message
                                is RepositoryResult.Queued -> message = "A recuperação precisa de internet."
                            }
                            busy = false
                        }
                    },
                ) { Text(if (busy) "Enviando…" else "Enviar código") }
                2 -> Button(
                    enabled = !busy && code.length == 6 && newPassword.length >= 8 && newPassword == confirmPassword,
                    onClick = {
                        scope.launch {
                            busy = true
                            message = null
                            val payload = JSONObject().put("login", identifier.trim()).put("codigo", code).put("novaSenha", newPassword).toString()
                            when (val result = container.repository.mutateOnlineOnly("POST", "/api/auth/recuperar-senha/confirmar", payload)) {
                                is RepositoryResult.Success -> { step = 3; message = "Senha alterada com sucesso." }
                                is RepositoryResult.Failure -> message = result.message
                                is RepositoryResult.Queued -> message = "A recuperação precisa de internet."
                            }
                            busy = false
                        }
                    },
                ) { Text(if (busy) "Alterando…" else "Alterar senha") }
                else -> Button(onClick = onDismiss) { Text("Voltar ao login") }
            }
        },
        dismissButton = { if (step < 3) TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancelar") } },
    )
}
