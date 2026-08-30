from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Literal

Hour = Literal["leituras", "laudes", "terca", "sexta", "nona", "vesperas", "completas", "vigilia"]

DAY_NAMES = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]
WITH_FIRST_VESPERS = {
    "nsaparecida", "anunciacao", "apresentacao", "ascensaodosenhor", "assuncao", "corpuschristi",
    "cristoreidouniverso", "epifania", "exaltacao", "fieisdefuntos", "imaculada", "natal", "pascoa",
    "pedroepaulo", "pentecostes", "ramos", "sagradafamilia", "santamaria", "santissimatrindade",
    "saojoao", "saojose", "scj", "todosossantos", "transfiguracao",
}

COMMON_BY_KEY = {
    "saoandre": "apostolos", "saobartolomeu": "apostolos", "saofilipeetiago": "apostolos",
    "saomatias": "apostolos", "saotiago": "apostolos", "saotome": "apostolos", "simaoejudas": "apostolos",
    "saomarcos": "apostolos", "saolucas": "apostolos",
    "santaines": "virgens", "santaclara": "virgens", "santaluzia": "virgens", "santateresinha": "virgens",
    "santoantonio": "doutores", "santoagostinho": "doutores", "santoambrosio": "doutores",
    "santoatanasio": "doutores", "santotomas": "doutores", "saojeronimo": "doutores",
    "saogregorio": "doutores", "saoboaventura": "doutores", "saobernardo": "doutores",
    "saojoaocrisostomo": "doutores", "saojoaodacruz": "doutores", "santateresa": "doutores",
    "saojmvianney": "pastores", "saocarlosborromeu": "pastores", "saofranciscosales": "pastores",
    "saovicentedepaulo": "pastores", "saopiox": "pastores", "saofilipeneri": "pastores",
    "santoestevao": "ummartir", "saolourenco": "ummartir", "saojustino": "ummartir",
    "saopaulomiki": "variosmartires", "saocarloslwanga": "variosmartires", "inaciodeazevedo": "variosmartires",
    "roquegonzalez": "variosmartires",
    "santapaulina": "santasreligiosas", "santaescolastica": "santasreligiosas", "santajoanadechantal": "santasreligiosas",
    "santacatarina": "santasmulheres", "santamonica": "santasmulheres", "santamarta": "santasmulheres",
    "stamariamadalena": "santasmulheres", "santabrigida": "santasmulheres", "saoluisdefranca": "santoshomens",
    "saobento": "santosreligiosos", "saodomingos": "santosreligiosos", "saofrancisco": "santosreligiosos",
    "santoinacio": "santosreligiosos",
    "nsaparecida": "nossasenhora", "nscarmo": "nossasenhora", "nsdores": "nossasenhora",
    "nsguadalupe": "nossasenhora", "nsrainha": "nossasenhora", "nsrosario": "nossasenhora",
    "nslourdes": "nossasenhora", "maedaigreja": "nossasenhora", "icvm": "nossasenhora",
    "apresentacaons": "nossasenhora", "santamariamaior": "nossasenhora",
}

# Subconjunto da tabela fixa do iliturgia-sanctoral.ts que pode influenciar
# a resolução de I Vésperas. O grau é necessário para reproduzir exatamente a
# precedência do TypeScript quando uma celebração fixa cai no domingo.
FIXED_VESPERS_CANDIDATES: dict[tuple[int, int], tuple[str, str]] = {
    (1, 1): ("santamaria", "solenidade"),
    (2, 2): ("apresentacao", "festa"),
    (3, 19): ("saojose", "solenidade"),
    (3, 25): ("anunciacao", "solenidade"),
    # O TypeScript usa a chave "natividade" em 24/06, enquanto o conjunto de
    # arquivos de I Vésperas contém "saojoao". Mantemos essa diferença de chave
    # para não mascarar uma divergência preexistente do servidor original.
    (6, 24): ("natividade", "solenidade"),
    (6, 29): ("pedroepaulo", "solenidade"),
    (8, 6): ("transfiguracao", "festa"),
    (8, 15): ("assuncao", "solenidade"),
    (9, 14): ("exaltacao", "festa"),
    (10, 12): ("nsaparecida", "solenidade"),
    (11, 1): ("todosossantos", "solenidade"),
    (11, 2): ("fieisdefuntos", "solenidade"),
    (12, 8): ("imaculada", "solenidade"),
    (12, 25): ("natal", "solenidade"),
}


