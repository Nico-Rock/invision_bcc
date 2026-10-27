"""Validación de nombres de pistas antes de pedir un permiso de subida (spec 005, R3).

Mismas reglas que la carga del panel operativo (admin-dashboard/server.py,
`subir_pista`): nada de rutas, solo MP3 y un largo razonable. Se valida en el
servidor: la pantalla puede saltearse, esto no (CWE-22, CWE-20).
"""
import re

LARGO_MAXIMO = 200
MAX_PISTA_BYTES = 500 * 1024 * 1024  # 500 MB por pista
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def validar_nombre_pista(nombre):
    """Devuelve None si el nombre sirve, o el motivo legible si no."""
    if not nombre or not nombre.strip():
        return "Falta el nombre del archivo."
    if "/" in nombre or "\\" in nombre or ".." in nombre:
        return "El nombre del archivo no puede incluir carpetas ni '..'."
    if _CONTROL.search(nombre):
        return "El nombre del archivo tiene caracteres no permitidos."
    if len(nombre) > LARGO_MAXIMO:
        return f"El nombre del archivo supera los {LARGO_MAXIMO} caracteres."
    if not nombre.lower().endswith(".mp3"):
        return "Solo se aceptan archivos MP3."
    return None


def validar_tamano_pista(tamano):
    """Devuelve None si el tamaño (en bytes) sirve, o el motivo legible si no.

    Una pista vacía se subiría igual y quedaría «con problemas» sin poder
    reemplazarse (el permiso es solo de creación), así que se rechaza antes."""
    if tamano is None or tamano <= 0:
        return "El archivo está vacío: no se puede subir una pista sin contenido."
    if tamano > MAX_PISTA_BYTES:
        return "El archivo supera los 500 megabytes permitidos por pista."
    return None
