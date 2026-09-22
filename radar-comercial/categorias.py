"""Categorias comerciais do radar — fonte única para gerar_base e docs."""

CATEGORIAS = [
    "Construtora",
    "Corte e dobra ferro para construção",
    "Corte e dobra carbono",
    "Corte e dobra inox",
    "Indústria inox",
    "Indústria carbono",
    "Metalúrgica inox",
    "Metalúrgica carbono",
    "Revenda ferro para construção",
    "Revenda inox",
    "Revenda carbono",
    "Pré-moldados",
    "Artefatos de concreto",
    "Fundações",
    "Infraestrutura",
    "Silos e estruturas agro",
    "Tanques e vasos",
]

# Nomes antigos → atuais (CSV/UI já publicados)
_CATEGORIA_ALIASES = {
    "Corte e dobra de ferro para construção": "Corte e dobra ferro para construção",
    "Corte e dobra de aço carbono": "Corte e dobra carbono",
    "Corte e dobra de aço inox": "Corte e dobra inox",
}

# Abreviações só para UI compacta (stats)
CATEGORIA_ABREV = {
    "Construtora": "C",
    "Corte e dobra ferro para construção": "CDF",
    "Corte e dobra carbono": "CDC",
    "Corte e dobra inox": "CDI",
    "Indústria inox": "II",
    "Indústria carbono": "IC",
    "Metalúrgica inox": "MI",
    "Metalúrgica carbono": "MC",
    "Revenda ferro para construção": "RF",
    "Revenda inox": "RI",
    "Revenda carbono": "RC",
    "Pré-moldados": "PM",
    "Artefatos de concreto": "AC",
    "Fundações": "F",
    "Infraestrutura": "IF",
    "Silos e estruturas agro": "SA",
    "Tanques e vasos": "TV",
}

# Linha de produto (material) — independente da categoria (operação)
LINHAS = [
    "Ferro para construção",
    "Carbono",
    "Inox",
]

_LINHA_POR_CATEGORIA = {
    "Construtora": "Ferro para construção",
    "Corte e dobra ferro para construção": "Ferro para construção",
    "Revenda ferro para construção": "Ferro para construção",
    "Pré-moldados": "Ferro para construção",
    "Artefatos de concreto": "Ferro para construção",
    "Fundações": "Ferro para construção",
    "Infraestrutura": "Ferro para construção",
    "Corte e dobra carbono": "Carbono",
    "Revenda carbono": "Carbono",
    "Metalúrgica carbono": "Carbono",
    "Indústria carbono": "Carbono",
    "Silos e estruturas agro": "Carbono",
    "Tanques e vasos": "Carbono",
    "Corte e dobra inox": "Inox",
    "Revenda inox": "Inox",
    "Metalúrgica inox": "Inox",
    "Indústria inox": "Inox",
}


def format_linha(values) -> str:
    ordered = []
    for name in LINHAS:
        if name in values:
            ordered.append(name)
    return "; ".join(ordered)


def parse_linha(raw: str) -> list[str]:
    parts = [p.strip() for p in (raw or "").replace(",", ";").split(";") if p.strip()]
    return [p for p in LINHAS if p in parts]


def infer_linha(lead: dict) -> str:
    """Infere linha de produto a partir da categoria e, se multiproduto, dos textos."""
    existing = parse_linha(lead.get("linha") or "")
    if existing:
        return format_linha(existing)

    found: set[str] = set()
    cat = (lead.get("categoria") or "").strip()
    cat = _CATEGORIA_ALIASES.get(cat, cat)
    base = _LINHA_POR_CATEGORIA.get(cat)
    if base:
        found.add(base)

    multi = (lead.get("multioportunidade") or "").strip().lower().startswith("sim")
    blob = " ".join(
        [
            lead.get("produto_provavel") or "",
            lead.get("produto_secundario") or "",
            lead.get("justificativa_produto") or "",
        ]
    ).lower()

    if multi or not found:
        if any(
            k in blob
            for k in ("ca-50", "ca-60", "vergalhão", "si 50", "armadura", "treliça", "trelica")
        ):
            found.add("Ferro para construção")
        if any(k in blob for k in ("chapa", "carbono", "metalon", "laminad")):
            found.add("Carbono")
        elif "bobina" in blob and not any(
            k in blob for k in ("ca-50", "ca-60", "vergalhão", "si 50")
        ):
            found.add("Carbono")
        if "inox" in blob:
            found.add("Inox")

    if not found and base:
        found.add(base)
    if not found:
        found.add("Carbono")

    return format_linha(found)


