#!/usr/bin/env python3
"""
Invision Admin & Structural Operations Dashboard (Local)
Herramienta local de auditoría, registros de acceso y visualización estructural.
Modo: 100% Solo Lectura (Read-Only)
"""

import os
import sys
import hmac
import json
import sqlite3
import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse
from dotenv import load_dotenv

# Cargar variables de entorno
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=env_path)

# Credenciales y configuración
AZURE_ACCOUNT_NAME = os.getenv("AZURE_ACCOUNT_NAME", "cuentaprueba")
AZURE_ACCOUNT_KEY = os.getenv("AZURE_ACCOUNT_KEY")
AZURE_CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME", "audiolibros")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "InvisionAPI-main", "audiobooks", "invision.db"))

# Cache en memoria para rendimiento de Azure Blob
blob_cache = {
    "last_fetched": None,
    "total_blobs": 0,
    "total_size_bytes": 0,
    "books": {}, # {book_name: [{"name": blob_name, "size": size, "chapter": int, "title": str}]}
    "is_loading": False
}

try:
    from azure.storage.blob import (
        BlobServiceClient, generate_blob_sas, BlobSasPermissions, ContentSettings
    )
    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False
    ContentSettings = None


try:
    import pymssql
    PYMSSQL_AVAILABLE = True
except ImportError:
    PYMSSQL_AVAILABLE = False


def get_db_connection():
    # 1. Intentar conectar primero a Azure SQL Database en la Nube
    sql_server = os.getenv("SQL_SERVER", "tu-servidor.database.windows.net")
    sql_db = os.getenv("SQL_DATABASE", "nombre_base")
    sql_user = os.getenv("SQL_USERNAME", "usuario_sql")
    sql_pass = os.getenv("SQL_PASSWORD")

    if PYMSSQL_AVAILABLE and sql_server and sql_pass:
        try:
            conn = pymssql.connect(
                server=sql_server,
                user=sql_user,
                password=sql_pass,
                database=sql_db,
                port=1433,
                login_timeout=3
            )
            return {"type": "azure_sql", "conn": conn}
        except Exception as e:
            # Firewall o error de red en Azure SQL
            pass

    # 2. Fallback a SQLite Local
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return {"type": "sqlite", "conn": conn}

    return None


def fetch_azure_blob_metadata(force_refresh=False):
    global blob_cache
    if not AZURE_SDK_AVAILABLE or not AZURE_ACCOUNT_KEY:
        return {"error": "Azure SDK no disponible o AZURE_ACCOUNT_KEY no configurada"}

    now = datetime.datetime.now()
    if not force_refresh and blob_cache["last_fetched"] and (now - blob_cache["last_fetched"]).total_seconds() < 600:
        return blob_cache

    try:
        blob_cache["is_loading"] = True
        conn_str = f"DefaultEndpointsProtocol=https;AccountName={AZURE_ACCOUNT_NAME};AccountKey={AZURE_ACCOUNT_KEY};EndpointSuffix=core.windows.net"
        service = BlobServiceClient.from_connection_string(conn_str)
        container = service.get_container_client(AZURE_CONTAINER_NAME)
        
        blobs = container.list_blobs()
        
        books_map = {}
        total_size = 0
        count = 0

        for b in blobs:
            count += 1
            total_size += b.size
            
            parts = b.name.split("/", 1)
            if len(parts) == 2:
                book_name, file_name = parts[0], parts[1]
            else:
                book_name, file_name = "Raíz / Sin Clasificar", b.name
                
            if book_name not in books_map:
                books_map[book_name] = {
                    "title": book_name,
                    "tracks": [],
                    "total_size_bytes": 0,
                    "total_tracks": 0
                }
            
            books_map[book_name]["tracks"].append({
                "blob_name": b.name,
                "file_name": file_name,
                "size_bytes": b.size,
                "size_mb": round(b.size / (1024 * 1024), 2),
                "last_modified": b.last_modified.isoformat() if b.last_modified else None
            })
            books_map[book_name]["total_size_bytes"] += b.size
            books_map[book_name]["total_tracks"] += 1

        # Ordenar pistas numéricamente si es posible
        for b_name, b_info in books_map.items():
            b_info["total_size_mb"] = round(b_info["total_size_bytes"] / (1024 * 1024), 2)
            b_info["tracks"].sort(key=lambda x: x["file_name"])

        blob_cache["last_fetched"] = now
        blob_cache["total_blobs"] = count
        blob_cache["total_size_bytes"] = total_size
        blob_cache["total_size_gb"] = round(total_size / (1024 * 1024 * 1024), 2)
        blob_cache["books"] = books_map
        blob_cache["is_loading"] = False
        return blob_cache
    except Exception as e:
        blob_cache["is_loading"] = False
        return {"error": str(e)}


