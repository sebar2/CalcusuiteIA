import os
from typing import Optional

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(env_file=".env", extra="ignore")

        MELI_CLIENT_ID: str = os.getenv("MELI_CLIENT_ID", "5376694505612300")
        MELI_CLIENT_SECRET: str = os.getenv("MELI_CLIENT_SECRET", "t9hBq41DBS8d8Z1nfoUavmd3yh7Yos38")
        SERPER_API_KEY: str = os.getenv("SERPER_API_KEY", "e56b138d18a92e10a103157e8829b509a47661de")
        OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    settings = Settings()
except ImportError:
    from pydantic import BaseModel, ConfigDict
    from dotenv import load_dotenv

    load_dotenv()

    class Settings(BaseModel):
        model_config = ConfigDict(extra="ignore")

        MELI_CLIENT_ID: str = os.getenv("MELI_CLIENT_ID", "5376694505612300")
        MELI_CLIENT_SECRET: str = os.getenv("MELI_CLIENT_SECRET", "t9hBq41DBS8d8Z1nfoUavmd3yh7Yos38")
        SERPER_API_KEY: str = os.getenv("SERPER_API_KEY", "e56b138d18a92e10a103157e8829b509a47661de")
        OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    settings = Settings()
