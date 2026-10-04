FROM python:3.11-slim

WORKDIR /app

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
