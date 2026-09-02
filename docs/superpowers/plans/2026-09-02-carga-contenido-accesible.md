# Carga de Contenido Accesible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`) para tracking.

**Goal:** Permitir que el administrador de la biblioteca (no vidente) cree un audiolibro y suba sus pistas de audio desde `admin-dashboard`, de forma operable sin mirar la pantalla.

**Architecture:** El servidor Python actúa de intermediario: recibe el MP3 del navegador y lo streamea a Azure Blob Storage, e inserta la fila en la base — en la misma operación. La lógica de escritura se extrae a funciones puras e inyectables (fuera del handler HTTP) para poder testearla sin servidor, sin Azure y sin tocar producción.

**Tech Stack:** Python 3.13 `http.server` (stdlib), `azure-storage-blob`, `pymssql`/`sqlite3`, HTML/JS vanilla (sin build step), Web Audio API, Web Speech API.

**Diseño de referencia:** [2026-09-02-carga-contenido-accesible-design.md](../specs/2026-09-02-carga-contenido-accesible-design.md) · **Módulo:** [12-admin-dashboard.md](../../specs/12-admin-dashboard.md)

---

## Global Constraints

**⚠️ CERO ESCRITURA EN PRODUCCIÓN DURANTE EL DESARROLLO.** El panel se conecta por defecto a la cuenta real de Azure Blob y a Azure SQL de producción. El mandato de gobernanza del propio panel dice: *"Ningún cambio a bases de datos o código en producción sin validación formal previa del equipo BCC."* Por lo tanto:
- Los tests **NUNCA** instancian un `BlobServiceClient` real ni se conectan a Azure SQL. Usan un contenedor falso en memoria y SQLite temporal.
- La verificación manual (Task 9) usa un libro de prueba con nombre marcado y se limpia al final.

**Intérprete de Python:** usar `/usr/local/bin/python3` (3.13.7) — es el único que tiene `azure-storage-blob`, `pymssql`, `pytest` y `dotenv`. **El `.venv/` del proyecto está vacío** (solo binarios, sin paquetes); si se activa, todo falla con `ModuleNotFoundError`. Los comandos de este plan usan la ruta absoluta a propósito.

**Sin build step:** `admin-dashboard/` es HTML/JS vanilla servido tal cual. No hay `npm run build` que valide nada — la verificación del frontend es sintáctica (`node --check`) + manual en navegador.

**Estilo:** todos los mensajes de usuario en español, y son los que se van a escuchar por voz. Escribirlos como se leen en voz alta (sin comillas, sin rutas, sin códigos de error crudos).

---

## Task 0: Rama y baseline

**Files:**
- Commit: `admin-dashboard/` (hoy untracked)

