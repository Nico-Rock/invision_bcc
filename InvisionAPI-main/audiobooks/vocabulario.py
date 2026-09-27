"""Vocabulario controlado del lado del servidor (spec 005, R15, R24).

La normalización es la misma que `frontend/src/lib/vocabulario.js`: sin tildes,
sin mayúsculas, espacios simples y sin plural final por palabra.
"""
import re
import unicodedata


def normalizar(valor):
    texto = unicodedata.normalize("NFD", str(valor or ""))
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn").lower().strip()
    return " ".join(re.sub(r"(es|s)$", "", palabra) for palabra in texto.split())


def grupos_parecidos(valores):
    """Grupos de dos o más valores distintos que se escriben distinto pero son el mismo."""
    grupos = {}
    for v in {str(v).strip() for v in valores if v and str(v).strip()}:
        grupos.setdefault(normalizar(v), set()).add(v)
    return [sorted(g) for g in grupos.values() if len(g) > 1]


def existente_parecido(valor, existentes):
    """El existente con la misma forma normalizada, si el valor no es idéntico a uno."""
    v = str(valor or "").strip()
    if not v or v in existentes:
        return None
    clave = normalizar(v)
    for e in sorted(existentes):
        if e and normalizar(e) == clave:
            return e
    return None
