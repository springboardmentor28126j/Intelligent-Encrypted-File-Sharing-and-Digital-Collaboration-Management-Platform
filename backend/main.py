from fastapi import FastAPI

app = FastAPI(
    title="TrustShare API",
    description="Secure File Sharing and Digital Collaboration Platform",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "message": "TrustShare API is running",
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TrustShare Backend",
    }