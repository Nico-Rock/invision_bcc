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