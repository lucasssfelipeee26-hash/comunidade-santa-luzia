package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class LiturgyMissalResolverTest {
    @Test
    fun `uses transferred Brazil proper before temporal`() {
        val date = LocalDate.of(2026, 8, 16)
        assertEquals(
            "missal/proprio/proprio/assuncao.htm",
            LiturgyMissalResolver.document(date, LiturgySanctoralResolver.celebration(date)?.key),
        )
    }

    @Test
    fun `ordinary Sunday resolves its proper temporal mass`() {
        val date = LocalDate.of(2026, 8, 30)
        assertEquals(
            "missal/proprio/tempocomum/22domingoTC.htm",
            LiturgyMissalResolver.document(date, LiturgySanctoralResolver.celebration(date)?.key),
        )
    }

    @Test
    fun `ordinary weekday without supported proper stays empty`() {
        val date = LocalDate.of(2026, 8, 29)
        assertEquals("", LiturgyMissalResolver.document(date, LiturgySanctoralResolver.celebration(date)?.key))
    }

    @Test
    fun `advent privileged weekdays use date specific documents`() {
        assertEquals(
            "missal/proprio/advento/18dezembroAD.htm",
            LiturgyMissalResolver.document(LocalDate.of(2026, 12, 18)),
        )
        assertEquals(
            "missal/proprio/advento/_24dezembroAD.htm",
            LiturgyMissalResolver.document(LocalDate.of(2026, 12, 24)),
        )
    }

    @Test
    fun `lent and easter paths follow Beta patterns`() {
        assertEquals(
            "missal/proprio/quaresma/quinta_depoisdascinzas.htm",
            LiturgyMissalResolver.document(LocalDate.of(2026, 2, 19)),
        )
        assertEquals(
            "missal/proprio/pascoa/segunda_oitava.htm",
            LiturgyMissalResolver.document(LocalDate.of(2026, 4, 6)),
        )
    }
}
