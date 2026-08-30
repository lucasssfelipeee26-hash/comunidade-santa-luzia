package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal object LiturgyMissalResolver {
    private val dayNames = mapOf(
        DayOfWeek.SUNDAY to "domingo",
        DayOfWeek.MONDAY to "segunda",
        DayOfWeek.TUESDAY to "terca",
        DayOfWeek.WEDNESDAY to "quarta",
        DayOfWeek.THURSDAY to "quinta",
        DayOfWeek.FRIDAY to "sexta",
        DayOfWeek.SATURDAY to "sabado",
    )

    private val existingPropers = setOf(
        "NSAparecida", "NSCarmo", "NSDores", "NSGuadalupe", "NSRainha", "NSRosario",
        "andreeambrosio", "anjos", "antoniogalvao", "anunciacao", "apresentacao", "apresentacaoNS",
        "arcanjos", "ascensaodosenhor", "assuncao", "basilioegregorio", "batismo", "carlosborromeu",
        "catedra", "cinzas", "conversaosaopaulo", "cornelioecipriano", "corpuschristi",
        "cristoreidouniverso", "divinamisericordia", "epifania", "exaltacao", "franciscoxavier", "icvm",
        "imaculada", "inaciodeantioquia", "inaciodeazevedo", "isabeldahungria", "joaoevangelista",
        "josedeanchieta", "latrao", "maedaigreja", "martiriobatista", "natividade", "paixaodosenhor",
        "pedroepaulo", "pentecostes", "policarpo", "roquegonzalez", "sagradafamilia", "santaagueda",
        "santacatarina", "santacecilia", "santaclara", "santaescolastica", "santaines", "santaluzia",
        "santamaria", "santamarta", "santamonica", "santapaulina", "santarosa", "santateresa",
        "santateresinha", "santissimatrindade", "santoafonso", "santoagostinho", "santoalberto",
        "santoambrosio", "santoandre", "santoandrekim", "santoantao", "santoantonio", "santoatanasio",
        "santoestevao", "santoinacio", "santosinocentes", "santotomas", "saobarnabe", "saobartolomeu",
        "saobento", "saobernardo", "saoboaventura", "saobonifacio", "saocarloslwanga",
        "saociriloemetodio", "saodomingos", "saofilipeetiago", "saofilipeneri", "saofrancisco",
        "saofranciscosales", "saogregorio", "saojeronimo", "saojmvianney", "saojoao", "saojoaobosco",
        "saojoaocrisostomo", "saojoaodacruz", "saojoaquimesantana", "saojosafa", "saojose", "saojustino",
        "saoleao", "saolourenco", "saolucas", "saoluisgonzaga", "saomarcos", "saomartinho", "saomateus",
        "saomatias", "saomaximiliano", "saopaulomiki", "saopio", "saopiox", "saotiago", "saotimoteoetito",
        "saotome", "saovicentedepaulo", "scj", "simaoejudas", "stamariamadalena", "todosossantos",
        "transfiguracao", "visitacao",
    )

    private val brazil2026 = mapOf<LocalDate, String?>(
        LocalDate.of(2026, 6, 28) to "pedroepaulo",
        LocalDate.of(2026, 6, 29) to null,
        LocalDate.of(2026, 7, 17) to "inaciodeazevedo",
        LocalDate.of(2026, 7, 20) to null,
        LocalDate.of(2026, 8, 12) to null,
        LocalDate.of(2026, 8, 13) to null,
        LocalDate.of(2026, 8, 15) to null,
        LocalDate.of(2026, 8, 16) to "assuncao",
    )

    private val adventAvailable = setOf(
        "1domingo", "1segunda", "1terca", "1quarta", "1quinta", "1sexta", "1sabado",
        "2domingo", "2segunda", "2terca", "2quarta", "2quinta", "2sexta", "2sabado",
        "3domingo", "3segunda", "3terca", "4domingo",
    )

    fun document(date: LocalDate, celebrationKey: String? = null): String {
        var key = celebrationKey
        if (date.year == 2026 && brazil2026.containsKey(date)) {
            val brazilKey = brazil2026[date]
            if (!brazilKey.isNullOrBlank() && brazilKey in existingPropers) {
                return "missal/proprio/proprio/${brazilKey}.htm"
            }
            key = null
        }
        if (!key.isNullOrBlank() && key in existingPropers) {
            return "missal/proprio/proprio/${key}.htm"
        }

        val season = LiturgyCalendarResolver.season(date)
        val day = dayNames.getValue(date.dayOfWeek)
        return when (season) {
            LiturgySeason.Ordinary -> {
                if (date.dayOfWeek == DayOfWeek.SUNDAY) {
                    "missal/proprio/tempocomum/${LiturgyCalendarResolver.ordinaryWeek(date)}domingoTC.htm"
                } else ""
            }
            LiturgySeason.Advent -> adventDocument(date, day)
            LiturgySeason.Lent -> lentDocument(date, day)
            LiturgySeason.Easter -> easterDocument(date, day)
            LiturgySeason.Christmas -> christmasDocument(date, day)
        }
    }

    private fun adventDocument(date: LocalDate, day: String): String {
        if (date.monthValue == 12 && date.dayOfMonth in 17..23) {
            return "missal/proprio/advento/${date.dayOfMonth}dezembroAD.htm"
        }
        if (date.monthValue == 12 && date.dayOfMonth == 24) return "missal/proprio/advento/_24dezembroAD.htm"
        val week = weekSince(LiturgyCalendarResolver.adventStart(date.year), date).coerceIn(1, 4)
        val key = "$week$day"
        return if (key in adventAvailable) "missal/proprio/advento/${key}AD.htm" else ""
    }

    private fun lentDocument(date: LocalDate, day: String): String {
        val ashWednesday = LiturgyCalendarResolver.easter(date.year).minusDays(46)
        return when (ChronoUnit.DAYS.between(ashWednesday, date).toInt()) {
            1 -> "missal/proprio/quaresma/quinta_depoisdascinzas.htm"
            2 -> "missal/proprio/quaresma/sexta_depoisdascinzas.htm"
            3 -> "missal/proprio/quaresma/sabado_depoisdascinzas.htm"
            else -> {
                val firstSunday = ashWednesday.plusDays(4)
                val week = weekSince(firstSunday, date).coerceIn(1, 5)
                "missal/proprio/quaresma/${week}${day}QA.htm"
            }
        }
    }

    private fun easterDocument(date: LocalDate, day: String): String {
        val easter = LiturgyCalendarResolver.easter(date.year)
        val sinceEaster = ChronoUnit.DAYS.between(easter, date).toInt()
        if (sinceEaster in 1..6) return "missal/proprio/pascoa/${day}_oitava.htm"
        val week = sinceEaster / 7 + 1
        if (week in 2..7 && date.dayOfWeek != DayOfWeek.SUNDAY) return "missal/proprio/pascoa/${week}${day}PA.htm"
        if (week in 3..6 && date.dayOfWeek == DayOfWeek.SUNDAY) return "missal/proprio/pascoa/${week}domingoPA.htm"
        return ""
    }

    private fun christmasDocument(date: LocalDate, day: String): String {
        val month = date.monthValue
        val dateNumber = date.dayOfMonth
        if (month == 12 && dateNumber in 29..31) return "missal/proprio/natal/${dateNumber}dezembroNA.htm"
        if (month == 1 && dateNumber <= 6 && date.dayOfWeek != DayOfWeek.SUNDAY && date.dayOfWeek != DayOfWeek.MONDAY) {
            return "missal/proprio/natal/${day}_antesdaepifania.htm"
        }
        if (month == 1 && dateNumber >= 7 && date.dayOfWeek != DayOfWeek.SUNDAY) {
            return "missal/proprio/natal/${day}_ateobatismo.htm"
        }
        return ""
    }

    private fun weekSince(start: LocalDate, date: LocalDate): Int =
        ChronoUnit.DAYS.between(start, date).toInt() / 7 + 1
}