- [ ] **Step 1: Crear rama de trabajo**
  El repo está en `main`. No trabajar directo sobre `main`.
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision && git checkout -b feat/carga-contenido-accesible`

- [ ] **Step 2: Commitear el dashboard actual como baseline**
  `admin-dashboard/` está sin trackear. Commitearlo **antes** de modificarlo, así el diff de las tareas siguientes muestra solo el trabajo nuevo.
  Run: `git add admin-dashboard/ docs/specs/12-admin-dashboard.md docs/specs/00-overview.md docs/superpowers/specs/2026-09-02-carga-contenido-accesible-design.md docs/superpowers/plans/2026-09-02-carga-contenido-accesible.md`
  Run: `git commit -m "chore: track admin-dashboard baseline y specs de carga de contenido"`

  **NO** agregar `Catalogo digital Audioteca 2025(disponibles).csv` (queda untracked, es data fuente).

---

## Task 1: Harness de tests + `crear_libro` con detección de duplicados

**Files:**
- Create: `admin-dashboard/conftest.py`
- Create: `admin-dashboard/test_server.py`
- Modify: `admin-dashboard/server.py`

**Interfaces:**
- Produce: `crear_libro(payload: dict, db_info: dict) -> tuple[int, dict]` — función pura, sin HTTP, sin red.
- Consume: el `db_info` con forma `{"type": "sqlite"|"azure_sql", "conn": conn}` que ya devuelve `get_db_connection()`.

**Contexto para quien implementa:** `server.py` hoy tiene toda la lógica dentro del handler HTTP, lo que la hace imposible de testear. Extraemos la lógica de escritura a funciones que reciben sus dependencias por parámetro (el handler las va a llamar en Task 3). El esquema real de la tabla es `audiolibros(id, nombre, descripcion, genero, autor, categoria_id)` — ver `InvisionAPI-main/audiobooks/models.py`.

- [ ] **Step 1: Crear el conftest con fixtures locales**
  Crear `admin-dashboard/conftest.py`:
  ```python
  """Fixtures para los tests del admin-dashboard.

  Nada acá toca Azure ni Azure SQL: contenedor falso en memoria y SQLite temporal.
  """
  import sqlite3
  import pytest


  class FakeBlobClient:
      def __init__(self, store, name):
          self.store = store
          self.name = name

      def exists(self):
          return self.name in self.store

      def upload_blob(self, data, overwrite=False, content_type=None, length=None):
          if self.name in self.store and not overwrite:
              raise FileExistsError(self.name)
          contenido = data.read() if hasattr(data, "read") else data
          self.store[self.name] = {
              "content": contenido,
              "content_type": content_type,
              "length": length,
          }


  class FakeContainer:
      """Reemplaza al ContainerClient de Azure. `store` es el estado inspeccionable."""

      def __init__(self):
          self.store = {}

      def get_blob_client(self, name):
          return FakeBlobClient(self.store, name)


  @pytest.fixture
  def container():
      return FakeContainer()


  @pytest.fixture
  def db_info(tmp_path):
      """SQLite temporal con el mismo esquema que la tabla real de audiolibros."""
      conn = sqlite3.connect(tmp_path / "test.db")
      conn.row_factory = sqlite3.Row
      conn.execute(
          """
          CREATE TABLE audiolibros (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nombre TEXT NOT NULL,
              descripcion TEXT,
              genero TEXT,
              autor TEXT,
              categoria_id INTEGER
          )
          """
      )
      conn.commit()
      yield {"type": "sqlite", "conn": conn}
      conn.close()
  ```

- [ ] **Step 2: Escribir los tests que fallan**
  Crear `admin-dashboard/test_server.py`:
  ```python
  import server


  def test_crear_libro_exitoso(db_info):
      status, data = server.crear_libro({"nombre": "Libro Nuevo", "autor": "Autora"}, db_info)
      assert status == 201
      assert data["ok"] is True
      assert isinstance(data["id"], int)
      assert "Libro Nuevo" in data["mensaje"]

      fila = db_info["conn"].execute("SELECT nombre, autor FROM audiolibros").fetchone()
      assert fila["nombre"] == "Libro Nuevo"
      assert fila["autor"] == "Autora"


  def test_crear_libro_rechaza_nombre_vacio(db_info):
      status, data = server.crear_libro({"nombre": "   "}, db_info)
      assert status == 400
      assert data["ok"] is False
      assert db_info["conn"].execute("SELECT COUNT(*) FROM audiolibros").fetchone()[0] == 0


  def test_crear_libro_detecta_duplicado_ignorando_mayusculas(db_info):
      server.crear_libro({"nombre": "Actos Humanos"}, db_info)
      status, data = server.crear_libro({"nombre": "actos humanos"}, db_info)
      assert status == 409
      assert data["ok"] is False
      assert "ya existe" in data["mensaje"].lower()
      # No debe haber insertado una segunda fila
      assert db_info["conn"].execute("SELECT COUNT(*) FROM audiolibros").fetchone()[0] == 1
  ```

- [ ] **Step 3: Correr los tests para verificar que fallan**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && /usr/local/bin/python3 -m pytest test_server.py -v`
  Expected: FAIL con `AttributeError: module 'server' has no attribute 'crear_libro'`.

- [ ] **Step 4: Implementar `crear_libro`**
  Agregar en `admin-dashboard/server.py`, después de `generate_audio_sas_url()` y antes de `class AdminApiHandler`:
  ```python
  def crear_libro(payload, db_info):
      """Crea un audiolibro en la base. Devuelve (status_code, dict).

      El campo `mensaje` es el texto que el frontend anuncia por voz: escribirlo
      como se lee en voz alta.
      """
      nombre = (payload.get("nombre") or "").strip()
      if not nombre:
          return 400, {"ok": False, "mensaje": "El nombre del libro es obligatorio"}

      conn = db_info["conn"]
      es_sqlite = db_info["type"] == "sqlite"
      ph = "?" if es_sqlite else "%s"  # sqlite3 usa ?, pymssql usa %s
      cursor = conn.cursor()

      cursor.execute(
          f"SELECT id FROM audiolibros WHERE LOWER(nombre) = LOWER({ph})", (nombre,)
      )
      if cursor.fetchone():
          return 409, {
              "ok": False,
              "mensaje": f"Ya existe un libro llamado {nombre}. Revisá el catálogo.",
          }

      cursor.execute(
          f"INSERT INTO audiolibros (nombre, descripcion, genero, autor, categoria_id) "
          f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph})",
          (
              nombre,
              payload.get("descripcion"),
              payload.get("genero"),
              payload.get("autor"),
              payload.get("categoria_id"),
          ),
      )

      if es_sqlite:
          nuevo_id = cursor.lastrowid
      else:
          cursor.execute("SELECT SCOPE_IDENTITY()")
          nuevo_id = int(cursor.fetchone()[0])

      conn.commit()
      return 201, {
          "ok": True,
          "id": nuevo_id,
          "nombre": nombre,
          "mensaje": f"Libro {nombre} creado. Ahora seleccioná los archivos de audio.",
      }
  ```

