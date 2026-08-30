package br.com.comunidadesantaluzia.nativeapp.core.liturgy

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal enum class LiturgyCelebrationRank {
    Solemnity,
    Feast,
    Memorial,
    OptionalMemorial,
}

internal data class LiturgyCelebration(
    val name: String,
    val key: String,
    val rank: LiturgyCelebrationRank,
)

/**
 * Port nativo do calendário santoral aprovado na Beta 18, incluindo os ajustes
 * próprios do Brasil usados em 2026. O resultado fornece a chave canônica dos
 * documentos do Ofício e do Missal sem depender do servidor.
 */
internal object LiturgySanctoralResolver {
    private fun c(name: String, key: String, rank: LiturgyCelebrationRank) = LiturgyCelebration(name, key, rank)
    private val S = LiturgyCelebrationRank.Solemnity
    private val F = LiturgyCelebrationRank.Feast
    private val M = LiturgyCelebrationRank.Memorial
    private val O = LiturgyCelebrationRank.OptionalMemorial

    private val fixed = mapOf(
        "01-01" to c("Santa Maria, Mãe de Deus", "santamaria", S),
        "01-02" to c("São Basílio Magno e São Gregório Nazianzeno", "basilioegregorio", M),
        "01-03" to c("Santíssimo Nome de Jesus", "ssnomedejesus", O),
        "01-07" to c("São Raimundo de Penaforte", "", O),
        "01-13" to c("Santo Hilário", "santohilario", O),
        "01-17" to c("Santo Antão", "santoantao", M),
        "01-20" to c("São Fabiano e São Sebastião", "saofabiano", O),
        "01-21" to c("Santa Inês", "santaines", M),
        "01-22" to c("São Vicente", "saovicente", O),
        "01-24" to c("São Francisco de Sales", "saofranciscosales", M),
        "01-25" to c("Conversão de São Paulo", "conversaosaopaulo", F),
        "01-26" to c("São Timóteo e São Tito", "saotimoteoetito", M),
        "01-27" to c("Santa Ângela Mérici", "angelamerici", O),
        "01-28" to c("Santo Tomás de Aquino", "santotomas", M),
        "01-31" to c("São João Bosco", "saojoaobosco", M),
        "02-02" to c("Apresentação do Senhor", "apresentacao", F),
        "02-03" to c("São Brás", "saobras", O),
        "02-05" to c("Santa Águeda", "santaagueda", M),
        "02-06" to c("São Paulo Miki e companheiros", "saopaulomiki", M),
        "02-08" to c("Santa Josefina Bakhita", "josefinabakhita", O),
        "02-10" to c("Santa Escolástica", "santaescolastica", M),
        "02-11" to c("Nossa Senhora de Lourdes", "NSLourdes", O),
        "02-14" to c("São Cirilo e São Metódio", "saociriloemetodio", M),
        "02-22" to c("Cátedra de São Pedro", "catedra", F),
        "02-23" to c("São Policarpo", "policarpo", M),
        "03-04" to c("São Casimiro", "saocasimiro", O),
        "03-07" to c("Santa Perpétua e Santa Felicidade", "perpetuaefelicidade", M),
        "03-08" to c("São João de Deus", "joaodedeus", O),
        "03-09" to c("Santa Francisca Romana", "franciscaromana", O),
        "03-17" to c("São Patrício", "saopatricio", O),
        "03-18" to c("São Cirilo de Jerusalém", "cirilojerusalem", O),
        "03-19" to c("São José, Esposo da Virgem Maria", "saojose", S),
        "03-23" to c("São Turíbio de Mogrovejo", "turibiodemogrovejo", O),
        "03-25" to c("Anunciação do Senhor", "anunciacao", S),
        "04-02" to c("São Francisco de Paula", "", O),
        "04-04" to c("Santo Isidoro", "", O),
        "04-05" to c("São Vicente Ferrer", "saovicenteferrer", O),
        "04-07" to c("São João Batista de La Salle", "joaodelasalle", M),
        "04-11" to c("Santo Estanislau", "estanislau", M),
        "04-13" to c("São Martinho I", "martinhoI", O),
        "04-21" to c("Santo Anselmo", "santoanselmo", O),
        "04-23" to c("São Jorge", "saojorge", O),
        "04-24" to c("São Fidélis de Sigmaringa", "", O),
        "04-25" to c("São Marcos, Evangelista", "saomarcos", F),
        "04-28" to c("São Pedro Chanel", "pedrochanel", O),
        "04-29" to c("Santa Catarina de Sena", "santacatarina", M),
        "04-30" to c("São Pio V", "saopiov", O),
        "05-01" to c("São José Operário", "saojoseoperario", O),
        "05-02" to c("Santo Atanásio", "santoatanasio", M),
        "05-03" to c("São Filipe e São Tiago", "saofilipeetiago", F),
        "05-12" to c("São Nereu e Santo Aquiles", "nereueaquiles", O),
        "05-13" to c("Nossa Senhora de Fátima", "", O),
        "05-14" to c("São Matias", "saomatias", F),
        "05-18" to c("São João I", "joaoi", O),
        "05-20" to c("São Bernardino de Sena", "saobernardino", O),
        "05-25" to c("São Beda Venerável", "saobeda", O),
        "05-26" to c("São Filipe Néri", "saofilipeneri", M),
        "05-27" to c("Santo Agostinho de Cantuária", "agostinhodecantuaria", O),
        "05-31" to c("Visitação de Nossa Senhora", "visitacao", F),
        "06-01" to c("São Justino", "saojustino", M),
        "06-02" to c("São Marcelino e São Pedro", "marcelinoepedro", O),
        "06-03" to c("São Carlos Lwanga e companheiros", "saocarloslwanga", M),
        "06-05" to c("São Bonifácio", "saobonifacio", M),
        "06-06" to c("São Norberto", "norberto", O),
        "06-09" to c("São José de Anchieta", "josedeanchieta", M),
        "06-11" to c("São Barnabé", "saobarnabe", M),
        "06-13" to c("Santo Antônio de Pádua", "santoantonio", M),
        "06-19" to c("São Romualdo", "saoromualdo", O),
        "06-21" to c("São Luís Gonzaga", "saoluisgonzaga", M),
        "06-22" to c("São Paulino de Nola; São João Fisher e São Tomás More", "joaofishertomasmore", O),
        "06-24" to c("Natividade de São João Batista", "natividade", S),
        "06-27" to c("São Cirilo de Alexandria", "saociriloalexandria", O),
        "06-28" to c("Santo Irineu", "santoirineu", M),
        "06-29" to c("São Pedro e São Paulo", "pedroepaulo", S),
        "06-30" to c("Protomártires da Igreja de Roma", "protomartiresroma", O),
        "07-03" to c("São Tomé, Apóstolo", "saotome", F),
        "07-04" to c("Santa Isabel de Portugal", "isabeldeportugal", O),
        "07-06" to c("Santa Maria Goretti", "mariagoretti", O),
        "07-09" to c("Santa Paulina", "santapaulina", M),
        "07-11" to c("São Bento", "saobento", M),
        "07-13" to c("Santo Henrique", "santohenrique", O),
        "07-14" to c("São Camilo de Lellis", "camilodelellis", O),
        "07-15" to c("São Boaventura", "saoboaventura", M),
        "07-16" to c("Nossa Senhora do Carmo", "NSCarmo", O),
        "07-20" to c("Santo Inácio de Azevedo e companheiros", "inaciodeazevedo", M),
        "07-21" to c("São Lourenço de Brindisi", "lourencodebrindisi", O),
        "07-22" to c("Santa Maria Madalena", "stamariamadalena", F),
        "07-23" to c("Santa Brígida", "santabrigida", O),
        "07-25" to c("São Tiago, Apóstolo", "saotiago", F),
        "07-26" to c("São Joaquim e Santa Ana", "saojoaquimesantana", M),
        "07-29" to c("Santa Marta, Maria e Lázaro", "santamarta", M),
        "07-30" to c("São Pedro Crisólogo", "saopedrocrisologo", O),
        "07-31" to c("Santo Inácio de Loyola", "santoinacio", M),
        "08-01" to c("Santo Afonso Maria de Ligório", "santoafonso", M),
        "08-04" to c("São João Maria Vianney", "saojmvianney", M),
        "08-05" to c("Dedicação da Basílica de Santa Maria Maior", "santamariamaior", O),
        "08-06" to c("Transfiguração do Senhor", "transfiguracao", F),
        "08-07" to c("São Sisto II e companheiros", "saosisto", O),
        "08-08" to c("São Domingos", "saodomingos", M),
        "08-09" to c("Santa Teresa Benedita da Cruz", "beneditadacruz", O),
        "08-10" to c("São Lourenço", "saolourenco", F),
        "08-11" to c("Santa Clara", "santaclara", M),
        "08-12" to c("Santa Joana Francisca de Chantal", "santajoanadechantal", O),
        "08-13" to c("São Ponciano e Santo Hipólito", "saoponciano", O),
        "08-14" to c("São Maximiliano Maria Kolbe", "saomaximiliano", M),
        "08-15" to c("Assunção de Nossa Senhora", "assuncao", S),
        "08-16" to c("Santo Estêvão da Hungria", "estevaodahungria", O),
        "08-20" to c("São Bernardo", "saobernardo", M),
        "08-21" to c("São Pio X", "saopiox", M),
        "08-22" to c("Nossa Senhora Rainha", "NSRainha", M),
        "08-23" to c("Santa Rosa de Lima", "santarosadelima", M),
        "08-24" to c("São Bartolomeu, Apóstolo", "saobartolomeu", F),
        "08-27" to c("Santa Mônica", "santamonica", M),
        "08-28" to c("Santo Agostinho", "santoagostinho", M),
        "08-29" to c("Martírio de São João Batista", "joaobatista", M),
        "09-03" to c("São Gregório Magno", "saogregoriomagno", M),
        "09-08" to c("Natividade de Nossa Senhora", "natividadens", F),
        "09-09" to c("São Pedro Claver", "pedroclaver", O),
        "09-13" to c("São João Crisóstomo", "joaocrisostomo", M),
        "09-14" to c("Exaltação da Santa Cruz", "exaltacao", F),
        "09-15" to c("Nossa Senhora das Dores", "NSDores", M),
        "09-16" to c("São Cornélio e São Cipriano", "cornelioecipriano", M),
        "09-17" to c("São Roberto Belarmino", "robertobelarmino", O),
        "09-19" to c("São Januário", "saojanuario", O),
        "09-20" to c("Santos André Kim, Paulo Chong e companheiros", "andrekim", M),
        "09-21" to c("São Mateus, Apóstolo e Evangelista", "saomateus", F),
        "09-23" to c("São Pio de Pietrelcina", "padrepio", M),
        "09-26" to c("São Cosme e São Damião", "cosmeedamiao", O),
        "09-27" to c("São Vicente de Paulo", "saovicentedepaulo", M),
        "09-28" to c("São Venceslau", "saovenceslau", O),
        "09-29" to c("Santos Arcanjos Miguel, Gabriel e Rafael", "arcanjos", F),
        "09-30" to c("São Jerônimo", "saojeronimo", M),
        "10-01" to c("Santa Teresinha do Menino Jesus", "stateresinha", M),
        "10-02" to c("Santos Anjos da Guarda", "anjos", M),
        "10-04" to c("São Francisco de Assis", "saofranciscodeassis", M),
        "10-06" to c("São Bruno", "saobruno", O),
        "10-07" to c("Nossa Senhora do Rosário", "NSRosario", M),
        "10-09" to c("São Dionísio e companheiros; São João Leonardi", "", O),
        "10-11" to c("São João XXIII", "saojoaoxxiii", O),
        "10-12" to c("Nossa Senhora Aparecida", "NSAparecida", S),
        "10-14" to c("São Calisto I", "saocalisto", O),
        "10-15" to c("Santa Teresa de Jesus", "santateresadejesus", M),
        "10-16" to c("Santa Edwiges; Santa Margarida Maria Alacoque", "margaridamaria", O),
        "10-17" to c("Santo Inácio de Antioquia", "inacioantioquia", M),
        "10-18" to c("São Lucas, Evangelista", "saolucas", F),
        "10-19" to c("São João de Brébeuf, Santo Isaac Jogues e companheiros", "", O),
        "10-22" to c("São João Paulo II", "saojoaopauloII", O),
        "10-23" to c("São João de Capistrano", "joaocapistrano", O),
        "10-24" to c("Santo Antônio Maria Claret", "antoniomariaclaret", O),
        "10-28" to c("São Simão e São Judas, Apóstolos", "simaoejudas", F),
        "11-01" to c("Todos os Santos", "todosossantos", S),
        "11-02" to c("Comemoração de Todos os Fiéis Defuntos", "fieisdefuntos", S),
        "11-04" to c("São Carlos Borromeu", "saocarlosborromeu", M),
        "11-09" to c("Dedicação da Basílica do Latrão", "latrao", F),
        "11-10" to c("São Leão Magno", "saoleao", M),
        "11-11" to c("São Martinho de Tours", "saomartinho", M),
        "11-12" to c("São Josafá", "saojosafa", M),
        "11-17" to c("Santa Isabel da Hungria", "isabeldahungria", M),
        "11-18" to c("Dedicação das Basílicas de São Pedro e São Paulo", "basilicaspedroepaulo", O),
        "11-21" to c("Apresentação de Nossa Senhora", "apresentacaoNS", M),
        "11-22" to c("Santa Cecília", "santacecilia", M),
        "11-23" to c("São Clemente I", "saoclemente", O),
        "11-24" to c("Santo André Dung-Lac e companheiros", "santoandredung", M),
        "11-25" to c("Santa Catarina de Alexandria", "catarinadealexandria", O),
        "11-30" to c("Santo André, Apóstolo", "santoandre", F),
        "12-03" to c("São Francisco Xavier", "franciscoxavier", M),
        "12-04" to c("São João Damasceno", "joaodamasceno", O),
        "12-06" to c("São Nicolau", "saonicolau", O),
        "12-07" to c("Santo Ambrósio", "santoambrosio", M),
        "12-08" to c("Imaculada Conceição de Nossa Senhora", "imaculada", S),
        "12-09" to c("São João Diego", "saojoaodiego", O),
        "12-10" to c("Nossa Senhora de Loreto", "NSLoreto", O),
        "12-11" to c("São Dâmaso I", "saodamaso", O),
        "12-12" to c("Nossa Senhora de Guadalupe", "NSGuadalupe", O),
        "12-13" to c("Santa Luzia", "santaluzia", M),
        "12-14" to c("São João da Cruz", "saojoaodacruz", M),
        "12-21" to c("São Pedro Canísio", "pedrocanisio", O),
        "12-23" to c("São João de Kenty", "", O),
        "12-25" to c("Natal de Nosso Senhor Jesus Cristo", "natal", S),
        "12-26" to c("Santo Estêvão, Primeiro Mártir", "santoestevao", F),
        "12-27" to c("São João, Apóstolo e Evangelista", "joaoevangelista", F),
        "12-28" to c("Santos Inocentes", "santosinocentes", F),
        "12-29" to c("São Tomás Becket", "tomasbecket", O),
        "12-31" to c("São Silvestre I", "saosilvestre", O),
    )

