"""Corre los tests de la lógica JS del panel con `node --test` (spec 002, D10).

Así `pytest admin-dashboard` cubre también el JS sin framework. Si Node no está
instalado el caso se saltea con motivo, nunca en silencio.
"""
import shutil
import subprocess
from pathlib import Path

import pytest

CARPETA_JS = Path(__file__).parent / "js"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node no está instalado: no se pueden correr los tests JS")
def test_logica_js_con_node():
    resultado = subprocess.run(
        ["node", "--test", *sorted(str(p) for p in CARPETA_JS.glob("*.test.js"))],
        capture_output=True, text=True, timeout=60,
    )
    assert resultado.returncode == 0, resultado.stdout[-4000:] + resultado.stderr[-2000:]