- [ ] **Step 5: Correr los tests para verificar que pasan**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && /usr/local/bin/python3 -m pytest test_server.py -v`
  Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**
  Run: `git add admin-dashboard/conftest.py admin-dashboard/test_server.py admin-dashboard/server.py && git commit -m "feat(admin-dashboard): crear_libro con deteccion de duplicados + harness de tests"`

---

## Task 2: `subir_pista` — streaming a Blob, validaciones y skip de existentes

**Files:**
- Modify: `admin-dashboard/server.py`
- Modify: `admin-dashboard/test_server.py`

**Interfaces:**
- Produce: `subir_pista(nombre, archivo, stream, length, container) -> tuple[int, dict]`
- Convención de blob: `{nombre}/{archivo}` — **debe matchear exactamente** el `nombre` de la fila en `audiolibros`, igual que hace `_ops_upload/upload_books.py`.

**Contexto:** no existe tabla de capítulos; el orden de reproducción sale de ordenar los blobs por nombre de archivo. `overwrite=False` es deliberado: nunca pisar audio ya subido.

- [ ] **Step 1: Escribir los tests que fallan**
  Agregar al final de `admin-dashboard/test_server.py`:
  ```python
  import io


  def test_subir_pista_exitosa(container):
      status, data = server.subir_pista(
          "Actos Humanos", "01.mp3", io.BytesIO(b"audio-falso"), 11, container
      )
      assert status == 201
      assert data["ok"] is True
      assert data["skipped"] is False
      assert container.store["Actos Humanos/01.mp3"]["content"] == b"audio-falso"
      assert container.store["Actos Humanos/01.mp3"]["content_type"] == "audio/mpeg"


  def test_subir_pista_saltea_si_ya_existe(container):
      server.subir_pista("Libro", "01.mp3", io.BytesIO(b"original"), 8, container)
      status, data = server.subir_pista(
          "Libro", "01.mp3", io.BytesIO(b"reemplazo"), 9, container
      )
      assert status == 200
      assert data["skipped"] is True
      # El audio original NO se pisó
      assert container.store["Libro/01.mp3"]["content"] == b"original"


  def test_subir_pista_rechaza_extension_invalida(container):
      status, data = server.subir_pista(
          "Libro", "notas.txt", io.BytesIO(b"x"), 1, container
      )
      assert status == 400
      assert "MP3" in data["mensaje"]
      assert container.store == {}  # no tocó el storage


  def test_subir_pista_rechaza_archivo_vacio(container):
      status, data = server.subir_pista("Libro", "01.mp3", io.BytesIO(b""), 0, container)
      assert status == 400
      assert container.store == {}


  def test_subir_pista_rechaza_path_traversal(container):
      for nombre, archivo in [
          ("Libro", "../../etc/passwd.mp3"),
          ("../secreto", "01.mp3"),
          ("Libro", "sub/carpeta.mp3"),
      ]:
          status, data = server.subir_pista(
              nombre, archivo, io.BytesIO(b"x"), 1, container
          )
          assert status == 400, f"deberia rechazar {nombre}/{archivo}"
      assert container.store == {}


  def test_subir_pista_informa_error_de_azure(container):
      class ContainerRoto:
          def get_blob_client(self, name):
              class C:
                  def exists(self):
                      return False

                  def upload_blob(self, *a, **k):
                      raise RuntimeError("network down")

              return C()

      status, data = server.subir_pista(
          "Libro", "01.mp3", io.BytesIO(b"x"), 1, ContainerRoto()
      )
      assert status == 500
      assert data["ok"] is False
      assert "01.mp3" in data["mensaje"]
  ```

- [ ] **Step 2: Correr los tests para verificar que fallan**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && /usr/local/bin/python3 -m pytest test_server.py -k subir_pista -v`
  Expected: FAIL con `AttributeError: module 'server' has no attribute 'subir_pista'`.

- [ ] **Step 3: Implementar `subir_pista`**
  Agregar en `admin-dashboard/server.py`, después de `crear_libro`:
  ```python
  MAX_PISTA_BYTES = 500 * 1024 * 1024  # 500 MB, tope defensivo por archivo


  def _nombre_seguro(valor):
      """Rechaza valores que puedan escapar del prefijo del blob."""
      return bool(valor) and not any(c in valor for c in ("/", "\\", "..", "\x00"))


  def subir_pista(nombre, archivo, stream, length, container):
      """Sube una pista a Azure Blob como {nombre}/{archivo}. Devuelve (status, dict).

      No pisa audio existente (overwrite=False): si el blob ya está, lo saltea.
      El stream se pasa tal cual al SDK -> no se carga el MP3 entero en memoria.
      """
      nombre = (nombre or "").strip()
      archivo = (archivo or "").strip()

      if not nombre or not archivo:
          return 400, {"ok": False, "mensaje": "Faltan datos del libro o del archivo"}
      if not _nombre_seguro(nombre) or not _nombre_seguro(archivo):
          return 400, {"ok": False, "mensaje": "El nombre del libro o del archivo no es válido"}
      if not archivo.lower().endswith(".mp3"):
          return 400, {
              "ok": False,
              "mensaje": f"El archivo {archivo} no es MP3. Solo se aceptan archivos MP3.",
          }
      if length <= 0:
          return 400, {"ok": False, "mensaje": f"El archivo {archivo} está vacío"}
      if length > MAX_PISTA_BYTES:
          return 400, {
              "ok": False,
              "mensaje": f"El archivo {archivo} es demasiado grande, supera los 500 megabytes",
          }

      blob_name = f"{nombre}/{archivo}"
      blob_client = container.get_blob_client(blob_name)

      if blob_client.exists():
          return 200, {
              "ok": True,
              "skipped": True,
              "mensaje": f"La pista {archivo} ya estaba subida, la salteo",
          }

      try:
          blob_client.upload_blob(
              stream, length=length, overwrite=False, content_type="audio/mpeg"
          )
      except Exception as e:
          return 500, {
              "ok": False,
              "mensaje": f"Error subiendo la pista {archivo}. Detalle: {type(e).__name__}",
          }

      return 201, {
          "ok": True,
          "skipped": False,
          "mensaje": f"Pista {archivo} subida correctamente",
      }
  ```

