"""Validación de nombres de pistas antes de pedir un permiso de subida (spec 005, R3).

Mismas reglas que la carga del panel operativo (admin-dashboard/server.py,
`subir_pista`): nada de rutas, solo MP3 y un largo razonable. Se valida en el
servidor: la pantalla puede saltearse, esto no (CWE-22, CWE-20).
"""
import re

LARGO_MAXIMO = 200
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
