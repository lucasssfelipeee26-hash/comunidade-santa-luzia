package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LiturgySanctoralResolverTest {
    @Test
    fun `resolves current saint proper key`() {
        val celebration = LiturgySanctoralResolver.celebration(LocalDate.of(2026, 8, 29))
        assertEquals("Martírio de São João Batista", celebration?.name)
        assertEquals("joaobatista", celebration?.key)
        assertEquals(LiturgyCelebrationRank.Memorial, celebration?.rank)
    }

    @Test
    fun `applies Brazil transfers in 2026`() {
        assertEquals(
            "pedroepaulo",
            LiturgySanctoralResolver.celebration(LocalDate.of(2026, 6, 28))?.key,
        )
        assertNull(LiturgySanctoralResolver.celebration(LocalDate.of(2026, 6, 29)))
        assertEquals(
            "inaciodeazevedo",
            LiturgySanctoralResolver.celebration(LocalDate.of(2026, 7, 17))?.key,
        )
        assertNull(LiturgySanctoralResolver.celebration(LocalDate.of(2026, 7, 20)))
        assertEquals(
            "saoponciano",
            LiturgySanctoralResolver.celebration(LocalDate.of(2026, 8, 12))?.key,
        )
        assertEquals(
            "",
            LiturgySanctoralResolver.celebration(LocalDate.of(2026, 8, 13))?.key,
        )
        assertNull(LiturgySanctoralResolver.celebration(LocalDate.of(2026, 8, 15)))
        assertEquals(
            "assuncao",
            LiturgySanctoralResolver.celebration(LocalDate.of(2026, 8, 16))?.key,
        )
    }

    @Test
    fun `movable celebrations keep Beta keys`() {
        assertEquals("pascoa", LiturgySanctoralResolver.celebration(LocalDate.of(2026, 4, 5))?.key)
        assertEquals("pentecostes", LiturgySanctoralResolver.celebration(LocalDate.of(2026, 5, 24))?.key)
        assertEquals("corpuschristi", LiturgySanctoralResolver.celebration(LocalDate.of(2026, 6, 4))?.key)
        assertEquals("cristoreidouniverso", LiturgySanctoralResolver.celebration(LocalDate.of(2026, 11, 22))?.key)
    }

    @Test
    fun `ordinary Sunday overrides lower rank fixed celebration`() {
        val celebration = LiturgySanctoralResolver.celebration(LocalDate.of(2026, 8, 30))
        assertEquals("22domingoTC", celebration?.key)
    }

    @Test
    fun `solemnity can override ordinary Sunday`() {
        val celebration = LiturgySanctoralResolver.celebration(LocalDate.of(2027, 8, 15))
        assertEquals("assuncao", celebration?.key)
        assertEquals(LiturgyCelebrationRank.Solemnity, celebration?.rank)
    }
}