- [ ] **Step 4: Correr todos los tests**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && /usr/local/bin/python3 -m pytest test_server.py -v`
  Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**
  Run: `git add admin-dashboard/server.py admin-dashboard/test_server.py && git commit -m "feat(admin-dashboard): subir_pista con streaming, validaciones y skip de existentes"`

---

## Task 3: Wiring HTTP — `do_POST` y endpoint de categorías

**Files:**
- Modify: `admin-dashboard/server.py`
- Modify: `admin-dashboard/test_server.py`

**Interfaces:**
- Produce: `POST /api/admin/crear-libro`, `POST /api/admin/subir-pista?nombre=&archivo=`, `GET /api/categorias`
- El body de `subir-pista` es **binario crudo**, no multipart (parsear multipart a mano con `http.server` es innecesario para una herramienta interna).

- [ ] **Step 1: Escribir el test del lector acotado**
  El riesgo real: si el SDK de Azure llama `read()` sin argumento sobre el socket, se cuelga esperando datos que no llegan. Un cuelgue sin feedback es el peor error posible para quien opera sin ver la pantalla.
  Agregar a `admin-dashboard/test_server.py`:
  ```python
  def test_bounded_reader_no_lee_de_mas():
      origen = io.BytesIO(b"AAAABBBB")  # 4 bytes nuestros + 4 de la proxima request
      lector = server._BoundedReader(origen, 4)
      assert lector.read() == b"AAAA"
      assert lector.read() == b""
      assert origen.read() == b"BBBB"  # intacto para el resto del stream


  def test_bounded_reader_respeta_tamano_pedido():
      lector = server._BoundedReader(io.BytesIO(b"ABCDEF"), 6)
      assert lector.read(2) == b"AB"
      assert lector.read(10) == b"CDEF"
      assert lector.read(1) == b""
  ```

- [ ] **Step 2: Correr para verificar que falla**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && /usr/local/bin/python3 -m pytest test_server.py -k bounded -v`
  Expected: FAIL con `AttributeError: module 'server' has no attribute '_BoundedReader'`.

- [ ] **Step 3: Implementar `_BoundedReader`**
  Agregar en `server.py` antes de `class AdminApiHandler`:
  ```python
  class _BoundedReader:
      """Limita la lectura de un stream a `limit` bytes.

      Sin esto, el SDK de Azure puede llamar read() sin argumento sobre el socket
      y quedarse colgado esperando bytes que nunca llegan.
      """

      def __init__(self, stream, limit):
          self._stream = stream
          self._remaining = limit

      def read(self, size=-1):
          if self._remaining <= 0:
              return b""
          if size is None or size < 0:
              size = self._remaining
          chunk = self._stream.read(min(size, self._remaining))
          self._remaining -= len(chunk)
          return chunk
  ```

- [ ] **Step 4: Extraer el helper de respuesta JSON (DRY)**
  En `AdminApiHandler`, el final de `handle_api()` arma la respuesta a mano. Extraerlo a un método y hacer que `handle_api` lo use:
  ```python
      def _send_json(self, status_code, payload):
          self.send_response(status_code)
          self.send_header("Content-Type", "application/json; charset=utf-8")
          self.send_header("Access-Control-Allow-Origin", "*")
          self.end_headers()
          self.wfile.write(json.dumps(payload, default=str).encode("utf-8"))
  ```
  Reemplazar las últimas 5 líneas de `handle_api()` (desde `self.send_response(status_code)`) por:
  ```python
          self._send_json(status_code, response_data)
  ```

