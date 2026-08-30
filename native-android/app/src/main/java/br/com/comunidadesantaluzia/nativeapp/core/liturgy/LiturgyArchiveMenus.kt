package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.LocalDate

internal data class LiturgyArchiveMenuItem(
    val id: String,
    val title: String,
    val category: String,
    val path: String,
)

internal object LiturgyArchiveMenus {
    val ordinaryMass = listOf(
        item("ritos-iniciais", "Ritos Iniciais", "missal", "missal/ordinario/ritosiniciais.htm"),
        item("liturgia-palavra", "Liturgia da Palavra", "missal", "missal/ordinario/liturgiapalavra.htm"),
        item("oracao-fieis", "Oração dos Fiéis", "missal", "missal/ordinario/oracaodosfieis.htm"),
        item("liturgia-eucaristica", "Liturgia Eucarística", "missal", "missal/ordinario/liturgiaeucaristica.htm"),
        item("rito-comunhao", "Rito da Comunhão", "missal", "missal/ordinario/ritocomunhao.htm"),
        item("ritos-finais", "Ritos Finais", "missal", "missal/ordinario/ritosfinais.htm"),
    )

    val eucharisticPrayers = listOf("I", "II", "III", "IV", "V", "VI-A", "VI-B", "VI-C", "VI-D", "VII", "VIII", "IX", "X", "XI")
        .map { number ->
            item(
                "oe-$number",
                "Oração Eucarística $number",
                "missal",
                "missal/oracaoeucaristica/oracaoeucaristica$number.htm",
            )
        }

    private val properPrefaceIds = listOf(
        "NSAparecida", "anjos", "anunciacao", "apresentacao", "arcanjos", "ascensaodosenhor",
        "batismo", "ceiadosenhor", "corpuschristi", "cristoreidouniverso", "epifania", "exaltacao",
        "paixaodosenhor", "pedroepaulo", "pentecostes", "ramos", "sabadosanto", "santissimatrindade",
        "saojoao", "saojose", "scj", "todosossantos", "transfiguracao",
    )

    private val temporalPrefaceIds = listOf(
        "adventoI", "adventoIA", "adventoII", "adventoIIA", "anjos", "apostolosI", "apostolosII",
        "ascensaoI", "ascensaoII", "batismo", "comumI", "comumII", "comumIII", "comumIV", "comumV",
        "comumVI", "crisma", "domingoTCI", "domingoTCII", "domingoTCIII", "domingoTCIV", "domingoTCIX",
        "domingoTCV", "domingoTCVI", "domingoTCVII", "domingoTCVIII", "enfermos", "espiritosantoI",
        "espiritosantoII", "fieisdefuntosI", "fieisdefuntosII", "fieisdefuntosIII", "fieisdefuntosIV",
        "fieisdefuntosV", "martires", "natalI", "natalII", "natalIII", "ordem", "paixaoI", "paixaoII",
        "pascoaI", "pascoaII", "pascoaIII", "pascoaIV", "pascoaV", "penitencia", "quaresmaI",
        "quaresmaII", "quaresmaIII", "quaresmaIV", "quaresmaV", "santasvirgensreligiosos", "santosI",
        "santosII", "santospastores", "saojose", "sseucaristiaI", "sseucaristiaII", "sseucaristiaIII",
        "virgemmariaI", "virgemmariaII",
    )

    val properPrefaces = properPrefaceIds.map { id ->
        item("pp-$id", prefaceTitle(id), "missal", "missal/prefacio/proprio/$id.htm")
    }

    val temporalPrefaces = temporalPrefaceIds.map { id ->
        item("pt-$id", prefaceTitle(id), "missal", "missal/prefacio/tempo/$id.htm")
    }

