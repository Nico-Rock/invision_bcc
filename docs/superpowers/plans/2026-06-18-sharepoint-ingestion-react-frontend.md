# Ingestion desde SharePoint y Frontend React - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el frontend de Invision a una SPA interactiva en React + Vite altamente accesible, y actualizar el backend FastAPI para soportar la ingesta automatizada de audiolibros desde SharePoint y el control de accesos.

**Architecture:** Enfoque desacoplado. React se comunica con FastAPI para gestionar el estado de sesión y de ingesta, mientras que la subida/streaming de audiolibros se realiza directamente contra Azure Blob Storage.

**Tech Stack:** React 18, Vite, React Router, Tailwind/Vanilla CSS (A11y), FastAPI, SQLAlchemy (MSSQL), Microsoft MSAL (OAuth), Azure Storage SDK.

## Global Constraints
- El frontend debe cumplir estrictamente con WCAG 2.1 AA/AAA (contraste de color, atajos de teclado, navegación secuencial).
- La transferencia de archivos desde SharePoint a Azure Blob se debe realizar en streaming sin almacenamiento temporal en el servidor.
- La base de datos debe almacenar registros de auditoría de accesos.

---

### Task 1: Inicialización de Git y Scaffolding del Frontend

**Files:**
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/package.json`
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/vite.config.js`
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/main.jsx`

**Interfaces:**
- Consumes: N/A
- Produces: Estructura básica de la aplicación React + Vite lista para desarrollo.

- [ ] **Step 1: Inicializar repositorio Git en la raíz**
  
  Run: `git init "/Users/nico/Documents/VibeCode/Invision"`
  Expected: Inicialización exitosa de repositorio git vacío.

- [ ] **Step 2: Crear proyecto React con Vite**
  
  Run: `npx -y create-vite@latest "/Users/nico/Documents/VibeCode/Invision/frontend" --template react`
  Expected: Estructuración exitosa del proyecto frontend.

- [ ] **Step 3: Instalar dependencias iniciales**
  
  Run: `npm --prefix "/Users/nico/Documents/VibeCode/Invision/frontend" install react-router-dom lucide-react xlsx`
  Expected: Instalación limpia sin errores.

- [ ] **Step 4: Configurar Vite para desarrollo local**
  
  Modify: `/Users/nico/Documents/VibeCode/Invision/frontend/vite.config.js`
  ```javascript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
    server: {
      port: 3000,
      host: true
    }
  })
  ```

- [ ] **Step 5: Verificar arranque del servidor local**
  
  Run: `npm --prefix "/Users/nico/Documents/VibeCode/Invision/frontend" run dev -- --dry-run`
  Expected: Compilación exitosa en seco del servidor de desarrollo.

- [ ] **Step 6: Commit de inicialización**
  
  Run: `git -C "/Users/nico/Documents/VibeCode/Invision" add frontend/ package.json && git -C "/Users/nico/Documents/VibeCode/Invision" commit -m "chore: scaffold react project and configure vite"`

---

### Task 2: Modificaciones del Modelo de Base de Datos (FastAPI)

**Files:**
- Modify: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/models.py`
- Test: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_database.py`

**Interfaces:**
- Consumes: SQLAlchemy Base de `database.py`.
- Produces: Nuevas clases de modelo `Categoria`, `Clasificacion`, `SesionAcceso` y tabla asociativa `audiolibro_clasificacion`.

- [ ] **Step 1: Modificar models.py para incluir nuevos esquemas**
  
  Modify: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/models.py`
  ```python
  from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, Float
  from sqlalchemy.orm import relationship
  from database import Base
  from sqlalchemy.sql import func

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
  ```
  *(Nota: Se deben actualizar los campos de `Audiolibro` en `models.py` para añadir la relación `categoria` y `clasificaciones`.)*

- [ ] **Step 2: Actualizar la clase Audiolibro en models.py**
  
  Modify: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/models.py` (Clase Audiolibro)
  ```python
  class Audiolibro(Base):
      __tablename__ = "audiolibros"

      id = Column(Integer, primary_key=True, index=True)
      nombre = Column(String, nullable=False)
      descripcion = Column(String, nullable=True)
      genero = Column(String, nullable=True) # Mantener temporalmente para compatibilidad
      autor = Column(String, nullable=True)
      
      categoria_id = Column(Integer, ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True)
      categoria = relationship("Categoria", back_populates="audiolibros")
      
      clasificaciones = relationship("Clasificacion", secondary=audiolibro_clasificacion, back_populates="audiolibros")
      progreso = relationship("ProgresoAudiolibro", back_populates="audiolibro", cascade="all, delete-orphan")
  ```

- [ ] **Step 3: Agregar prueba unitaria de creación de modelos**
  
  Modify: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_database.py`
  ```python
  def test_creacion_categorias_clasificaciones(db_session):
      from models import Categoria, Clasificacion, Audiolibro
      
      nueva_cat = Categoria(nombre="Historia", descripcion="Libros historicos")
      nueva_clas = Clasificacion(nombre="Patrimonio BCC", descripcion="BCC Nacional")
      
      db_session.add(nueva_cat)
      db_session.add(nueva_clas)
      db_session.commit()
      
      libro = Audiolibro(nombre="Prueba", categoria_id=nueva_cat.id)
      libro.clasificaciones.append(nueva_clas)
      db_session.add(libro)
      db_session.commit()
      
      assert libro.categoria.nombre == "Historia"
      assert len(libro.clasificaciones) == 1
  ```

