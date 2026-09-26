"""Estructura accesible del panel, verificada sobre el HTML y el JS (spec 002, T3, D11).

Cada caso cita el criterio de verificación (V#) que protege. Son chequeos que
axe no hace o que conviene atrapar antes del navegador.
"""
import re
from html.parser import HTMLParser
from pathlib import Path

STATIC = Path(__file__).resolve().parent.parent / "static"
HTML = (STATIC / "index.html").read_text(encoding="utf-8")
JS = {p.name: p.read_text(encoding="utf-8") for p in STATIC.glob("*.js")}


class Nodo:
    def __init__(self, tag, attrs, padre):
        self.tag, self.attrs, self.padre = tag, dict(attrs), padre
        self.hijos, self.texto = [], []

    def texto_visible(self):
        """Texto que se ve, sin lo marcado aria-hidden."""
        if self.attrs.get("aria-hidden") == "true":
            return ""
        partes = list(self.texto)
        for h in self.hijos:
            partes.append(h.texto_visible())
        return " ".join(p for p in partes if p.strip())


class Arbol(HTMLParser):
    VACIOS = {"meta", "link", "input", "br", "img", "hr", "source", "stop", "path", "circle", "polygon"}

    def __init__(self):
        super().__init__()
        self.raiz = Nodo("#doc", [], None)
        self.actual = self.raiz
        self.todos = []

    def handle_starttag(self, tag, attrs):
        nodo = Nodo(tag, attrs, self.actual)
        self.actual.hijos.append(nodo)
        self.todos.append(nodo)
        if tag not in self.VACIOS:
            self.actual = nodo

    def handle_startendtag(self, tag, attrs):
        nodo = Nodo(tag, attrs, self.actual)
        self.actual.hijos.append(nodo)
        self.todos.append(nodo)

    def handle_endtag(self, tag):
        n = self.actual
        while n is not None and n.tag != tag:
            n = n.padre
        if n is not None and n.padre is not None:
            self.actual = n.padre

    def handle_data(self, data):
        if self.actual.tag not in ("style", "script"):
            self.actual.texto.append(data)


def arbol():
    a = Arbol()
    a.feed(HTML)
    return a


def normalizar(texto):
    sin_simbolos = re.sub(r"[^\w\s]", " ", texto, flags=re.UNICODE)
    return re.sub(r"\s+", " ", sin_simbolos).strip().lower()


def css():
    """CSS del panel sin comentarios (un comentario que nombra un color no es un uso)."""
    bloques = "\n".join(re.findall(r"<style>(.*?)</style>", HTML, flags=re.S))
    return re.sub(r"/\*.*?\*/", "", bloques, flags=re.S)


# --- V4: exactamente dos regiones vivas -------------------------------------

def test_v4_exactamente_dos_regiones_vivas():
    vivas = [n for n in arbol().todos
             if "aria-live" in n.attrs or n.attrs.get("role") in ("status", "alert", "log")]
    modos = sorted(n.attrs.get("aria-live") for n in vivas)
    assert len(vivas) == 2, [n.attrs.get("id") for n in vivas]
    assert modos == ["assertive", "polite"]


# --- V18: colores de texto solo por tokens ----------------------------------

def test_v18_sin_colores_de_texto_literales_fuera_de_los_tokens():
    literales = []
    for linea in css().splitlines():
        l = linea.strip()
        if l.startswith("--"):
            continue  # definición de token
        if re.search(r"(^|[\s;{])(color|background(-color)?|border(-\w+)?)\s*:[^;]*#[0-9A-Fa-f]{3,6}\b", l):
            literales.append(l)
    for nodo in arbol().todos:
        estilo = nodo.attrs.get("style") or ""
        if re.search(r"#[0-9A-Fa-f]{3,6}\b", estilo):
            literales.append(f"<{nodo.tag} style={estilo}>")
    assert literales == []


def test_v18_naranja_de_marca_solo_en_su_token():
    usos = [l.strip() for l in css().splitlines() if "#D34500" in l.upper()]
    assert usos and all(u.startswith("--brand-orange") for u in usos), usos


# --- V13: regiones y nombres -------------------------------------------------