    val prayers = listOf(
        "angelus" to "Angelus" to "oficio/outros/angelus.htm",
        "angelus-latim" to "Angelus em latim" to "oficio/outros/angelus_latim.htm",
        "antifonas-marianas" to "Antífonas Marianas" to "oficio/outros/antifonas_marianas.htm",
        "ato-contricao" to "Ato de Contrição" to "oficio/outros/atodecontricao.htm",
        "ato-penitencial" to "Ato Penitencial" to "oficio/outros/atopenitencial.htm",
        "ave-maria-latim" to "Ave-Maria em latim" to "oficio/outros/avemarialatim.htm",
        "bencao-santissimo" to "Bênção do Santíssimo" to "oficio/outros/bencao_santissimo.htm",
        "benedictus" to "Benedictus" to "oficio/outros/benedictus.htm",
        "consagracao-ns" to "Consagração a Nossa Senhora" to "oficio/outros/consagracaonossasenhora.htm",
        "credo-niceno" to "Credo Niceno-Constantinopolitano" to "oficio/outros/credoniceno.htm",
        "formulas-completas" to "Fórmulas para Completas" to "oficio/outros/formulascompletas.htm",
        "pai-nosso" to "Fórmulas do Pai-Nosso" to "oficio/outros/formulaspainosso.htm",
        "gloria" to "Glória" to "oficio/outros/gloria.htm",
        "hinos-latim" to "Hinos em latim" to "oficio/outros/hinosemlatim.htm",
        "ladainha-santos" to "Ladainha de Todos os Santos" to "oficio/outros/ladainhatodosossantos.htm",
        "magnificat" to "Magnificat" to "oficio/outros/magnificat.htm",
        "magnificat-latim" to "Magnificat em latim" to "oficio/outros/magnificat_latim.htm",
        "nunc-dimittis" to "Nunc Dimittis" to "oficio/outros/nuncdimittis.htm",
        "pai-nosso-latim" to "Pai-Nosso em latim" to "oficio/outros/painossolatim.htm",
        "paramentacao" to "Orações para a paramentação" to "oficio/outros/paramentacao.htm",
        "pos-missa" to "Orações após a Missa" to "oficio/outros/posmissa.htm",
        "preparacao-confissao" to "Preparação para a Confissão" to "oficio/outros/preparacao_confissao.htm",
        "preparacao-missa" to "Preparação para a Missa" to "oficio/outros/preparacaomissa.htm",
        "reconciliacao" to "Reconciliação individual" to "oficio/outros/reconciliacaoindividual.htm",
        "salve-rainha" to "Salve Rainha" to "oficio/outros/salverainha.htm",
        "te-deum" to "Te Deum" to "oficio/outros/tedeum.htm",
        "te-deum-latim" to "Te Deum em latim" to "oficio/outros/tedeum_latim.htm",
        "veni-creator" to "Veni Creator" to "oficio/outros/venicreator.htm",
        "via-sacra" to "Via-Sacra" to "oficio/outros/viasacra.htm",
    ).map { triple ->
        val idTitle = triple.first
        item(idTitle.first, idTitle.second, "oficio", triple.second)
    }

    fun vigil(date: LocalDate): List<LiturgyArchiveMenuItem> {
        val celebration = LiturgySanctoralResolver.celebration(date)
        val properVigils = setOf(
            "NSAparecida", "anunciacao", "apresentacao", "arcanjos", "ascensaodosenhor", "assuncao",
            "batismo", "corpuschristi", "cristoreidouniverso", "epifania", "exaltacao", "imaculada",
            "joaoevangelista", "natal", "paixaodosenhor", "pedroepaulo", "pentecostes", "ramos",
            "sabadosanto", "sagradafamilia", "santamaria", "santissimatrindade", "santoandre", "saojoao",
            "saojose", "scj", "simaoejudas", "todosossantos", "transfiguracao",
        )
        val key = celebration?.key.orEmpty()
        if (key in properVigils) {
            return listOf(
                item(
                    "vigilia-propria",
                    "Vigília · ${celebration?.name.orEmpty()}",
                    "oficio",
                    "oficio/proprio/horas/${key}_vigilia.htm",
                ),
            )
        }

        val folder = when (LiturgyCalendarResolver.season(date)) {
            LiturgySeason.Ordinary -> "tempocomum"
            LiturgySeason.Advent -> "advento"
            LiturgySeason.Lent -> "quaresma"
            LiturgySeason.Easter -> "pascoa"
            LiturgySeason.Christmas -> "natal"
        }
        val total = when (folder) {
            "tempocomum" -> 8
            "advento" -> 4
            "quaresma" -> 5
            "pascoa" -> 6
            else -> 0
        }
        return buildList {
            add(item("vigilia-canticos", "Cânticos da Vigília", "oficio", "oficio/$folder/horas/vigilia_canticos.htm"))
            for (index in 1..total) {
                if (folder == "pascoa" && index == 1) continue
                add(
                    item(
                        "vigilia-evangelho-$index",
                        "Evangelho da Vigília $index",
                        "oficio",
                        "oficio/$folder/horas/vigilia_evangelho_$index.htm",
                    ),
                )
            }
        }
    }