def generate_audio_sas_url(blob_name):
    if not AZURE_SDK_AVAILABLE or not AZURE_ACCOUNT_KEY:
        return None
    try:
        sas_token = generate_blob_sas(
            account_name=AZURE_ACCOUNT_NAME,
            container_name=AZURE_CONTAINER_NAME,
            blob_name=blob_name,
            account_key=AZURE_ACCOUNT_KEY,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)
        )
        return f"https://{AZURE_ACCOUNT_NAME}.blob.core.windows.net/{AZURE_CONTAINER_NAME}/{urllib.parse.quote(blob_name)}?{sas_token}"
    except Exception as e:
        print(f"Error generando SAS token: {e}")
        return None


def _token_valido(headers):
    """Valida el token de administrador de los endpoints de escritura.

    Falla cerrado: sin ADMIN_TOKEN configurado no se autoriza nada.
    Comparacion en tiempo constante para no filtrar el token caracter a caracter.
    """
    if not ADMIN_TOKEN:
        return False
    recibido = (headers.get("X-Admin-Token") or "") if headers else ""
    # Se compara en bytes: http.server decodifica los headers como latin-1, y
    # compare_digest sobre str con caracteres no ASCII levanta TypeError. En
    # bytes cualquier header entra sin romper y sigue siendo tiempo constante.
    return hmac.compare_digest(recibido.encode("utf-8"), ADMIN_TOKEN.encode("utf-8"))


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

    # En Azure SQL el id se pide con OUTPUT dentro del mismo INSERT: pymssql manda
    # cada execute() como un batch separado, y SCOPE_IDENTITY() en un batch aparte
    # es otro scope -> devuelve NULL y la creacion falla siempre.
    salida = "" if es_sqlite else "OUTPUT INSERTED.id "
    cursor.execute(
        f"INSERT INTO audiolibros (nombre, descripcion, genero, autor, categoria_id) "
        f"{salida}"
        f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph})",
        (
            nombre,
            payload.get("descripcion"),
            payload.get("genero"),
            payload.get("autor"),
            payload.get("categoria_id"),
        ),
    )

    nuevo_id = cursor.lastrowid if es_sqlite else int(cursor.fetchone()[0])

    conn.commit()
    return 201, {
        "ok": True,
        "id": nuevo_id,
        "nombre": nombre,
        "mensaje": f"Libro {nombre} creado. Ahora seleccioná los archivos de audio.",
    }


MAX_PISTA_BYTES = 500 * 1024 * 1024  # 500 MB, tope defensivo por archivo


def _nombre_seguro(valor):
    """Rechaza valores que puedan escapar del prefijo del blob."""
    if not valor or any(c in valor for c in ("/", "\\", "..", "\x00")):
        return False
    # Un valor de solo puntos ("." o ". ") es un dot-segment: el SDK no lo escapa
    # en la URL, así que una capa que normalice la ruta lo colapsaría y la pista
    # terminaría en la raíz del contenedor, fuera de la carpeta del libro.
    return bool(valor.strip(" ."))


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
        # OJO: el content-type va en `content_settings`. Un `content_type=` suelto
        # no es un kwarg del SDK: cae en **kwargs, se ignora sin avisar y el MP3
        # queda como application/octet-stream.
        blob_client.upload_blob(
            stream,
            length=length,
            overwrite=False,
            content_settings=ContentSettings(content_type="audio/mpeg"),
        )
    except Exception as e:
        # `mensaje` se lee por voz: va sin jerga. El detalle técnico queda aparte
        # y en la consola del panel, que es donde se diagnostica.
        print(f"Error subiendo {blob_name}: {type(e).__name__}: {e}")
        return 500, {
            "ok": False,
            "mensaje": f"No se pudo subir la pista {archivo}. Probá de nuevo.",
            "detalle": type(e).__name__,
        }

    return 201, {
        "ok": True,
        "skipped": False,
        "mensaje": f"Pista {archivo} subida correctamente",
    }


class AdminApiHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        static_dir = os.path.join(os.path.dirname(__file__), "static")
        super().__init__(*args, directory=static_dir, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        # Rutas de API REST
        if path.startswith("/api/"):
            self.handle_api(path, query)
        else:
            # Archivos estáticos. /index.html se atiende por _servir_index igual que
            # "/": servirlo con super() devolvería el archivo crudo, sin el token, y
            # el panel fallaría en cada escritura sin motivo visible.
            if (
                path in ("/", "/index.html")
                or not os.path.exists(os.path.join(self.directory, path.lstrip("/")))
            ):
                self._servir_index()
                return
            super().do_GET()

    def _servir_index(self):
        ruta = os.path.join(self.directory, "index.html")
        with open(ruta, "r", encoding="utf-8") as f:
            html = f.read()
        # El token queda disponible para el JS del panel, mismo origen
        html = html.replace(
            "</head>",
            f'<script>window.ADMIN_TOKEN = "{ADMIN_TOKEN}";</script></head>',
            1,
        )
        cuerpo = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def handle_api(self, path, query):
        response_data = {}
        status_code = 200

        try:
            if path == "/api/overview":
                # Estado general y KPIs
                meta = fetch_azure_blob_metadata(force_refresh=False)
                db_info = get_db_connection()
                user_count = 0
                log_count = 0
                db_type_label = "SQLite Local (Desconectado de Azure SQL)"
                db_status = "local_only"

                if db_info:
                    conn = db_info["conn"]
                    if db_info["type"] == "azure_sql":
                        db_type_label = "Azure SQL Database (Producción)"
                        db_status = "connected_azure_sql"
                        cursor = conn.cursor(as_dict=True)
                        cursor.execute("SELECT COUNT(*) as total FROM usuarios")
                        user_count = cursor.fetchone()["total"]
                        cursor.execute("SELECT COUNT(*) as total FROM sesiones_acceso")
                        log_count = cursor.fetchone()["total"]
                        conn.close()
                    else:
                        db_type_label = "SQLite Local (Firewall bloquea Azure SQL)"
                        user_count = conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
                        log_count = conn.execute("SELECT COUNT(*) FROM sesiones_acceso").fetchone()[0]
                        conn.close()

                response_data = {
                    "status": "online",
                    "mode": "read_only_governance",
                    "azure_storage": {
                        "account": AZURE_ACCOUNT_NAME,
                        "container": AZURE_CONTAINER_NAME,
                        "total_files": meta.get("total_blobs", 0),
                        "total_size_gb": meta.get("total_size_gb", 0),
                        "total_books": len(meta.get("books", {})),
                        "last_synced": meta.get("last_fetched").isoformat() if meta.get("last_fetched") else None
                    },
                    "database": {
                        "type": db_type_label,
                        "total_users": user_count,
                        "total_access_logs": log_count,
                        "status": db_status
                    },
                    "production_site": {
                        "url": "https://biblioteca-invision.com/login",
                        "api": "https://api.biblioteca-invision.com",
                        "status": "active"
                    }
                }

            elif path == "/api/access-logs":
                # Registros de acceso
                db_info = get_db_connection()
                logs = []
                if db_info:
                    conn = db_info["conn"]
                    if db_info["type"] == "azure_sql":
                        cursor = conn.cursor(as_dict=True)
                        cursor.execute("""
                            SELECT TOP 100 s.id, s.tipo_evento, CONVERT(VARCHAR, s.timestamp, 120) as timestamp, 
                                   u.id as user_id, u.email, u.username, u.first_name, u.last_name 
                            FROM sesiones_acceso s
                            LEFT JOIN usuarios u ON s.usuario_id = u.id
                            ORDER BY s.timestamp DESC
                        """)
                        logs = cursor.fetchall()
                        conn.close()
                    else:
                        rows = conn.execute("""
                            SELECT s.id, s.tipo_evento, s.timestamp, u.id as user_id, u.email, u.username, u.first_name, u.last_name 
                            FROM sesiones_acceso s
                            LEFT JOIN usuarios u ON s.usuario_id = u.id
                            ORDER BY s.timestamp DESC
                        """).fetchall()
                        for r in rows:
                            logs.append(dict(r))
                        conn.close()
                response_data = {"logs": logs, "total": len(logs)}

            elif path == "/api/users":
                # Directorio de usuarios y roles
                db_info = get_db_connection()
                users = []
                if db_info:
                    conn = db_info["conn"]
                    if db_info["type"] == "azure_sql":
                        cursor = conn.cursor(as_dict=True)
                        cursor.execute("""
                            SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.phone_number, 
                                   CONVERT(VARCHAR, u.created_at, 120) as created_at,
                                   STRING_AGG(r.name, ', ') as roles
                            FROM usuarios u
                            LEFT JOIN user_roles ur ON u.id = ur.user_id
                            LEFT JOIN roles r ON ur.role_id = r.id
                            GROUP BY u.id, u.email, u.username, u.first_name, u.last_name, u.phone_number, u.created_at
                            ORDER BY u.id ASC
                        """)
                        users = cursor.fetchall()
                        conn.close()
                    else:
                        rows = conn.execute("""
                            SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.phone_number, u.created_at,
                                   GROUP_CONCAT(r.name, ', ') as roles
                            FROM usuarios u
                            LEFT JOIN user_roles ur ON u.id = ur.user_id
                            LEFT JOIN roles r ON ur.role_id = r.id
                            GROUP BY u.id
                            ORDER BY u.id ASC
                        """).fetchall()
                        for r in rows:
                            users.append(dict(r))
                        conn.close()
                response_data = {"users": users, "total": len(users)}

            elif path == "/api/books":
                # Catálogo estructurado de audiolibros desde Azure Blob Storage
                force = query.get("refresh", ["false"])[0].lower() == "true"
                meta = fetch_azure_blob_metadata(force_refresh=force)
                search = query.get("q", [""])[0].lower()

                books_list = []
                for title, info in meta.get("books", {}).items():
                    if not search or search in title.lower():
                        books_list.append({
                            "title": info["title"],
                            "total_tracks": info["total_tracks"],
                            "total_size_mb": info["total_size_mb"],
                            "tracks": info["tracks"]
                        })

                books_list.sort(key=lambda x: x["title"])
                response_data = {
                    "total_books": len(books_list),
                    "total_storage_gb": meta.get("total_size_gb", 0),
                    "books": books_list[:100], # Paginación inicial de 100
                    "cached_at": meta.get("last_fetched").isoformat() if meta.get("last_fetched") else None
                }

            elif path == "/api/stream-sas":
                # Generar enlace SAS temporal para previsualizar audio
                blob_name = query.get("blob", [""])[0]
                if not blob_name:
                    status_code = 400
                    response_data = {"error": "blob param is required"}
                else:
                    sas_url = generate_audio_sas_url(blob_name)
                    if sas_url:
                        response_data = {"sas_url": sas_url, "blob_name": blob_name}
                    else:
                        status_code = 500
                        response_data = {"error": "No se pudo generar el token SAS"}

            else:
                status_code = 404
                response_data = {"error": f"Endpoint {path} no encontrado"}

        except Exception as e:
            status_code = 500
            response_data = {"error": str(e)}

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(response_data, default=str).encode("utf-8"))


def run(port=8888):
    print("=" * 60)
    print("🎧 INVISION - PANEL ADMINISTRATIVO Y VISOR ESTRUCTURAL")
    print(f"🔒 Modo: Solo Lectura & Diagnóstico de Gobernanza")
    print(f"☁️  Azure Account: {AZURE_ACCOUNT_NAME} | Contenedor: {AZURE_CONTAINER_NAME}")
    print(f"🚀 Servidor local iniciado en: http://localhost:{port}")
    print("=" * 60)
    
    # Pre-cargar metadatos de Azure Blob en segundo plano
    print("⏳ Indexando estructura de Azure Blob Storage...")
    fetch_azure_blob_metadata()
    print("✅ Estructura indexada correctamente.")

    server_address = ("127.0.0.1", port)  # solo localhost: el panel escribe en produccion
    httpd = HTTPServer(server_address, AdminApiHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido de manera segura.")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
    run(port=port)
