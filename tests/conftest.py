"""Configuración global de pytest."""
import os

# Las pruebas nunca deben depender del portal externo de Compras Estatales ni de Ollama.
os.environ.setdefault("TENDERS_FEED_OFFLINE", "1")
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite:///calcu.db")
