"""Assemblaggio dell'app FastAPI del BE.

Entrypoint per uvicorn: `uvicorn app.server:app`.
Importa l'app principale e i moduli che registrano endpoint aggiuntivi.
"""
from .api import app  # noqa: F401
from . import api_lookup  # noqa: F401,E402  # registra /api/sourceurls/lookup

__all__ = ["app"]