- [ ] **Step 5: Implementar `do_POST`**
  Agregar como método de `AdminApiHandler`, después de `do_GET`:
  ```python
      def do_POST(self):
          parsed_url = urllib.parse.urlparse(self.path)
          path = parsed_url.path
          query = urllib.parse.parse_qs(parsed_url.query)
          length = int(self.headers.get("Content-Length") or 0)

          try:
              if path == "/api/admin/crear-libro":
                  payload = json.loads(self.rfile.read(length) or b"{}")
                  db_info = get_db_connection()
                  if not db_info:
                      self._send_json(500, {"ok": False, "mensaje": "No hay conexión a la base de datos"})
                      return
                  try:
                      status, data = crear_libro(payload, db_info)
                  finally:
                      db_info["conn"].close()
                  self._send_json(status, data)

              elif path == "/api/admin/subir-pista":
                  if not AZURE_SDK_AVAILABLE or not AZURE_ACCOUNT_KEY:
                      self._send_json(500, {"ok": False, "mensaje": "Azure no está configurado en este servidor"})
                      return
                  conn_str = (
                      f"DefaultEndpointsProtocol=https;AccountName={AZURE_ACCOUNT_NAME};"
                      f"AccountKey={AZURE_ACCOUNT_KEY};EndpointSuffix=core.windows.net"
                  )
                  container = BlobServiceClient.from_connection_string(conn_str).get_container_client(
                      AZURE_CONTAINER_NAME
                  )
                  status, data = subir_pista(
                      query.get("nombre", [""])[0],
                      query.get("archivo", [""])[0],
                      _BoundedReader(self.rfile, length),
                      length,
                      container,
                  )
                  self._send_json(status, data)

              else:
                  self._send_json(404, {"ok": False, "mensaje": f"Endpoint {path} no encontrado"})

          except Exception as e:
              self._send_json(500, {"ok": False, "mensaje": f"Error del servidor: {type(e).__name__}"})
  ```

- [ ] **Step 6: Agregar `GET /api/categorias`**
  En `handle_api()`, agregar una rama antes del `else` final:
  ```python
              elif path == "/api/categorias":
                  db_info = get_db_connection()
                  categorias = []
                  if db_info:
                      conn = db_info["conn"]
                      if db_info["type"] == "azure_sql":
                          cursor = conn.cursor(as_dict=True)
                          cursor.execute("SELECT id, nombre FROM categorias ORDER BY nombre ASC")
                          categorias = cursor.fetchall()
                      else:
                          rows = conn.execute("SELECT id, nombre FROM categorias ORDER BY nombre ASC").fetchall()
                          categorias = [dict(r) for r in rows]
                      conn.close()
                  response_data = {"categorias": categorias, "total": len(categorias)}
  ```

- [ ] **Step 7: Correr todos los tests + verificar que el servidor arranca**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && /usr/local/bin/python3 -m pytest test_server.py -v`
  Expected: PASS, 11 tests.
  Run: `/usr/local/bin/python3 -c "import sys; sys.path.insert(0,'.'); import server; print('import OK')"`
  Expected: `import OK` (valida que no hay error de sintaxis).

- [ ] **Step 8: Commit**
  Run: `git add admin-dashboard/server.py admin-dashboard/test_server.py && git commit -m "feat(admin-dashboard): endpoints POST de carga y GET de categorias"`

---

## Task 4: Primitivas de accesibilidad en JS vanilla

**Files:**
- Create: `admin-dashboard/static/a11y.js`
- Modify: `admin-dashboard/static/index.html`

**Interfaces:**
- Produce: `A11y.anunciar(texto)`, `A11y.earcon(tipo)` con tipos `exito` / `error` / `accion`.
- Portadas desde `frontend/src/context/AudioContext.jsx`, mismas frecuencias que documenta [10-accesibilidad.md](../../specs/10-accesibilidad.md).

**Contexto:** `admin-dashboard` hoy tiene **cero** accesibilidad — ni un `aria-*` en todo el HTML. Esto es la base de la que depende todo el flujo de carga.

- [ ] **Step 1: Crear `a11y.js`**
  Crear `admin-dashboard/static/a11y.js`:
  ```javascript
  /**
   * Primitivas de accesibilidad del panel: voz, earcons y live region.
   * Portado de frontend/src/context/AudioContext.jsx (ver docs/specs/10-accesibilidad.md).
   */
  const A11y = (() => {
    let ctx = null;

    // Frecuencias y formas de onda del spec de accesibilidad (seccion 2.3)
    const EARCONS = {
      exito:  { freqs: [440, 880], onda: 'triangle', dur: 0.18 },
      error:  { freqs: [180],      onda: 'sawtooth', dur: 0.30 },
      accion: { freqs: [659.25],   onda: 'sine',     dur: 0.10 },
    };

    function earcon(tipo) {
      const cfg = EARCONS[tipo];
      if (!cfg) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        cfg.freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = cfg.onda;
          osc.frequency.value = freq;
          // Volumen bajo con decay exponencial: feedback, no interrupcion
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.dur);
          osc.connect(gain).connect(ctx.destination);
          const inicio = ctx.currentTime + i * cfg.dur;
          osc.start(inicio);
          osc.stop(inicio + cfg.dur);
        });
      } catch (e) {
        // Sin Web Audio el flujo sigue: la voz y la live region son el canal principal
      }
    }

    function anunciar(texto) {
      // Live region primero: es el canal que siempre funciona, incluso sin TTS
      const region = document.getElementById('a11y-anuncios');
      if (region) {
        region.textContent = '';
        // El reset fuerza a los lectores de pantalla a releer un texto repetido
        setTimeout(() => { region.textContent = texto; }, 50);
      }
      try {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();  // no encimar anuncios
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES';
        window.speechSynthesis.speak(u);
      } catch (e) {
        // Degradacion: queda la live region
      }
    }

    return { anunciar, earcon };
  })();
  ```

- [ ] **Step 2: Verificar sintaxis**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && node --check static/a11y.js`
  Expected: sin salida (OK).

