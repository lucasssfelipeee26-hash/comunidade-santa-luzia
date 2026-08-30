package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

internal enum class LiturgicalHour(val id: String, val label: String) {
    Readings("leituras", "Ofício das Leituras"),
    Lauds("laudes", "Laudes"),
    Terce("terca", "Hora Terça"),
    Sext("sexta", "Hora Sexta"),
    None("nona", "Hora Nona"),
    Vespers("vesperas", "Vésperas"),
    Compline("completas", "Completas"),
}

internal enum class LiturgicalSeason {
    Advent,
    Christmas,
    Lent,
    Easter,
    Ordinary,
}

/**
 * Resolve os caminhos temporais do Ofício com a mesma regra da Beta 18.
 *
 * O próprio dos santos é uma camada separada: quando houver um documento próprio
 * conhecido ele deve ter precedência; este resolvedor fornece o temporal seguro
 * para qualquer dia, inteiramente offline.
 */
internal object LiturgicalOfficeResolver {
    private val dayNames = mapOf(
        DayOfWeek.SUNDAY to "domingo",
        DayOfWeek.MONDAY to "segunda",
        DayOfWeek.TUESDAY to "terca",
        DayOfWeek.WEDNESDAY to "quarta",
        DayOfWeek.THURSDAY to "quinta",
        DayOfWeek.FRIDAY to "sexta",
        DayOfWeek.SATURDAY to "sabado",
    )

    fun season(date: LocalDate): LiturgicalSeason {
        val easter = easter(date.year)
        val ashWednesday = easter.minusDays(46)
        val pentecost = easter.plusDays(49)
        val advent = adventStart(date.year)
        val christmas = LocalDate.of(date.year, 12, 25)
        val epiphany = LocalDate.of(date.year, 1, 6)
        val baptism = nextOrSameSunday(epiphany)

        return when {
            !date.isBefore(advent) && date.isBefore(christmas) -> LiturgicalSeason.Advent
            !date.isBefore(christmas) || !date.isAfter(baptism) -> LiturgicalSeason.Christmas
            !date.isBefore(ashWednesday) && date.isBefore(easter) -> LiturgicalSeason.Lent
            !date.isBefore(easter) && !date.isAfter(pentecost) -> LiturgicalSeason.Easter
            else -> LiturgicalSeason.Ordinary
        }
    }

    fun psalterWeek(date: LocalDate): Int = when (season(date)) {
        LiturgicalSeason.Ordinary -> ((ordinaryWeek(date) - 1) % 4) + 1
        LiturgicalSeason.Advent -> ((weekSince(adventStart(date.year), date) - 1) % 4) + 1
        LiturgicalSeason.Lent -> ((weekSince(easter(date.year).minusDays(46), date) - 1) % 4) + 1
        LiturgicalSeason.Easter -> ((weekSince(easter(date.year), date) - 1) % 4) + 1
        LiturgicalSeason.Christmas -> 1
    }

    fun temporalDocument(date: LocalDate, hour: LiturgicalHour): String {
        val season = season(date)
        val day = dayNames.getValue(date.dayOfWeek)
        val week = psalterWeek(date)

        if (hour == LiturgicalHour.Compline) {
            return when (season) {
                LiturgicalSeason.Ordinary -> "oficio/tempocomum/horas/completas_${day}.htm"
                LiturgicalSeason.Advent -> "oficio/advento/horas/completas${day}.htm"
                LiturgicalSeason.Christmas -> "oficio/natal/horas/completas_${if (day == "domingo") "domingoI" else day}.htm"
                else -> seasonalDocument(season, week, day, hour.id)
            }
        }

        return when (season) {
            LiturgicalSeason.Ordinary -> "oficio/tempocomum/horas/${week}${day}_${hour.id}.htm"
            LiturgicalSeason.Advent -> "oficio/advento/horas/${week}${day}_${hour.id}.htm"
            LiturgicalSeason.Lent -> "oficio/quaresma/horas/${week}${day}quaresma_${hour.id}.htm"
            LiturgicalSeason.Easter -> "oficio/pascoa/horas/${week}${day}pascoa_${hour.id}.htm"
            LiturgicalSeason.Christmas -> christmasDocument(date, day, hour.id)
        }
    }

    private fun seasonalDocument(season: LiturgicalSeason, week: Int, day: String, hour: String): String = when (season) {
        LiturgicalSeason.Lent -> "oficio/quaresma/horas/${week}${day}quaresma_${hour}.htm"
        LiturgicalSeason.Easter -> "oficio/pascoa/horas/${week}${day}pascoa_${hour}.htm"
        LiturgicalSeason.Ordinary -> "oficio/tempocomum/horas/${week}${day}_${hour}.htm"
        LiturgicalSeason.Advent -> "oficio/advento/horas/${week}${day}_${hour}.htm"
        LiturgicalSeason.Christmas -> error("Christmas uses date-specific paths")
    }

    private fun christmasDocument(date: LocalDate, day: String, hour: String): String {
        if (date.monthValue == 12 && date.dayOfMonth >= 29) {
            return "oficio/natal/horas/${date.dayOfMonth}dezembro_${hour}.htm"
        }
        if (date.monthValue == 1 && date.dayOfMonth in 2..7) {
            return "oficio/natal/horas/${date.dayOfMonth}janeiro_${hour}.htm"
        }
        return "oficio/natal/horas/${day}_aposepifania_${hour}.htm"
    }

    private fun ordinaryWeek(date: LocalDate): Int {
        val easter = easter(date.year)
        val ashWednesday = easter.minusDays(46)
        val epiphany = LocalDate.of(date.year, 1, 6)
        val baptism = nextOrSameSunday(epiphany)

        if (date.isBefore(ashWednesday)) {
            return maxOf(1, weekSince(baptism.plusDays(1), date) + 1)
        }

        val christTheKingSunday = adventStart(date.year).minusDays(7)
        val remaining = ChronoUnit.DAYS.between(previousOrSameSunday(date), christTheKingSunday).toInt() / 7
        return maxOf(1, 34 - remaining)
    }

    private fun weekSince(start: LocalDate, date: LocalDate): Int {
        val aligned = previousOrSameSunday(start)
        return maxOf(1, ChronoUnit.DAYS.between(aligned, date).toInt() / 7 + 1)
    }

    private fun previousOrSameSunday(date: LocalDate): LocalDate =
        date.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY))

    private fun nextOrSameSunday(date: LocalDate): LocalDate =
        date.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY))

    internal fun adventStart(year: Int): LocalDate = nextOrSameSunday(LocalDate.of(year, 11, 27))

    internal fun easter(year: Int): LocalDate {
        val a = year % 19
        val b = year / 100
        val c = year % 100
        val d = b / 4
        val e = b % 4
        val f = (b + 8) / 25
        val g = (b - f + 1) / 3
        val h = (19 * a + b - d - g + 15) % 30
        val i = c / 4
        val k = c % 4
        val l = (32 + 2 * e + 2 * i - h - k) % 7
        val m = (a + 11 * h + 22 * l) / 451
        val month = (h + l - 7 * m + 114) / 31
        val day = ((h + l - 7 * m + 114) % 31) + 1
        return LocalDate.of(year, month, day)
    }
}
