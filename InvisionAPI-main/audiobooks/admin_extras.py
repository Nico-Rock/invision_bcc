"""Rutas de la administración sin ver (spec 005, grupos B y C: R18 a R27).

Todas exigen rol Admin (salvo las preferencias propias del socio) y usan tablas
fuera del create_all: sin la tabla, la ruta que la necesita responde 503 con un
texto claro y el resto sigue funcionando (R28).
"""
import datetime
import json
import threading
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm import Session as SesionSQL

import extras as ex
import importador as imp
import verificacion_audio as va
from config import container_client
from crud import decode_access_token, oauth2_scheme, ordenar_capitulos
from database import get_db
from indice_audio import IndiceBlob
from models import Audiolibro, Categoria, Usuario
from models_extras import (
    TABLA_HISTORIAL, TABLA_NARRACION, TABLA_PAPELERA, TABLA_PERFIL, TABLA_PUBLICACION,
    TABLA_REGISTRO, TABLA_TAREAS, TABLA_VERIFICACION, HistorialAudiolibro,
    NarracionAudiolibro, PapeleraAudiolibro, PerfilAccesibilidad, PublicacionAudiolibro,
    RegistroOperacion, TareaAdmin, VerificacionPista, tabla_habilitada,
)
from validacion_pistas import validar_nombre_pista
from vocabulario import grupos_parecidos

router = APIRouter(tags=["Administración sin ver"])

MAX_TEXTO_CSV = 2_000_000
MAX_LISTA = 2000  # la consola filtra Libros con estos ids
PERFILES = {
    "lector": {"voz": False, "contraste": False, "texto": 16},
    "baja_vision": {"voz": True, "contraste": True, "texto": 24},
    "ceguera_parcial": {"voz": True, "contraste": True, "texto": 32},
    "mayor_sin_lector": {"voz": True, "contraste": False, "texto": 20},
}
CAMPOS_LIBRO = {"nombre", "autor", "genero", "descripcion", "categoria_id"}
CAMPOS_NARRACION = {"narrador", "en_memoria"}


def _listar_blobs():
    if container_client is None:
        raise RuntimeError("El almacenamiento de audio no está configurado.")
    return container_client.list_blobs()


# Índice de audio en segundo plano (D13): nadie espera al listado de Azure
INDICE_AUDIO = IndiceBlob(listar=_listar_blobs)


def lanzar(funcion):
    """Tareas largas en un hilo (D17); los tests lo reemplazan por una llamada directa."""
    threading.Thread(target=funcion, daemon=True).start()


def admin(token: str = Depends(oauth2_scheme)):
    info = decode_access_token(token)
    if "Admin" not in info.get("roles", []):
        raise HTTPException(status_code=403, detail="No autorizado")
    return info.get("id")


def _exigir(db, tabla, que):
    if not tabla_habilitada(db, tabla):
        raise HTTPException(status_code=503,
                            detail=f"{que} todavía no está habilitado en esta base (pendiente de aprobación de la BCC).")


def _libro(db, libro_id):
    libro = db.query(Audiolibro).filter_by(id=libro_id).first()
    if not libro or libro.id in ex.ids_en_papelera(db):
        raise HTTPException(status_code=404, detail="Audiolibro no encontrado")
    return libro


def _pistas_mp3(libro):
    if container_client is None:
        raise HTTPException(status_code=503, detail="El almacenamiento de audio no está disponible.")
    nombres = [b.name for b in container_client.list_blobs(name_starts_with=f"{libro.nombre}/") if b.name.lower().endswith(".mp3")]
    return ordenar_capitulos(nombres)


def _fecha(valor):
    if valor is None:
        return None
    if isinstance(valor, str):
        valor = datetime.datetime.fromisoformat(valor)
    return valor if valor.tzinfo else valor.replace(tzinfo=datetime.timezone.utc)


def _usuarios(db, ids):
    return {u.id: {"username": u.username, "email": u.email} for u in db.query(Usuario).filter(Usuario.id.in_(ids or [0])).all()}


