from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from config import SQLALCHEMY_DATABASE_URL


def habilitar_paridad_sqlite(motor):
    """Solo en SQLite (entorno local): lower() con Unicode completo.

    El lower() nativo de SQLite solo baja letras ASCII, así que `ilike` no hace
    coincidir "POESÍA" con "poesía" y los géneros con tilde quedan vacíos. En
    producción (SQL Server) la collation ya lo resuelve: allí no se toca nada.
    Devuelve True si lo aplicó.
    """
    if motor.dialect.name != "sqlite":
        return False

    @event.listens_for(motor, "connect")
    def _registrar_lower(conexion_dbapi, _registro):
        conexion_dbapi.create_function(
            "lower", 1, lambda v: v.lower() if isinstance(v, str) else v, deterministic=True
        )

    return True


def crear_motor(url):
    """Motor de la app. En SQLite (entorno local) se permite usar la conexión
    desde varios hilos, como hace FastAPI; en SQL Server no se toca nada."""
    argumentos = {"check_same_thread": False} if url.startswith("sqlite") else {}
    motor = create_engine(url, connect_args=argumentos)
    habilitar_paridad_sqlite(motor)
    return motor


engine = crear_motor(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
