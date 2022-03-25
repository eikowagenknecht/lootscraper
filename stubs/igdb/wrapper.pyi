from typing import Any

from requests.models import Response

API_URL: str

class IGDBWrapper:
    client_id: Any
    auth_token: Any
    def __init__(self, client_id: str, auth_token: str) -> None: ...
    def api_request(self, endpoint: str, query: str) -> bytes: ...
