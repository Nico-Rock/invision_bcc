from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from passlib.context import CryptContext
from database import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone_number = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True))

    roles = relationship("UserRole", back_populates="usuario", cascade="all, delete-orphan")
    progreso = relationship("ProgresoAudiolibro", back_populates="usuario", cascade="all, delete-orphan")

    def verify_password(self, password: str):
        return pwd_context.verify(password, self.hashed_password)

    def hash_password(self, password: str):
        self.hashed_password = pwd_context.hash(password)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String, nullable=True)

    users = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario", back_populates="roles")
    role = relationship("Role", back_populates="users")


# Tabla asociativa muchos-a-muchos
audiolibro_clasificacion = Table(
    "audiolibro_clasificacion",
    Base.metadata,
    Column("audiolibro_id", Integer, ForeignKey("audiolibros.id", ondelete="CASCADE"), primary_key=True),
    Column("clasificacion_id", Integer, ForeignKey("clasificaciones.id", ondelete="CASCADE"), primary_key=True)
)


class Categoria(Base):
    __tablename__ = "categorias"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)

    audiolibros = relationship("Audiolibro", back_populates="categoria")


class Clasificacion(Base):
    __tablename__ = "clasificaciones"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)

    audiolibros = relationship("Audiolibro", secondary=audiolibro_clasificacion, back_populates="clasificaciones")


class SesionAcceso(Base):
    __tablename__ = "sesiones_acceso"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo_evento = Column(String(20), nullable=False) # LOGIN o LOGOUT
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario")


class Audiolibro(Base):
    __tablename__ = "audiolibros"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    genero = Column(String, nullable=True) 
    autor = Column(String, nullable=True)

    categoria_id = Column(Integer, ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True)
    categoria = relationship("Categoria", back_populates="audiolibros")
    clasificaciones = relationship("Clasificacion", secondary=audiolibro_clasificacion, back_populates="audiolibros")

    progreso = relationship("ProgresoAudiolibro", back_populates="audiolibro", cascade="all, delete-orphan")


class ProgresoAudiolibro(Base):
    __tablename__ = "progreso_audiolibros"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    audiolibro_id = Column(Integer, ForeignKey("audiolibros.id", ondelete="CASCADE"), nullable=False)
    chapter_index = Column(Integer, nullable=False)
    progreso = Column(Float, nullable=False)
    ultima_reproduccion = Column(DateTime, default=func.now())

    usuario = relationship("Usuario", back_populates="progreso")
    audiolibro = relationship("Audiolibro", back_populates="progreso")