- [ ] **Step 3: Enlazar en el HTML + agregar la live region**
  En `admin-dashboard/static/index.html`, agregar la live region justo después de la apertura de `<body>` (buscar el primer elemento del layout) :
  ```html
  <div id="a11y-anuncios" aria-live="assertive" aria-atomic="true" class="sr-only"></div>
  ```
  Y antes del `</body>`, antes de cualquier otro `<script>`:
  ```html
  <script src="/a11y.js"></script>
  ```
  Agregar la clase `sr-only` al bloque `<style>` existente:
  ```css
  .sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  ```

- [ ] **Step 4: Commit**
  Run: `git add admin-dashboard/static/a11y.js admin-dashboard/static/index.html && git commit -m "feat(admin-dashboard): primitivas de accesibilidad (voz, earcons, live region)"`

---

## Task 5: Sección "Cargar audiolibro" — paso 1, metadata

**Files:**
- Modify: `admin-dashboard/static/index.html`
- Create: `admin-dashboard/static/carga.js`

**Interfaces:**
- Consume: `POST /api/admin/crear-libro`, `GET /api/categorias`, `A11y.*`
- Produce: `window.libroActual = {id, nombre}` al crear con éxito — lo consume el paso 2.

- [ ] **Step 1: Agregar el item de navegación**
  En el `<nav class="nav-menu">` de `index.html`, agregar como último item:
  ```html
  <a class="nav-item" onclick="switchTab('carga')">
    <span class="nav-icon">📤</span> Cargar Audiolibro
  </a>
  ```

- [ ] **Step 2: Agregar la sección con el formulario**
  Agregar antes del cierre de `</main>`, después de `view-governance`:
  ```html
  <!-- TAB 6: CARGA DE CONTENIDO -->
  <section id="view-carga" class="view-section">
    <form id="form-libro" class="governance-card" novalidate>
      <h3>Paso 1: Datos del libro</h3>

      <label for="campo-nombre">Nombre del libro (obligatorio)</label>
      <input type="text" id="campo-nombre" name="nombre" required
             aria-required="true" autocomplete="off" class="search-input">

      <label for="campo-autor">Autor</label>
      <input type="text" id="campo-autor" name="autor" autocomplete="off" class="search-input">

      <label for="campo-genero">Género</label>
      <input type="text" id="campo-genero" name="genero" autocomplete="off" class="search-input">

      <label for="campo-categoria">Categoría</label>
      <select id="campo-categoria" name="categoria_id" class="search-input">
        <option value="">Sin categoría</option>
      </select>

      <label for="campo-descripcion">Descripción (opcional)</label>
      <textarea id="campo-descripcion" name="descripcion" rows="3" class="search-input"></textarea>

      <button type="submit" id="btn-crear-libro">Crear libro y continuar</button>
    </form>

    <div id="paso-archivos" hidden></div>
  </section>
  ```

- [ ] **Step 3: Crear `carga.js` con la lógica del paso 1**
  Crear `admin-dashboard/static/carga.js`:
  ```javascript
  /** Flujo de carga de audiolibros, operable sin ver la pantalla. */
  let libroActual = null;

  async function cargarCategorias() {
    try {
      const r = await fetch('/api/categorias');
      const d = await r.json();
      const sel = document.getElementById('campo-categoria');
      (d.categorias || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        sel.appendChild(opt);
      });
    } catch (e) {
      // Sin categorias el flujo sigue: el campo es opcional
    }
  }

  document.getElementById('form-libro').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = document.getElementById('campo-nombre').value.trim();
    if (!nombre) {
      A11y.earcon('error');
      A11y.anunciar('El nombre del libro es obligatorio');
      document.getElementById('campo-nombre').focus();
      return;
    }

    const btn = document.getElementById('btn-crear-libro');
    btn.disabled = true;
    A11y.anunciar('Creando el libro, esperá un momento');

    try {
      const r = await fetch('/api/admin/crear-libro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          autor: document.getElementById('campo-autor').value.trim(),
          genero: document.getElementById('campo-genero').value.trim(),
          descripcion: document.getElementById('campo-descripcion').value.trim(),
          categoria_id: document.getElementById('campo-categoria').value || null,
        }),
      });
      const d = await r.json();

      if (!r.ok) {
        A11y.earcon('error');
        A11y.anunciar(d.mensaje || 'No se pudo crear el libro');
        document.getElementById('campo-nombre').focus();
        return;
      }

      libroActual = { id: d.id, nombre: d.nombre };
      A11y.earcon('exito');
      A11y.anunciar(d.mensaje);
      mostrarPasoArchivos();
    } catch (e) {
      A11y.earcon('error');
      A11y.anunciar('Error de conexión con el servidor. Revisá que el panel esté corriendo.');
    } finally {
      btn.disabled = false;
    }
  });

  // Enter en el campo nombre no envia el formulario: evita envios accidentales
  document.getElementById('campo-nombre').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      document.getElementById('campo-autor').focus();
    }
  });

  cargarCategorias();
  ```

