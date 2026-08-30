package br.com.comunidadesantaluzia.nativeapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Tokens exatos do tema padrão "manto-rubi" da Windows Beta usada como referência.
val SantaWine = Color(0xFF7B1326)
val SantaWineDark = Color(0xFF5A0B18)
val SantaGold = Color(0xFFD4AF37)
val SantaGoldLight = Color(0xFFF2CF62)
val SantaCream = Color(0xFFFFF8EE)
val SantaSurface = Color(0xFFFFFAF4)
val SantaText = Color(0xFF3F171C)
val SantaSecondary = Color(0xFFF4E8D3)
val SantaMuted = Color(0xFFF7EEE2)
val SantaOutline = Color(0xFFDCC7B7)

private val SantaLuziaColors = lightColorScheme(
    primary = SantaWine,
    onPrimary = SantaCream,
    primaryContainer = Color(0xFFF4E8D3),
    onPrimaryContainer = Color(0xFF53121D),
    secondary = SantaGold,
    onSecondary = Color(0xFF4B0C16),
    secondaryContainer = SantaSecondary,
    onSecondaryContainer = Color(0xFF53121D),
    background = SantaCream,
    onBackground = SantaText,
    surface = SantaSurface,
    onSurface = SantaText,
    surfaceVariant = SantaMuted,
    onSurfaceVariant = Color(0xFF765E5D),
    outline = SantaOutline,
    error = Color(0xFFA61F31),
)

@Composable
fun SantaLuziaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SantaLuziaColors,
        typography = Typography(),
        content = content,
    )
}
