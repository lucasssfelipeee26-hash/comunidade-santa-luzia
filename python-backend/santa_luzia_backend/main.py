from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .routers import auth, profiles

app = FastAPI(
    title="Comunidade Santa Luzia — Backend Python",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
)


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        body = exc.detail
    else:
        body = {"erro": str(exc.detail)}
    return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)


@app.get("/health")
async def health():
    return {"ok": True, "backend": "python", "service": "santa-luzia"}


app.include_router(auth.router)
app.include_router(profiles.router)