def easter(year: int) -> date:
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def advent_start(year: int) -> date:
    current = date(year, 11, 27)
    return current + timedelta(days=(6 - current.weekday()) % 7)


def liturgical_season(day: date) -> str:
    p = easter(day.year)
    ashes = p - timedelta(days=46)
    pentecost = p + timedelta(days=49)
    advent = advent_start(day.year)
    christmas = date(day.year, 12, 25)
    epiphany = date(day.year, 1, 6)
    baptism = epiphany + timedelta(days=(6 - epiphany.weekday()) % 7)
    if advent <= day < christmas:
        return "advento"
    if day >= christmas or day <= baptism:
        return "natal"
    if ashes <= day < p:
        return "quaresma"
    if p <= day <= pentecost:
        return "pascoa"
    return "tempocomum"


def _previous_or_same_sunday(day: date) -> date:
    return day - timedelta(days=(day.weekday() + 1) % 7)


def _week_since(start: date, day: date) -> int:
    first_sunday = _previous_or_same_sunday(start)
    return max(1, (day - first_sunday).days // 7 + 1)


def common_time_week(day: date) -> int:
    p = easter(day.year)
    ashes = p - timedelta(days=46)
    epiphany = date(day.year, 1, 6)
    baptism = epiphany + timedelta(days=(6 - epiphany.weekday()) % 7)
    if day < ashes:
        return max(1, _week_since(baptism + timedelta(days=1), day) + 1)
    christ_king_sunday = advent_start(day.year) - timedelta(days=7)
    remaining = (christ_king_sunday - _previous_or_same_sunday(day)).days // 7
    return max(1, 34 - remaining)


def psalter_week(day: date) -> int:
    season = liturgical_season(day)
    if season == "tempocomum":
        number = common_time_week(day)
    elif season == "advento":
        number = _week_since(advent_start(day.year), day)
    elif season == "quaresma":
        number = _week_since(easter(day.year) - timedelta(days=46), day)
    elif season == "pascoa":
        number = _week_since(easter(day.year), day)
    else:
        return 1
    return (number - 1) % 4 + 1


def temporal_document(day: date, hour: Hour) -> str:
    season = liturgical_season(day)
    day_name = DAY_NAMES[day.weekday()]
    week = psalter_week(day)
    if hour == "completas":
        if season == "tempocomum":
            return f"oficio/tempocomum/horas/completas_{day_name}.htm"
        if season == "advento":
            return f"oficio/advento/horas/completas{day_name}.htm"
        if season == "natal":
            suffix = "domingoI" if day_name == "domingo" else day_name
            return f"oficio/natal/horas/completas_{suffix}.htm"
    if season == "tempocomum":
        return f"oficio/tempocomum/horas/{week}{day_name}_{hour}.htm"
    if season == "advento":
        return f"oficio/advento/horas/{week}{day_name}_{hour}.htm"
    if season == "quaresma":
        return f"oficio/quaresma/horas/{week}{day_name}quaresma_{hour}.htm"
    if season == "pascoa":
        return f"oficio/pascoa/horas/{week}{day_name}pascoa_{hour}.htm"
    if day.month == 12 and day.day >= 29:
        return f"oficio/natal/horas/{day.day}dezembro_{hour}.htm"
    if day.month == 1 and 2 <= day.day <= 7:
        return f"oficio/natal/horas/{day.day}janeiro_{hour}.htm"
    return f"oficio/natal/horas/{day_name}_aposepifania_{hour}.htm"


def hour_from_proper(document: str) -> Hour | None:
    path = document.lstrip("/").replace("\\", "/").lower()
    if "/proprio/oficiodasleituras/" in path:
        return "leituras"
    match = re.search(r"_(laudes|terca|sexta|nona|vesperas|completas)\.html?$", path, re.I)
    return match.group(1).lower() if match else None  # type: ignore[return-value]


def proper_key(document: str) -> str:
    path = document.lstrip("/").replace("\\", "/").lower()
    readings = re.search(r"/proprio/oficiodasleituras/([^/]+)\.html?$", path, re.I)
    if readings:
        return readings.group(1)
    hours = re.search(r"/proprio/horas/([^/]+?)_(?:laudes|terca|sexta|nona|vesperas|completas|ivesperas)\.html?$", path, re.I)
    return hours.group(1) if hours else ""


def proper_exceptions(key: str, hour: Hour | None) -> list[str]:
    if key == "catedra" and hour in {"terca", "sexta", "nona"}:
        return [f"oficio/proprio/horas/catedra_comum_{hour}.htm"]
    return []


def common_for(key: str) -> str:
    return COMMON_BY_KEY.get(key.lower(), "")


def common_document(common: str, hour: Hour, first_vespers: bool = False) -> str:
    if first_vespers and hour == "vesperas":
        return f"oficio/outros/comum_{common}_Ivesperas.htm"
    return f"oficio/outros/comum_{common}_{hour}.htm"


def _sunday_between(year: int, month: int, start_day: int, end_day: int) -> date:
    for number in range(start_day, end_day + 1):
        candidate = date(year, month, number)
        if candidate.weekday() == 6:
            return candidate
    return date(year, month, start_day)


def _movable_celebration_key(day: date) -> str:
    """Reproduz a ordem de celebracaoMovel() do TypeScript."""
    p = easter(day.year)
    epiphany = _sunday_between(day.year, 1, 2, 8)
    baptism = epiphany + timedelta(days=1 if epiphany.day in {7, 8} else 7)
    movable = {
        epiphany: "epifania",
        baptism: "batismo",
        p - timedelta(days=46): "cinzas",
        p - timedelta(days=7): "ramos",
        p - timedelta(days=3): "ceiadosenhor",
        p - timedelta(days=2): "paixaodosenhor",
        p - timedelta(days=1): "sabadosanto",
        p: "pascoa",
        p + timedelta(days=7): "divinamisericordia",
        p + timedelta(days=42): "ascensaodosenhor",
        p + timedelta(days=49): "pentecostes",
        p + timedelta(days=50): "maedaigreja",
        p + timedelta(days=56): "santissimatrindade",
        p + timedelta(days=60): "corpuschristi",
        p + timedelta(days=68): "scj",
        advent_start(day.year) - timedelta(days=7): "cristoreidouniverso",
    }
    if day in movable:
        return movable[day]
    if day.month == 12 and 26 <= day.day <= 31 and day.weekday() == 6:
        return "sagradafamilia"
    return ""


def first_vespers_key(day: date) -> str:
    """Chave de celebracaoDoDia() relevante para a regra de I Vésperas.

    O route.ts original não consulta o título da Liturgia mensal aqui: ele chama
    celebracaoDoDia(amanha(data)). Esta implementação preserva a mesma ordem:
    celebrações móveis vencem primeiro; depois aplica-se a celebração fixa e a
    precedência do domingo. Isso é importante em calendários onde o conteúdo
    mensal transfere uma solenidade para outro dia, mas o servidor antigo ainda
    usa a tabela sanctoral fixa.
    """
    movable = _movable_celebration_key(day)
    if movable:
        return movable

    fixed = FIXED_VESPERS_CANDIDATES.get((day.month, day.day))
    is_sunday = day.weekday() == 6
    if not is_sunday:
        return fixed[0] if fixed else ""
    if not fixed:
        return ""

    # Em Advento, Quaresma e Páscoa o domingo sempre vence a fixa. Fora desses
    # tempos, apenas uma solenidade fixa vence o domingo; festas não vencem.
    season = liturgical_season(day)
    if season in {"advento", "quaresma", "pascoa"}:
        return ""
    key, grade = fixed
    return key if grade == "solenidade" else ""


def has_first_vespers(key: str) -> bool:
    return bool(key and key.lower() in WITH_FIRST_VESPERS)
