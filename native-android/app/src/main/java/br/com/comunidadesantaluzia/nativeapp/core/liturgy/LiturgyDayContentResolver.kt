package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.text.Normalizer
import java.time.DayOfWeek
import java.time.LocalDate

internal object LiturgyDayContentResolver {
    private val dayNames = mapOf(
        DayOfWeek.SUNDAY to "domingo",
        DayOfWeek.MONDAY to "segunda",
        DayOfWeek.TUESDAY to "terca",
        DayOfWeek.WEDNESDAY to "quarta",
        DayOfWeek.THURSDAY to "quinta",
        DayOfWeek.FRIDAY to "sexta",
        DayOfWeek.SATURDAY to "sabado",
    )

    fun catechesisDocument(date: LocalDate, period: String = "laudes"): String {
        val safePeriod = if (period == "vesperas") "vesperas" else "laudes"
        val week = LiturgyCalendarResolver.psalterWeek(date)
        return "catequeses/semana${week}_${dayNames.getValue(date.dayOfWeek)}_${safePeriod}.htm"
    }

    fun gospelDocument(reference: String?, title: String? = null): String {
        val rawReference = reference?.trim().orEmpty()
        if (rawReference.isBlank()) return ""
        val bookMatch = Regex("^([1-3]?\\s*[A-Za-zÀ-ÿ]+)").find(rawReference)
        val book = bookMatch?.groupValues?.getOrNull(1)?.replace(" ", "")
            .orEmpty()
            .ifBlank { abbreviateBook(title.orEmpty()) }
        val chapterVerses = rawReference.replaceFirst(Regex("^([1-3]?\\s*[A-Za-zÀ-ÿ]+)\\s*"), "").trim()
        if (book.isBlank() || chapterVerses.isBlank()) return ""
        val name = chapterVerses
            .replace(Regex("\\s+"), "")
            .replace(",", "_")
            .replace(";", "+")
            .replace(".", "")
        return "evangelho/${book}X${name}.htm"
    }

    fun lectionaryDocument(
        first: List<LiturgyReading>,
        second: List<LiturgyReading>,
        gospel: List<LiturgyReading>,
    ): String {
        val parts = listOf(
            first.firstOrNull()?.reference,
            second.firstOrNull()?.reference,
            gospel.firstOrNull()?.reference,
        ).map(::readingKey).filter { it.isNotBlank() }
        return if (parts.size >= 2) "lecionario/${parts.joinToString("")}.htm" else ""
    }

    fun rosaryDocument(date: LocalDate): String = "rosario/misterios_${rosaryMystery(date)}.htm"

    fun rosaryMystery(date: LocalDate): String = when (date.dayOfWeek) {
        DayOfWeek.TUESDAY, DayOfWeek.FRIDAY -> "dor"
        DayOfWeek.WEDNESDAY, DayOfWeek.SUNDAY -> "gloria"
        DayOfWeek.THURSDAY -> "luz"
        DayOfWeek.MONDAY, DayOfWeek.SATURDAY -> "alegria"
    }

    private fun readingKey(reference: String?): String {
        if (reference.isNullOrBlank()) return ""
        return reference
            .replace(Regex("\\([^)]*\\)"), "")
            .replace(Regex("\\bR\\.?\\s*.*$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("[^0-9A-Za-zÀ-ÿ]"), "")
    }

    private fun abbreviateBook(title: String): String {
        val normalized = Normalizer.normalize(title, Normalizer.Form.NFD)
            .replace(Regex("[\\u0300-\\u036f]"), "")
            .trim()
            .lowercase()
        return when {
            "mateus" in normalized -> "Mt"
            "marcos" in normalized -> "Mc"
            "lucas" in normalized -> "Lc"
            "joao" in normalized -> "Jo"
            else -> Regex("^([1-3]?\\s*[A-Za-zÀ-ÿ]+)").find(title)
                ?.groupValues?.getOrNull(1)
                ?.replace(" ", "")
                .orEmpty()
        }
    }
}
