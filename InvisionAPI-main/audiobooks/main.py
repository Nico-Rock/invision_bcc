import sys
from unittest.mock import MagicMock

# Mock pyodbc before any database imports to prevent startup crashes when driver is missing
try:
    import pyodbc
except ImportError:
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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router as main_router
import uvicorn 

# Create database tables if they do not exist (useful for local SQLite fallback)
from database import Base, engine, SessionLocal
from models import Usuario, Role, UserRole
from crud import hash_password

Base.metadata.create_all(bind=engine)

# Seed initial admin and standard user if database is empty
def seed_database():
    db = SessionLocal()
    try:
        # 1. Seed Roles
        admin_role = db.query(Role).filter_by(name="Admin").first()
        if not admin_role:
            admin_role = Role(name="Admin", description="Administrator Role")
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)

        user_role = db.query(Role).filter_by(name="User").first()
        if not user_role:
            user_role = Role(name="User", description="Standard User Role")
            db.add(user_role)
            db.commit()
            db.refresh(user_role)

        # 2. Seed Admin User (admin@invision.com / admin123)
        admin_user = db.query(Usuario).filter_by(email="admin@invision.com").first()
        if not admin_user:
            admin_user = Usuario(
                email="admin@invision.com",
                username="admin",
                hashed_password=hash_password("admin123"),
                first_name="Admin",
                last_name="Biblioteca"
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            
            # Link to Admin role
            user_role_link = UserRole(user_id=admin_user.id, role_id=admin_role.id)
            db.add(user_role_link)
            db.commit()

        # 3. Seed Normal User (user@invision.com / user123)
        normal_user = db.query(Usuario).filter_by(email="user@invision.com").first()
        if not normal_user:
            normal_user = Usuario(
                email="user@invision.com",
                username="user",
                hashed_password=hash_password("user123"),
                first_name="User",
                last_name="Biblioteca"
            )
            db.add(normal_user)
            db.commit()
            db.refresh(normal_user)
            
            # Link to User role
            user_role_link = UserRole(user_id=normal_user.id, role_id=user_role.id)
            db.add(user_role_link)
            db.commit()
    finally:
        db.close()

seed_database()

app = FastAPI(title="Invision API", description="Servicios de la Biblioteca Central para Ciegos")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(main_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")