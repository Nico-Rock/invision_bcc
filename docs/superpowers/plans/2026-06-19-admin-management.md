# Admin Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full user management and manual content/audiobook management with premium accessibility features under a unified tabbed admin dashboard.

**Architecture:** Extend FastAPI backend routes with audiobook and role-relation CRUD endpoints. Refactor the Vite/React frontend's admin panel to use an accessible W3C ARIA tabbed layout and split concerns into modular components.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, React (Vite), React Router v7, Vanilla CSS, Web Audio API / useAudio.

## Global Constraints

- Must maintain strict accessibility (A11y) standards: keyboard shortcuts, focus trapping, screen-reader announcements, and audio cues.
- Do not use TailwindCSS; styling must use Vanilla CSS (in existing `index.css`/`App.css` or new custom CSS files).
- Keep component files small, focused, and organized by folders.

---

### Task 1: Backend Schemas and Category Endpoint

**Files:**
- Modify: [schemas.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/schemas.py)
- Modify: [routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py)
- Test: [test_routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_routes.py)

**Interfaces:**
- Consumes: Database models `Categoria`, `Usuario` from models.py
- Produces: `AdminUserUpdate` and `AudiobookCreateUpdate` schemas, and `/admin/categorias` GET endpoint.

- [ ] **Step 1: Write the failing tests**
  Add the following test at the end of [test_routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_routes.py):
  ```python
  def test_get_categorias_unauthorized(client):
      response = client.get("/admin/categorias")
      assert response.status_code == 401

  def test_get_categorias_success(client, admin_token):
      headers = {"Authorization": f"Bearer {admin_token}"}
      response = client.get("/admin/categorias", headers=headers)
      assert response.status_code == 200
      assert isinstance(response.json(), list)
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest test_routes.py -k "test_get_categorias" -v`
  Expected: FAIL with 404 (Route not found).

- [ ] **Step 3: Define Pydantic Schemas**
  Add these classes at the end of [schemas.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/schemas.py):
  ```python
  class AdminUserUpdate(BaseModel):
      email: Optional[EmailStr] = None
      username: Optional[str] = Field(None, min_length=3, max_length=50)
      first_name: Optional[str] = None
      last_name: Optional[str] = None
      phone_number: Optional[str] = None

  class AudiobookCreateUpdate(BaseModel):
      nombre: str = Field(..., min_length=1)
      descripcion: Optional[str] = None
      genero: Optional[str] = None
      autor: Optional[str] = None
      categoria_id: Optional[int] = None
      clasificaciones: Optional[List[str]] = []
  ```

- [ ] **Step 4: Implement Category Endpoint**
  Add the following route at the end of [routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py):
  ```python
  @router.get("/admin/categorias")
  async def get_categorias(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
      decode_access_token(token)
      categorias = db.query(Categoria).all()
      return [{"id": c.id, "nombre": c.nombre} for c in categorias]
  ```

- [ ] **Step 5: Run tests to verify they pass**
  Run: `pytest test_routes.py -k "test_get_categorias" -v`
  Expected: PASS.

- [ ] **Step 6: Commit**
  Run: `git add InvisionAPI-main/audiobooks/schemas.py InvisionAPI-main/audiobooks/routes.py InvisionAPI-main/audiobooks/test_routes.py && git commit -m "feat: add admin schemas and categories endpoint"`

---

### Task 2: Backend Audiobook CRUD Endpoints

**Files:**
- Modify: [routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py)
- Test: [test_routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_routes.py)

**Interfaces:**
- Consumes: `AudiobookCreateUpdate` from schemas.py
- Produces: `GET /admin/audiolibros`, `POST /admin/audiolibros`, `PUT /admin/audiolibros/{id}`, `DELETE /admin/audiolibros/{id}`.