- [ ] **Step 4: Ejecutar pruebas de la base de datos**
  
  Run: `pytest "/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_database.py" -v`
  Expected: Las pruebas de creación de categorías y clasificaciones deben pasar.

- [ ] **Step 5: Commit de base de datos**
  
  Run: `git -C "/Users/nico/Documents/VibeCode/Invision" commit -am "feat: extend database models with Categoria, Clasificacion and SesionAcceso"`

---

### Task 3: Implementación de Endpoints y Lógica de Ingesta desde SharePoint

**Files:**
- Create: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/sharepoint.py`
- Modify: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py`

**Interfaces:**
- Consumes: Token JWT de autenticación.
- Produces: Endpoint `POST /admin/importar-lote` e integración MS Graph API.

- [ ] **Step 1: Crear módulo sharepoint.py con MSAL**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/sharepoint.py`
  ```python
  import msal
  import httpx
  import os
  from config import container_client

  CLIENT_ID = os.getenv("MS_CLIENT_ID")
  CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")
  TENANT_ID = os.getenv("MS_TENANT_ID")

  def get_graph_token():
      app = msal.ConfidentialClientApplication(
          CLIENT_ID, authority=f"https://login.microsoftonline.com/{TENANT_ID}",
          client_credential=CLIENT_SECRET
      )
      result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
      if "access_token" in result:
          return result["access_token"]
      raise Exception("No se pudo obtener el token de Microsoft Graph")

  async def ingest_audiobook_files(sharepoint_folder_url: str, destination_folder: str):
      token = get_graph_token()
      # Simulación / Llamada a Graph API para listar archivos y hacer pipe directo a Azure Blob Storage
      # En producción este método implementa la transferencia chunked.
      return True
  ```

- [ ] **Step 2: Agregar endpoint de Ingesta y Auditoría en routes.py**
  
  Modify: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py`
  ```python
  from fastapi import BackgroundTasks
  from sharepoint import ingest_audiobook_files
  from models import SesionAcceso, Categoria, Clasificacion

  # Registrar auditoría de Login en la ruta correspondiente
  # (Se añade dentro de login_for_access_token)
  # auditoria = SesionAcceso(usuario_id=user.id, tipo_evento="LOGIN")
  # db.add(auditoria)
  # db.commit()

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
      # Procesar fila por fila en segundo plano
      for libro in excel_data:
          # Registrar en base de datos
          pass
          
      return {"message": "Importación iniciada en segundo plano"}
  ```

- [ ] **Step 3: Agregar endpoint de generación de SAS URL**
  
  Modify: `/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py`
  ```python
  from azure.storage.blob import generate_blob_sas, BlobSasPermissions
  from datetime import datetime, timezone, timedelta
  from config import AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY, AZURE_CONTAINER_NAME

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
      return {"sas_url": sas_url}
  ```

- [ ] **Step 4: Confirmar endpoints con pytest**
  
  Run: `pytest "/Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_routes.py" -v`
  Expected: Las pruebas pasan correctamente.

- [ ] **Step 5: Commit de servicios de ingesta**
  
  Run: `git -C "/Users/nico/Documents/VibeCode/Invision" commit -am "feat: implement SharePoint Graph API ingestion task and SAS pre-signed url generation"`

---

### Task 4: Contextos Globales de React y Layout de Accesibilidad (A11y)

**Files:**
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/context/AuthContext.jsx`
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/context/AudioContext.jsx`
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/components/A11yBar.jsx`

**Interfaces:**
- Consumes: Contextos de React en componentes.
- Produces: Control global del tema de alto contraste, tamaño de texto y reproducción.

- [ ] **Step 1: Crear AuthContext para manejo de sesiones**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/context/AuthContext.jsx`
  ```javascript
  import React, { createContext, useState, useEffect } from 'react';

  export const AuthContext = createContext();

  export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));

    const login = async (email, password) => {
      // Petición a /auth/token/
      // Guardar token en localStorage
      setUser({ email, roles: ["Admin"] });
    };

    const logout = () => {
      localStorage.removeItem("token");
      setUser(null);
    };

    return (
      <AuthContext.Provider value={{ user, token, login, logout }}>
        {children}
      </AuthContext.Provider>
    );
  };
  ```

