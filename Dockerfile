# UniFind runs as a single container: FastAPI serves both the API and the
# compiled React bundle, so the browser talks to one origin and the SameSite=Lax
# session cookie keeps working. See backend/main.py for the static mount.

# --- Stage 1: compile the React frontend -----------------------------------
FROM node:20-slim AS frontend

WORKDIR /build

# Copy manifests first so this layer is cached until dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY client ./client

# "npm run build" typechecks before bundling, so a type error fails the deploy
# here rather than surfacing as a broken page in the browser.
RUN npm run build


# --- Stage 2: the runtime image --------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY --from=frontend /build/dist ./dist

# The app resolves the frontend relative to backend/, i.e. /app/dist.
EXPOSE 8000

# Render (and most free hosts) inject the port to bind as $PORT. Falling back to
# 8000 keeps "docker run -p 8000:8000" working locally with no extra flags.
CMD ["sh", "-c", "cd backend && exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