    private val brazil2026 = mapOf<LocalDate, LiturgyCelebration?>(
        LocalDate.of(2026, 6, 28) to c("São Pedro e São Paulo, Apóstolos", "pedroepaulo", S),
        LocalDate.of(2026, 6, 29) to null,
        LocalDate.of(2026, 7, 17) to c("Bem-aventurado Inácio de Azevedo e companheiros mártires", "inaciodeazevedo", M),
        LocalDate.of(2026, 7, 20) to null,
        LocalDate.of(2026, 8, 12) to c("São Ponciano e Santo Hipólito", "saoponciano", O),
        LocalDate.of(2026, 8, 13) to c("Santa Dulce Lopes Pontes", "", M),
        LocalDate.of(2026, 8, 15) to null,
        LocalDate.of(2026, 8, 16) to c("Assunção de Nossa Senhora", "assuncao", S),
    )

    fun celebration(date: LocalDate): LiturgyCelebration? {
        if (date.year == 2026 && brazil2026.containsKey(date)) return brazil2026[date]
        movable(date)?.let { return it }
        val sunday = temporalSunday(date)
        val fixedCelebration = fixed["%02d-%02d".format(date.monthValue, date.dayOfMonth)]
        if (sunday == null) return fixedCelebration
        if (fixedCelebration == null) return sunday
        val season = LiturgyCalendarResolver.season(date)
        if (season == LiturgySeason.Advent || season == LiturgySeason.Lent || season == LiturgySeason.Easter) return sunday
        if (fixedCelebration.rank == S) return fixedCelebration
        return sunday
    }