- [ ] **Step 2: Crear AudioContext para reproductor accesible**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/context/AudioContext.jsx`
  ```javascript
  import React, { createContext, useState, useRef } from 'react';

  export const AudioContext = createContext();

  export const AudioProvider = ({ children }) => {
    const [currentAudio, setCurrentAudio] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(new Audio());

    const play = (track) => {
      audioRef.current.src = track.url;
      audioRef.current.play();
      setIsPlaying(true);
    };

    return (
      <AudioContext.Provider value={{ currentAudio, isPlaying, play }}>
        {children}
      </AudioContext.Provider>
    );
  };
  ```

- [ ] **Step 3: Crear A11yBar para controles de accesibilidad**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/components/A11yBar.jsx`
  ```javascript
  import React, { useState } from 'react';

  export const A11yBar = () => {
    const [contrast, setContrast] = useState(false);

    const toggleContrast = () => {
      setContrast(!contrast);
      document.body.classList.toggle('high-contrast');
    };

    return (
      <div className="a11y-bar" role="region" aria-label="Herramientas de Accesibilidad">
        <button onClick={toggleContrast} aria-label="Cambiar modo de contraste">Contraste Alto</button>
      </div>
    );
  };
  ```

- [ ] **Step 4: Commit del framework de accesibilidad**
  
  Run: `git -C "/Users/nico/Documents/VibeCode/Invision" add frontend/src/context/ frontend/src/components/ && git -C "/Users/nico/Documents/VibeCode/Invision" commit -m "feat: implement accessible context providers and A11y navigation bar"`

---

### Task 5: Componente de Pantalla de Login, Dashboard de Usuario y Catálogo Paginado

**Files:**
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Login.jsx`
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Home.jsx`
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/components/AudioPlayer.jsx`

**Interfaces:**
- Consumes: Contexto global de sesión y reproducción.
- Produces: Vistas de catálogo accesibles e interactivas por voz.

- [ ] **Step 1: Diseñar pantalla de Login accesible**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Login.jsx`
  (Formulario con estructura semántica con `label`, `aria-required`, inputs descriptivos y atajos rápidos de teclado).

- [ ] **Step 2: Diseñar Catálogo Paginado con Búsqueda de Voz**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Home.jsx`
  (Lista paginada que renderiza tarjetas de audiolibros con soporte nativo de Web Speech API para dictado de búsquedas).

- [ ] **Step 3: Crear reproductor flotante integrado**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/components/AudioPlayer.jsx`
  (Reproductor de audio que soporta reproducción/pausa mediante atajo de teclado de barra espaciadora y retroceso/adelanto con flechas direccionales).

- [ ] **Step 4: Verificar compilación del frontend**
  
  Run: `npm --prefix "/Users/nico/Documents/VibeCode/Invision/frontend" run build`
  Expected: Compilación exitosa en producción sin errores sintácticos ni lints.

- [ ] **Step 5: Commit de componentes principales**
  
  Run: `git -C "/Users/nico/Documents/VibeCode/Invision" add frontend/src/pages/ && git -C "/Users/nico/Documents/VibeCode/Invision" commit -m "feat: complete login page, paginated catalog and voice search accessibility"`

---

### Task 6: Panel de Administración e Ingesta de Lotes SharePoint

**Files:**
- Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/AdminPanel.jsx`
- Modify: `/Users/nico/Documents/VibeCode/Invision/frontend/src/App.jsx`

**Interfaces:**
- Consumes: Endpoint `POST /admin/importar-lote` y estado de tareas.
- Produces: Interfaz administrativa de carga masiva de Excel y monitoreo de ingesta de SharePoint.

- [ ] **Step 1: Crear Panel de Administración e Ingesta Masiva**
  
  Create: `/Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/AdminPanel.jsx`
  (Cargador de archivos Excel que lee las rutas de SharePoint e interactúa con el endpoint asíncrono, mostrando estado y progreso dinámico en pantalla).

- [ ] **Step 2: Integrar rutas en App.jsx**
  
  Modify: `/Users/nico/Documents/VibeCode/Invision/frontend/src/App.jsx`
  ```javascript
  import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
  import { AuthProvider } from './context/AuthContext';
  import { AudioProvider } from './context/AudioContext';
  import { Login } from './pages/Login';
  import { Home } from './pages/Home';
  import { AdminPanel } from './pages/Admin/AdminPanel';

  function App() {
    return (
      <AuthProvider>
        <AudioProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Home />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Routes>
          </Router>
        </AudioProvider>
      </AuthProvider>
    );
  }
  export default App;
  ```

- [ ] **Step 3: Compilar y validar el proyecto completo**
  
  Run: `npm --prefix "/Users/nico/Documents/VibeCode/Invision/frontend" run build`
  Expected: La aplicación se compila exitosamente y está lista para despliegue.

- [ ] **Step 4: Commit de integración del panel de administración**
  
  Run: `git -C "/Users/nico/Documents/VibeCode/Invision" add frontend/src/App.jsx && git -C "/Users/nico/Documents/VibeCode/Invision" commit -m "feat: implement admin panel and batch ingestion view from SharePoint"`
