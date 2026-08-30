package androidx.compose.material.icons.rounded

import androidx.compose.material.icons.Icons
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Compatibilidade para o ícone Database usado pelas telas administrativas.
 * A versão de Material Icons empacotada no Compose atual não expõe Database
 * na família Rounded; Storage mantém a mesma semântica visual sem alterar UI.
 */
val Icons.Rounded.Database: ImageVector
    get() = Icons.Rounded.Storage