    private fun movable(date: LocalDate): LiturgyCelebration? {
        val year = date.year
        val easter = LiturgyCalendarResolver.easter(year)
        val advent = LiturgyCalendarResolver.adventStart(year)
        val epiphany = sundayBetween(year, 1, 2, 8)
        val baptism = epiphany.plusDays(if (epiphany.dayOfMonth == 7 || epiphany.dayOfMonth == 8) 1 else 7)
        val movements = mapOf(
            epiphany to c("Epifania do Senhor", "epifania", S),
            baptism to c("Batismo do Senhor", "batismo", F),
            easter.minusDays(46) to c("Quarta-feira de Cinzas", "cinzas", S),
            easter.minusDays(7) to c("Domingo de Ramos e da Paixão do Senhor", "ramos", S),
            easter.minusDays(3) to c("Quinta-feira da Ceia do Senhor", "ceiadosenhor", S),
            easter.minusDays(2) to c("Sexta-feira da Paixão do Senhor", "paixaodosenhor", S),
            easter.minusDays(1) to c("Sábado Santo", "sabadosanto", S),
            easter to c("Domingo da Páscoa na Ressurreição do Senhor", "pascoa", S),
            easter.plusDays(7) to c("Domingo da Divina Misericórdia", "divinamisericordia", S),
            easter.plusDays(42) to c("Ascensão do Senhor", "ascensaodosenhor", S),
            easter.plusDays(49) to c("Pentecostes", "pentecostes", S),
            easter.plusDays(50) to c("Bem-aventurada Virgem Maria, Mãe da Igreja", "maedaigreja", M),
            easter.plusDays(56) to c("Santíssima Trindade", "santissimatrindade", S),
            easter.plusDays(60) to c("Santíssimo Corpo e Sangue de Cristo", "corpuschristi", S),
            easter.plusDays(68) to c("Sagrado Coração de Jesus", "scj", S),
            advent.minusDays(7) to c("Nosso Senhor Jesus Cristo, Rei do Universo", "cristoreidouniverso", S),
        )
        movements[date]?.let { return it }
        if (date.monthValue == 12 && date.dayOfMonth in 26..31 && date.dayOfWeek == DayOfWeek.SUNDAY) {
            return c("Sagrada Família de Jesus, Maria e José", "sagradafamilia", F)
        }
        return null
    }

