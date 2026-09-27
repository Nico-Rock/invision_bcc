from pydantic import BaseModel, EmailStr, constr, ConfigDict
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)

# Esquema para actualizar un usuario existente
class UserUpdate(BaseModel):
    first_name: Optional[str]
    last_name: Optional[str]
    phone_number: Optional[str]

# Esquema para la respuesta de usuario
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    first_name: Optional[str]
    last_name: Optional[str]

    model_config = ConfigDict(
        from_attributes=True
    )
    
class UserBaseResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    roles :Optional[list]
    valid_token:Optional[str]
    
    model_config = ConfigDict(
        from_attributes=True
    )
        
class RoleCreate(BaseModel):
    name: str
    description: str = None

    model_config = ConfigDict(
        from_attributes=True
    )
    
class RoleInfo(BaseModel):
    id:int 
    name: str
    
    model_config = ConfigDict(
        from_attributes=True
    )
    
class AddRoleToUser(BaseModel):
    user_id: int
    role_id: int

class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str
    user_id: int = None


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None


class AudiobookCreateUpdate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    genero: Optional[str] = Field(None, max_length=100)
    autor: Optional[str] = Field(None, max_length=200)
    categoria_id: Optional[int] = None
    clasificaciones: Optional[List[str]] = []
    # Spec 005 (R6): se guardan en una tabla aparte; None = no tocar
    narrador: Optional[str] = Field(None, max_length=200)
    en_memoria: Optional[bool] = None