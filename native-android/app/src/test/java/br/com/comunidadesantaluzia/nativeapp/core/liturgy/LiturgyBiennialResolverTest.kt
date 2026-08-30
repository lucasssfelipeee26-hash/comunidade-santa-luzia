package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class LiturgyBiennialResolverTest {
    @Test
    fun `uses even and odd two year cycles`() {
        assertEquals("par", LiturgyBiennialResolver.cycle(LocalDate.of(2026, 8, 29)))
        assertEquals("impar", LiturgyBiennialResolver.cycle(LocalDate.of(2027, 8, 29)))
        assertEquals("Leituras bienais · ano par", LiturgyBiennialResolver.title(LocalDate.of(2026, 8, 29)))
    }

    @Test
    fun `resolves ordinary time with two digit week`() {
        assertEquals(
            "oficio/tempocomum/leituras/bienal/21sabadoTC_par.htm",
            LiturgyBiennialResolver.document(LocalDate.of(2026, 8, 29)),
        )
    }

    @Test
    fun `resolves privileged Advent dates`() {
        assertEquals(
            "oficio/advento/leituras/bienal/18dezembro_par.htm",
            LiturgyBiennialResolver.document(LocalDate.of(2026, 12, 18)),
        )
    }

    @Test
    fun `resolves days after Ash Wednesday and Holy Week`() {
        assertEquals(
            "oficio/quaresma/oficiodasleituras/bienal/quintacinzas_par.htm",
            LiturgyBiennialResolver.document(LocalDate.of(2026, 2, 19)),
        )
        assertEquals(
            "oficio/quaresma/oficiodasleituras/bienal/segundafeirasanta_par.htm",
            LiturgyBiennialResolver.document(LocalDate.of(2026, 3, 30)),
        )
    }

    @Test
    fun `resolves Easter and Christmas patterns`() {
        assertEquals(
            "oficio/pascoa/oficiodasleituras/bienal/1segundaPascoa_par.htm",
            LiturgyBiennialResolver.document(LocalDate.of(2026, 4, 6)),
        )
        assertEquals(
            "oficio/natal/leituras/bienal/30dezembro_par.htm",
            LiturgyBiennialResolver.document(LocalDate.of(2026, 12, 30)),
        )
        assertEquals(
            "oficio/natal/leituras/bienal/5janeiro_par.htm",
            LiturgyBiennialResolver.document(LocalDate.of(2026, 1, 5)),
        )
    }
}