    private fun temporalSunday(date: LocalDate): LiturgyCelebration? {
        if (date.dayOfWeek != DayOfWeek.SUNDAY) return null
        val season = LiturgyCalendarResolver.season(date)
        val easter = LiturgyCalendarResolver.easter(date.year)
        return when (season) {
            LiturgySeason.Advent -> {
                val n = ChronoUnit.DAYS.between(LiturgyCalendarResolver.adventStart(date.year), date).toInt() / 7 + 1
                c("${n}º Domingo do Advento", "${n}domingo", S)
            }
            LiturgySeason.Lent -> {
                val ashWednesday = easter.minusDays(46)
                val n = maxOf(1, ChronoUnit.DAYS.between(ashWednesday, date).toInt() / 7 + 1)
                c("${n}º Domingo da Quaresma", "${n}domingoquaresma", S)
            }
            LiturgySeason.Easter -> {
                val n = ChronoUnit.DAYS.between(easter, date).toInt() / 7 + 1
                c("${n}º Domingo da Páscoa", "${n}domingopascoa", S)
            }
            LiturgySeason.Ordinary -> {
                val n = LiturgyCalendarResolver.ordinaryWeek(date)
                c("${n}º Domingo do Tempo Comum", "${n}domingoTC", F)
            }
            LiturgySeason.Christmas -> c("Domingo do Tempo do Natal", "domingonatal", F)
        }
    }

    private fun sundayBetween(year: Int, month: Int, firstDay: Int, lastDay: Int): LocalDate {
        for (day in firstDay..lastDay) {
            val candidate = LocalDate.of(year, month, day)
            if (candidate.dayOfWeek == DayOfWeek.SUNDAY) return candidate
        }
        return LocalDate.of(year, month, firstDay)
    }
}
