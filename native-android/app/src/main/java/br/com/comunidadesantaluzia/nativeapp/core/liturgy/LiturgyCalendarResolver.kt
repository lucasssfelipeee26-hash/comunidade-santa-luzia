package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit

enum class LiturgyOfficeHour(val id: String, val label: String) {
    Readings("leituras", "Ofício das Leituras"),
    Lauds("laudes", "Laudes"),
    Terce("terca", "Hora Terça"),
    Sext("sexta", "Hora Sexta"),
    None("nona", "Hora Nona"),
    Vespers("vesperas", "Vésperas"),
    Compline("completas", "Completas"),
}

enum class LiturgySeason(val id: String) {
    Advent("advento"),
    Christmas("natal"),
    Lent("quaresma"),
    Easter("pascoa"),
    Ordinary("tempocomum"),
}

/**
 * Port direto das regras aprovadas em lib/iliturgia-calendario.ts da Beta 18.
 * Resolve somente o temporal; próprios de santos são sobrepostos separadamente.
 */
object LiturgyCalendarResolver {
    private val dayNames = mapOf(
        DayOfWeek.SUNDAY to "domingo",
        DayOfWeek.MONDAY to "segunda",
        DayOfWeek.TUESDAY to "terca",
        DayOfWeek.WEDNESDAY to "quarta",
        DayOfWeek.THURSDAY to "quinta",
        DayOfWeek.FRIDAY to "sexta",
        DayOfWeek.SATURDAY to "sabado",
    )

    fun easter(year: Int): LocalDate {
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

    fun adventStart(year: Int): LocalDate = nextOrSameSunday(LocalDate.of(year, 11, 27))

    fun season(date: LocalDate): LiturgySeason {
        val year = date.year
        val easter = easter(year)
        val ashWednesday = easter.minusDays(46)
        val pentecost = easter.plusDays(49)
        val advent = adventStart(year)
        val christmas = LocalDate.of(year, 12, 25)
        val epiphany = LocalDate.of(year, 1, 6)
        val baptism = nextOrSameSunday(epiphany)
        return when {
            !date.isBefore(advent) && date.isBefore(christmas) -> LiturgySeason.Advent
            !date.isBefore(christmas) || !date.isAfter(baptism) -> LiturgySeason.Christmas
            !date.isBefore(ashWednesday) && date.isBefore(easter) -> LiturgySeason.Lent
            !date.isBefore(easter) && !date.isAfter(pentecost) -> LiturgySeason.Easter
            else -> LiturgySeason.Ordinary
        }
    }

    fun ordinaryWeek(date: LocalDate): Int {
        val year = date.year
        val easter = easter(year)
        val ashWednesday = easter.minusDays(46)
        val baptism = nextOrSameSunday(LocalDate.of(year, 1, 6))
        if (date.isBefore(ashWednesday)) {
            return maxOf(1, weekSince(baptism.plusDays(1), date) + 1)
        }
        val christKingSunday = adventStart(year).minusDays(7)
        val remainingWeeks = ChronoUnit.DAYS.between(previousOrSameSunday(date), christKingSunday).toInt() / 7
        return maxOf(1, 34 - remainingWeeks)
    }

    fun psalterWeek(date: LocalDate): Int = when (season(date)) {
        LiturgySeason.Ordinary -> ((ordinaryWeek(date) - 1) % 4) + 1
        LiturgySeason.Advent -> cycle4(weekSince(adventStart(date.year), date))
        LiturgySeason.Lent -> cycle4(weekSince(easter(date.year).minusDays(46), date))
        LiturgySeason.Easter -> cycle4(weekSince(easter(date.year), date))
        LiturgySeason.Christmas -> 1
    }

    fun temporalOfficePath(date: LocalDate, hour: LiturgyOfficeHour): String {
        val season = season(date)
        val day = dayNames.getValue(date.dayOfWeek)
        val week = psalterWeek(date)

        if (hour == LiturgyOfficeHour.Compline) {
            when (season) {
                LiturgySeason.Ordinary -> return "oficio/tempocomum/horas/completas_${day}.htm"
                LiturgySeason.Advent -> return "oficio/advento/horas/completas${day}.htm"
                LiturgySeason.Christmas -> return "oficio/natal/horas/completas_${if (day == "domingo") "domingoI" else day}.htm"
                else -> Unit
            }
        }

        return when (season) {
            LiturgySeason.Ordinary -> "oficio/tempocomum/horas/${week}${day}_${hour.id}.htm"
            LiturgySeason.Advent -> "oficio/advento/horas/${week}${day}_${hour.id}.htm"
            LiturgySeason.Lent -> "oficio/quaresma/horas/${week}${day}quaresma_${hour.id}.htm"
            LiturgySeason.Easter -> "oficio/pascoa/horas/${week}${day}pascoa_${hour.id}.htm"
            LiturgySeason.Christmas -> christmasPath(date, day, hour)
        }
    }

    fun saintOfficePath(key: String?, hour: LiturgyOfficeHour): String {
        val clean = key?.trim().orEmpty()
        if (clean.isBlank() || clean == "santadulcelopespontes" || hour == LiturgyOfficeHour.Compline) return ""
        return if (hour == LiturgyOfficeHour.Readings) {
            "oficio/proprio/oficiodasleituras/${clean}.htm"
        } else {
            "oficio/proprio/horas/${clean}_${hour.id}.htm"
        }
    }

    private fun christmasPath(date: LocalDate, day: String, hour: LiturgyOfficeHour): String {
        if (date.monthValue == 12 && date.dayOfMonth >= 29) {
            return "oficio/natal/horas/${date.dayOfMonth}dezembro_${hour.id}.htm"
        }
        if (date.monthValue == 1 && date.dayOfMonth in 2..7) {
            return "oficio/natal/horas/${date.dayOfMonth}janeiro_${hour.id}.htm"
        }
        return "oficio/natal/horas/${day}_aposepifania_${hour.id}.htm"
    }

    private fun weekSince(start: LocalDate, date: LocalDate): Int {
        val weekZero = previousOrSameSunday(start)
        return maxOf(1, ChronoUnit.DAYS.between(weekZero, date).toInt() / 7 + 1)
    }

    private fun cycle4(value: Int): Int = ((value - 1) % 4) + 1

    private fun previousOrSameSunday(date: LocalDate): LocalDate = date.minusDays((date.dayOfWeek.value % 7).toLong())

    private fun nextOrSameSunday(date: LocalDate): LocalDate {
        val days = (7 - (date.dayOfWeek.value % 7)) % 7
        return date.plusDays(days.toLong())
    }
}
