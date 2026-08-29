package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import android.content.Context
import java.time.LocalDate
import org.json.JSONArray
import org.json.JSONObject

internal data class LiturgyReading(
    val title: String,
    val reference: String,
    val text: String,
    val refrain: String = "",
)

internal data class LiturgyDay(
    val dateIso: String,
    val displayDate: String,
    val celebration: String,
    val color: String,
    val liturgicalPeriod: String,
    val collect: String,
    val offerings: String,
    val communion: String,
    val firstReading: List<LiturgyReading>,
    val psalm: List<LiturgyReading>,
    val secondReading: List<LiturgyReading>,
    val gospel: List<LiturgyReading>,
)

internal class OfflineLiturgyRepository(private val context: Context) {
    fun day(date: LocalDate): LiturgyDay? {
        if (date.year != 2026) return null
        val fileName = "liturgia-completa/%04d-%02d.json".format(date.year, date.monthValue)
        val root = runCatching {
            context.assets.open(fileName).bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
        }.getOrNull() ?: return null
        val key = date.toString()
        val day = root.optJSONObject("dias")?.optJSONObject(key) ?: return null
        val prayers = day.optJSONObject("oracoes") ?: JSONObject()
        val readings = day.optJSONObject("leituras") ?: JSONObject()
        return LiturgyDay(
            dateIso = day.optString("dataIso", key),
            displayDate = day.optString("data", key),
            celebration = day.optString("liturgia", "Liturgia diária"),
            color = day.optString("cor"),
            liturgicalPeriod = day.optString("tempoLiturgicoAtual"),
            collect = prayers.optString("coleta"),
            offerings = prayers.optString("oferendas"),
            communion = prayers.optString("comunhao"),
            firstReading = parseReadings(readings.optJSONArray("primeiraLeitura")),
            psalm = parseReadings(readings.optJSONArray("salmo")),
            secondReading = parseReadings(readings.optJSONArray("segundaLeitura")),
            gospel = parseReadings(readings.optJSONArray("evangelho")),
        )
    }

    fun auditYear2026(): Pair<Int, List<String>> {
        val missing = mutableListOf<String>()
        var count = 0
        var date = LocalDate.of(2026, 1, 1)
        val end = LocalDate.of(2026, 12, 31)
        while (!date.isAfter(end)) {
            if (day(date) == null) missing += date.toString() else count += 1
            date = date.plusDays(1)
        }
        return count to missing
    }

    private fun parseReadings(array: JSONArray?): List<LiturgyReading> {
        if (array == null) return emptyList()
        return buildList {
            repeat(array.length()) { index ->
                val item = array.optJSONObject(index) ?: return@repeat
                add(
                    LiturgyReading(
                        title = item.optString("titulo"),
                        reference = item.optString("referencia"),
                        text = item.optString("texto"),
                        refrain = item.optString("refrao"),
                    ),
                )
            }
        }
    }
}
