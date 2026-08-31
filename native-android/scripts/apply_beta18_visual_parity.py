from __future__ import annotations

from pathlib import Path
import re

TARGET = Path("native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/ReferenceSantaLuziaApp.kt")
text = TARGET.read_text(encoding="utf-8")

# A reescrita muda a tecnologia, nunca o desenho aprovado. Este patch mantém a
# Home pública da Beta 18 como golden master até os componentes Kotlin serem
# consolidados definitivamente no mesmo formato.
if "import androidx.compose.animation.core.keyframes" not in text:
    text = text.replace(
        "import androidx.compose.animation.core.infiniteRepeatable\n",
        "import androidx.compose.animation.core.infiniteRepeatable\nimport androidx.compose.animation.core.keyframes\n",
    )

header_pattern = re.compile(
    r"@Composable\nprivate fun ReferencePublicHeader\(loggedIn: Boolean, onNavigate: \(ReferenceRoute\) -> Unit\) \{.*?\n\}\n\n@Composable\nprivate fun ReferenceHero",
    re.S,
)
header_replacement = r'''@Composable
private fun ReferencePublicHeader(loggedIn: Boolean, onNavigate: (ReferenceRoute) -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    val logo = rememberReferenceAsset("reference/santa-luzia-logo.jpg")
    Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 3.dp) {
        Column(Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    Modifier.size(42.dp).clip(CircleShape).background(SantaWine.copy(alpha = .09f)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (logo != null) {
                        Image(
                            bitmap = logo,
                            contentDescription = "Santa Luzia",
                            modifier = Modifier.fillMaxSize().clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text("COMUNIDADE", color = SantaGold, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                    Text("SANTA LUZIA", color = SantaWine, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleMedium)
                    Text("Acólitos e Coroinhas São Padre Pio", style = MaterialTheme.typography.labelSmall, color = SantaWineDark)
                }
                OutlinedButton(
                    onClick = {
                        if (loggedIn) onNavigate(ReferenceRoute.Area) else menuOpen = !menuOpen
                    },
                ) {
                    Text(if (loggedIn) "☰" else if (menuOpen) "×" else "☰", color = SantaWine, fontWeight = FontWeight.Black)
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(SantaGold.copy(alpha = .60f)))
            if (!loggedIn && menuOpen) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 5.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Button(
                            modifier = Modifier.weight(1f),
                            onClick = { menuOpen = false; onNavigate(ReferenceRoute.Login) },
                        ) { Text("Entrar") }
                        OutlinedButton(
                            modifier = Modifier.weight(1f),
                            onClick = { menuOpen = false; onNavigate(ReferenceRoute.Login) },
                        ) { Text("Cadastro") }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReferenceHero'''
text, count = header_pattern.subn(header_replacement, text, count=1)
if count != 1:
    raise SystemExit("Não foi possível aplicar o header Beta 18; fonte divergente.")

card_pattern = re.compile(
    r"@Composable\nprivate fun ReferenceHomeCard\(modifier: Modifier, title: String, icon: ImageVector, onClick: \(\) -> Unit\) \{.*?\n\}\n\n@Composable\nprivate fun ReferenceLoginScreen",
    re.S,
)
card_replacement = r'''@Composable
private fun ReferenceHomeCard(modifier: Modifier, title: String, icon: ImageVector, onClick: () -> Unit) {
    val motion = rememberInfiniteTransition(label = "beta18-home-$title")
    val bookAngle by motion.animateFloat(
        initialValue = 0f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = keyframes {
                durationMillis = if (title == "Escala do Dia") 5200 else 5000
                0f at 0
                0f at if (title == "Escala do Dia") 3950 else 3750
                (if (title == "Escala do Dia") 16f else -18f) at if (title == "Escala do Dia") 4315 else 4100
                (if (title == "Escala do Dia") -4f else 9f) at if (title == "Escala do Dia") 4730 else 4500
                0f at if (title == "Escala do Dia") 5200 else 5000
            },
            repeatMode = RepeatMode.Restart,
        ),
        label = "beta18-home-angle",
    )
    Card(
        modifier = modifier,
        onClick = onClick,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Box(
                Modifier.size(42.dp).clip(CircleShape).background(SantaWineDark),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = SantaGoldLight,
                    modifier = Modifier.size(22.dp).graphicsLayer {
                        if (title == "Escala do Dia") {
                            rotationX = bookAngle
                            translationY = if (bookAngle > 0f) -2f else 0f
                        } else if (title == "Centro Litúrgico" || title == "Biblioteca" || title == "Liturgia Diária") {
                            rotationY = bookAngle
                        }
                    },
                )
            }
            Text(title, color = SantaWineDark, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun ReferenceLoginScreen'''
text, count = card_pattern.subn(card_replacement, text, count=1)
if count != 1:
    raise SystemExit("Não foi possível aplicar as animações Beta 18; fonte divergente.")

text = text.replace(
    'Text("SL", color = SantaWine, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)',
    'Icon(Icons.Rounded.Lock, contentDescription = null, tint = SantaWine, modifier = Modifier.size(30.dp))',
    1,
)
text = text.replace(
    'Text("Entre para acessar sua Área Restrita", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)',
    'Text("Entre para abrir seu painel ou continue como visitante", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)',
    1,
)

TARGET.write_text(text, encoding="utf-8")
print("Beta 18 visual parity patch: OK")
