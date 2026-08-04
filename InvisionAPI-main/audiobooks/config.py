import os
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

SQL_SERVER = os.getenv("SQL_SERVER", "")
SQL_DATABASE = os.getenv("SQL_DATABASE", "")
SQL_USERNAME = os.getenv("SQL_USERNAME", "")
SQL_PASSWORD = os.getenv("SQL_PASSWORD", "")
SQL_DRIVER = os.getenv("SQL_DRIVER", "{ODBC Driver 18 for SQL Server}")

SQL_CONN_STR = (
    f"DRIVER={SQL_DRIVER};SERVER={SQL_SERVER};DATABASE={SQL_DATABASE};"
    f"UID={SQL_USERNAME};PWD={SQL_PASSWORD}"
)

SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"mssql+pyodbc://{SQL_USERNAME}:{SQL_PASSWORD}@{SQL_SERVER}/{SQL_DATABASE}?driver=ODBC+Driver+18+for+SQL+Server"
    if SQL_SERVER else "sqlite:///invision.db"
)

AZURE_ACCOUNT_NAME = os.getenv("AZURE_ACCOUNT_NAME", "")
AZURE_ACCOUNT_KEY = os.getenv("AZURE_ACCOUNT_KEY", "")
AZURE_CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME", "audiolibros")
AZURE_CONNECTION_STRING = os.getenv(
    "AZURE_CONNECTION_STRING",
    f"DefaultEndpointsProtocol=https;AccountName={AZURE_ACCOUNT_NAME};"
    f"AccountKey={AZURE_ACCOUNT_KEY};EndpointSuffix=core.windows.net"
)

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING) if AZURE_ACCOUNT_KEY else None
container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME) if blob_service_client else None
