"""Índice del catálogo de audio en segundo plano, con estado honesto (spec 005 D13).

Porta la intención de las 9 pruebas del panel operativo
(admin-dashboard/tests/test_indice_blob.py), que prueban la copia que el panel
tiene del índice, y suma la invalidación a pedido, el TTL y el reintento tras un
error. La copia que usa la API no tenía ninguna prueba propia.
"""
import datetime
import threading
from types import SimpleNamespace

from indice_audio import IndiceBlob, MENSAJE_ERROR_PUBLICO, REINTENTO_TRAS_ERROR_SEGUNDOS, TTL_SEGUNDOS


def blob(nombre, tamano=1024):
    return SimpleNamespace(
        name=nombre, size=tamano,
        last_modified=datetime.datetime(2026, 9, 1, tzinfo=datetime.timezone.utc),
    )


BLOBS = [
    blob("RAYUELA/Rayuela Pista 2.mp3", 2048),
    blob("RAYUELA/Rayuela Pista 1.mp3", 1024),
    blob("AFRODITA/Afrodita Pista 1.mp3", 4096),
]


class Reloj:
    def __init__(self):
        self.ahora = datetime.datetime(2026, 10, 1, tzinfo=datetime.timezone.utc)

    def __call__(self):
        return self.ahora

    def avanzar(self, segundos):
        self.ahora += datetime.timedelta(seconds=segundos)


# --- Las 9 pruebas del panel, portadas ---------------------------------------------------

def test_arranca_vacio_sin_listar():
    llamadas = []
    indice = IndiceBlob(listar=lambda: llamadas.append(1) or BLOBS)

    assert indice.estado()["estado"] == "vacio"
    assert llamadas == []  # crear el índice no toca el almacenamiento


def test_refrescar_agrupa_por_libro_y_ordena_pistas():
    indice = IndiceBlob(listar=lambda: BLOBS)
    indice.refrescar()

    datos = indice.datos()
    assert indice.estado()["estado"] == "listo"
    assert datos["total_blobs"] == 3
    assert datos["total_size_bytes"] == 7168
    assert set(datos["books"]) == {"RAYUELA", "AFRODITA"}
    pistas = [t["file_name"] for t in datos["books"]["RAYUELA"]["tracks"]]
    assert pistas == ["Rayuela Pista 1.mp3", "Rayuela Pista 2.mp3"]
    assert datos["books"]["RAYUELA"]["total_tracks"] == 2


def test_fallo_sin_indice_previo_queda_en_error_y_no_finge_exito():
    def listar():
        raise ConnectionError("Unable to stream download.")

    indice = IndiceBlob(listar=listar)
    indice.refrescar()

    estado = indice.estado(detalle=True)
    assert estado["estado"] == "error"
    assert "Unable to stream download" in estado["error"]
    assert estado["ultimo_ok"] is None
    assert indice.datos()["books"] == {}


def test_fallo_parcial_conserva_el_indice_anterior():
    """Un listado que se corta a mitad no reemplaza un índice bueno por uno a medias."""
    fuente = {"blobs": BLOBS}

    def listar():
        for b in fuente["blobs"]:
            yield b
        if fuente.get("romper"):
            raise ConnectionError("corte a mitad del listado")

    indice = IndiceBlob(listar=listar)
    indice.refrescar()
    ultimo_ok = indice.estado()["ultimo_ok"]

    fuente["blobs"] = [blob("SOLO_UNO/p1.mp3")]
    fuente["romper"] = True
    indice.refrescar()

    estado = indice.estado()
    assert estado["estado"] == "error"
    assert estado["ultimo_ok"] == ultimo_ok
    assert set(indice.datos()["books"]) == {"RAYUELA", "AFRODITA"}


def test_obtener_no_bloquea_y_dispara_segundo_plano():
    liberar = threading.Event()
    empezo = threading.Event()

    def listar_lento():
        empezo.set()
        liberar.wait(5)
        return BLOBS

    indice = IndiceBlob(listar=listar_lento)
    datos = indice.obtener()  # vuelve enseguida, sin esperar al almacenamiento

    assert datos["books"] == {}
    assert empezo.wait(2)
    assert indice.estado()["estado"] == "indexando"

    liberar.set()
    indice.esperar(timeout=2)
    assert indice.estado()["estado"] == "listo"


def test_no_lanza_dos_refrescos_a_la_vez():
    liberar = threading.Event()
    llamadas = []

    def listar():
        llamadas.append(1)
        liberar.wait(5)
        return BLOBS

    indice = IndiceBlob(listar=listar)
    indice.refrescar_en_segundo_plano()
    indice.refrescar_en_segundo_plano()
    liberar.set()
    indice.esperar(timeout=2)

    assert len(llamadas) == 1


