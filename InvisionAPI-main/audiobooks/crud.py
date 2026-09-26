from sqlalchemy.orm import Session
from models import Usuario, Role, UserRole, Audiolibro, ProgresoAudiolibro
import re
from datetime import datetime
from fastapi.responses import StreamingResponse
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from database import get_db
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, container_client
import jwt
from typing import List


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con la contraseña hasheada."""
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    """Hashea una contraseña en texto plano."""
    return pwd_context.hash(password)

async def authenticate_user(email: str, password: str, db: Session):
    """Autentica al usuario verificando su correo electrónico y contraseña."""
    user = db.query(Usuario).filter(Usuario.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Crea un token JWT para un usuario autenticado."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    """Decodifica el token JWT y devuelve los datos contenidos en él."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Obtiene el usuario actual a partir del token JWT."""
    payload = decode_access_token(token)
    user_email = payload.get("email")
    if user_email is None:
        raise HTTPException(status_code=400, detail="Email no encontrado en el token")
    
    user = db.query(Usuario).filter(Usuario.email == user_email).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


async def user_create_user(user: Usuario, db: Session):
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


async def get_user_by_id(db: Session, user_id: int):
    """Obtiene un usuario por su ID."""
    return db.query(Usuario).filter(Usuario.id == user_id).first()

async def update_user(db: Session, user_id: int, username: str, email: str, first_name: str, last_name: str, phone_number: str):
    """Actualiza los datos de un usuario."""
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise ValueError("Usuario no encontrado.")
    user.username = username
    user.email = email
    user.first_name = first_name
    user.last_name = last_name
    user.phone_number = phone_number
    db.commit()
    db.refresh(user)
    return user

async def change_password(db: Session, user_id: int, current_password: str, new_password: str):
    """Cambia la contraseña de un usuario."""
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise ValueError("Usuario no encontrado.")
    if not user.verify_password(current_password):
        raise ValueError("La contraseña actual es incorrecta.")
    user.hash_password(new_password)
    db.commit()
    return {"message": "Contraseña actualizada correctamente."}


async def user_get_by_email(email: str, db: Session):
    return db.query(Usuario).filter(Usuario.email == email).first()


async def user_update_user(user_update,user:Usuario,db:Session):
        # Actualiza los campos que están presentes en el request
    for var, value in vars(user_update).items():
        if value is not None:
            setattr(user, var, value)
    
    db.commit()
    db.refresh(user)
    return user


async def get_role_by_name(db: Session, name: str):
    """
    Obtiene un rol por su nombre.
    """
    return db.query(Role).filter(Role.name == name).first()


