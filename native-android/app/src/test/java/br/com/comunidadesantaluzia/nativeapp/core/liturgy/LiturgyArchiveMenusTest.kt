package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LiturgyArchiveMenusTest {
    @Test
    fun `ports ordinary and Eucharistic menus from Beta`() {
        assertEquals(6, LiturgyArchiveMenus.ordinaryMass.size)
        assertEquals("missal/ordinario/ritosiniciais.htm", LiturgyArchiveMenus.ordinaryMass.first().path)
        assertEquals(14, LiturgyArchiveMenus.eucharisticPrayers.size)
        assertEquals(
            "missal/oracaoeucaristica/oracaoeucaristicaVI-A.htm",
            LiturgyArchiveMenus.eucharisticPrayers.first { it.id == "oe-VI-A" }.path,
        )
    }

    @Test
    fun `ports preface and prayer inventories`() {
        assertEquals(23, LiturgyArchiveMenus.properPrefaces.size)
        assertEquals(59, LiturgyArchiveMenus.temporalPrefaces.size)
        assertEquals(29, LiturgyArchiveMenus.prayers.size)
        assertTrue(LiturgyArchiveMenus.properPrefaces.any { it.title == "Nossa Senhora Aparecida" })
        assertTrue(LiturgyArchiveMenus.temporalPrefaces.any { it.title == "Advento I-A" })
        assertTrue(LiturgyArchiveMenus.prayers.any { it.title == "Via-Sacra" })
    }

    @Test
    fun `uses proper vigil when Beta has one`() {
        val items = LiturgyArchiveMenus.vigil(LocalDate.of(2026, 8, 16))
        assertEquals(1, items.size)
        assertEquals("oficio/proprio/horas/assuncao_vigilia.htm", items.first().path)
    }

    @Test
    fun `builds temporal vigil menu with Easter exception`() {
        val ordinary = LiturgyArchiveMenus.vigil(LocalDate.of(2026, 8, 29))
        assertEquals(9, ordinary.size)
        assertEquals("oficio/tempocomum/horas/vigilia_canticos.htm", ordinary.first().path)

        val easter = LiturgyArchiveMenus.vigil(LocalDate.of(2026, 4, 13))
        assertEquals(6, easter.size)
        assertTrue(easter.none { it.id == "vigilia-evangelho-1" })
    }
}