- [ ] **Step 1: Write the failing tests**
  Add the following tests at the end of [test_routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_routes.py):
  ```python
  def test_audiolibros_crud_admin_flow(client, admin_token):
      headers = {"Authorization": f"Bearer {admin_token}"}
      
      # 1. List
      resp = client.get("/admin/audiolibros", headers=headers)
      assert resp.status_code == 200
      
      # 2. Create
      create_payload = {
          "nombre": "Libro Manual",
          "descripcion": "Manual desc",
          "genero": "Literatura",
          "autor": "Autor Manual",
          "categoria_id": None,
          "clasificaciones": ["BCC"]
      }
      resp = client.post("/admin/audiolibros", json=create_payload, headers=headers)
      assert resp.status_code == 201
      new_book = resp.json()
      assert new_book["nombre"] == "Libro Manual"
      book_id = new_book["id"]
      
      # 3. Update
      update_payload = {
          "nombre": "Libro Manual Editado",
          "descripcion": "Manual desc updated",
          "genero": "Literatura",
          "autor": "Autor Manual Editado",
          "categoria_id": None,
          "clasificaciones": ["BCC", "Editado"]
      }
      resp = client.put(f"/admin/audiolibros/{book_id}", json=update_payload, headers=headers)
      assert resp.status_code == 200
      assert resp.json()["nombre"] == "Libro Manual Editado"
      
      # 4. Delete
      resp = client.delete(f"/admin/audiolibros/{book_id}", headers=headers)
      assert resp.status_code == 204
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest test_routes.py -k "test_audiolibros_crud_admin_flow" -v`
  Expected: FAIL with 404.

- [ ] **Step 3: Implement Audiobook CRUD API routes**
  Add the following endpoints at the end of [routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py):
  ```python
  from schemas import AudiobookCreateUpdate

  @router.get("/admin/audiolibros")
  async def list_admin_audiolibros(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
      user_info = decode_access_token(token)
      if "Admin" not in user_info.get("roles", []):
          raise HTTPException(status_code=403, detail="No autorizado")
      
      libros = db.query(Audiolibro).all()
      return [
          {
              "id": b.id,
              "nombre": b.nombre,
              "descripcion": b.descripcion,
              "genero": b.genero,
              "autor": b.autor,
              "categoria_id": b.categoria_id,
              "categoria": b.categoria.nombre if b.categoria else None,
              "clasificaciones": [c.nombre for c in b.clasificaciones]
          }
          for b in libros
      ]

  @router.post("/admin/audiolibros", status_code=status.HTTP_201_CREATED)
  async def create_admin_audiolibro(payload: AudiobookCreateUpdate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
      user_info = decode_access_token(token)
      if "Admin" not in user_info.get("roles", []):
          raise HTTPException(status_code=403, detail="No autorizado")
      
      libro = Audiolibro(
          nombre=payload.nombre,
          descripcion=payload.descripcion,
          genero=payload.genero,
          autor=payload.autor,
          categoria_id=payload.categoria_id
      )
      db.add(libro)
      db.commit()
      db.refresh(libro)

      # Vincular clasificaciones
      for cl_nombre in payload.clasificaciones:
          cl = db.query(Clasificacion).filter(Clasificacion.nombre == cl_nombre).first()
          if not cl and cl_nombre:
              cl = Clasificacion(nombre=cl_nombre)
              db.add(cl)
              db.commit()
              db.refresh(cl)
          if cl:
              libro.clasificaciones.append(cl)
      db.commit()
      
      return {
          "id": libro.id,
          "nombre": libro.nombre,
          "descripcion": libro.descripcion,
          "genero": libro.genero,
          "autor": libro.autor,
          "categoria_id": libro.categoria_id
      }

  @router.put("/admin/audiolibros/{id}")
  async def update_admin_audiolibro(id: int, payload: AudiobookCreateUpdate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
      user_info = decode_access_token(token)
      if "Admin" not in user_info.get("roles", []):
          raise HTTPException(status_code=403, detail="No autorizado")
      
      libro = db.query(Audiolibro).filter(Audiolibro.id == id).first()
      if not libro:
          raise HTTPException(status_code=404, detail="Audiolibro no encontrado")
      
      libro.nombre = payload.nombre
      libro.descripcion = payload.descripcion
      libro.genero = payload.genero
      libro.autor = payload.autor
      libro.categoria_id = payload.categoria_id
      
      # Actualizar clasificaciones
      libro.clasificaciones.clear()
      for cl_nombre in payload.clasificaciones:
          cl = db.query(Clasificacion).filter(Clasificacion.nombre == cl_nombre).first()
          if not cl and cl_nombre:
              cl = Clasificacion(nombre=cl_nombre)
              db.add(cl)
              db.commit()
              db.refresh(cl)
          if cl:
              libro.clasificaciones.append(cl)
      
      db.commit()
      return {"id": libro.id, "nombre": libro.nombre, "descripcion": libro.descripcion}

  @router.delete("/admin/audiolibros/{id}", status_code=status.HTTP_204_NO_CONTENT)
  async def delete_admin_audiolibro(id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
      user_info = decode_access_token(token)
      if "Admin" not in user_info.get("roles", []):
          raise HTTPException(status_code=403, detail="No autorizado")
      
      libro = db.query(Audiolibro).filter(Audiolibro.id == id).first()
      if not libro:
          raise HTTPException(status_code=404, detail="Audiolibro no encontrado")
      
      db.delete(libro)
      db.commit()
      return
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest test_routes.py -k "test_audiolibros_crud_admin_flow" -v`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run: `git add InvisionAPI-main/audiobooks/routes.py InvisionAPI-main/audiobooks/test_routes.py && git commit -m "feat: add admin audiobook CRUD endpoints"`