- [ ] **Step 4: Enlazar el script y dar foco al entrar a la sección**
  Antes de `</body>`, después de `a11y.js`:
  ```html
  <script src="/carga.js"></script>
  ```
  En la función `switchTab()` existente de `index.html`, agregar al final:
  ```javascript
  if (tab === 'carga') {
    document.getElementById('campo-nombre').focus();
    A11y.anunciar('Cargar audiolibro. Paso 1, escribí el nombre del libro.');
  }
  ```

- [ ] **Step 5: Verificar sintaxis**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && node --check static/carga.js`
  Expected: sin salida.

- [ ] **Step 6: Commit**
  Run: `git add admin-dashboard/static/ && git commit -m "feat(admin-dashboard): seccion de carga, paso 1 metadata accesible"`

---

## Task 6: Paso 2 y 3 — selección de archivos y subida secuencial

**Files:**
- Modify: `admin-dashboard/static/carga.js`

**Interfaces:**
- Consume: `POST /api/admin/subir-pista?nombre=&archivo=`, `libroActual`

**Contexto crítico:** el orden de reproducción sale **solo** del nombre de archivo (no hay tabla de capítulos). Si los nombres no traen número, el orden queda mal y no hay forma de arreglarlo sin volver a subir todo. Por eso se avisa **antes** de subir. Y la subida es **secuencial a propósito**: en paralelo, los anuncios de voz se pisarían entre sí.

- [ ] **Step 1: Implementar el paso de selección con salvaguarda de orden**
  Agregar a `carga.js`:
  ```javascript
  function mostrarPasoArchivos() {
    const cont = document.getElementById('paso-archivos');
    cont.hidden = false;
    cont.innerHTML = `
      <h3>Paso 2: Archivos de audio de ${libroActual.nombre}</h3>
      <label for="campo-archivos">Seleccioná los archivos MP3</label>
      <input type="file" id="campo-archivos" accept=".mp3,audio/mpeg" multiple>
      <button type="button" id="btn-subir" hidden>Subir pistas</button>
      <ul id="lista-pistas"></ul>
    `;
    document.getElementById('campo-archivos').addEventListener('change', revisarArchivos);
    document.getElementById('btn-subir').addEventListener('click', subirTodo);
    document.getElementById('campo-archivos').focus();
  }

  let archivosElegidos = [];

  function revisarArchivos(ev) {
    // El orden de reproduccion sale del nombre de archivo: se ordena igual que en el server
    archivosElegidos = Array.from(ev.target.files).sort((a, b) => a.name.localeCompare(b.name));
    if (!archivosElegidos.length) return;

    const nombres = archivosElegidos.map(f => f.name);
    const sinNumero = nombres.filter(n => !/^\d/.test(n));

    let msg = `${nombres.length} archivos, en este orden: ${nombres.join(', ')}. `;
    if (sinNumero.length) {
      msg += 'Atención: los nombres no empiezan con número, así que este es el orden en que se van a escuchar. ' +
             'Si no es el correcto, elegí otros archivos. ';
    }
    msg += 'Cuando estés listo, presioná el botón subir pistas.';

    A11y.earcon('accion');
    A11y.anunciar(msg);
    document.getElementById('btn-subir').hidden = false;
    document.getElementById('btn-subir').focus();
  }
  ```

- [ ] **Step 2: Implementar la subida secuencial con reintento**
  Agregar a `carga.js`:
  ```javascript
  async function subirUna(file) {
    const url = `/api/admin/subir-pista?nombre=${encodeURIComponent(libroActual.nombre)}` +
                `&archivo=${encodeURIComponent(file.name)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    return { ok: r.ok, data: await r.json() };
  }

  async function subirTodo() {
    const btn = document.getElementById('btn-subir');
    btn.disabled = true;
    const total = archivosElegidos.length;
    let subidas = 0;

    // Secuencial a proposito: en paralelo los anuncios de voz se pisan entre si
    for (let i = 0; i < total; i++) {
      const file = archivosElegidos[i];
      A11y.anunciar(`Subiendo pista ${i + 1} de ${total}`);

      let resultado;
      try {
        resultado = await subirUna(file);
      } catch (e) {
        resultado = { ok: false, data: { mensaje: `Error de conexión subiendo ${file.name}` } };
      }

      if (!resultado.ok) {
        A11y.earcon('error');
        // El foco va al boton de reintento: sin esto, quien no ve la pantalla queda sin salida
        const reintentar = await ofrecerReintento(resultado.data.mensaje, i + 1, total);
        if (reintentar) { i--; continue; }
        A11y.anunciar(`Carga interrumpida. Se subieron ${subidas} de ${total} pistas.`);
        btn.disabled = false;
        return;
      }

      subidas++;
      A11y.earcon('exito');
      A11y.anunciar(resultado.data.mensaje);
    }

    A11y.earcon('exito');
    A11y.anunciar(`Carga completa. ${libroActual.nombre} ya está en el catálogo con ${subidas} pistas.`);
    btn.disabled = false;
  }

  function ofrecerReintento(mensaje, indice, total) {
    return new Promise((resolve) => {
      const cont = document.getElementById('lista-pistas');
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${mensaje}</span>
        <button type="button" id="btn-reintentar">Reintentar pista ${indice}</button>
        <button type="button" id="btn-cancelar">Cancelar la carga</button>
      `;
      cont.appendChild(li);
      const btnR = li.querySelector('#btn-reintentar');
      const btnC = li.querySelector('#btn-cancelar');
      A11y.anunciar(`${mensaje}. Presioná reintentar, o cancelar para detener la carga.`);
      btnR.focus();
      btnR.addEventListener('click', () => { li.remove(); resolve(true); });
      btnC.addEventListener('click', () => { li.remove(); resolve(false); });
    });
  }
  ```

- [ ] **Step 3: Verificar sintaxis**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && node --check static/carga.js`
  Expected: sin salida.