    private fun item(id: String, title: String, category: String, path: String) =
        LiturgyArchiveMenuItem(id, title, category, path)

    private fun prefaceTitle(id: String): String {
        val special = mapOf(
            "NSAparecida" to "Nossa Senhora Aparecida", "anjos" to "Anjos", "anunciacao" to "Anunciação do Senhor",
            "apresentacao" to "Apresentação do Senhor", "arcanjos" to "Arcanjos", "ascensaodosenhor" to "Ascensão do Senhor",
            "batismo" to "Batismo do Senhor", "ceiadosenhor" to "Ceia do Senhor", "corpuschristi" to "Corpus Christi",
            "cristoreidouniverso" to "Cristo Rei do Universo", "epifania" to "Epifania do Senhor",
            "exaltacao" to "Exaltação da Santa Cruz", "paixaodosenhor" to "Paixão do Senhor", "pedroepaulo" to "São Pedro e São Paulo",
            "pentecostes" to "Pentecostes", "ramos" to "Domingo de Ramos", "sabadosanto" to "Sábado Santo",
            "santissimatrindade" to "Santíssima Trindade", "saojoao" to "São João Batista", "saojose" to "São José",
            "scj" to "Sagrado Coração de Jesus", "todosossantos" to "Todos os Santos", "transfiguracao" to "Transfiguração do Senhor",
            "crisma" to "Crisma", "enfermos" to "Enfermos", "martires" to "Mártires", "ordem" to "Ordem",
            "penitencia" to "Penitência", "santasvirgensreligiosos" to "Santas Virgens e Religiosos", "santospastores" to "Santos Pastores",
        )
        special[id]?.let { return it }
        val match = Regex("^(advento|apostolos|ascensao|comum|domingoTC|espiritosanto|fieisdefuntos|natal|paixao|pascoa|quaresma|santos|sseucaristia|virgemmaria)(.+)$")
            .matchEntire(id) ?: return id
        val base = mapOf(
            "advento" to "Advento", "apostolos" to "Apóstolos", "ascensao" to "Ascensão", "comum" to "Comum",
            "domingoTC" to "Domingos do Tempo Comum", "espiritosanto" to "Espírito Santo", "fieisdefuntos" to "Fiéis Defuntos",
            "natal" to "Natal", "paixao" to "Paixão do Senhor", "pascoa" to "Páscoa", "quaresma" to "Quaresma",
            "santos" to "Santos", "sseucaristia" to "Santíssima Eucaristia", "virgemmaria" to "Virgem Maria",
        ).getValue(match.groupValues[1])
        val roman = mapOf("I" to "I", "IA" to "I-A", "II" to "II", "IIA" to "II-A", "III" to "III", "IV" to "IV", "V" to "V", "VI" to "VI", "VII" to "VII", "VIII" to "VIII", "IX" to "IX")
        return "$base ${roman[match.groupValues[2]] ?: match.groupValues[2]}"
    }
}
