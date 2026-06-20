import sys
from unittest.mock import MagicMock
mock_pyodbc = MagicMock()
mock_pyodbc.version = "4.0.0"
sys.modules['pyodbc'] = mock_pyodbc

# Monkeypatch passlib bcrypt issue on Python 3.13
try:
    import bcrypt
    original_hashpw = bcrypt.hashpw
    def mock_hashpw(password, salt):
        if isinstance(password, bytes) and len(password) > 72:
            password = password[:72]
        elif isinstance(password, str) and len(password.encode('utf-8')) > 72:
            password = password[:72]
        return original_hashpw(password, salt)
    bcrypt.hashpw = mock_hashpw
except Exception:
    pass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from test_database import test_engine, Base, get_test_db, TestingSessionLocal
from database import get_db
from main import app
from models import Usuario, Role, UserRole, Audiolibro, ProgresoAudiolibro
from crud import hash_password
from unittest.mock import AsyncMock, patch

@pytest.fixture(scope="module")
def test_db():
    print("Tablas registradas en Base.metadata:", Base.metadata.tables.keys())
    Base.metadata.create_all(bind=test_engine)

    inspector = inspect(test_engine)
    table_names = inspector.get_table_names()
    print("Tablas creadas:", table_names)

    if not table_names:
        raise RuntimeError("No se crearon tablas en la base de datos de prueba.")

    db = TestingSessionLocal()

    admin_user = db.query(Usuario).filter_by(email="admin@example.com").first()
    if not admin_user:
        hashed_password = hash_password("adminpassword")
        admin_user = Usuario(
            email="admin@example.com",
            username="adminuser",
            hashed_password=hashed_password
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    admin_role = db.query(Role).filter_by(name="Admin").first()
    if not admin_role:
        admin_role = Role(name="Admin", description="Administrador del sistema")
        db.add(admin_role)
        db.commit()
        db.refresh(admin_role)

    test_role = db.query(Role).filter_by(name="TestRole").first()
    if not test_role:
        test_role = Role(name="TestRole", description="Rol de prueba")
        db.add(test_role)
        db.commit()
        db.refresh(test_role)

    roles = db.query(Role).all()

    user_role = db.query(UserRole).filter_by(user_id=admin_user.id, role_id=admin_role.id).first()
    if not user_role:
        user_role = UserRole(usuario=admin_user, role=admin_role)
        db.add(user_role)
        db.commit()
        
    # Crear audiolibro de prueba
        test_audiobook = Audiolibro(nombre="Libro de Prueba")
        db.add(test_audiobook)
        db.commit()
        db.refresh(test_audiobook)

        # Crear progreso de audiolibro para el usuario administrador
        progress = ProgresoAudiolibro(
            usuario_id=admin_user.id,
            audiolibro_id=test_audiobook.id,
            chapter_index=2,
            progreso=75.5,
            ultima_reproduccion=None
        )
        db.add(progress)
        db.commit()

    yield db

    Base.metadata.drop_all(bind=test_engine)
    db.close()

@pytest.fixture(scope="module")
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    test_db.close()

# Token del administrador
@pytest.fixture(scope="module")
def admin_token(client):
    login_data = {
        "username": "admin@example.com",
        "password": "adminpassword"
    }
    response = client.post("/auth/token/", data=login_data)
    print("Token response:", response.json())
    assert response.status_code == 200
    return response.json()["access_token"]

# Datos de prueba
@pytest.fixture(scope="module")
def test_user(client, admin_token):
    # crea un usuario de prueba
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword"
    }
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post("/users/", json=user_data, headers=headers)
    assert response.status_code == 201
    return response.json()

def test_read_current_user(client, test_user):
    login_data = {
        "username": "test@example.com",
        "password": "testpassword"
    }
    token_response = client.post("/auth/token/", data=login_data)
    token = token_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/user/me", headers=headers)
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == "test@example.com"
    assert user_data["username"] == "testuser"

def test_update_current_user(client, test_user):
    login_data = {
        "username": "test@example.com",
        "password": "testpassword"
    }
    token_response = client.post("/auth/token/", data=login_data)
    token = token_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    update_data = {
        "first_name": "UpdatedFirstName",
        "last_name": "UpdatedLastName",
        "phone_number": None
    }
    response = client.put("/user/me", json=update_data, headers=headers)

    assert response.status_code == 200
    updated_user = response.json()
    assert updated_user["first_name"] == "UpdatedFirstName"
    assert updated_user["last_name"] == "UpdatedLastName"