def test_v13_nav_con_nombre_y_pie():
    a = arbol()
    navs = [n for n in a.todos if n.tag == "nav"]
    assert navs and all(n.attrs.get("aria-label") for n in navs)
    assert any(n.tag == "footer" for n in a.todos)
    # La barra de accesibilidad no debe ser un <header> (anulaba el banner)
    barra = [n for n in a.todos if "a11y-header" in (n.attrs.get("class") or "")]
    assert barra and barra[0].tag == "section" and barra[0].attrs.get("aria-label")


def test_v13_nombre_accesible_contiene_el_texto_visible():
    fallas = []
    for n in arbol().todos:
        etiqueta = n.attrs.get("aria-label")
        es_control = n.tag in ("button", "a") or n.attrs.get("role") == "button"
        if not (es_control and etiqueta):
            continue
        visible = normalizar(n.texto_visible())
        if visible and visible not in normalizar(etiqueta):
            fallas.append((visible, etiqueta))
    assert fallas == []


def test_v30_emojis_de_la_navegacion_ocultos_al_lector():
    iconos = [n for n in arbol().todos
              if (n.attrs.get("class") or "").split() and set((n.attrs.get("class") or "").split()) & {"nav-icon", "kpi-icon", "brand-icon"}]
    assert iconos and all(n.attrs.get("aria-hidden") == "true" for n in iconos)


# --- V30: atajos -------------------------------------------------------------

TECLA_ARIA = re.compile(r"^((Shift|Control|Alt|Meta)\+)*([A-Za-z0-9?]|Escape|Space|Slash|Arrow(Up|Down|Left|Right))$")


def test_v30_aria_keyshortcuts_validos():
    for n in arbol().todos:
        valor = n.attrs.get("aria-keyshortcuts")
        if valor is None:
            continue
        for tecla in valor.split():
            assert TECLA_ARIA.match(tecla), (n.tag, valor)
            # ARIA recomienda la letra en mayúscula
            assert not re.fullmatch(r"[a-z]", tecla), (n.tag, valor)


# --- V10/V19: foco -----------------------------------------------------------

def test_v19_ningun_outline_none_y_regla_global_de_foco():
    assert not re.search(r"outline\s*:\s*(none|0)\b", css())
    assert re.search(r":focus-visible\s*\{[^}]*outline:\s*4px solid var\(--focus-ring\)[^}]*outline-offset:\s*4px", css())
    assert "--focus-ring-outline" not in HTML


# --- P8 / CWE-79: nada de datos en innerHTML ---------------------------------

def test_cwe79_sin_innerhtml_con_datos():
    fuentes = {"index.html": HTML, **JS}
    con_datos = [(nombre, m.group(0)[:80]) for nombre, texto in fuentes.items()
                 for m in re.finditer(r"innerHTML\s*=\s*[^;]*\$\{", texto)]
    assert con_datos == []


def test_alert_no_se_usa_para_avisos():
    assert not re.search(r"\balert\(", HTML)


# --- R37: preferencias antes del primer pintado ------------------------------

def test_r37_preferencias_se_aplican_en_head():
    cabeza = HTML.split("</head>")[0]
    assert "a11y-logica.js" in cabeza and "aplicarTemprano" in cabeza
    assert cabeza.index("a11y-logica.js") < cabeza.index("<style>")
    assert "body.high-contrast" not in HTML


# --- Los botones de accesibilidad nunca quedan mudos -------------------------

def test_scripts_locales_con_version_en_la_url():
    """Un navegador que reusa un a11y.js viejo con el HTML nuevo deja la barra
    de accesibilidad sin funcionar y sin avisar (reportado el 26/09 con captura)."""
    locales = re.findall(r'<script src="(/[^"]+)"', HTML)
    assert locales, "no se encontraron scripts locales"
    sin_version = [s for s in locales if "?v=" not in s]
    assert sin_version == []
    assert len({s.split("?v=")[1] for s in locales}) == 1, "todos con la misma versión"


def test_aviso_visible_si_las_primitivas_no_cargan():
    assert "typeof A11y === 'undefined'" in HTML
    assert 'id="aviso-a11y-caido"' in HTML
