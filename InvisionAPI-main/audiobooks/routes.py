# routes.py

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Path
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
from crud import (
    user_create_user,
    user_get_by_email,
    search_audio,
    guardar_progreso,
    obtener_progreso,
    get_audio_stream,
    get_chapters_by_audiobook_id,
    mis_audiolibros,
    user_get_roles,
    user_get_by_id,
    role_get_all,
    role_get_by_id,
    user_add_role,
    role_delete,
    user_delete_user,
    user_update_user,
    authenticate_user,
    create_access_token,
    oauth2_scheme,
    decode_access_token,
    hash_password,
    verify_password,
    get_unique_genres,
    get_books_by_genre,
)
from models import Usuario, Audiolibro, SesionAcceso, Categoria, Clasificacion
from schemas import UserUpdate, UserPasswordUpdate, UserResponse, RoleInfo, AddRoleToUser, UserCreate, UserBaseResponse
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, container_client
import re
from urllib.parse import unquote
from fastapi.responses import StreamingResponse
from starlette.requests import Request

router = APIRouter(tags=["Main Routes"])

@router.post("/users/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: Session = Depends(get_db),token:str = Depends(oauth2_scheme)):
    # Verifica si el email ya está registrado
    existing_user = await user_get_by_email(user.email, db)
    user_info = decode_access_token(token)
    roles = user_info["roles"]
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="Not Authorized")
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hashear la contraseña
    hashed_password = hash_password(user.password)
    
    # Crear el objeto User
    user = Usuario(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    created_user = await user_create_user(user, db)
    return created_user


@router.post("/auth/token/", response_model=dict)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Genera un token JWT para el usuario autenticado."""
    # Autenticar al usuario (verificar email y contraseña)
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Obtener los roles del usuario
    roles = await user_get_roles(user.id, db)
    role_names = [role.name for role in roles]

    # Crear el token JWT con el email y los roles del usuario
    access_token = create_access_token(data={"id": user.id, "email": user.email, "roles": role_names})

    # Registrar auditoría de acceso
    auditoria = SesionAcceso(usuario_id=user.id, tipo_evento="LOGIN")
    db.add(auditoria)
    db.commit()

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/", response_model=List[UserResponse])
async def read_users(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Decodificar el token para obtener la información del usuario autenticado
    user_info = decode_access_token(token)
    roles = user_info.get("roles", [])

    # Verificar si el usuario tiene el rol Admin
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Obtener todos los usuarios desde la base de datos
    users = db.query(Usuario).all()
    if not users:
        raise HTTPException(status_code=404, detail="No se encontraron usuarios")

    return users

@router.get("/users/{user_id}/", response_model=UserResponse)
async def read_user_detail(user_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Decodificar el token para obtener la información del usuario autenticado
    user_info = decode_access_token(token)
    roles = user_info.get("roles", [])

    # Verificar si el usuario tiene el rol Admin
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Obtener el usuario desde la base de datos
    user = await user_get_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return user


@router.put("/user/{user_id}/", response_model=UserResponse)
async def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db),token:str = Depends(oauth2_scheme)):
    user_info = decode_access_token(token)
    roles = user_info["roles"]
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="Not Authorized")
    
    user = await user_get_by_id(user_id, db)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if user.email != user_info["email"] and "Admin" not in roles:
        raise HTTPException(status_code=403, detail="Not Authorized")
    
    user = await user_update_user(user_update, user, db)
    return user

@router.put("/user/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Decodificar el token para obtener la información del usuario autenticado
    user_info = decode_access_token(token)
    email = user_info["email"]

    # Obtener el usuario de la base de datos
    user = await user_get_by_email(email, db)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Actualizar los datos del usuario
    updated_user = await user_update_user(user_update, user, db)
    return updated_user


@router.delete("/users/{user_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: Session = Depends(get_db),token:str = Depends(oauth2_scheme)):
    user_info = decode_access_token(token)
    roles = user_info["roles"]
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="Not Authorized")
    user = await user_get_by_id(user_id, db)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    await user_delete_user(user, db)
    return

@router.put("/user/change-password")
async def change_password(
    password_update: UserPasswordUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Decodificar el token para obtener el usuario autenticado
    user_info = decode_access_token(token)
    user_email = user_info.get("email")
    user_roles = user_info.get("roles", [])

    # Verificar si el usuario autenticado existe
    user = db.query(Usuario).filter(Usuario.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Si es Admin y se proporciona user_id, cambia la contraseña de otro usuario
    if "Admin" in user_roles and password_update.user_id is not None:
        target_user = db.query(Usuario).filter(Usuario.id == password_update.user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Usuario objetivo no encontrado")
        target_user.hashed_password = hash_password(password_update.new_password)
        db.commit()
        return {"message": "Contraseña actualizada correctamente"}

    # Si no es Admin, verificar la contraseña actual
    if not verify_password(password_update.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")

    # Cambiar la contraseña del usuario autenticado
    user.hashed_password = hash_password(password_update.new_password)
    db.commit()

    return {"message": "Contraseña actualizada correctamente"}

@router.get("/user/me", response_model=UserBaseResponse)
async def read_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Decodifica el token para obtener la información del usuario
    user_info = decode_access_token(token)

    # Extrae el email desde el token
    user_email = user_info.get("email")
    if user_email is None:
        raise HTTPException(status_code=400, detail="User ID not found in token")

    # Busca la información del usuario en la base de datos
    user = await user_get_by_email(user_email, db)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Convierte el objeto user a un diccionario
    user_data = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "roles": user_info["roles"],
        "valid_token": token,
    }

    print(user_data)  # Imprime los datos antes de devolverlos
    return user_data

@router.get("/user/{user_id}/roles", response_model=List[RoleInfo])
async def get_roles_user(user_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Decodificar el token para obtener la información del usuario autenticado
    user_info = decode_access_token(token)
    roles = user_info.get("roles", [])

    # Verificar si el usuario tiene el rol Admin
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Obtener los roles del usuario desde la base de datos
    user = await user_get_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_roles = await user_get_roles(user_id, db)
    return user_roles

@router.get("/roles/", response_model=List[RoleInfo])
async def get_all_roles(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Decodificar el token para obtener la información del usuario autenticado
    user_info = decode_access_token(token)
    roles = user_info.get("roles", [])

    # Verificar si el usuario tiene el rol Admin
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Obtener todos los roles desde la base de datos
    all_roles = await role_get_all(db)
    return all_roles

@router.post("/users/add_roles", status_code=status.HTTP_204_NO_CONTENT)
async def assign_role_to_user(role_info: AddRoleToUser, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Decodificar el token para obtener la información del usuario autenticado
    user_info = decode_access_token(token)
    roles = user_info.get("roles", [])

    # Verificar si el usuario tiene el rol Admin
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Verificar si el usuario y el rol existen
    user = await user_get_by_id(role_info.user_id, db)
    role = await role_get_by_id(role_info.role_id, db)
    if not user or not role:
        raise HTTPException(status_code=404, detail="Usuario o Rol no encontrado")

    # Verificar si el usuario ya tiene el rol
    user_roles = await user_get_roles(role_info.user_id, db)
    user_roles_ids = [role.id for role in user_roles]
    if role_info.role_id in user_roles_ids:
        raise HTTPException(status_code=400, detail="El usuario ya tiene este rol")

    # Asignar el rol al usuario
    await user_add_role(role_info.user_id, role_info.role_id, db)
    return

@router.delete("/roles/{role_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_from_user(role_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    # Decodificar el token para obtener la información del usuario autenticado
    user_info = decode_access_token(token)
    roles = user_info.get("roles", [])

    # Verificar si el usuario tiene el rol Admin
    if "Admin" not in roles:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Verificar si el rol existe
    role = await role_get_by_id(role_id, db)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    # Eliminar el rol
    await role_delete(role_id, db)
    return

@router.post("/search")
async def search(query: dict, db: Session = Depends(get_db)):
    search_term = query.get("query", "")
    return await search_audio(db, search_term)


@router.post("/guardar-progreso")
async def save_progress(data: dict, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    decode_access_token(token)
    
    usuario_id = data.get("usuario_id")
    audiolibro_id = data.get("audiolibro_id")
    chapter_index = data.get("chapter_index")
    progreso = data.get("progreso")

    if not all([usuario_id, audiolibro_id, chapter_index is not None, progreso is not None]):
        raise HTTPException(status_code=400, detail="Faltan datos requeridos.")

    return await guardar_progreso(db, usuario_id, audiolibro_id, chapter_index, progreso)

@router.get("/obtener-progreso/{usuario_id}/{audiolibro_id}")
async def get_progress(usuario_id: int, audiolibro_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_info = decode_access_token(token)
    authenticated_user_id = user_info.get("id")

    if authenticated_user_id != usuario_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este progreso.")

    return await obtener_progreso(db, usuario_id, audiolibro_id)


@router.get("/stream-audio-simple/{usuario_id}/{audiolibro_id}/{chapter_index}")
async def stream_audio_range(
    usuario_id: int,
    audiolibro_id: int,
    chapter_index: int,
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        user_info = decode_access_token(token)
        authenticated_user_id = user_info.get("id")
    except HTTPException as e:
        raise e

    if authenticated_user_id != usuario_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso.")

    try:
        audiolibro = db.query(Audiolibro).filter_by(id=audiolibro_id).first()
        if not audiolibro:
            raise HTTPException(status_code=404, detail="Audiolibro no encontrado.")

        folder_name = audiolibro.nombre
        blobs_list = container_client.list_blobs(name_starts_with=f"{folder_name}/")
        chapters = [blob.name for blob in blobs_list if blob.name.lower().endswith(".mp3")]

        if not chapters:
            raise HTTPException(status_code=404, detail="No se encontraron capítulos.")

        def extract_chapter_number(blob_name):
            match = re.search(r"(\d+)", blob_name)
            return int(match.group(1)) if match else None

        chapters_with_numbers = []
        for blob_name in chapters:
            chapter_number = extract_chapter_number(blob_name)
            if chapter_number is not None:
                chapters_with_numbers.append((blob_name, chapter_number))

        if not chapters_with_numbers:
            raise HTTPException(status_code=404, detail="No se pudieron ordenar los capítulos por número.")

        chapters_with_numbers.sort(key=lambda x: x[1])

        selected_chapter_index = chapter_index - 1
        if selected_chapter_index < 0 or selected_chapter_index >= len(chapters_with_numbers):
            raise HTTPException(status_code=404, detail=f"Capítulo {chapter_index} no encontrado.")

        chapter_blob_name = chapters_with_numbers[selected_chapter_index][0]

        blob_client = container_client.get_blob_client(chapter_blob_name)
        blob_props = blob_client.get_blob_properties()
        blob_size = blob_props.size

        range_header = request.headers.get("range")
        if range_header:
            match = re.match(r"bytes=(\d+)-(\d*)", range_header)
            if match:
                start = int(match.group(1))
                end = int(match.group(2)) if match.group(2) else blob_size - 1
            else:
                start = 0
                end = blob_size - 1
        else:
            start = 0
            end = blob_size - 1

        length = end - start + 1

        stream = blob_client.download_blob(offset=start, length=length)

        headers = {
            "Content-Range": f"bytes {start}-{end}/{blob_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "audio/mpeg",
        }

        return StreamingResponse(stream.chunks(), status_code=206, headers=headers)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audio-by-id/{audiolibro_id}")
async def get_chapters(
    audiolibro_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    decode_access_token(token)

    try:
        # Llamar a la función del CRUD para obtener los capítulos
        result = get_chapters_by_audiobook_id(audiolibro_id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/mis-audiolibros/{usuario_id}")
async def get_my_audiobooks(usuario_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user_info = decode_access_token(token)
    authenticated_user_id = user_info.get("id")  # Extrae el ID del token

    if authenticated_user_id != usuario_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a estos audiolibros.")
    
    return {"results": await mis_audiolibros(db, usuario_id)}


@router.get("/genres", response_model=List[str])
def get_genres(db: Session = Depends(get_db)):
    try:
        return get_unique_genres(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar los géneros: {str(e)}")


@router.get("/books-by-genre/{genre}", response_model=List[dict])
def get_books_by_genre_endpoint(
    genre: str = Path(..., description="Género de los libros"), 
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        user_info = decode_access_token(token)
        authenticated_user_id = user_info.get("id")

        if not authenticated_user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado.")

        decoded_genre = unquote(genre).strip().lower()

        books = get_books_by_genre(db, decoded_genre)

        return books

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al cargar los libros: {str(e)}")


from fastapi import BackgroundTasks
from sharepoint import ingest_audiobook_files
from azure.storage.blob import generate_blob_sas, BlobSasPermissions
from datetime import datetime, timezone, timedelta
from config import AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY, AZURE_CONTAINER_NAME

@router.post("/admin/importar-lote")
async def importar_lote(
    data: dict, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
):
    user_info = decode_access_token(token)
    if "Admin" not in user_info["roles"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    excel_data = data.get("libros", [])
    
    for libro_data in excel_data:
        nombre = libro_data.get("nombre")
        descripcion = libro_data.get("descripcion")
        autor = libro_data.get("autor")
        categoria_nombre = libro_data.get("categoria")
        clasificaciones_lista = libro_data.get("clasificaciones", [])
        sharepoint_url = libro_data.get("sharepoint_url")
        
        # 1. Resolver o crear categoría
        categoria = db.query(Categoria).filter(Categoria.nombre == categoria_nombre).first()
        if not categoria and categoria_nombre:
            categoria = Categoria(nombre=categoria_nombre)
            db.add(categoria)
            db.commit()
            db.refresh(categoria)
            
        # 2. Crear audiolibro
        audiolibro = db.query(Audiolibro).filter(Audiolibro.nombre == nombre).first()
        if not audiolibro:
            audiolibro = Audiolibro(
                nombre=nombre,
                descripcion=descripcion,
                autor=autor,
                categoria_id=categoria.id if categoria else None
            )
            db.add(audiolibro)
            db.commit()
            db.refresh(audiolibro)
            
        # 3. Vincular clasificaciones
        for clas_nombre in clasificaciones_lista:
            clas = db.query(Clasificacion).filter(Clasificacion.nombre == clas_nombre).first()
            if not clas and clas_nombre:
                clas = Clasificacion(nombre=clas_nombre)
                db.add(clas)
                db.commit()
                db.refresh(clas)
            if clas and clas not in audiolibro.clasificaciones:
                audiolibro.clasificaciones.append(clas)
                db.commit()
                
        # 4. Encolar tarea de descarga de SharePoint si hay URL
        if sharepoint_url:
            background_tasks.add_task(
                ingest_audiobook_files,
                sharepoint_url,
                audiolibro.nombre
            )
            
    return {"message": "Importación iniciada en segundo plano"}


@router.post("/audiolibros/{audiolibro_id}/capitulos/presign-upload")
async def get_presigned_upload_url(
    audiolibro_id: int,
    filename: str,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user_info = decode_access_token(token)
    if "Admin" not in user_info["roles"]:
        raise HTTPException(status_code=403, detail="No autorizado")

    audiolibro = db.query(Audiolibro).filter(Audiolibro.id == audiolibro_id).first()
    if not audiolibro:
        raise HTTPException(status_code=404, detail="Audiolibro no encontrado")
        
    blob_name = f"{audiolibro.nombre}/{filename}"

    sas_token = generate_blob_sas(
        account_name=AZURE_ACCOUNT_NAME,
        container_name=AZURE_CONTAINER_NAME,
        blob_name=blob_name,
        account_key=AZURE_ACCOUNT_KEY,
        permission=BlobSasPermissions(write=True, create=True),
        expiry=datetime.now(timezone.utc) + timedelta(hours=1)
    )

    sas_url = f"https://{AZURE_ACCOUNT_NAME}.blob.core.windows.net/{AZURE_CONTAINER_NAME}/{blob_name}?{sas_token}"
    return {"sas_url": sas_url, "blob_path": blob_name}


@router.get("/admin/auditoria/sesiones/")
async def get_sesiones_auditoria(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user_info = decode_access_token(token)
    if "Admin" not in user_info["roles"]:
        raise HTTPException(status_code=403, detail="No autorizado")
        
    sesiones = db.query(SesionAcceso).order_by(SesionAcceso.timestamp.desc()).all()
    return [
        {
            "id": s.id,
            "usuario_id": s.usuario_id,
            "tipo_evento": s.tipo_evento,
            "timestamp": s.timestamp.isoformat() if s.timestamp else None
        }
        for s in sesiones
    ]


@router.post("/auth/logout")
async def logout(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user_info = decode_access_token(token)
    usuario_id = user_info.get("id")
    
    # Registrar auditoría de logout
    auditoria = SesionAcceso(usuario_id=usuario_id, tipo_evento="LOGOUT")
    db.add(auditoria)
    db.commit()
    
    return {"message": "Sesión cerrada correctamente"}


@router.get("/admin/categorias")
async def get_categorias(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    decode_access_token(token)
    categorias = db.query(Categoria).all()
    return [{"id": c.id, "nombre": c.nombre} for c in categorias]