package br.com.comunidadesantaluzia.nativeapp.core.notifications

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Ponte mínima entre os Intents do Android e a navegação Compose.
 * Aceita somente caminhos internos; URLs externas nunca são convertidas em navegação do app.
 */
internal object NotificationNavigationBus {
    private val pendingHref = MutableStateFlow<String?>(null)
    val href = pendingHref.asStateFlow()

    fun publish(raw: String?) {
        val value = raw
            ?.trim()
            ?.takeIf { it.startsWith("/") && it.length <= 500 }
            ?: return
        pendingHref.value = value
    }

    fun consume(value: String) {
        if (pendingHref.value == value) pendingHref.value = null
    }
}