async def user_get_roles(user_id: int, db: Session):
    """Obtiene los roles asociados a un usuario."""
    query = (
        db.query(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
    )
    roles = query.all()
    return roles

async def role_get_all(db: Session):
    return db.query(Role).all()

async def role_get_by_id(role_id: int, db: Session):
    return db.query(Role).filter(Role.id == role_id).first()

async def user_add_role(user_id:int,role_id:int,db:Session):
    user_role = UserRole(user_id=user_id,role_id=role_id)
    db.add(user_role)
    db.commit()
    db.refresh(user_role)
    return user_role

async def user_get_by_id(user_id:int,db: Session):
    return db.query(Usuario).filter(Usuario.id == user_id).first()

async def role_delete(role_id: int, db: Session):
    role = await role_get_by_id(role_id, db)
    if role:
        db.delete(role)
        db.commit()
        
async def user_delete_user(user: Usuario, db: Session):
    db.delete(user)
    db.commit()
    return

async def search_audio(db: Session, search_term: str):
    try:
        audiolibros = (
            db.query(Audiolibro)
            .filter(Audiolibro.nombre.ilike(f"%{search_term}%"))
            .all()
        )

        blobs_list = container_client.list_blobs()
        results = []
        folders_seen = set()

        for blob in blobs_list:
            try:
                if "/" not in blob.name:
                    continue
                folder_name = blob.name.split("/")[0]

                if search_term.lower() in blob.name.lower():
                    if folder_name not in folders_seen and any(
                        a.nombre.lower() == folder_name.lower() for a in audiolibros
                    ):
                        audiolibro = next(
                            (a for a in audiolibros if a.nombre.lower() == folder_name.lower()), None
                        )
                        if audiolibro:
                            results.append(
                                {
                                    "type": "folder",
                                    "id": audiolibro.id,
                                    "name": audiolibro.nombre,
                                    "author": audiolibro.autor,
                                    "genre": audiolibro.genero,
                                    "description": audiolibro.descripcion or "Sin descripción",
                                }
                            )
                            folders_seen.add(folder_name)
            except Exception as e:
                print(f"Error al procesar blob '{blob.name}': {e}")

        return {"results": results}

    except Exception as e:
        print(f"Error general en search_audio: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


async def guardar_progreso(db: Session, usuario_id: int, audiolibro_id: int, chapter_index: int, progreso: float):
    """
    Guarda o actualiza el progreso de reproducción de un audiolibro.
    """
    existing_record = (
        db.query(ProgresoAudiolibro)
        .filter_by(usuario_id=usuario_id, audiolibro_id=audiolibro_id)
        .first()
    )

    if existing_record:
        existing_record.chapter_index = chapter_index
        existing_record.progreso = progreso
        existing_record.ultima_reproduccion = datetime.now()
    else:
        new_record = ProgresoAudiolibro(
            usuario_id=usuario_id,
            audiolibro_id=audiolibro_id,
            chapter_index=chapter_index,
            progreso=progreso,
            ultima_reproduccion=datetime.now(),
        )
        db.add(new_record)

    db.commit()
    return {"message": "Progreso guardado correctamente."}


async def obtener_progreso(db: Session, usuario_id: int, audiolibro_id: int):
    """
    Obtiene el progreso de reproducción de un audiolibro para un usuario.
    """
    record = (
        db.query(ProgresoAudiolibro)
        .filter_by(usuario_id=usuario_id, audiolibro_id=audiolibro_id)
        .first()
    )

    if record:
        return {"chapter_index": record.chapter_index, "progreso": record.progreso}
    else:
        return {"chapter_index": 1, "progreso": 0}
    
    
def numero_de_capitulo(nombre_blob):
    """Último número del nombre de archivo, sin carpeta ni extensión.

    "LIBRO/Libro Pista 12.mp3" -> 12. Antes se tomaba el número final CON la
    extensión (el "3" de "mp3", igual para todas las pistas) o el primero de la
    ruta (incluida la carpeta), y el orden terminaba siendo alfabético:
    Pista 1, Pista 10 ... Pista 2.
    """
    archivo = nombre_blob.rsplit("/", 1)[-1]
    base = archivo.rsplit(".", 1)[0]
    numeros = re.findall(r"\d+", base)
    return int(numeros[-1]) if numeros else None


def ordenar_capitulos(nombres_blob):
    """Orden único de capítulos, compartido por la lista y el streaming: por número;
    los que no tienen número van al final, por nombre."""
    def clave(nombre):
        numero = numero_de_capitulo(nombre)
        archivo = nombre.rsplit("/", 1)[-1]
        return (numero is None, numero or 0, archivo.lower())

    return sorted(nombres_blob, key=clave)


async def get_audio_stream(db: Session, audiolibro_id: int, chapter_index: int):
    # Obtener el nombre del audiolibro desde la base de datos
    audiolibro = db.query(Audiolibro).filter_by(id=audiolibro_id).first()
    if not audiolibro:
        raise ValueError("Audiolibro no encontrado.")

    folder_name = audiolibro.nombre
    try:
        # Listar blobs que coincidan con el nombre del audiolibro
        blobs_list = container_client.list_blobs(name_starts_with=f"{folder_name}/")

        # Filtrar los blobs para encontrar los capítulos
        chapters = [
            blob.name
            for blob in blobs_list
            if blob.name.lower().endswith(".mp3")
        ]

        if not chapters:
            raise ValueError(f"No se encontraron capítulos en la carpeta '{folder_name}'.")

        # Mismo orden que la lista de capítulos (audio-by-id): la posición que
        # elige el usuario es la pista que suena.
        ordenados = ordenar_capitulos(chapters)

        # Validar el índice del capítulo
        selected_chapter_index = chapter_index - 1
        if selected_chapter_index < 0 or selected_chapter_index >= len(ordenados):
            raise ValueError(f"Capítulo {chapter_index} no encontrado. Solo hay {len(ordenados)} capítulos.")

        # Obtener el capítulo seleccionado
        chapter_to_stream = ordenados[selected_chapter_index]

        # Descargar el archivo de Azure Blob Storage
        blob_client = container_client.get_blob_client(chapter_to_stream)
        blob_properties = blob_client.get_blob_properties()
        file_size = blob_properties.size

        # Preparar los encabezados para la transmisión
        headers = {
            "Content-Length": str(file_size),
            "Content-Type": "audio/mpeg",
            "Accept-Ranges": "bytes",
        }

        # Devolver el stream del archivo
        downloader = blob_client.download_blob()
        return StreamingResponse(downloader.chunks(), headers=headers)

    except Exception as e:
        raise ValueError(f"Error al procesar el audiolibro: {str(e)}")


def get_chapters_by_audiobook_id(audiolibro_id: int, db: Session):
    audiolibro = db.query(Audiolibro).filter_by(id=audiolibro_id).first()
    if not audiolibro:
        raise ValueError("Audiolibro no encontrado.")

    folder_name = audiolibro.nombre

    try:
        blobs_list = list(container_client.list_blobs(name_starts_with=f"{folder_name}/"))

        mp3 = [b.name for b in blobs_list if b.name.lower().endswith(".mp3")]
        # `indice` es la posición 1..n en el orden compartido con el streaming.
        chapters = [
            {"indice": posicion, "nombre": nombre.rsplit("/", 1)[-1]}
            for posicion, nombre in enumerate(ordenar_capitulos(mp3), start=1)
        ]

        return {"audiolibro": audiolibro.nombre, "capitulos": chapters}

    except Exception as e:
        print(f"Error al consultar Azure Blob Storage: {e}")
        raise ValueError("Error al obtener los capítulos del audiolibro.")


async def mis_audiolibros(db: Session, usuario_id: int):
    """
    Obtiene los audiolibros que un usuario ha escuchado, ordenados por última reproducción.
    """
    results = (
        db.query(Audiolibro, ProgresoAudiolibro)
        .join(ProgresoAudiolibro, Audiolibro.id == ProgresoAudiolibro.audiolibro_id)
        .filter(ProgresoAudiolibro.usuario_id == usuario_id)
        .order_by(ProgresoAudiolibro.ultima_reproduccion.desc())
        .all()
    )

    return [
        {
            "id": audiolibro.id,
            "nombre": audiolibro.nombre,
            "descripcion": audiolibro.descripcion or "Sin descripción",
            "genero": audiolibro.genero, 
            "autor": audiolibro.autor,
            "progreso": progreso.progreso,
            "ultima_reproduccion": progreso.ultima_reproduccion.isoformat() if progreso.ultima_reproduccion else None,
            "chapter_index": progreso.chapter_index,
        }
        for audiolibro, progreso in results
    ]
    
    
def get_unique_genres(db: Session) -> List[str]:
    try:
        genres = (
            db.query(Audiolibro.genero)
            .filter(Audiolibro.genero.isnot(None))
            .distinct()
            .all()
        )

        raw_genres = [genre.strip() for genre in (genre[0] for genre in genres) if genre and genre.strip()]

        return sorted(set(raw_genres))

    except Exception as e:
        raise Exception(f"Error al cargar los géneros: {str(e)}")


def get_books_by_genre(db: Session, genre: str) -> List[dict]:
    try:
        normalized_genre = genre.replace('-', '/').strip().lower()

        books = (
            db.query(Audiolibro)
            .filter(Audiolibro.genero.ilike(normalized_genre))
            .all()
        )

        return [
            {
                "id": book.id,
                "nombre": book.nombre,
                "descripcion": book.descripcion or "Sin descripción",
                "genero": book.genero,
                "autor": book.autor or "Autor desconocido",
            }
            for book in books
        ]

    except Exception as e:
        raise Exception(f"Error al cargar los libros: {str(e)}")