"""Spec 005, grupos B y C: piezas sin base de datos ni Azure (R20, R22, R24)."""
import verificacion_audio as va
import vocabulario as voc
import importador as imp

# Cuadro MPEG-1 Layer III, 128 kbps, 44,1 kHz, sin relleno: 417 bytes y 1152 muestras
CABECERA = bytes([0xFF, 0xFB, 0x90, 0x64])
CUADRO = CABECERA + bytes(417 - 4)


def mp3(cuadros, prefijo=b"", sufijo=b""):
    return prefijo + CUADRO * cuadros + sufijo


def id3(largo):
    tam = bytes([(largo >> 21) & 0x7F, (largo >> 14) & 0x7F, (largo >> 7) & 0x7F, largo & 0x7F])
    return b"ID3\x03\x00\x00" + tam + bytes(largo)


# --- Verificación de audio (R20) --------------------------------------------------

def test_duracion_de_un_mp3_valido():
    r = va.analizar(mp3(1000))
    assert abs(r["duracion_segundos"] - 1000 * 1152 / 44100) < 0.01
    assert r["problemas"] == []


def test_salta_la_etiqueta_id3():
    r = va.analizar(mp3(1000, prefijo=id3(2000)))
    assert r["cuadros"] == 1000 and r["problemas"] == []


def test_vacia_y_sin_audio():
    assert "vacia" in va.analizar(b"")["problemas"]
    assert "sin_audio" in va.analizar(b"dummy mp3 content")["problemas"]


def test_danada_si_hay_mucha_basura_entre_cuadros():
    datos = mp3(300) + bytes([0x12]) * 20000 + mp3(300)
    assert "danada" in va.analizar(datos)["problemas"]


def test_truncada_si_el_ultimo_cuadro_no_termina():
    assert "truncada" in va.analizar(mp3(1000) + CUADRO[:200])["problemas"]


def test_muy_corta():
    assert "muy_corta" in va.analizar(mp3(100))["problemas"]  # 2,6 s


def test_texto_de_problemas_y_duracion_hablada():
    assert va.duracion_hablada(3725) == "1 hora 2 minutos 5 segundos"
    assert va.duracion_hablada(59) == "59 segundos"
    assert "dañado" in va.describir(["danada"])


# --- Vocabulario (R15, R24) --------------------------------------------------------

def test_normalizar_igual_que_el_sitio():
    assert voc.normalizar("CLÁSICOS de la Literatura") == voc.normalizar("clasico de la literatura")


def test_grupos_de_valores_parecidos():
    grupos = voc.grupos_parecidos(["BIOGRAFIAS Y MEMORIAS", "BIOGRAFÍAS Y MEMORIAS", "NOVELA", "Novela", "ENSAYO"])
    assert sorted(map(sorted, grupos)) == [["BIOGRAFIAS Y MEMORIAS", "BIOGRAFÍAS Y MEMORIAS"], ["NOVELA", "Novela"]]


# --- Importador (R22) --------------------------------------------------------------

def test_detecta_separador_y_propone_mapeo():
    texto = "Título;Autor;Narrador;Género\nRAYUELA;CORTÁZAR;ANA;NOVELA\n"
    a = imp.analizar(texto, existentes={"titulos": [], "generos": [], "autores": [], "narradores": []})
    assert a["separador"] == ";"
    assert a["mapeo"] == {"Título": "nombre", "Autor": "autor", "Narrador": "narrador", "Género": "genero"}
    assert a["resumen"]["filas"] == 1 and a["resumen"]["listas"] == 1


def test_una_columna_de_narrador_no_se_toma_como_titulo():
    a = imp.analizar("Nombre del narrador,Título\nANA,RAYUELA\n", existentes={"titulos": [], "generos": [], "autores": [], "narradores": []})
    assert a["mapeo"] == {"Nombre del narrador": "narrador", "Título": "nombre"}


def test_problemas_por_fila():
    texto = "titulo,genero\n,NOVELA\nRAYUELA,novelas\nRAYUELA,NOVELA\nAFRODITA,NOVELA\n"
    a = imp.analizar(texto, existentes={"titulos": ["AFRODITA"], "generos": ["NOVELA"], "autores": [], "narradores": []})
    problemas = {p["fila"]: p["motivos"] for p in a["problemas"]}
    assert "sin título" in problemas[2][0]
    assert any("parecido" in m for m in problemas[3])
    assert any("repetido" in m for m in problemas[4])
    assert any("ya existe" in m for m in problemas[5])
    # El parecido no bloquea: se unifica con el valor existente y se avisa
    assert a["resumen"]["listas"] == 1
    assert a["resumen"]["con_avisos"] == 1
    assert a["resumen"]["bloqueadas"] == 3
    assert a["filas"][1]["genero"] == "NOVELA"


def test_sin_columna_de_titulo_no_se_puede_importar():
    a = imp.analizar("autor,genero\nX,Y\n", existentes={"titulos": [], "generos": [], "autores": [], "narradores": []})
    assert a["resumen"]["bloqueante"]
