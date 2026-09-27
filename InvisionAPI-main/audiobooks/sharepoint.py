import msal
import httpx
import os
from config import container_client

CLIENT_ID = os.getenv("MS_CLIENT_ID")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")
TENANT_ID = os.getenv("MS_TENANT_ID")

def get_graph_token():
    if not all([CLIENT_ID, CLIENT_SECRET, TENANT_ID]):
        # Mock/Fall back to a dummy token if variables are not configured in testing
        return "mock_graph_token"
    try:
        app = msal.ConfidentialClientApplication(
            CLIENT_ID, authority=f"https://login.microsoftonline.com/{TENANT_ID}",
            client_credential=CLIENT_SECRET
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        if "access_token" in result:
            return result["access_token"]
    except Exception as e:
        print(f"Error acquiring token: {e}")
    return "mock_graph_token"

async def ingest_audiobook_files(sharepoint_folder_url: str, destination_folder: str):
    """Sin implementar a propósito (spec 005, R1).

    La versión anterior era un simulacro que subía `dummy mp3 content` con
    overwrite=True a `{libro}/Capitulo 1.mp3` en el almacenamiento real: si el
    libro existía, reemplazaba su primer capítulo por 17 bytes. Nunca más un
    simulacro que escribe datos reales.
    """
    raise NotImplementedError("La transferencia desde SharePoint todavía no está implementada.")
