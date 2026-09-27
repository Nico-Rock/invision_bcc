"""Importador de fichas desde CSV que valida y explica antes de actuar (spec 005, R22, D18).

Reemplaza al que adivinaba columnas en silencio: el mapeo se propone y se
devuelve para confirmar, cada fila dice qué le pasa y nada se escribe hasta
ejecutar. Solo crea fichas: el audio desde SharePoint sigue fuera de alcance.
"""
import csv
import io

from vocabulario import existente_parecido, normalizar

MAX_FILAS = 5000
CAMPOS = ("nombre", "autor", "narrador", "genero", "descripcion", "categoria", "clasificaciones")
NOMBRES_CAMPOS = {
    "nombre": "título", "autor": "autor", "narrador": "narrador", "genero": "género",
    "descripcion": "descripción", "categoria": "categoría", "clasificaciones": "clasificaciones",
}
VOCABULARIO = (("genero", "generos", "género"), ("autor", "autores", "autor"), ("narrador", "narradores", "narrador"))


def _campo_de_columna(encabezado):
    """Campo para un encabezado. El orden importa: 'Nombre del narrador' es narrador."""
    h = normalizar(encabezado)
    if any(p in h for p in ("narrador", "lector", "locutor", "voz")):
        return "narrador"
    if "autor" in h or "author" in h:
        return "autor"
    if "titulo" in h or "title" in h or h in ("nombre", "name", "libro", "nombre del libro"):
        return "nombre"
    if "genero" in h or "genre" in h:
        return "genero"
    if "descrip" in h:
        return "descripcion"
    if "categor" in h:
        return "categoria"
    if "clasific" in h or "etiqueta" in h:
        return "clasificaciones"
    return None


def _separador(texto):
    muestra = texto[:4096]
    try:
        return csv.Sniffer().sniff(muestra, delimiters=",;\t|").delimiter
    except csv.Error:
        return ","


def proponer_mapeo(encabezados):
    mapeo, usados = {}, set()
    for e in encabezados:
        campo = _campo_de_columna(e)
        if campo and campo not in usados:
            mapeo[e] = campo
            usados.add(campo)
    return mapeo


def analizar(texto, existentes, mapeo=None):
    """Valida sin escribir. `existentes`: títulos, géneros, autores y narradores del catálogo."""
    separador = _separador(texto)
    lector = csv.reader(io.StringIO(texto.lstrip("﻿")), delimiter=separador)
    filas_crudas = [f for f in lector if any(c.strip() for c in f)]
    if not filas_crudas:
        return {"separador": separador, "columnas": [], "mapeo": {}, "filas": [], "problemas": [],
                "resumen": {"filas": 0, "listas": 0, "con_avisos": 0, "bloqueadas": 0,
                            "bloqueante": "El archivo no tiene filas."}}
    encabezados = [e.strip() for e in filas_crudas[0]]
    mapeo = mapeo or proponer_mapeo(encabezados)
    datos = filas_crudas[1:MAX_FILAS + 1]

    titulos_catalogo = {normalizar(t) for t in existentes.get("titulos", [])}
    vistos = {}
    filas, problemas = [], []
    listas = con_avisos = bloqueadas = 0
    for n, cruda in enumerate(datos, start=2):
        fila = {c: "" for c in CAMPOS}
        for i, e in enumerate(encabezados):
            campo = mapeo.get(e)
            if campo and i < len(cruda):
                fila[campo] = cruda[i].strip()
        bloquea, avisos = [], []
        clave = normalizar(fila["nombre"])
        if not fila["nombre"]:
            bloquea.append("sin título")
        elif clave in vistos:
            bloquea.append(f"título repetido en el archivo (fila {vistos[clave]})")
        elif clave in titulos_catalogo:
            bloquea.append("ya existe en el catálogo")
        if fila["nombre"] and clave not in vistos:
            vistos[clave] = n
        for campo, lista, nombre in VOCABULARIO:
            existente = existente_parecido(fila[campo], existentes.get(lista, []))
            if existente:
                avisos.append(f"{nombre} parecido a {existente}: se usa {existente}")
                fila[campo] = existente
        fila["_fila"] = n
        fila["_importable"] = not bloquea
        filas.append(fila)
        if bloquea:
            bloqueadas += 1
        elif avisos:
            con_avisos += 1
            listas += 1
        else:
            listas += 1
        if bloquea or avisos:
            problemas.append({"fila": n, "titulo": fila["nombre"], "motivos": bloquea + avisos, "bloquea": bool(bloquea)})

    bloqueante = None
    if "nombre" not in mapeo.values():
        bloqueante = "No hay ninguna columna de título: indicá cuál columna es el título."
    ignoradas = [e for e in encabezados if e not in mapeo]
    return {
        "separador": separador,
        "columnas": encabezados,
        "mapeo": mapeo,
        "ignoradas": ignoradas,
        "filas": filas,
        "problemas": problemas,
        "resumen": {
            "filas": len(datos), "listas": 0 if bloqueante else listas, "con_avisos": con_avisos,
            "bloqueadas": bloqueadas, "bloqueante": bloqueante,
            "recortado": len(filas_crudas) - 1 > MAX_FILAS,
        },
    }