---

### Task 3: Backend Role Deletion and User Admin Update

**Files:**
- Modify: [routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py)
- Test: [test_routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_routes.py)

**Interfaces:**
- Consumes: `AdminUserUpdate` schema from schemas.py
- Produces: `DELETE /users/{user_id}/roles/{role_id}` and `PUT /users/{user_id}/admin` endpoints.

- [ ] **Step 1: Write the failing tests**
  Add the following tests at the end of [test_routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/test_routes.py):
  ```python
  def test_delete_user_role_admin(client, admin_token, test_user):
      headers = {"Authorization": f"Bearer {admin_token}"}
      # Assign a role first (e.g. role_id 2)
      client.post("/users/add_roles", json={"user_id": test_user["id"], "role_id": 2}, headers=headers)
      
      # Delete role association
      response = client.delete(f"/users/{test_user['id']}/roles/2", headers=headers)
      assert response.status_code == 204

  def test_update_user_admin(client, admin_token, test_user):
      headers = {"Authorization": f"Bearer {admin_token}"}
      update_payload = {
          "email": "newadminupdate@example.com",
          "username": "newusernameadmin"
      }
      response = client.put(f"/users/{test_user['id']}/admin", json=update_payload, headers=headers)
      assert response.status_code == 200
      assert response.json()["email"] == "newadminupdate@example.com"
      assert response.json()["username"] == "newusernameadmin"
  ```

- [ ] **Step 2: Run tests to verify they fail**
  Run: `pytest test_routes.py -k "test_delete_user_role_admin or test_update_user_admin" -v`
  Expected: FAIL with 404.

