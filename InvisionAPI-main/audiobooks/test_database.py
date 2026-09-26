from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
from unittest.mock import MagicMock
mock_pyodbc = MagicMock()
mock_pyodbc.version = "4.0.0"
sys.modules['pyodbc'] = mock_pyodbc

from database import Base
import pytest
from models import Categoria, Clasificacion, Audiolibro, SesionAcceso

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def get_test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_creacion_categorias_clasificaciones():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        nueva_cat = Categoria(nombre="Historia", descripcion="Libros historicos")
        nueva_clas = Clasificacion(nombre="Patrimonio BCC", descripcion="BCC Nacional")
        
        db.add(nueva_cat)
        db.add(nueva_clas)
        db.commit()
        
        libro = Audiolibro(nombre="Prueba", categoria_id=nueva_cat.id)
        libro.clasificaciones.append(nueva_clas)
        db.add(libro)
        db.commit()
        db.refresh(libro)
        
        assert libro.categoria.nombre == "Historia"
        assert len(libro.clasificaciones) == 1
        assert libro.clasificaciones[0].nombre == "Patrimonio BCC"
    finally:
        Base.metadata.drop_all(bind=test_engine)
        db.close()

def test_sesion_acceso_creation():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        from models import Usuario
        usuario = Usuario(email="user@test.com", username="testuser", hashed_password="dummypassword")
        db.add(usuario)
        db.commit()
        db.refresh(usuario)

        nueva_sesion = SesionAcceso(usuario_id=usuario.id, tipo_evento="LOGIN")
        db.add(nueva_sesion)
        db.commit()
        db.refresh(nueva_sesion)

        assert nueva_sesion.usuario_id == usuario.id
        assert nueva_sesion.tipo_evento == "LOGIN"
    finally:
        Base.metadata.drop_all(bind=test_engine)
        db.close()

# --- T25: paridad local con producción ante mayúsculas acentuadas [R38] ---

def test_acentos_filtro_por_genero_sin_distinguir_mayusculas_acentuadas():
    from sqlalchemy.orm import Session
    from database import habilitar_paridad_sqlite
    from crud import get_books_by_genre

    motor = create_engine("sqlite:///:memory:", poolclass=StaticPool,
                          connect_args={"check_same_thread": False})
    habilitar_paridad_sqlite(motor)
    Base.metadata.create_all(bind=motor)
    with Session(motor) as db:
        db.add_all([
            Audiolibro(nombre="Veinte poemas", genero="POESÍA"),
            Audiolibro(nombre="Otro", genero="Poesía"),
            Audiolibro(nombre="Ajeno", genero="INFANTIL"),
        ])
        db.commit()
        nombres = {b["nombre"] for b in get_books_by_genre(db, "poesía")}

    assert nombres == {"Veinte poemas", "Otro"}


def test_acentos_paridad_no_se_aplica_a_otros_motores():
    from database import habilitar_paridad_sqlite

    motor_mssql = create_engine("mssql+pyodbc://u:p@servidor/db?driver=x")
    assert habilitar_paridad_sqlite(motor_mssql) is False


def test_acentos_motor_sqlite_local_admite_varios_hilos(tmp_path):
    """FastAPI atiende en hilos distintos: sin esto, cada streaming local daba 500."""
    import threading
    from sqlalchemy import text
    from database import crear_motor

    motor = crear_motor(f"sqlite:///{tmp_path / 'hilos.db'}")
    conexion = motor.raw_connection()
    errores = []

    def usar_en_otro_hilo():
        try:
            conexion.cursor().execute("SELECT 1")
        except Exception as e:
            errores.append(e)

    hilo = threading.Thread(target=usar_en_otro_hilo)
    hilo.start()
    hilo.join()
    conexion.close()
    assert errores == []


# --- T19: número y orden de capítulos, compartido por lista y streaming [R24] ---

def test_capitulos_numero_ignora_extension_y_carpeta():
    from crud import numero_de_capitulo

    assert numero_de_capitulo("A CARA DESCUBIERTA/A cara descubierta Pista 12.mp3") == 12
    assert numero_de_capitulo("1984/1984 Pista 5.mp3") == 5          # carpeta con dígitos
    assert numero_de_capitulo("Harry Potter 2 Pista 7.MP3") == 7      # último número, no el primero
    assert numero_de_capitulo("Prólogo.mp3") is None


def test_capitulos_orden_numerico_no_alfabetico():
    from crud import ordenar_capitulos

    nombres = [f"LIBRO/Libro Pista {n}.mp3" for n in (1, 10, 11, 2, 20, 3)]
    assert [numero for numero in map(lambda n: int(n.split()[-1][:-4]), ordenar_capitulos(nombres))] == [1, 2, 3, 10, 11, 20]


def test_capitulos_sin_numero_van_al_final_por_nombre():
    from crud import ordenar_capitulos

    nombres = ["L/Pista 2.mp3", "L/Epílogo.mp3", "L/Pista 1.mp3", "L/Anexo.mp3"]
    assert ordenar_capitulos(nombres) == ["L/Pista 1.mp3", "L/Pista 2.mp3", "L/Anexo.mp3", "L/Epílogo.mp3"]
