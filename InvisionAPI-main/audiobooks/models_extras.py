"""Tablas nuevas que NO se crean solas al arrancar la API (spec 005, R7 y R28).

`main.py` corre `Base.metadata.create_all`: cualquier modelo registrado en `Base`
aparecería en producción con el próximo despliegue, sin aprobación de la BCC
(P12). Por eso estas tablas usan su propia `BaseExtras`. En local se crean con
`habilitar_local.py` (docker exec invision_local python habilitar_local.py); en producción, con el DDL aprobado en
`aprobaciones/2026-09-29_narrador_en_memoria.md`.

Tampoco se agrega el narrador como columna de `audiolibros`: toda consulta a esa
tabla la pediría y fallaría en producción, donde no existe (P13).
"""
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, inspect
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

BaseExtras = declarative_base()

TABLA_NARRACION = "audiolibro_narracion"


class NarracionAudiolibro(BaseExtras):
    """Narrador de un audiolibro e iniciativa "En Memoria".

    La clave foránea a `audiolibros.id` la declara el DDL de producción; acá no,
    porque `audiolibros` vive en otra metadata. El borrado se hace explícito en la
    ruta de eliminación.
    """
    __tablename__ = TABLA_NARRACION

    audiolibro_id = Column(Integer, primary_key=True)
    narrador = Column(String(200), nullable=True)
    en_memoria = Column(Boolean, nullable=False, default=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


def narracion_habilitada(db):
    """True si la base tiene la tabla del narrador. Sin ella, la ficha funciona igual."""
    return tabla_habilitada(db, TABLA_NARRACION)


# --- Grupos B y C del spec 005 (D14 a D23) --------------------------------------

TABLA_PUBLICACION = "audiolibro_publicacion"
TABLA_VERIFICACION = "pista_verificacion"
TABLA_TAREAS = "tareas_admin"
TABLA_PAPELERA = "audiolibro_papelera"
TABLA_HISTORIAL = "audiolibro_historial"
TABLA_PERFIL = "perfil_accesibilidad"
TABLA_REGISTRO = "registro_operaciones"


class PublicacionAudiolibro(BaseExtras):
    """Estado de publicación. Sin fila = publicado (así las fichas que ya existen
    no desaparecen para los socios al crear la tabla). Las nuevas nacen en borrador."""
    __tablename__ = TABLA_PUBLICACION
    audiolibro_id = Column(Integer, primary_key=True)
    estado = Column(String(20), nullable=False, default="borrador")  # borrador | publicado
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class VerificacionPista(BaseExtras):
    __tablename__ = TABLA_VERIFICACION
    blob = Column(String(500), primary_key=True)
    audiolibro_id = Column(Integer, nullable=False, index=True)
    bytes = Column(Integer, nullable=False, default=0)
    duracion_segundos = Column(Float, nullable=False, default=0)
    problemas = Column(String(200), nullable=False, default="")  # separados por coma
    verificado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TareaAdmin(BaseExtras):
    __tablename__ = TABLA_TAREAS
    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String(40), nullable=False)
    estado = Column(String(20), nullable=False, default="encolada")  # encolada | en_curso | terminada | con_errores | fallida
    titulo = Column(String(300), nullable=False, default="")
    total = Column(Integer, nullable=False, default=0)
    hechos = Column(Integer, nullable=False, default=0)
    fallidos = Column(Integer, nullable=False, default=0)
    detalle = Column(Text, nullable=False, default="[]")  # JSON: [{nombre, estado, mensaje}]
    usuario_id = Column(Integer, nullable=True)
    creada_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizada_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PapeleraAudiolibro(BaseExtras):
    __tablename__ = TABLA_PAPELERA
    audiolibro_id = Column(Integer, primary_key=True)
    nombre = Column(String(255), nullable=False)
    eliminado_por = Column(Integer, nullable=True)
    eliminado_en = Column(DateTime(timezone=True), server_default=func.now())


class HistorialAudiolibro(BaseExtras):
    __tablename__ = TABLA_HISTORIAL
    id = Column(Integer, primary_key=True, autoincrement=True)
    audiolibro_id = Column(Integer, nullable=False, index=True)
    campo = Column(String(40), nullable=False)
    antes = Column(Text, nullable=True)
    despues = Column(Text, nullable=True)
    motivo = Column(String(40), nullable=False, default="edicion")  # edicion | fusion | deshacer | importacion
    usuario_id = Column(Integer, nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())


class PerfilAccesibilidad(BaseExtras):
    __tablename__ = TABLA_PERFIL
    usuario_id = Column(Integer, primary_key=True)
    perfil = Column(String(30), nullable=False)  # lector | baja_vision | ceguera_parcial | mayor_sin_lector
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RegistroOperacion(BaseExtras):
    __tablename__ = TABLA_REGISTRO
    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, nullable=True)
    operacion = Column(String(40), nullable=False)
    objeto = Column(String(300), nullable=False, default="")
    detalle = Column(String(500), nullable=False, default="")
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)


def tabla_habilitada(db, nombre):
    """Se inspecciona con la conexión de la propia sesión, dentro de su transacción.

    Pedirle otra conexión al motor puede devolver la misma conexión compartida
    (SQLite de prueba) y, al soltarla, hacer ROLLBACK de lo que la sesión tenía
    pendiente: así se "deshacía" el borrado del narrador (hallado en los tests).
    """
    return inspect(db.connection()).has_table(nombre)
