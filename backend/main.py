import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import text

from core.config import settings
from core.database import engine, _get_db_url
from routers import auth, user, unit, raid, shield, referral, leaderboard, daily, internal, shop, pets, admin, clans

logger = logging.getLogger(__name__)

_basic_security = HTTPBasic()


def _verify_docs_access(credentials: HTTPBasicCredentials = Depends(_basic_security)):
    """Проверяет Basic Auth для доступа к /docs. Константное время — защита от timing attack."""
    ok_user = secrets.compare_digest(
        credentials.username.encode("utf-8"),
        settings.DOCS_USERNAME.encode("utf-8"),
    )
    ok_pass = secrets.compare_digest(
        credentials.password.encode("utf-8"),
        settings.DOCS_PASSWORD.encode("utf-8"),
    )
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учётные данные",
            headers={"WWW-Authenticate": "Basic"},
        )


async def run_migrations():
    """Применяет init.sql при первом запуске (если таблиц ещё нет)."""
    try:
        import os
        sql_path = os.path.join(os.path.dirname(__file__), "migrations", "init.sql")
        with open(sql_path, "r") as f:
            sql = f.read()
        async with engine.begin() as conn:
            # Выполняем каждый statement отдельно
            for statement in sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    await conn.execute(text(stmt))
        logger.info("Migrations applied successfully")
    except Exception as e:
        logger.error(f"Migration error: {e}")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations()
    from services.notification_triggers import notification_trigger_loop
    trigger_task = asyncio.create_task(notification_trigger_loop())
    yield
    trigger_task.cancel()
    try:
        await trigger_task
    except asyncio.CancelledError:
        pass


# docs_url=None, redoc_url=None — отключаем стандартные открытые маршруты
app = FastAPI(
    title="TG Warriors API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,   # openapi.json тоже закрываем; раздаём через защищённый endpoint
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(user.router)
app.include_router(unit.router)
app.include_router(raid.router)
app.include_router(shield.router)
app.include_router(referral.router)
app.include_router(leaderboard.router)
app.include_router(daily.router)
app.include_router(internal.router)
app.include_router(shop.router)
app.include_router(pets.router)
app.include_router(admin.router)
app.include_router(clans.router)


# ── Защищённая документация ───────────────────────────────────────────────────

@app.get("/docs", include_in_schema=False)
async def swagger_ui(_: None = Depends(_verify_docs_access)):
    """Swagger UI — доступен только администратору (Basic Auth)."""
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="TG Warriors API — Admin Docs",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
    )


@app.get("/openapi.json", include_in_schema=False)
async def openapi_schema(_: None = Depends(_verify_docs_access)):
    """OpenAPI-схема — тоже закрыта Basic Auth."""
    return JSONResponse(
        get_openapi(
            title=app.title,
            version=app.version,
            routes=app.routes,
        )
    )


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