_CDC_EMPRESAS = (
    "tornofer",
    "fratini",
    "metallaser",
    "rorato",
    "norte aço",
    "norte aco",
    "lacerda",
    "maridobras",
    "aws metal",
)

_MI_EMPRESAS = (
    "ata inox",
    "atainox",
    "aisi",
    "inox e cia",
    "brazzatti",
    "plasminox",
    "aquinox",
)

_REVENDA_FERRO = (
    "ca-50",
    "ca-60",
    "si 50",
    "vergalhão",
    "aço construção",
    "aco construcao",
    "ferro para constru",
    "ferragens",
    "treliça",
    "trelica",
    "armadura",
    "construção civil",
    "construcao civil",
)

_REVENDA_CARBONO = (
    "chapa",
    "bobina",
    "tubo",
    "perfil",
    "laser",
    "oxicorte",
    "plasma",
    "laminado",
    "viga",
    "metalon",
)


def _classify_revenda(lead: dict) -> str:
    """Desmembra R / Distribuição em Revenda ferro / inox / carbono."""
    sub = (lead.get("subcategoria") or "").strip().upper()
    emp = (lead.get("empresa") or "").lower()
    tipo = (lead.get("tipo_operacao") or "").lower()
    prod = (lead.get("produto_provavel") or "").lower()
    sec = (lead.get("produto_secundario") or "").lower()
    just = (lead.get("justificativa_produto") or "").lower()
    fab = (lead.get("o_que_fabrica_constroi") or "").lower()
    blob = f"{sub} | {tipo} | {prod} | {sec} | {just} | {fab} | {emp}"
    prod_pri = prod.split(";")[0]

    if sub == "R2" or (
        "inox" in prod_pri and not any(k in prod_pri for k in ("carbono", "ca-50", "vergalhão"))
    ):
        return "Revenda inox"

    if sub == "R1" or any(k in blob for k in _REVENDA_FERRO):
        # Primário só chapa/bobina, sem armadura/construção → carbono
        if any(k in prod_pri for k in ("chapa", "bobina")) and not any(
            k in prod_pri
            for k in (
                "ca-50",
                "ca-60",
                "si 50",
                "vergalhão",
                "construção",
                "construcao",
                "ferro",
            )
        ):
            return "Revenda carbono"
        return "Revenda ferro para construção"

    if sub == "R5" or any(k in blob for k in _REVENDA_CARBONO):
        return "Revenda carbono"

    return "Revenda carbono"


def remap_categoria(lead: dict) -> str:
    """Converte categorias legadas (C/CD/M/I/R/Distribuição) para o vocabulário atual."""
    old = (lead.get("categoria") or "").strip()
    old = _CATEGORIA_ALIASES.get(old, old)
    # Já no vocabulário atual (exceto Distribuição, desmembrada abaixo)
    if old in CATEGORIAS:
        return old

    sub = (lead.get("subcategoria") or "").strip()
    emp = (lead.get("empresa") or "").lower()
    tipo = (lead.get("tipo_operacao") or "").lower()
    prod = (lead.get("produto_provavel") or "").lower()
    just = (lead.get("justificativa_produto") or "").lower()
    blob = f"{tipo} | {prod} | {just} | {emp}"

    if old == "C":
        return "Construtora"
    if old == "CD":
        return "Corte e dobra ferro para construção"
    if old in ("R", "Distribuição"):
        return _classify_revenda(lead)

    if old == "I":
        if any(k in emp for k in _MI_EMPRESAS) or sub in ("I4", "I5"):
            return "Metalúrgica inox"
        if sub == "I15":
            return "Indústria carbono"
        return "Indústria inox"

    if old == "M":
        if any(k in emp for k in _CDC_EMPRESAS):
            return "Corte e dobra carbono"
        if any(
            k in blob
            for k in (
                "corte e dobra de chapas",
                "corte a laser",
                "corte laser",
                "centro de serviço",
                "serviço de corte e dobra",
            )
        ):
            if "vergalhão" in blob or "armadura" in blob or "ca-50" in blob:
                return "Corte e dobra ferro para construção"
            if "inox" in prod.split(";")[0] and "carbono" not in prod.split(";")[0]:
                return "Corte e dobra inox"
            return "Corte e dobra carbono"
        if any(k in emp for k in _MI_EMPRESAS) or (
            "inox" in emp and "estrutura" not in emp
        ):
            return "Metalúrgica inox"
        return "Metalúrgica carbono"

    return old or "Metalúrgica carbono"
