from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.models import models  # noqa: F401  (ensures models are registered before create_all)
from app.routes import auth, files

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustShare API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(files.router)


@app.get("/health")
def health():
    return {"status": "ok"}