def test_change_password(client, test_user):
    login_data = {
        "username": "test@example.com",
        "password": "testpassword"
    }
    token_response = client.post("/auth/token/", data=login_data)
    token = token_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    password_data = {
        "current_password": "testpassword",
        "new_password": "newtestpassword"
    }
    response = client.put("/user/change-password", json=password_data, headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Contraseña actualizada correctamente"

    new_login_data = {
        "username": "test@example.com",
        "password": "newtestpassword"
    }
    new_token_response = client.post("/auth/token/", data=new_login_data)
    assert new_token_response.status_code == 200
    
def test_read_users(client, admin_token):
    user_data_1 = {
        "email": "user1@example.com",
        "username": "user1",
        "password": "password1"
    }
    user_data_2 = {
        "email": "user2@example.com",
        "username": "user2",
        "password": "password2"
    }
    headers = {"Authorization": f"Bearer {admin_token}"}
    client.post("/users/", json=user_data_1, headers=headers)
    client.post("/users/", json=user_data_2, headers=headers)

    response = client.get("/users/", headers=headers)
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 2
    assert any(user["email"] == "user1@example.com" for user in users)
    assert any(user["email"] == "user2@example.com" for user in users)
    
def test_read_user_detail(client, admin_token, test_user):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get(f"/users/{test_user['id']}/", headers=headers)
    assert response.status_code == 200
    user = response.json()
    assert user["email"] == "test@example.com"
    assert user["username"] == "testuser"

def test_update_user(client, admin_token, test_user):
    update_data = {
        "first_name": "UpdatedFirstName",
        "last_name": "UpdatedLastName",
        "phone_number": None
    }
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.put(f"/user/{test_user['id']}/", json=update_data, headers=headers)
    assert response.status_code == 200
    updated_user = response.json()
    assert updated_user["first_name"] == "UpdatedFirstName"
    assert updated_user["last_name"] == "UpdatedLastName"

def test_delete_user(client, admin_token, test_user):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.delete(f"/users/{test_user['id']}/", headers=headers)
    assert response.status_code == 204

    response = client.get(f"/users/{test_user['id']}/", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Usuario no encontrado"
    
    
def test_get_roles_admin_user(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/user/1/roles/", headers=headers)
    assert response.status_code == 200, f"Error getting admin roles: {response.json()}"

    roles = response.json()
    assert len(roles) > 0
    assert any(role["name"] == "Admin" for role in roles)
    
def test_get_all_roles(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/roles/", headers=headers)
    
    # Verificar que la respuesta sea exitosa (status_code 200)
    assert response.status_code == 200, f"Error getting all roles: {response.json()}"

    # Verificar que se devuelva una lista de roles
    roles = response.json()
    assert isinstance(roles, list), "La respuesta no es una lista"

    # Verificar que al menos un rol tenga el nombre 'Admin'
    assert any(role["name"] == "Admin" for role in roles), "El rol 'Admin' no está presente"
    
def test_assign_role_to_user(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    user_id = 1
    role_id = 2

    payload = {"user_id": user_id, "role_id": role_id}

    response = client.post("/users/add_roles", json=payload, headers=headers)

    assert response.status_code == 204, f"Error assigning role to user: {response.json()}"

def test_delete_role(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    role_id = 2

    response = client.delete(f"/roles/{role_id}/", headers=headers)

    assert response.status_code == 204, f"Error deleting role: {response.json()}"
    
def test_search(client, test_db):
    audiolibro = Audiolibro(nombre="Aventuras en el espacio")
    test_db.add(audiolibro)
    test_db.commit()

    payload = {"query": "aventuras"}

    response = client.post("/search", json=payload)

    assert response.status_code == 200, f"Error en la búsqueda: {response.json()}"
    
def test_save_progress(client, test_db, admin_token):
    usuario = Usuario(email="testuser@example.com", username="testuser", hashed_password="hashedpass")
    audiolibro = Audiolibro(nombre="Libro de prueba")
    test_db.add_all([usuario, audiolibro])
    test_db.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    
    payload = {
        "usuario_id": usuario.id,
        "audiolibro_id": audiolibro.id,
        "chapter_index": 3,
        "progreso": 50.75
    }

    response = client.post("/guardar-progreso", json=payload, headers=headers)

    assert response.status_code == 200, f"Error al guardar el progreso: {response.json()}"
    
def test_get_progress(client, test_db, admin_token):
    usuario = test_db.query(Usuario).filter_by(email="admin@example.com").first()
    audiolibro = test_db.query(Audiolibro).filter_by(nombre="Libro de Prueba").first()

    headers = {"Authorization": f"Bearer {admin_token}"}

    response = client.get(f"/obtener-progreso/{usuario.id}/{audiolibro.id}", headers=headers)

    assert response.status_code == 200, f"Error al obtener el progreso: {response.json()}"


@patch("routes.container_client")
def test_stream_audio_simple_with_mock(mock_container_client, client, test_db, admin_token):
    # Mock list_blobs
    mock_blob1 = MagicMock()
    mock_blob1.name = "Libro de Prueba/01_intro.mp3"
    mock_blob2 = MagicMock()
    mock_blob2.name = "Libro de Prueba/02_chapter1.mp3"
    mock_container_client.list_blobs.return_value = [mock_blob1, mock_blob2]

    # Mock get_blob_client
    mock_blob_client = MagicMock()
    # Mock chunks generator
    mock_chunks = MagicMock()
    mock_chunks.chunks.return_value = [b"fake_audio_data"]
    mock_blob_client.download_blob.return_value = mock_chunks
    
    mock_props = MagicMock()
    mock_props.size = 15
    mock_blob_client.get_blob_properties.return_value = mock_props
    
    mock_container_client.get_blob_client.return_value = mock_blob_client

    admin_user = test_db.query(Usuario).filter_by(email="admin@example.com").first()
    test_audiobook = test_db.query(Audiolibro).filter_by(nombre="Libro de Prueba").first()

    progress = test_db.query(ProgresoAudiolibro).filter_by(
        usuario_id=admin_user.id,
        audiolibro_id=test_audiobook.id
    ).first()
    chapter_index = progress.chapter_index

    url = f"/stream-audio-simple/{admin_user.id}/{test_audiobook.id}/{chapter_index}"
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get(url, headers=headers)

    assert response.status_code == 206 or response.status_code == 200, f"Error al reproducir el audio: {response.json()}"


@patch("crud.get_chapters_by_audiobook_id")
def test_get_chapters_success(mock_get_chapters, client, test_db, admin_token):
    mock_get_chapters.return_value = [
        {"chapter_index": 1, "title": "Capítulo 1", "duration": 300},
        {"chapter_index": 2, "title": "Capítulo 2", "duration": 400},
    ]

    test_audiobook = test_db.query(Audiolibro).filter_by(nombre="Libro de Prueba").first()

    url = f"/audio-by-id/{test_audiobook.id}"
    headers = {"Authorization": f"Bearer {admin_token}"}

    response = client.get(url, headers=headers)

    assert response.status_code == 200, f"Error al obtener los capítulos: {response.json()}"

    chapters = response.json()
    assert len(chapters) == 2, "El número de capítulos no coincide"

    
def test_get_my_audiobooks(client, test_db, admin_token):
    usuario = test_db.query(Usuario).filter_by(email="admin@example.com").first()
    
    headers = {"Authorization": f"Bearer {admin_token}"}

    response = client.get(f"/mis-audiolibros/{usuario.id}", headers=headers)

    assert response.status_code == 200, f"Error al obtener los audiolibros: {response.json()}"


def test_logout(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post("/auth/logout", headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Sesión cerrada correctamente"


def test_presign_upload(client, test_db, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    test_audiobook = test_db.query(Audiolibro).filter_by(nombre="Libro de Prueba").first()
    
    url = f"/audiolibros/{test_audiobook.id}/capitulos/presign-upload?filename=cap1.mp3"
    response = client.post(url, headers=headers)
    assert response.status_code == 200
    assert "sas_url" in response.json()


def test_get_sesiones_auditoria(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/admin/auditoria/sesiones/", headers=headers)
    assert response.status_code == 200
    sesiones = response.json()
    assert len(sesiones) >= 1
    assert sesiones[0]["tipo_evento"] in ["LOGIN", "LOGOUT"]


@patch("routes.ingest_audiobook_files")
def test_importar_lote_endpoint(mock_ingest, client, admin_token):
    mock_ingest.return_value = True
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "libros": [
            {
                "nombre": "Libro Importado",
                "descripcion": "Una descripción de prueba",
                "autor": "Autor Importado",
                "categoria": "Historia",
                "clasificaciones": ["Patrimonio", "BCC"],
                "sharepoint_url": "https://sharepoint.com/folder"
            }
        ]
    }
    response = client.post("/admin/importar-lote", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Importación iniciada en segundo plano"


def test_get_categorias_unauthorized(client):
    response = client.get("/admin/categorias")
    assert response.status_code == 401


def test_get_categorias_success(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/admin/categorias", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)