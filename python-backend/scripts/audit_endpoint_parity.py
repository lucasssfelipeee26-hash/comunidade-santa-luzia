from __future__ import annotations

import importlib
import re
from pathlib import Path

import santa_luzia_backend.main as backend_main

# Import explícito/reload: o CI deve auditar exatamente o código do checkout atual,
# nunca um módulo residual carregado por outra etapa/processo.
backend_main = importlib.reload(backend_main)
app = backend_main.app

ROOT = Path(__file__).resolve().parents[2]
API_ROOT = ROOT / "app" / "api"
METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}


def normalize(path: str) -> str:
    return re.sub(r"\{[^/]+\}", "{}", path.rstrip("/") or "/")


def next_path(route_file: Path) -> str:
    relative = route_file.parent.relative_to(API_ROOT)
    segments = []
    for part in relative.parts:
        match = re.fullmatch(r"\[([^]]+)\]", part)
        segments.append("{}" if match else part)
    return "/api" + ("/" + "/".join(segments) if segments else "")


def expected_routes():
    result: set[tuple[str, str]] = set()
    method_re = re.compile(r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b")
    export_re = re.compile(r"export\s*\{([^}]+)\}")
    for route_file in sorted(API_ROOT.rglob("route.ts")):
        text = route_file.read_text(encoding="utf-8")
        methods = set(method_re.findall(text))
        for block in export_re.findall(text):
            for method in METHODS:
                if re.search(rf"\b{method}\b", block):
                    methods.add(method)
        path = next_path(route_file)
        for method in methods:
            result.add((method, normalize(path)))
    return result


def actual_routes():
    result: set[tuple[str, str]] = set()
    for route in app.routes:
        path = str(getattr(route, "path", ""))
        methods = set(getattr(route, "methods", set()) or set())
        if not path.startswith("/api/"):
            continue
        for method in methods:
            if method in METHODS:
                result.add((method, normalize(path)))
    return result


def main():
    print(f"Backend importado de: {Path(backend_main.__file__).resolve()}")
    print(f"FastAPI version: {app.version}")
    registered = sorted(
        (str(getattr(route, 'path', '')), sorted(getattr(route, 'methods', set()) or set()))
        for route in app.routes
    )
    print(f"Objetos de rota registrados: {len(registered)}")
    for path, methods in registered:
        print(f"  ROUTE {','.join(methods) or '-'} {path}")

    expected = expected_routes()
    actual = actual_routes()
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    print(f"Next.js: {len(expected)} combinações método/rota")
    print(f"FastAPI: {len(actual)} combinações método/rota")
    if extra:
        print("Rotas Python adicionais:")
        for item in extra:
            print("  +", item)
    if missing:
        print("Rotas sem equivalente Python:")
        for item in missing:
            print("  -", item)
        raise SystemExit(1)
    print("Paridade estrutural de endpoints: OK")


if __name__ == "__main__":
    main()
