package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class LiturgyCalendarResolverTest {
    @Test
    fun `computes movable dates used by Beta calendar`() {
        assertEquals(LocalDate.of(2026, 4, 5), LiturgyCalendarResolver.easter(2026))
        assertEquals(LocalDate.of(2026, 11, 29), LiturgyCalendarResolver.adventStart(2026))
    }

    @Test
    fun `resolves current ordinary-time office exactly like Beta temporal`() {
        val date = LocalDate.of(2026, 8, 29)
        assertEquals(LiturgySeason.Ordinary, LiturgyCalendarResolver.season(date))
        assertEquals(21, LiturgyCalendarResolver.ordinaryWeek(date))
        assertEquals(1, LiturgyCalendarResolver.psalterWeek(date))
        assertEquals(
            "oficio/tempocomum/horas/1sabado_laudes.htm",
            LiturgyCalendarResolver.temporalOfficePath(date, LiturgyOfficeHour.Lauds),
        )
        assertEquals(
            "oficio/tempocomum/horas/completas_sabado.htm",
            LiturgyCalendarResolver.temporalOfficePath(date, LiturgyOfficeHour.Compline),
        )
    }

    @Test
    fun `resolves advent lent easter and christmas patterns`() {
        assertEquals(
            "oficio/advento/horas/1terca_laudes.htm",
            LiturgyCalendarResolver.temporalOfficePath(LocalDate.of(2026, 12, 1), LiturgyOfficeHour.Lauds),
        )
        assertEquals(
            "oficio/quaresma/horas/3domingoquaresma_laudes.htm",
            LiturgyCalendarResolver.temporalOfficePath(LocalDate.of(2026, 3, 1), LiturgyOfficeHour.Lauds),
        )
        assertEquals(
            "oficio/pascoa/horas/1segundapascoa_laudes.htm",
            LiturgyCalendarResolver.temporalOfficePath(LocalDate.of(2026, 4, 6), LiturgyOfficeHour.Lauds),
        )
        assertEquals(
            "oficio/natal/horas/30dezembro_laudes.htm",
            LiturgyCalendarResolver.temporalOfficePath(LocalDate.of(2026, 12, 30), LiturgyOfficeHour.Lauds),
        )
        assertEquals(
            "oficio/natal/horas/5janeiro_laudes.htm",
            LiturgyCalendarResolver.temporalOfficePath(LocalDate.of(2026, 1, 5), LiturgyOfficeHour.Lauds),
        )
    }

    @Test
    fun `saint proper never overrides compline`() {
        assertEquals(
            "oficio/proprio/horas/joaobatista_laudes.htm",
            LiturgyCalendarResolver.saintOfficePath("joaobatista", LiturgyOfficeHour.Lauds),
        )
        assertEquals(
            "oficio/proprio/oficiodasleituras/joaobatista.htm",
            LiturgyCalendarResolver.saintOfficePath("joaobatista", LiturgyOfficeHour.Readings),
        )
        assertEquals("", LiturgyCalendarResolver.saintOfficePath("joaobatista", LiturgyOfficeHour.Compline))
        assertEquals("", LiturgyCalendarResolver.saintOfficePath("", LiturgyOfficeHour.Lauds))
    }
}
