"""Categorias comerciais do radar — fonte única para gerar_base e docs."""

CATEGORIAS = [
    "Construtora",
    "Corte e dobra de ferro para construção",
    "Corte e dobra de aço carbono",
    "Corte e dobra de aço inox",
    "Indústria inox",
    "Indústria carbono",
    "Metalúrgica inox",
    "Metalúrgica carbono",
    "Revenda ferro para construção",
    "Revenda inox",
    "Revenda carbono",
]

# Abreviações só para UI compacta (stats)
CATEGORIA_ABREV = {
    "Construtora": "C",
    "Corte e dobra de ferro para construção": "CDF",
    "Corte e dobra de aço carbono": "CDC",
    "Corte e dobra de aço inox": "CDI",
    "Indústria inox": "II",
    "Indústria carbono": "IC",
    "Metalúrgica inox": "MI",
    "Metalúrgica carbono": "MC",
    "Revenda ferro para construção": "RF",
    "Revenda inox": "RI",
    "Revenda carbono": "RC",
}

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
    # Já no novo vocabulário (exceto Distribuição, que foi desmembrada)
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
        return "Corte e dobra de ferro para construção"
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
            return "Corte e dobra de aço carbono"
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
                return "Corte e dobra de ferro para construção"
            if "inox" in prod.split(";")[0] and "carbono" not in prod.split(";")[0]:
                return "Corte e dobra de aço inox"
            return "Corte e dobra de aço carbono"
        if any(k in emp for k in _MI_EMPRESAS) or (
            "inox" in emp and "estrutura" not in emp
        ):
            return "Metalúrgica inox"
        return "Metalúrgica carbono"

    return old or "Metalúrgica carbono"
