package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

internal object LiturgyBiennialResolver {
    private val dayNames = mapOf(
        DayOfWeek.SUNDAY to "domingo",
        DayOfWeek.MONDAY to "segunda",
        DayOfWeek.TUESDAY to "terca",
        DayOfWeek.WEDNESDAY to "quarta",
        DayOfWeek.THURSDAY to "quinta",
        DayOfWeek.FRIDAY to "sexta",
        DayOfWeek.SATURDAY to "sabado",
    )

    fun cycle(date: LocalDate): String = if (date.year % 2 == 0) "par" else "impar"

    fun title(date: LocalDate): String = "Leituras bienais · ano ${if (cycle(date) == "par") "par" else "ímpar"}"

    fun document(date: LocalDate): String {
        val season = LiturgyCalendarResolver.season(date)
        val day = dayNames.getValue(date.dayOfWeek)
        val cycle = cycle(date)
        return when (season) {
            LiturgySeason.Ordinary -> {
                val week = LiturgyCalendarResolver.ordinaryWeek(date).toString().padStart(2, '0')
                "oficio/tempocomum/leituras/bienal/${week}${day}TC_${cycle}.htm"
            }
            LiturgySeason.Advent -> {
                if (date.monthValue == 12 && date.dayOfMonth in 17..24) {
                    "oficio/advento/leituras/bienal/${date.dayOfMonth}dezembro_${cycle}.htm"
                } else {
                    val week = weekSince(LiturgyCalendarResolver.adventStart(date.year), date).coerceAtMost(4)
                    "oficio/advento/leituras/bienal/${week}${day}Advento_${cycle}.htm"
                }
            }
            LiturgySeason.Lent -> lentDocument(date, day, cycle)
            LiturgySeason.Easter -> {
                val easter = LiturgyCalendarResolver.easter(date.year)
                val since = ChronoUnit.DAYS.between(easter, date).toInt()
                val week = (since / 7 + 1).coerceIn(1, 7)
                "oficio/pascoa/oficiodasleituras/bienal/${week}${day}Pascoa_${cycle}.htm"
            }
            LiturgySeason.Christmas -> {
                when {
                    date.monthValue == 12 && date.dayOfMonth in 29..31 ->
                        "oficio/natal/leituras/bienal/${date.dayOfMonth}dezembro_${cycle}.htm"
                    date.monthValue == 1 && date.dayOfMonth in 2..7 ->
                        "oficio/natal/leituras/bienal/${date.dayOfMonth}janeiro_${cycle}.htm"
                    else -> "oficio/natal/leituras/bienal/${day}_aposepifania_${cycle}.htm"
                }
            }
        }
    }

    private fun lentDocument(date: LocalDate, day: String, cycle: String): String {
        val easter = LiturgyCalendarResolver.easter(date.year)
        val ashWednesday = easter.minusDays(46)
        val sinceAshWednesday = ChronoUnit.DAYS.between(ashWednesday, date).toInt()
        when (sinceAshWednesday) {
            1 -> return "oficio/quaresma/oficiodasleituras/bienal/quintacinzas_${cycle}.htm"
            2 -> return "oficio/quaresma/oficiodasleituras/bienal/sextacinzas_${cycle}.htm"
            3 -> return "oficio/quaresma/oficiodasleituras/bienal/sabadocinzas_${cycle}.htm"
        }

        val palmSunday = easter.minusDays(7)
        if (date.isAfter(palmSunday) && date.isBefore(easter)) {
            val holyWeekName = when (date.dayOfWeek) {
                DayOfWeek.MONDAY -> "segundafeirasanta"
                DayOfWeek.TUESDAY -> "tercafeirasanta"
                DayOfWeek.WEDNESDAY -> "quartafeirasanta"
                DayOfWeek.THURSDAY -> "quinta"
                DayOfWeek.FRIDAY -> "sexta"
                DayOfWeek.SATURDAY -> "sabado"
                DayOfWeek.SUNDAY -> "domingo"
            }
            return "oficio/quaresma/oficiodasleituras/bienal/${holyWeekName}_${cycle}.htm"
        }

        val firstSunday = ashWednesday.plusDays(4)
        val week = weekSince(firstSunday, date).coerceIn(1, 5)
        return "oficio/quaresma/oficiodasleituras/bienal/${week}${day}_quaresma_${cycle}.htm"
    }

    private fun weekSince(start: LocalDate, date: LocalDate): Int {
        val aligned = start.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY))
        return maxOf(1, ChronoUnit.DAYS.between(aligned, date).toInt() / 7 + 1)
    }
}
