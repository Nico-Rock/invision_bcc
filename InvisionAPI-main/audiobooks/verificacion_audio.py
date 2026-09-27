"""Verificación de pistas MP3 sin decodificar (spec 005, R20, D16).

Quien administra no puede mirar una forma de onda: el sistema lee la estructura
de cuadros MPEG y dice la duración y los problemas. Python puro, sin
dependencias nuevas en la imagen de producción.

Detecta: vacía, sin audio reconocible, dañada (más del 5 % de bytes fuera de
cuadros), truncada (el último cuadro no termina) y muy corta (menos de 10 s).
NO detecta silencios largos: eso requiere decodificar (ffmpeg), pendiente de
aprobación como dependencia nueva.
"""
BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
SAMPLERATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}
UMBRAL_DANADA = 0.05
MINIMO_SEGUNDOS = 10

DESCRIPCIONES = {
    "vacia": "el archivo está vacío",
    "sin_audio": "no tiene audio MP3 reconocible",
    "danada": "está dañado: tiene partes que no son audio",
    "truncada": "está incompleto: se corta al final",
    "muy_corta": f"dura menos de {MINIMO_SEGUNDOS} segundos",
}


def _cabecera(datos, pos):
    """(largo, muestras, frecuencia) si en `pos` hay una cabecera Layer III válida."""
    if pos + 4 > len(datos) or datos[pos] != 0xFF or (datos[pos + 1] & 0xE0) != 0xE0:
        return None
    b2, b3 = datos[pos + 1], datos[pos + 2]
    version = (b2 >> 3) & 3
    capa = (b2 >> 1) & 3
    if version == 1 or capa != 1:  # versión reservada o no es Layer III
        return None
    i_bitrate, i_frecuencia, relleno = b3 >> 4, (b3 >> 2) & 3, (b3 >> 1) & 1
    if i_bitrate in (0, 15) or i_frecuencia == 3:
        return None
    bitrate = (BITRATES_V1 if version == 3 else BITRATES_V2)[i_bitrate] * 1000
    frecuencia = SAMPLERATES[version][i_frecuencia]
    if version == 3:
        largo, muestras = 144 * bitrate // frecuencia + relleno, 1152
    else:
        largo, muestras = 72 * bitrate // frecuencia + relleno, 576
    return (largo, muestras, frecuencia) if largo > 4 else None


def _saltar_id3(datos):
    if len(datos) >= 10 and datos[:3] == b"ID3":
        tam = (datos[6] << 21) | (datos[7] << 14) | (datos[8] << 7) | datos[9]
        pie = 10 if datos[5] & 0x10 else 0
        return 10 + tam + pie
    return 0


def analizar(datos):
    problemas = []
    if not datos:
        return {"bytes": 0, "cuadros": 0, "duracion_segundos": 0.0, "problemas": ["vacia"]}

    inicio = _saltar_id3(datos)
    fin = len(datos) - (128 if len(datos) >= 128 and datos[-128:-125] == b"TAG" else 0)
    pos, cuadros, segundos, basura, truncada = inicio, 0, 0.0, 0, False
    while pos + 4 <= fin:
        cab = _cabecera(datos, pos)
        if cab is None:
            basura += 1
            pos += 1
            continue
        largo, muestras, frecuencia = cab
        if pos + largo > fin:
            truncada = True
            break
        cuadros += 1
        segundos += muestras / frecuencia
        pos += largo
    basura += max(0, fin - pos) if not truncada else 0

    util = max(1, fin - inicio)
    if cuadros == 0:
        problemas.append("sin_audio")
    else:
        if basura / util > UMBRAL_DANADA:
            problemas.append("danada")
        if truncada:
            problemas.append("truncada")
        if segundos < MINIMO_SEGUNDOS:
            problemas.append("muy_corta")
    return {"bytes": len(datos), "cuadros": cuadros, "duracion_segundos": round(segundos, 2), "problemas": problemas}


def duracion_hablada(segundos):
    s = int(round(segundos))
    horas, resto = divmod(s, 3600)
    minutos, seg = divmod(resto, 60)
    partes = []
    if horas:
        partes.append(f"{horas} {'hora' if horas == 1 else 'horas'}")
    if minutos:
        partes.append(f"{minutos} {'minuto' if minutos == 1 else 'minutos'}")
    if seg or not partes:
        partes.append(f"{seg} {'segundo' if seg == 1 else 'segundos'}")
    return " ".join(partes)


def describir(problemas):
    return "; ".join(DESCRIPCIONES.get(p, p) for p in problemas)
