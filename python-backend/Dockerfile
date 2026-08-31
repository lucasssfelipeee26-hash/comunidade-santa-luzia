FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/python-backend \
    DATA_DIR=/data

WORKDIR /app

COPY python-backend/requirements.txt /app/python-backend/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r /app/python-backend/requirements.txt

# Código do servidor e recursos estáticos realmente consumidos em runtime.
COPY python-backend /app/python-backend
COPY content /app/content
COPY public/offline /app/public/offline
COPY config /app/config
COPY lib/biblioteca.ts /app/lib/biblioteca.ts
COPY *.html.json.gz /app/

# O backend reescrito deve usar o mesmo volume persistente da versão Android/Beta
# anterior. Nunca inicializar uma base paralela dentro da imagem em /app/data.
RUN mkdir -p /data \
    && python -m compileall -q /app/python-backend/santa_luzia_backend /app/python-backend/scripts

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:' + __import__('os').environ.get('PORT','8000') + '/health', timeout=3).read()" || exit 1

CMD ["sh", "-c", "uvicorn santa_luzia_backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
