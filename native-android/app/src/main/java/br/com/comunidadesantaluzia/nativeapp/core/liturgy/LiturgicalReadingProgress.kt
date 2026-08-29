package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import android.content.Context
import java.time.LocalDate
import java.time.ZoneId

internal object LiturgicalReadingProgress {
    private const val PreferencesName = "santa_luzia_liturgy_progress"
    private const val KeyPrefix = "liturgia-lida:"
    private val cuiabaZone = ZoneId.of("America/Cuiaba")

    fun todayCuiaba(): LocalDate = LocalDate.now(cuiabaZone)

    fun isRead(context: Context, date: LocalDate = todayCuiaba()): Boolean =
        context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
            .getBoolean("$KeyPrefix$date", false)

    fun markRead(context: Context, date: LocalDate = todayCuiaba()) {
        context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("$KeyPrefix$date", true)
            .apply()
    }
}
