from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "TrustShare backend is running!"}