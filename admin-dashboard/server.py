#!/usr/bin/env python3
"""
Invision Admin & Structural Operations Dashboard (Local)
Herramienta local de auditoría, registros de acceso y visualización estructural.
Modo: 100% Solo Lectura (Read-Only)
"""

import os
import sys
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
    from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False


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
            # Archivos estáticos
            if path == "/" or not os.path.exists(os.path.join(self.directory, path.lstrip("/"))):
                self.path = "/index.html"
            super().do_GET()

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
        self.send_header("Access-Control-Allow-Origin", "*")
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

    server_address = ("", port)
    httpd = HTTPServer(server_address, AdminApiHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido de manera segura.")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
    run(port=port)
