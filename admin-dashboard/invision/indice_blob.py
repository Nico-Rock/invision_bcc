"""Índice del catálogo de audio en Azure Blob, construido en segundo plano.

Principios que lo gobiernan (constitución P10):
- el servidor atiende aunque Azure tarde o falle: nadie espera al listado;
- el estado se informa tal cual es: nunca "listo" después de un fallo;
- un refresco que falla (aunque sea a mitad) no pisa el último índice válido.
"""
import datetime
import threading

TTL_SEGUNDOS = 600
REINTENTO_TRAS_ERROR_SEGUNDOS = 60


def _vacio():
    return {
        "books": {},
        "total_blobs": 0,
        "total_size_bytes": 0,
        "total_size_gb": 0,
        "last_fetched": None,
    }


def _construir(blobs):
    """Agrupa los blobs por prefijo `{libro}/`. Consume el iterable entero antes de
    devolver: si el listado se corta a mitad, la excepción sale acá y el índice
    parcial se descarta."""
    libros = {}
    total, bytes_totales = 0, 0

    for b in blobs:
        total += 1
        bytes_totales += b.size
        partes = b.name.split("/", 1)
        if len(partes) == 2:
            libro, archivo = partes
        else:
            libro, archivo = "Raíz / Sin Clasificar", b.name

        info = libros.setdefault(
            libro, {"title": libro, "tracks": [], "total_size_bytes": 0, "total_tracks": 0}
        )
        info["tracks"].append({
            "blob_name": b.name,
            "file_name": archivo,
            "size_bytes": b.size,
            "size_mb": round(b.size / (1024 * 1024), 2),
            "last_modified": b.last_modified.isoformat() if b.last_modified else None,
        })
        info["total_size_bytes"] += b.size
        info["total_tracks"] += 1

    for info in libros.values():
        info["total_size_mb"] = round(info["total_size_bytes"] / (1024 * 1024), 2)
        info["tracks"].sort(key=lambda t: t["file_name"])

    return {
        "books": libros,
        "total_blobs": total,
        "total_size_bytes": bytes_totales,
        "total_size_gb": round(bytes_totales / (1024 ** 3), 2),
    }


class IndiceBlob:
    def __init__(self, listar, ttl=TTL_SEGUNDOS, reloj=None):
        """`listar` devuelve un iterable de blobs con `name`, `size` y `last_modified`."""
        self._listar = listar
        self._ttl = ttl
        self._reloj = reloj or (lambda: datetime.datetime.now(datetime.timezone.utc))
        self._lock = threading.Lock()
        self._hilo = None
        self._datos = _vacio()
        self._estado = "vacio"
        self._error = None
        self._ultimo_intento = None

    def estado(self):
        with self._lock:
            ultimo = self._datos["last_fetched"]
            return {
                "estado": self._estado,
                "error": self._error,
                "ultimo_ok": ultimo.isoformat() if ultimo else None,
            }

    def datos(self):
        with self._lock:
            return self._datos

    def refrescar(self):
        """Reindexa de forma síncrona. Nunca lanza: el fallo queda en `estado()`."""
        with self._lock:
            self._estado = "indexando"
            self._ultimo_intento = self._reloj()
        try:
            nuevos = _construir(self._listar())
        except Exception as e:
            # El estado lleva una línea legible (se muestra y se lee por voz); el
            # detalle completo (Azure devuelve XML de varias líneas) va a la consola.
            primera_linea = (str(e).strip().splitlines() or [""])[0][:200]
            with self._lock:
                self._estado = "error"
                self._error = f"{type(e).__name__}: {primera_linea}"
            print(f"❌ Falló la indexación de Azure Blob: {type(e).__name__}: {e}")
            return
        nuevos["last_fetched"] = self._reloj()
        with self._lock:
            self._datos = nuevos
            self._estado = "listo"
            self._error = None
        print(f"✅ Azure Blob indexado: {len(nuevos['books'])} libros, {nuevos['total_blobs']} pistas.")

    def refrescar_en_segundo_plano(self):
        """Lanza un refresco si no hay uno en curso. Devuelve True si lo lanzó."""
        with self._lock:
            if self._hilo and self._hilo.is_alive():
                return False
            self._hilo = threading.Thread(target=self.refrescar, daemon=True)
            self._hilo.start()
            return True

    def esperar(self, timeout=None):
        hilo = self._hilo
        if hilo:
            hilo.join(timeout)

    def _necesita_refresco(self):
        with self._lock:
            if self._estado == "indexando":
                return False
            ahora = self._reloj()
            if self._estado == "error" and self._ultimo_intento:
                return (ahora - self._ultimo_intento).total_seconds() >= REINTENTO_TRAS_ERROR_SEGUNDOS
            ultimo = self._datos["last_fetched"]
            return ultimo is None or (ahora - ultimo).total_seconds() >= self._ttl

    def obtener(self):
        """Datos actuales, sin bloquear. Si están vencidos (o nunca se cargaron),
        dispara un refresco en segundo plano y devuelve lo que haya."""
        if self._necesita_refresco():
            self.refrescar_en_segundo_plano()
        return self.datos()