# --- R18: Inicio con pendientes ------------------------------------------------------

@router.get("/admin/pendientes")
def pendientes(db: Session = Depends(get_db), usuario_id=Depends(admin)):
    papelera = ex.ids_en_papelera(db)
    visibles = [l for l in db.query(Audiolibro).all() if l.id not in papelera]
    resumen = lambda libros: [{"id": l.id, "nombre": l.nombre} for l in libros[:MAX_LISTA]]  # noqa: E731

    INDICE_AUDIO.obtener()
    estado_indice = INDICE_AUDIO.estado()
    if estado_indice["estado"] == "listo" or estado_indice.get("ultimo_ok"):
        con_audio = set(INDICE_AUDIO.datos().get("books", {}).keys())
        sin = [l for l in visibles if l.nombre not in con_audio]
        sin_audio = {"calculando": False, "cantidad": len(sin), "libros": resumen(sin)}
    else:
        sin_audio = {"calculando": True, "cantidad": None, "libros": []}

    narraciones = {}
    if tabla_habilitada(db, TABLA_NARRACION):
        narraciones = {n.audiolibro_id: n for n in db.query(NarracionAudiolibro).all()}
        sin_n = [l for l in visibles if not (narraciones.get(l.id) and narraciones[l.id].narrador)]
        sin_narrador = {"habilitado": True, "cantidad": len(sin_n), "libros": resumen(sin_n)}
    else:
        sin_narrador = {"habilitado": False, "cantidad": None, "libros": []}

    if tabla_habilitada(db, TABLA_PUBLICACION):
        estados = ex.estados_publicacion(db)
        borr = [l for l in visibles if estados.get(l.id) == "borrador"]
        borradores = {"habilitado": True, "cantidad": len(borr), "libros": resumen(borr)}
    else:
        borradores = {"habilitado": False, "cantidad": None, "libros": []}

    tareas_err = []
    if tabla_habilitada(db, TABLA_TAREAS):
        tareas_err = [_tarea(t) for t in db.query(TareaAdmin).filter(TareaAdmin.estado.in_(["con_errores", "fallida"]))
                      .order_by(TareaAdmin.id.desc()).limit(10).all()]

    return {
        "indice": {"estado": estado_indice["estado"], "ultimo_ok": estado_indice.get("ultimo_ok")},
        "sin_audio": sin_audio,
        "sin_narrador": sin_narrador,
        "borradores": borradores,
        "parecidos": {
            "generos": grupos_parecidos([l.genero for l in visibles]),
            "autores": grupos_parecidos([l.autor for l in visibles]),
            "narradores": grupos_parecidos([n.narrador for n in narraciones.values()]),
        },
        "tareas_con_errores": tareas_err,
        "papelera": {"habilitado": tabla_habilitada(db, TABLA_PAPELERA), "cantidad": len(papelera)},
        "informe": _informe(db, None),
    }


# --- R19: publicación ---------------------------------------------------------------

class CambioPublicacion(BaseModel):
    estado: Literal["publicado", "borrador"]


@router.put("/admin/audiolibros/{libro_id}/publicacion")
def cambiar_publicacion(libro_id: int, cambio: CambioPublicacion, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_PUBLICACION, "El estado de publicación")
    libro = _libro(db, libro_id)
    if cambio.estado == "publicado" and not _pistas_mp3(libro):
        raise HTTPException(status_code=409, detail=f"{libro.nombre} no tiene audio: subí al menos un capítulo antes de publicarlo.")
    db.merge(PublicacionAudiolibro(audiolibro_id=libro.id, estado=cambio.estado))
    db.commit()
    ex.registrar(db, usuario_id, "publicar" if cambio.estado == "publicado" else "despublicar", libro.nombre)
    return {"id": libro.id, "estado_publicacion": cambio.estado}


# --- R20: verificación de audio -------------------------------------------------------

class Confirmacion(BaseModel):
    blob_path: str = Field(..., max_length=500)


