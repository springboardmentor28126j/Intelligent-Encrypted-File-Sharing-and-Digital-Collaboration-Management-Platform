FROM python:3.11-slim

WORKDIR /app

# Refresh CA certificates. Without this, some slim base images ship a
# stale cert bundle that fails the TLS handshake MongoDB Atlas requires
# (seen as "SSLError ... TLSV1_ALERT_INTERNAL_ERROR" at runtime).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads

# No --reload here: that's a dev-only feature (file-watching for hot
# reload) and was the cause of the WatchfilesRustInternalError crash
# seen in local Docker logs. It also has no place in production.
# $PORT is injected by Render/Railway at runtime; default to 8000 so
# this still works unchanged for local `docker build && docker run`.
ENV PORT=8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]