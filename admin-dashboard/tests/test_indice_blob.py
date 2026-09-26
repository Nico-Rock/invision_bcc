"""T3 — índice de Blob en segundo plano, con estado honesto [R3, R4].

Antes: el servidor indexaba ANTES de abrir el puerto (40 s colgado) y, si el
listado fallaba, igual imprimía "Estructura indexada correctamente".
"""
import datetime
import threading
from types import SimpleNamespace

from invision.indice_blob import IndiceBlob


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


def test_arranca_vacio_sin_listar():
    llamadas = []
    indice = IndiceBlob(listar=lambda: llamadas.append(1) or BLOBS)

    assert indice.estado()["estado"] == "vacio"
    assert llamadas == []  # crear el índice no toca Azure


def test_refrescar_agrupa_por_libro_y_ordena_pistas():
    indice = IndiceBlob(listar=lambda: BLOBS)
    indice.refrescar()

    datos = indice.datos()
    assert indice.estado()["estado"] == "listo"
    assert datos["total_blobs"] == 3
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
    datos = indice.obtener()  # vuelve enseguida, sin esperar a Azure

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
    """Mismo orden que la API (T19 de 001): N en el reproductor va de la pista 1
    a la 2, no a la 10. Las pistas sin número van al final, por nombre."""
    nombres = ["Pista 10.mp3", "Pista 2.mp3", "Intro.mp3", "Pista 1.mp3", "Pista 11.mp3"]
    indice = IndiceBlob(listar=lambda: [blob(f"LIBRO/{n}") for n in nombres])
    indice.refrescar()

    pistas = [t["file_name"] for t in indice.datos()["books"]["LIBRO"]["tracks"]]
    assert pistas == ["Pista 1.mp3", "Pista 2.mp3", "Pista 10.mp3", "Pista 11.mp3", "Intro.mp3"]


def test_estado_publico_no_expone_el_mensaje_interno():
    """R45 de 001 (CWE-209): los endpoints sin token muestran un texto genérico;
    el detalle (nombre de cuenta, XML de Azure) queda para el endpoint con token."""
    def listar():
        raise ConnectionError("AuthenticationFailed: cuenta cuentaprueba, firma inválida")

    indice = IndiceBlob(listar=listar)
    indice.refrescar()

    publico = indice.estado()
    assert publico["estado"] == "error"
    assert "cuentaprueba" not in (publico["error"] or "")
    assert "AuthenticationFailed" not in (publico["error"] or "")
    assert publico["error"]  # igual dice algo legible
    assert "cuentaprueba" in indice.estado(detalle=True)["error"]