def test_error_largo_se_resume_en_una_linea():
    def listar():
        raise PermissionError("AuthenticationFailed\n<?xml version='1.0'?><Error>...</Error>")

    indice = IndiceBlob(listar=listar)
    indice.refrescar()
    assert indice.estado(detalle=True)["error"] == "PermissionError: AuthenticationFailed"


def test_pistas_en_orden_de_capitulo_no_alfabetico():
    """Mismo orden que la API (`ordenar_capitulos`): N en el reproductor va de la
    pista 1 a la 2, no a la 10. Las pistas sin número van al final, por nombre."""
    nombres = ["Pista 10.mp3", "Pista 2.mp3", "Intro.mp3", "Pista 1.mp3", "Pista 11.mp3"]
    indice = IndiceBlob(listar=lambda: [blob(f"LIBRO/{n}") for n in nombres])
    indice.refrescar()

    pistas = [t["file_name"] for t in indice.datos()["books"]["LIBRO"]["tracks"]]
    assert pistas == ["Pista 1.mp3", "Pista 2.mp3", "Pista 10.mp3", "Pista 11.mp3", "Intro.mp3"]


def test_estado_publico_no_expone_el_mensaje_interno():
    """Los endpoints sin token muestran un texto genérico (CWE-209); el detalle
    (nombre de cuenta, XML del almacenamiento) queda para la ruta con token."""
    def listar():
        raise ConnectionError("AuthenticationFailed: cuenta cuentaprueba, firma inválida")

    indice = IndiceBlob(listar=listar)
    indice.refrescar()

    publico = indice.estado()
    assert publico["estado"] == "error"
    assert "cuentaprueba" not in (publico["error"] or "")
    assert "AuthenticationFailed" not in (publico["error"] or "")
    assert publico["error"] == MENSAJE_ERROR_PUBLICO
    assert "cuentaprueba" in indice.estado(detalle=True)["error"]


# --- Casos propios de la API: reloj, invalidación y reintento -------------------------------

def test_los_blobs_sin_carpeta_van_a_la_raiz():
    indice = IndiceBlob(listar=lambda: [blob("suelto.mp3", 10)])
    indice.refrescar()
    assert list(indice.datos()["books"]) == ["Raíz / Sin Clasificar"]


def test_el_indice_vence_a_los_diez_minutos():
    reloj = Reloj()
    llamadas = []
    indice = IndiceBlob(listar=lambda: llamadas.append(1) or BLOBS, reloj=reloj)
    indice.refrescar()
    assert indice._necesita_refresco() is False
    reloj.avanzar(TTL_SEGUNDOS + 1)
    assert indice._necesita_refresco() is True


def test_tras_un_error_reintenta_a_los_60_segundos_no_antes():
    reloj = Reloj()

    def falla():
        raise ConnectionError("sin red")

    indice = IndiceBlob(listar=falla, reloj=reloj)
    indice.refrescar()
    assert indice._necesita_refresco() is False
    reloj.avanzar(REINTENTO_TRAS_ERROR_SEGUNDOS + 1)
    assert indice._necesita_refresco() is True


def test_invalidar_pide_reindexar_y_conserva_los_ultimos_datos_validos():
    reloj = Reloj()
    indice = IndiceBlob(listar=lambda: BLOBS, reloj=reloj)
    indice.refrescar()
    assert indice._necesita_refresco() is False

    indice.invalidar()

    assert indice._necesita_refresco() is True
    assert indice.estado()["estado"] == "listo"           # no finge «indexando»
    assert set(indice.datos()["books"]) == {"RAYUELA", "AFRODITA"}  # sigue entregando lo último válido
    indice.refrescar()
    assert indice._necesita_refresco() is False           # un refresco posterior consume la invalidación


def test_una_invalidacion_durante_un_refresco_no_se_pierde():
    reloj = Reloj()
    liberar = threading.Event()
    empezo = threading.Event()
    indice = IndiceBlob(listar=lambda: (empezo.set(), liberar.wait(5), BLOBS)[2], reloj=reloj)
    hilo = threading.Thread(target=indice.refrescar)
    hilo.start()
    assert empezo.wait(2)

    indice.invalidar()  # llega mientras el refresco está listando
    liberar.set()
    hilo.join(2)

    assert indice.estado()["estado"] == "listo"
    assert indice._necesita_refresco() is True  # los datos nuevos pueden no incluir la pista subida


def test_invalidar_despues_de_un_error_reintenta_sin_esperar_los_60_segundos():
    reloj = Reloj()

    def falla():
        raise ConnectionError("sin red")

    indice = IndiceBlob(listar=falla, reloj=reloj)
    indice.refrescar()
    assert indice._necesita_refresco() is False
    indice.invalidar()
    assert indice._necesita_refresco() is True
    indice.refrescar()  # vuelve a fallar: rige otra vez la espera, sin reintentar en cada pedido
    assert indice._necesita_refresco() is False
