"""Operaciones sobre las tablas del spec 005 que usan las rutas existentes y el
router de administración (admin_extras.py).

Regla común (R28, P13): si la tabla no existe en la base, la función se degrada
en silencio para el socio y con aviso para el administrador; nunca rompe la API.
"""
import datetime
import logging

from models import Audiolibro
from models_extras import (
    TABLA_HISTORIAL, TABLA_NARRACION, TABLA_PAPELERA, TABLA_PERFIL, TABLA_PUBLICACION,
    TABLA_REGISTRO, TABLA_VERIFICACION, HistorialAudiolibro, NarracionAudiolibro,
    PapeleraAudiolibro, PublicacionAudiolibro, RegistroOperacion, VerificacionPista,
    tabla_habilitada,
)

log = logging.getLogger("invision.admin")
DIAS_PAPELERA = 30


def ahora():
    return datetime.datetime.now(datetime.timezone.utc)


def registrar(db, usuario_id, operacion, objeto="", detalle=""):
    """Registro de operaciones (R26). Sin la tabla, queda en el log del servidor."""
    if not tabla_habilitada(db, TABLA_REGISTRO):
        log.info("operación %s sobre %s por %s: %s", operacion, objeto, usuario_id, detalle)
        return
    db.add(RegistroOperacion(usuario_id=usuario_id, operacion=operacion,
                             objeto=str(objeto)[:300], detalle=str(detalle)[:500]))
    db.commit()


def ids_en_papelera(db):
    if not tabla_habilitada(db, TABLA_PAPELERA):
        return set()
    return {fila.audiolibro_id for fila in db.query(PapeleraAudiolibro.audiolibro_id).all()}


def estados_publicacion(db):
    """{id: estado} solo para las fichas con fila; sin fila = publicado (D14)."""
    if not tabla_habilitada(db, TABLA_PUBLICACION):
        return {}
    return {f.audiolibro_id: f.estado for f in db.query(PublicacionAudiolibro).all()}


def ids_ocultos_para_socios(db):
    """Borradores y papelera: los socios no los ven (R19, R23)."""
    borradores = {i for i, e in estados_publicacion(db).items() if e != "publicado"}
    return borradores | ids_en_papelera(db)


def marcar_borrador(db, libro_id):
    if tabla_habilitada(db, TABLA_PUBLICACION):
        db.merge(PublicacionAudiolibro(audiolibro_id=libro_id, estado="borrador"))
        db.commit()


def registrar_historial(db, libro_id, cambios, usuario_id, motivo="edicion"):
    """cambios: [(campo, antes, despues)]; solo los que de verdad cambiaron (R23)."""
    if not tabla_habilitada(db, TABLA_HISTORIAL):
        return
    for campo, antes, despues in cambios:
        if (antes or None) != (despues or None):
            db.add(HistorialAudiolibro(audiolibro_id=libro_id, campo=campo,
                                       antes=None if antes is None else str(antes),
                                       despues=None if despues is None else str(despues),
                                       motivo=motivo, usuario_id=usuario_id))
    db.commit()


def narracion_de(db, libro_id):
    if not tabla_habilitada(db, TABLA_NARRACION):
        return None
    return db.query(NarracionAudiolibro).filter_by(audiolibro_id=libro_id).first()


def mover_a_papelera(db, libro, usuario_id):
    """True si quedó en la papelera; False si la base no la tiene (borrado definitivo)."""
    if not tabla_habilitada(db, TABLA_PAPELERA):
        return False
    db.merge(PapeleraAudiolibro(audiolibro_id=libro.id, nombre=libro.nombre,
                                eliminado_por=usuario_id, eliminado_en=ahora()))
    db.commit()
    return True


def borrar_definitivo(db, libro_id):
    """Borra la ficha y todo lo que cuelga de ella en las tablas nuevas."""
    for tabla, modelo in ((TABLA_NARRACION, NarracionAudiolibro), (TABLA_PUBLICACION, PublicacionAudiolibro),
                          (TABLA_PAPELERA, PapeleraAudiolibro), (TABLA_HISTORIAL, HistorialAudiolibro),
                          (TABLA_VERIFICACION, VerificacionPista)):
        if tabla_habilitada(db, tabla):
            db.query(modelo).filter(modelo.audiolibro_id == libro_id).delete()
    libro = db.query(Audiolibro).filter_by(id=libro_id).first()
    if libro:
        db.delete(libro)
    db.commit()


def perfiles_por_usuario(db):
    if not tabla_habilitada(db, TABLA_PERFIL):
        return {}
    from models_extras import PerfilAccesibilidad
    return {p.usuario_id: p.perfil for p in db.query(PerfilAccesibilidad).all()}
