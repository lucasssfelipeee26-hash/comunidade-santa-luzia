package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class LiturgyDayContentResolverTest {
    @Test
    fun `resolves rosary mystery by weekday like Beta`() {
        assertEquals("alegria", LiturgyDayContentResolver.rosaryMystery(LocalDate.of(2026, 8, 31)))
        assertEquals("dor", LiturgyDayContentResolver.rosaryMystery(LocalDate.of(2026, 9, 1)))
        assertEquals("gloria", LiturgyDayContentResolver.rosaryMystery(LocalDate.of(2026, 9, 2)))
        assertEquals("luz", LiturgyDayContentResolver.rosaryMystery(LocalDate.of(2026, 9, 3)))
        assertEquals("rosario/misterios_dor.htm", LiturgyDayContentResolver.rosaryDocument(LocalDate.of(2026, 9, 4)))
    }

    @Test
    fun `resolves catechesis from psalter week and weekday`() {
        assertEquals(
            "catequeses/semana1_sabado_laudes.htm",
            LiturgyDayContentResolver.catechesisDocument(LocalDate.of(2026, 8, 29), "laudes"),
        )
        assertEquals(
            "catequeses/semana1_sabado_vesperas.htm",
            LiturgyDayContentResolver.catechesisDocument(LocalDate.of(2026, 8, 29), "vesperas"),
        )
    }

    @Test
    fun `converts gospel reference to archive path`() {
        assertEquals("evangelho/McX6_17-29.htm", LiturgyDayContentResolver.gospelDocument("Mc 6, 17-29"))
        assertEquals("evangelho/MtX25_1-13.htm", LiturgyDayContentResolver.gospelDocument("Mt 25,1-13"))
    }

    @Test
    fun `builds lectionary key from available readings`() {
        val first = listOf(LiturgyReading("", "Jr 1, 17-19", ""))
        val gospel = listOf(LiturgyReading("", "Mc 6, 17-29", ""))
        assertEquals(
            "lecionario/Jr11719Mc61729.htm",
            LiturgyDayContentResolver.lectionaryDocument(first, emptyList(), gospel),
        )
    }
}
