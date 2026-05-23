import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from core.database import engine, _get_db_url
from routers import auth, user, unit, raid, shield, referral, leaderboard, daily, internal, shop, pets

logger = logging.getLogger(__name__)


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
    yield


app = FastAPI(title="TG Warriors API", version="1.0.0", lifespan=lifespan)

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


@app.get("/health")
async def health():
    return {"status": "ok"}
