from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .data_protection import protect_database
from .routers import (
    app_admin,
    archive,
    auth,
    constancy,
    content,
    formations,
    games,
    members,
    notifications,
    profiles,
    quizzes,
    ranking,
    scales,
    settings,
)

app = FastAPI(
    title="Comunidade Santa Luzia — Backend Python",
    version="0.2.0",
    docs_url="/docs",
    redoc_url=None,
)


@app.middleware("http")
async def database_protection(request: Request, call_next):
    response = await call_next(request)
    # Após cada requisição, qualquer alteração persistida ganha snapshot validado.
    # Falhas do auditor não devem esconder a resposta da API; o diagnóstico reporta
    # o estado em /api/diagnostico.
    try:
        protect_database()
    except Exception:
        pass
    return response


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        body = exc.detail
    else:
        body = {"erro": str(exc.detail)}
    return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)


@app.get("/health")
async def health():
    return {"ok": True, "backend": "python", "service": "santa-luzia", "version": "0.2.0"}


for router in (
    auth.router,
    profiles.router,
    members.router,
    scales.router,
    formations.router,
    ranking.router,
    games.router,
    constancy.router,
    quizzes.router,
    notifications.router,
    content.router,
    archive.router,
    settings.router,
    app_admin.router,
):
    app.include_router(router)
