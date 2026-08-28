package br.com.comunidadesantaluzia.nativeapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val SantaWine = Color(0xFF6F172C)
val SantaWineDark = Color(0xFF4E0E1E)
val SantaGold = Color(0xFFD4AF37)
val SantaCream = Color(0xFFFFF9F0)
val SantaSurface = Color(0xFFFFFDF8)
val SantaText = Color(0xFF2D2224)

private val SantaLuziaColors = lightColorScheme(
    primary = SantaWine,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFF6DDE4),
    onPrimaryContainer = SantaWineDark,
    secondary = SantaGold,
    onSecondary = Color(0xFF342B08),
    background = SantaCream,
    onBackground = SantaText,
    surface = SantaSurface,
    onSurface = SantaText,
    outline = Color(0xFFD9CBCB),
)

@Composable
fun SantaLuziaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SantaLuziaColors,
        typography = Typography(),
        content = content,
    )
}
