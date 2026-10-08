"""Configuración global de pytest."""
import os

# Las pruebas nunca deben depender del portal externo de Compras Estatales ni de Ollama.
os.environ.setdefault("TENDERS_FEED_OFFLINE", "1")
