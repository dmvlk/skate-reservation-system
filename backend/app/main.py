from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

from app.routers import categories as categories_router
from app.routers import availability as availability_router
from app.routers import bookings as bookings_router
from app.routers import my_bookings as my_bookings_router
from app.routers import auth as auth_router
from app.routers import admin as admin_router


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

if settings.cors_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app.include_router(categories_router.router)
app.include_router(availability_router.router)
app.include_router(bookings_router.router)
app.include_router(my_bookings_router.router)
app.include_router(auth_router.router)
app.include_router(admin_router.router)


@app.get("/health", tags=["system"])
def healthcheck():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
