from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.routes import auth, file, share
from app.core.supabase_client import init_supabase

Base.metadata.create_all(bind=engine)
init_supabase()

app = FastAPI(title="TrustShare API")

# Allow React Frontend Connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(file.router)
app.include_router(share.router)

@app.get("/")
def root():
    return {"message": "TrustShare Backend Working Successfully!"}