- [ ] **Step 4: Commit**
  Run: `git add admin-dashboard/static/carga.js && git commit -m "feat(admin-dashboard): seleccion de archivos con salvaguarda de orden y subida secuencial"`

---

## Task 7: Verificación manual y de accesibilidad

**Files:** ninguno (verificación)

**⚠️ Esta tarea toca Azure y la base reales.** Usar el libro de prueba indicado y limpiarlo al final. Coordinar con Nico antes de correrla.

- [ ] **Step 1: Levantar el panel**
  Run: `cd /Users/nico/Documents/VibeCode/proyectos/activos/Invision/admin-dashboard && /usr/local/bin/python3 server.py 8888`
  Abrir `http://localhost:8888`.

- [ ] **Step 2: Preparar MP3s de prueba**
  Usar 2 archivos chicos de `_ops_upload/books/`, renombrados a `01.mp3` y `02.mp3`.

- [ ] **Step 3: Flujo completo a ciegas**
  Activar VoiceOver (`Cmd+F5` en Mac). **Apagar el monitor o cerrar los ojos** — el criterio de aceptación es completar la carga sin mirar.
  Nombre del libro: `ZZZ PRUEBA BORRAR` (prefijo que lo manda al final del catálogo alfabético).
  Verificar en orden:
  - Al entrar a la sección se anuncia el paso 1 y el foco cae en el campo nombre.
  - Enter en el campo nombre pasa al autor, **no** envía el formulario.
  - Al crear, suena earcon de éxito y se anuncia el paso 2.
  - Al elegir archivos, se anuncian cantidad y orden.
  - Cada pista anuncia progreso ("Subiendo pista 1 de 2") y confirmación.
  - El anuncio final dice el nombre del libro y la cantidad de pistas.

- [ ] **Step 4: Verificar el caso de duplicado**
  Repetir el paso 3 con el mismo nombre `ZZZ PRUEBA BORRAR`.
  Expected: earcon de error, se anuncia que ya existe, el foco vuelve al campo nombre, y **no** avanza al paso 2.

- [ ] **Step 5: Verificar el aviso de orden**
  Elegir archivos con nombres sin número (ej. `intro.mp3`, `final.mp3`).
  Expected: el anuncio incluye la advertencia de que ese es el orden de reproducción.

- [ ] **Step 6: Verificar sin TTS**
  Deshabilitar `speechSynthesis` en la consola del navegador: `window.speechSynthesis.speak = () => {}`.
  Repetir un tramo del flujo con VoiceOver activo.
  Expected: la live region sigue comunicando todo — no se pierde ningún estado.

- [ ] **Step 7: Verificar que el skip no pisa audio**
  Volver a subir `01.mp3` al mismo libro.
  Expected: se anuncia "ya estaba subida, la salteo", y el blob conserva su `last_modified` original.

- [ ] **Step 8: LIMPIEZA — borrar el libro de prueba**
  Borrar los blobs bajo el prefijo `ZZZ PRUEBA BORRAR/` y la fila en `audiolibros`.
  Verificar en el Explorador de Audios que ya no aparece.
  **No cerrar esta tarea sin confirmar la limpieza.**

- [ ] **Step 9: Actualizar el estado del módulo**
  En [12-admin-dashboard.md](../../specs/12-admin-dashboard.md): marcar la fila "Carga de contenido" como implementada, actualizar el encabezado de estado (ya no es "Solo lectura"), y actualizar el porcentaje en la tabla de [00-overview.md](../../specs/00-overview.md).
  Run: `git add docs/specs/ && git commit -m "docs: actualizar estado del modulo 12 tras implementar carga de contenido"`

---

## Fuera de alcance (no hacer en este plan)

- **Importación masiva de los ~700 desde el CSV.** El CSV es `;`-delimitado y está en **latin-1/cp1252** (se ve como `G�NERO` al leerlo como UTF-8) — necesita su propio diseño de encoding, dedup y reporte por fila. Este plan construye la carga de **un** libro; el bulk se apoya después sobre los mismos endpoints.
- **Autenticación del panel.** Hoy no tiene ninguna: cualquiera con acceso al puerto puede escribir. Aceptable mientras corra en local, **bloqueante antes de exponerlo**. Ver gaps en el módulo 12.
- **Clasificaciones (M:M) y campo editorial.** Descartados por YAGNI — ver nota de alcance en el design doc §3.1.
- **SharePoint real, Celery, tracking de jobs.** Ver [08-ingesta-masiva.md](../../specs/08-ingesta-masiva.md).