def _guardar_verificacion(db, libro_id, blob, resultado):
    if not tabla_habilitada(db, TABLA_VERIFICACION):
        return False
    db.merge(VerificacionPista(blob=blob, audiolibro_id=libro_id, bytes=resultado["bytes"],
                               duracion_segundos=resultado["duracion_segundos"],
                               problemas=",".join(resultado["problemas"])))
    db.commit()
    return True


@router.post("/audiolibros/{libro_id}/capitulos/confirmar")
def confirmar_pista(libro_id: int, datos: Confirmacion, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    """Después de subir: verifica que la pista exista, la analiza y lo registra (R20, R26)."""
    libro = _libro(db, libro_id)
    prefijo = f"{libro.nombre}/"
    if not datos.blob_path.startswith(prefijo) or validar_nombre_pista(datos.blob_path[len(prefijo):]):
        raise HTTPException(status_code=422, detail="La pista no pertenece a este libro o su nombre no es válido.")
    if container_client is None:
        raise HTTPException(status_code=503, detail="El almacenamiento de audio no está disponible.")
    cliente = container_client.get_blob_client(datos.blob_path)
    if not cliente.exists():
        raise HTTPException(status_code=404, detail="La pista no está en el almacenamiento: la subida no se completó.")
    resultado = va.analizar(cliente.download_blob().readall())
    guardada = _guardar_verificacion(db, libro.id, datos.blob_path, resultado)
    ex.registrar(db, usuario_id, "subir_pista", libro.nombre, datos.blob_path[len(prefijo):])
    return {**resultado, "duracion_hablada": va.duracion_hablada(resultado["duracion_segundos"]),
            "descripcion": va.describir(resultado["problemas"]), "verificacion_guardada": guardada}


@router.get("/admin/audiolibros/{libro_id}/audio")
def audio_del_libro(libro_id: int, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_VERIFICACION, "La verificación de audio")
    libro = _libro(db, libro_id)
    filas = db.query(VerificacionPista).filter_by(audiolibro_id=libro.id).all()
    orden = {n: i for i, n in enumerate(ordenar_capitulos([f.blob for f in filas]))}
    filas.sort(key=lambda f: orden.get(f.blob, 0))
    total = sum(f.duracion_segundos for f in filas)
    return {
        "verificadas": len(filas),
        "duracion_total_segundos": round(total, 2),
        "duracion_total_hablada": va.duracion_hablada(total),
        "pistas": [{"nombre": f.blob.rsplit("/", 1)[-1], "duracion_segundos": f.duracion_segundos,
                    "duracion_hablada": va.duracion_hablada(f.duracion_segundos),
                    "problemas": [p for p in f.problemas.split(",") if p],
                    "descripcion": va.describir([p for p in f.problemas.split(",") if p])} for f in filas],
    }


# --- R21: tareas con estado real ------------------------------------------------------

def _tarea(t, con_detalle=False):
    datos = {"id": t.id, "tipo": t.tipo, "titulo": t.titulo, "estado": t.estado, "total": t.total,
             "hechos": t.hechos, "fallidos": t.fallidos,
             "creada_en": t.creada_en.isoformat() if t.creada_en else None}
    if con_detalle:
        datos["detalle"] = json.loads(t.detalle or "[]")
    return datos


def _correr_tarea(motor, tarea_id, items, procesar):
    """Ejecuta `procesar(sesion, item) -> (ok, nombre, mensaje)` por ítem y guarda el
    estado después de cada uno: lo que se consulta es siempre lo que pasó (P10)."""
    db = SesionSQL(bind=motor)
    try:
        tarea = db.get(TareaAdmin, tarea_id)
        tarea.estado = "en_curso"
        db.commit()
        detalle = []
        for item in items:
            try:
                ok, nombre, mensaje = procesar(db, item)
            except Exception as e:  # un ítem que falla no frena a los demás
                db.rollback()
                ok, nombre, mensaje = False, str(item)[:120], f"error: {type(e).__name__}"
            detalle.append({"nombre": nombre, "estado": "ok" if ok else "con_problemas", "mensaje": mensaje})
            tarea = db.get(TareaAdmin, tarea_id)
            tarea.hechos += 1
            tarea.fallidos += 0 if ok else 1
            tarea.detalle = json.dumps(detalle, ensure_ascii=False)
            db.commit()
        tarea = db.get(TareaAdmin, tarea_id)
        tarea.estado = "terminada" if tarea.fallidos == 0 else "con_errores"
        db.commit()
    except Exception:
        db.rollback()
        tarea = db.get(TareaAdmin, tarea_id)
        if tarea:
            tarea.estado = "fallida"
            db.commit()
    finally:
        db.close()


def _crear_tarea(db, tipo, titulo, total, usuario_id):
    tarea = TareaAdmin(tipo=tipo, titulo=titulo, total=total, usuario_id=usuario_id, estado="encolada", detalle="[]")
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    return tarea


@router.post("/admin/audiolibros/{libro_id}/verificar", status_code=202)
def verificar_libro(libro_id: int, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_TAREAS, "Las tareas")
    libro = _libro(db, libro_id)
    pistas = _pistas_mp3(libro)
    tarea = _crear_tarea(db, "verificar_audio", f"Verificar el audio de {libro.nombre}", len(pistas), usuario_id)
    cliente = container_client

    def procesar(sesion, blob):
        resultado = va.analizar(cliente.get_blob_client(blob).download_blob().readall())
        _guardar_verificacion(sesion, libro.id, blob, resultado)
        nombre = blob.rsplit("/", 1)[-1]
        if resultado["problemas"]:
            return False, nombre, va.describir(resultado["problemas"])
        return True, nombre, va.duracion_hablada(resultado["duracion_segundos"])

    lanzar(lambda: _correr_tarea(db.get_bind(), tarea.id, pistas, procesar))
    return {"tarea_id": tarea.id, "total": len(pistas)}


@router.get("/admin/tareas")
def listar_tareas(db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_TAREAS, "Las tareas")
    # Las tareas avanzan en otra sesión (otro hilo): se relee la fila, nunca la copia en memoria
    db.expire_all()
    return [_tarea(t) for t in db.query(TareaAdmin).order_by(TareaAdmin.id.desc()).limit(20).all()]


@router.get("/admin/tareas/{tarea_id}")
def ver_tarea(tarea_id: int, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_TAREAS, "Las tareas")
    db.expire_all()  # ver listar_tareas
    tarea = db.get(TareaAdmin, tarea_id)
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return _tarea(tarea, con_detalle=True)


# --- R22: importador de fichas --------------------------------------------------------

class TextoImportacion(BaseModel):
    texto: str = Field(..., max_length=MAX_TEXTO_CSV)
    mapeo: Optional[dict] = None


def _existentes(db):
    libros = db.query(Audiolibro).all()
    narradores = [n.narrador for n in db.query(NarracionAudiolibro).all()] if tabla_habilitada(db, TABLA_NARRACION) else []
    return {
        "titulos": [l.nombre for l in libros],
        "generos": sorted({l.genero for l in libros if l.genero}),
        "autores": sorted({l.autor for l in libros if l.autor}),
        "narradores": sorted({n for n in narradores if n}),
    }


def _mapeo_valido(mapeo):
    if mapeo is None:
        return None
    if not all(isinstance(k, str) and v in imp.CAMPOS for k, v in mapeo.items()):
        raise HTTPException(status_code=422, detail="El mapeo de columnas tiene campos que no existen.")
    return mapeo


@router.post("/admin/importador/analizar")
def analizar_importacion(datos: TextoImportacion, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    """Valida sin escribir nada (R22)."""
    analisis = imp.analizar(datos.texto, _existentes(db), _mapeo_valido(datos.mapeo))
    importables = [f for f in analisis.pop("filas") if f["_importable"]]
    analisis["vista_previa"] = [{k: v for k, v in f.items() if not k.startswith("_")} for f in importables[:5]]
    analisis["nombres_campos"] = imp.NOMBRES_CAMPOS
    return analisis


@router.post("/admin/importador/ejecutar", status_code=202)
def ejecutar_importacion(datos: TextoImportacion, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_TAREAS, "Las tareas")
    analisis = imp.analizar(datos.texto, _existentes(db), _mapeo_valido(datos.mapeo))
    if analisis["resumen"]["bloqueante"]:
        raise HTTPException(status_code=422, detail=analisis["resumen"]["bloqueante"])
    filas = [f for f in analisis["filas"] if f["_importable"]]
    tarea = _crear_tarea(db, "importar_fichas", f"Importar {len(filas)} fichas", len(filas), usuario_id)

    def procesar(sesion, fila):
        nombre = fila["nombre"]
        if sesion.query(Audiolibro).filter(Audiolibro.nombre.ilike(nombre)).first():
            return False, nombre, "ya existe en el catálogo"
        categoria = sesion.query(Categoria).filter_by(nombre=fila["categoria"]).first() if fila["categoria"] else None
        libro = Audiolibro(nombre=nombre, autor=fila["autor"] or None, genero=fila["genero"] or None,
                           descripcion=fila["descripcion"] or None, categoria_id=categoria.id if categoria else None)
        sesion.add(libro)
        sesion.commit()
        sesion.refresh(libro)
        ex.marcar_borrador(sesion, libro.id)
        if fila["narrador"] and tabla_habilitada(sesion, TABLA_NARRACION):
            sesion.merge(NarracionAudiolibro(audiolibro_id=libro.id, narrador=fila["narrador"], en_memoria=False))
            sesion.commit()
        ex.registrar(sesion, usuario_id, "importar_ficha", nombre, f"fila {fila['_fila']}")
        return True, nombre, "ficha creada en borrador"

    lanzar(lambda: _correr_tarea(db.get_bind(), tarea.id, filas, procesar))
    return {"tarea_id": tarea.id, "total": len(filas)}


# --- R23: papelera, historial y deshacer ----------------------------------------------

@router.get("/admin/papelera")
def ver_papelera(db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_PAPELERA, "La papelera")
    hoy = ex.ahora()
    salida = []
    for p in db.query(PapeleraAudiolibro).order_by(PapeleraAudiolibro.eliminado_en.desc()).all():
        transcurridos = (hoy - _fecha(p.eliminado_en)).days
        salida.append({"audiolibro_id": p.audiolibro_id, "nombre": p.nombre,
                       "eliminado_en": _fecha(p.eliminado_en).isoformat(),
                       "dias_restantes": max(0, ex.DIAS_PAPELERA - transcurridos)})
    return salida


@router.post("/admin/papelera/{libro_id}/restaurar")
def restaurar(libro_id: int, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_PAPELERA, "La papelera")
    fila = db.query(PapeleraAudiolibro).filter_by(audiolibro_id=libro_id).first()
    if not fila:
        raise HTTPException(status_code=404, detail="Ese libro no está en la papelera.")
    nombre = fila.nombre
    db.delete(fila)
    db.commit()
    ex.registrar(db, usuario_id, "restaurar_libro", nombre)
    return {"id": libro_id, "nombre": nombre}


@router.delete("/admin/papelera/{libro_id}")
def eliminar_definitivamente(libro_id: int, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    """Borrado definitivo de una ficha que ya está en la papelera (confirmado en la consola)."""
    _exigir(db, TABLA_PAPELERA, "La papelera")
    fila = db.query(PapeleraAudiolibro).filter_by(audiolibro_id=libro_id).first()
    if not fila:
        raise HTTPException(status_code=404, detail="Ese libro no está en la papelera.")
    nombre = fila.nombre
    ex.borrar_definitivo(db, libro_id)
    ex.registrar(db, usuario_id, "borrar_definitivo", nombre)
    return {"id": libro_id, "nombre": nombre}


@router.post("/admin/papelera/vaciar-vencidos")
def vaciar_vencidos(db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_PAPELERA, "La papelera")
    limite = ex.ahora() - datetime.timedelta(days=ex.DIAS_PAPELERA)
    vencidos = [p for p in db.query(PapeleraAudiolibro).all() if _fecha(p.eliminado_en) <= limite]
    for p in vencidos:
        nombre = p.nombre
        ex.borrar_definitivo(db, p.audiolibro_id)
        ex.registrar(db, usuario_id, "borrar_definitivo", nombre)
    return {"eliminados": len(vencidos)}


@router.get("/admin/audiolibros/{libro_id}/historial")
def historial(libro_id: int, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_HISTORIAL, "El historial")
    filas = db.query(HistorialAudiolibro).filter_by(audiolibro_id=libro_id).order_by(HistorialAudiolibro.id.desc()).limit(100).all()
    personas = _usuarios(db, {f.usuario_id for f in filas if f.usuario_id})
    return [{"id": f.id, "campo": f.campo, "antes": f.antes, "despues": f.despues, "motivo": f.motivo,
             "fecha": _fecha(f.fecha).isoformat() if f.fecha else None, "usuario": personas.get(f.usuario_id)} for f in filas]


def _aplicar_campo(db, libro, campo, valor):
    """Asigna un campo de la ficha o de la narración. Devuelve el valor anterior."""
    if campo in CAMPOS_LIBRO:
        antes = getattr(libro, campo)
        if campo == "categoria_id":
            valor = int(valor) if valor not in (None, "") else None
        setattr(libro, campo, valor)
        return antes
    if campo in CAMPOS_NARRACION:
        _exigir(db, TABLA_NARRACION, "El narrador")
        fila = ex.narracion_de(db, libro.id) or NarracionAudiolibro(audiolibro_id=libro.id, en_memoria=False)
        antes = getattr(fila, campo)
        setattr(fila, campo, (valor in ("True", "true", True)) if campo == "en_memoria" else valor)
        db.merge(fila)
        return antes
    raise HTTPException(status_code=422, detail="Ese campo no se puede deshacer.")


@router.post("/admin/historial/{historial_id}/deshacer")
def deshacer(historial_id: int, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_HISTORIAL, "El historial")
    cambio = db.get(HistorialAudiolibro, historial_id)
    if not cambio:
        raise HTTPException(status_code=404, detail="Cambio no encontrado")
    libro = _libro(db, cambio.audiolibro_id)
    actual = _aplicar_campo(db, libro, cambio.campo, cambio.antes)
    db.commit()
    ex.registrar_historial(db, libro.id, [(cambio.campo, actual, cambio.antes)], usuario_id, motivo="deshacer")
    ex.registrar(db, usuario_id, "deshacer", libro.nombre, f"{cambio.campo}: volvió a {cambio.antes}")
    return {"id": libro.id, "campo": cambio.campo, "valor": cambio.antes}


# --- R24: fusión de valores ------------------------------------------------------------

class Fusion(BaseModel):
    campo: Literal["genero", "autor", "narrador"]
    origen: List[str] = Field(..., min_length=1, max_length=20)
    destino: str = Field(..., min_length=1, max_length=200)


def _fichas_con(db, campo, valores):
    papelera = ex.ids_en_papelera(db)
    if campo == "narrador":
        if not tabla_habilitada(db, TABLA_NARRACION):
            return []
        ids = [n.audiolibro_id for n in db.query(NarracionAudiolibro).filter(NarracionAudiolibro.narrador.in_(valores)).all()]
        return [l for l in db.query(Audiolibro).filter(Audiolibro.id.in_(ids or [0])).all() if l.id not in papelera]
    columna = getattr(Audiolibro, campo)
    return [l for l in db.query(Audiolibro).filter(columna.in_(valores)).all() if l.id not in papelera]


@router.get("/admin/vocabulario/vista-previa")
def vista_previa_fusion(campo: Literal["genero", "autor", "narrador"], destino: str, origen: List[str] = Query(...),
                        db: Session = Depends(get_db), usuario_id=Depends(admin)):
    origen = [o for o in origen if o != destino]
    return {"campo": campo, "destino": destino, "origen": origen, "fichas": len(_fichas_con(db, campo, origen))}


@router.post("/admin/vocabulario/fusionar")
def fusionar(datos: Fusion, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    origen = [o for o in datos.origen if o != datos.destino]
    libros = _fichas_con(db, datos.campo, origen)
    for libro in libros:
        antes = _aplicar_campo(db, libro, datos.campo, datos.destino)
        ex.registrar_historial(db, libro.id, [(datos.campo, antes, datos.destino)], usuario_id, motivo="fusion")
    db.commit()
    ex.registrar(db, usuario_id, "fusionar_valores", datos.destino, f"{datos.campo}: {', '.join(origen)} → {datos.destino} ({len(libros)} fichas)")
    return {"campo": datos.campo, "destino": datos.destino, "fichas": len(libros)}


# --- R25: perfil de accesibilidad del socio ---------------------------------------------

class CambioPerfil(BaseModel):
    perfil: Literal["lector", "baja_vision", "ceguera_parcial", "mayor_sin_lector"]


@router.put("/admin/usuarios/{usuario_destino}/perfil")
def cambiar_perfil(usuario_destino: int, cambio: CambioPerfil, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_PERFIL, "El perfil de accesibilidad")
    usuario = db.get(Usuario, usuario_destino)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.merge(PerfilAccesibilidad(usuario_id=usuario.id, perfil=cambio.perfil))
    db.commit()
    ex.registrar(db, usuario_id, "perfil_socio", usuario.username, cambio.perfil)
    return {"usuario_id": usuario.id, "perfil": cambio.perfil, "preferencias": PERFILES[cambio.perfil]}


@router.get("/user/me/preferencias")
def mis_preferencias(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    """Preferencias iniciales según el perfil que cargó la administración (R25)."""
    usuario_id = decode_access_token(token).get("id")
    perfil = ex.perfiles_por_usuario(db).get(usuario_id)
    return {"perfil": perfil, "preferencias": PERFILES.get(perfil)}


# --- R26 y R27: registro de operaciones e informe del día --------------------------------

@router.get("/admin/operaciones")
def operaciones(operacion: Optional[str] = None, persona: Optional[int] = None, desde: Optional[datetime.date] = None,
                hasta: Optional[datetime.date] = None, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    _exigir(db, TABLA_REGISTRO, "El registro de operaciones")
    consulta = db.query(RegistroOperacion)
    if operacion:
        consulta = consulta.filter(RegistroOperacion.operacion == operacion)
    if persona:
        consulta = consulta.filter(RegistroOperacion.usuario_id == persona)
    filas = consulta.order_by(RegistroOperacion.id.desc()).limit(500).all()
    if desde or hasta:
        filas = [f for f in filas if (not desde or _fecha(f.fecha).date() >= desde) and (not hasta or _fecha(f.fecha).date() <= hasta)]
    personas = _usuarios(db, {f.usuario_id for f in filas if f.usuario_id})
    return [{"id": f.id, "operacion": f.operacion, "objeto": f.objeto, "detalle": f.detalle,
             "fecha": _fecha(f.fecha).isoformat() if f.fecha else None,
             "usuario": personas.get(f.usuario_id, {"username": None, "email": None})} for f in filas[:200]]


CONTEOS_INFORME = {"crear_libro": "creados", "importar_ficha": "importados", "publicar": "publicados",
                   "subir_pista": "pistas_subidas", "eliminar_libro": "eliminados"}


def _informe(db, fecha):
    dia = fecha or ex.ahora().date()
    base = {"fecha": dia.isoformat(), **{v: 0 for v in CONTEOS_INFORME.values()}}
    if not tabla_habilitada(db, TABLA_REGISTRO):
        return {**base, "habilitado": False}
    for f in db.query(RegistroOperacion).filter(RegistroOperacion.operacion.in_(list(CONTEOS_INFORME))).all():
        if f.fecha and _fecha(f.fecha).date() == dia:
            base[CONTEOS_INFORME[f.operacion]] += 1
    return {**base, "habilitado": True}


@router.get("/admin/informe")
def informe(fecha: Optional[datetime.date] = None, db: Session = Depends(get_db), usuario_id=Depends(admin)):
    return _informe(db, fecha)
