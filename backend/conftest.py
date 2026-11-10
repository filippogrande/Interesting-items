"""Configurazione pytest del backend.

`storage/db.py` legge DATABASE_URL **a import time**: in produzione arriva dal
compose, in locale no. Senza questo il test scriverebbe su backend/storage/db.sqlite.
"""
import os
import tempfile

_TMP_DIR = tempfile.mkdtemp(prefix="interesting-items-test-")
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(_TMP_DIR, "test.db")