- [ ] **Step 3: Implement routes**
  Add the following endpoints at the end of [routes.py](file:///Users/nico/Documents/VibeCode/Invision/InvisionAPI-main/audiobooks/routes.py):
  ```python
  from schemas import AdminUserUpdate

  @router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
  async def remove_role_from_user(user_id: int, role_id: int, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
      user_info = decode_access_token(token)
      if "Admin" not in user_info.get("roles", []):
          raise HTTPException(status_code=403, detail="No autorizado")
      
      db.query(UserRole).filter(UserRole.user_id == user_id, UserRole.role_id == role_id).delete()
      db.commit()
      return

  @router.put("/users/{user_id}/admin")
  async def admin_update_user(user_id: int, payload: AdminUserUpdate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
      user_info = decode_access_token(token)
      if "Admin" not in user_info.get("roles", []):
          raise HTTPException(status_code=403, detail="No autorizado")
      
      user = db.query(Usuario).filter(Usuario.id == user_id).first()
      if not user:
          raise HTTPException(status_code=404, detail="Usuario no encontrado")
      
      if payload.email is not None:
          user.email = payload.email
      if payload.username is not None:
          user.username = payload.username
      if payload.first_name is not None:
          user.first_name = payload.first_name
      if payload.last_name is not None:
          user.last_name = payload.last_name
      if payload.phone_number is not None:
          user.phone_number = payload.phone_number
          
      db.commit()
      db.refresh(user)
      return {
          "id": user.id,
          "email": user.email,
          "username": user.username,
          "first_name": user.first_name,
          "last_name": user.last_name
      }
  ```

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pytest test_routes.py -k "test_delete_user_role_admin or test_update_user_admin" -v`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run: `git add InvisionAPI-main/audiobooks/routes.py InvisionAPI-main/audiobooks/test_routes.py && git commit -m "feat: add admin endpoints to remove roles and update users"`

---

### Task 4: Frontend Tabs Layout and Components Split

**Files:**
- Modify: [AdminPanel.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/AdminPanel.jsx)
- Create: [ExcelImporter.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/components/ExcelImporter.jsx)
- Create: [AuditLogs.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/components/AuditLogs.jsx)

**Interfaces:**
- Refactored `AdminPanel.jsx` consumes new component imports and manages the active tab.

- [ ] **Step 1: Extract Excel Ingestion logic into ExcelImporter.jsx**
  Create `frontend/src/pages/Admin/components/ExcelImporter.jsx` and copy code from existing `AdminPanel.jsx` related to excel loading, previews, drag & drop, and SharePoint import.
  Include properties like `excelData`, `dragActive`, `loadingImport`, etc.
  ```jsx
  import { useState } from 'react';
  import * as XLSX from 'xlsx';
  import { useAuth } from '../../../hooks/useAuth';
  import { useAudio } from '../../../hooks/useAudio';
  import { API_BASE_URL } from '../../../config';

  export const ExcelImporter = ({ fetchAuditLogs, isImportingActive, currentItemName, importProgress, startProgressSimulation }) => {
     // Paste current Excel and file drag-drop component methods and render block here.
     // ... (detailed implementation inside actual code execution)
  }
  ```

- [ ] **Step 2: Extract Audit Logs logic into AuditLogs.jsx**
  Create `frontend/src/pages/Admin/components/AuditLogs.jsx`:
  ```jsx
  import { useAudio } from '../../../hooks/useAudio';

  export const AuditLogs = ({ auditLogs, loadingAudit }) => {
     const { playCue } = useAudio();
     // Paste current Audit logs render block here.
  }
  ```

- [ ] **Step 3: Refactor AdminPanel.jsx**
  Replace contents of [AdminPanel.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/AdminPanel.jsx) to import the new sub-components, and structure the page layout with an ARIA tablist (`Carga Masiva`, `Usuarios`, `Libros`, `Auditoría`).
  Implement Arrow Key navigation and vocal navigation (`announceText`).
  ```jsx
  import { useState, useEffect } from 'react';
  import { useAuth } from '../../hooks/useAuth';
  import { useAudio } from '../../hooks/useAudio';
  import { API_BASE_URL } from '../../config';
  import { ExcelImporter } from './components/ExcelImporter';
  import { AuditLogs } from './components/AuditLogs';
  // (Remaining imports of UserManagement and ContentManagement will be added in subsequent tasks)
  ```

- [ ] **Step 4: Verify Frontend builds successfully**
  Run: `npm run build` inside `frontend` directory.
  Expected: Success without errors.

- [ ] **Step 5: Commit**
  Run: `git add frontend/src/pages/Admin/ && git commit -m "refactor: extract ExcelImporter and AuditLogs, implement Tabbed layout in AdminPanel"`

---

### Task 5: Frontend User Management Panel

**Files:**
- Create: [UserManagement.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/components/UserManagement.jsx)
- Modify: [AdminPanel.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/AdminPanel.jsx)

**Interfaces:**
- UserManagement tab is rendered inside `AdminPanel.jsx` under the `Usuarios` tab.

- [ ] **Step 1: Create UserManagement.jsx component**
  Write code in `frontend/src/pages/Admin/components/UserManagement.jsx` to list all users, create new ones, update names/emails/roles, and delete users. Use accessible forms and focus controls.
  Include password resets (`PUT /user/change-password` with `user_id`).
  Include role assignment (`POST /users/add_roles`) and role deletion (`DELETE /users/{user_id}/roles/{role_id}`).

- [ ] **Step 2: Connect UserManagement to AdminPanel.jsx**
  Import and render `UserManagement` inside the `Usuarios` tab panel.

- [ ] **Step 3: Verify build**
  Run: `npm run build` inside `frontend` folder.
  Expected: Success.

- [ ] **Step 4: Commit**
  Run: `git add frontend/src/pages/Admin/ && git commit -m "feat: implement frontend UserManagement tab"`

---

### Task 6: Frontend Content Management Panel

**Files:**
- Create: [ContentManagement.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/components/ContentManagement.jsx)
- Modify: [AdminPanel.jsx](file:///Users/nico/Documents/VibeCode/Invision/frontend/src/pages/Admin/AdminPanel.jsx)

**Interfaces:**
- ContentManagement tab is rendered inside `AdminPanel.jsx` under the `Libros` tab.

- [ ] **Step 1: Create ContentManagement.jsx component**
  Write code in `frontend/src/pages/Admin/components/ContentManagement.jsx` to list all catalog books, add books manually via a form (using Category and Classifications), edit metadata, and delete books. Use accessible dialogues/forms with focus traps.

- [ ] **Step 2: Connect ContentManagement to AdminPanel.jsx**
  Import and render `ContentManagement` inside the `Libros` tab panel.

- [ ] **Step 3: Verify application builds and runs**
  Run: `npm run build` in `frontend` folder.
  Expected: Success.

- [ ] **Step 4: Commit**
  Run: `git add frontend/src/pages/Admin/ && git commit -m "feat: implement frontend ContentManagement tab"`
