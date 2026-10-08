# API v1 package
from app.api.v1.endpoints import router as v1_router
from app.api.v1.advisor import router as advisor_router

__all__ = ["v1_router", "advisor_router"]
