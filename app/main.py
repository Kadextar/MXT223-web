from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.config import BASE_DIR, SENTRY_DSN
from app.database import database, init_db
from app.routers import auth, schedule, admin, push, api, pages
import sentry_sdk

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,  # Capture 10% of transactions for performance monitoring
        _experiments={
            "profiles_sample_rate": 0.1,
        },
    )

app = FastAPI()

# Mount Static Files
app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "web" / "static"),
    name="static"
)

# Startup/Shutdown Events
@app.on_event("startup")
async def startup():
    await database.connect()
    try:
        await init_db()
    except Exception as e:
        print(f"CRITICAL: init_db failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

# Include Routers
app.include_router(auth.router)
app.include_router(schedule.router)
app.include_router(admin.router)
app.include_router(push.router)
app.include_router(api.router)
app.include_router(pages.router)

from app.routers import ratings
app.include_router(ratings.router)
