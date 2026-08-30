#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "native-android" / "app" / "src" / "main"
JAVA = APP / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"

http = (JAVA / "core" / "network" / "NativeHttpClient.kt").read_text(encoding="utf-8")
formation = (JAVA / "features" / "formation" / "FormationFeature.kt").read_text(encoding="utf-8")
material_store = (JAVA / "features" / "formation" / "FormationMaterialStore.kt").read_text(encoding="utf-8")
auditor = (JAVA / "core" / "audit" / "SantaLuziaAuditor.kt").read_text(encoding="utf-8")
manifest = (APP / "AndroidManifest.xml").read_text(encoding="utf-8")
paths = (APP / "res" / "xml" / "file_paths.xml").read_text(encoding="utf-8")

errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


require("downloadToFile" in http, "Cliente HTTP não possui download autenticado de arquivo")
require(".part" in http and "renameTo" in http, "Download de material não usa gravação temporária/atômica")
require("Content-Length" in http and "Download incompleto" in http, "Download não valida integridade básica pelo tamanho")
require("FormationMaterialStore.cachedFile" in formation, "Tela de Formação não verifica cópia local")
require("FormationMaterialStore.ensureDownloaded" in formation, "Tela de Formação não salva material no aparelho")
require("Material disponível offline" in formation, "Tela não informa disponibilidade offline do material")
require("FileProvider.getUriForFile" in material_store, "Material local não usa URI segura para abrir")
require('path="formation-materials/"' in paths, "FileProvider não restringe o acesso aos materiais de Formação")

require("fun exportReport(): File" in auditor, "Auditor não gera relatório local")
require("fun shareReport(file: File): Boolean" in auditor, "Auditor não possui compartilhamento explícito")
require("FileProvider.getUriForFile" in auditor, "Auditor não compartilha por FileProvider")
require("FLAG_GRANT_READ_URI_PERMISSION" in auditor, "Compartilhamento do Auditor não concede acesso temporário seguro")
require('path="diagnosticos/"' in paths, "FileProvider não restringe a pasta de diagnósticos")
require("android:exported=\"false\"" in manifest and "FileProvider" in manifest, "FileProvider não está privado no manifesto")

if errors:
    print("AUDITORIA OFFLINE/ARQUIVOS NATIVOS — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA OFFLINE/ARQUIVOS NATIVOS")
print("✓ materiais de Formação: download autenticado e cache offline")
print("✓ diagnóstico: geração e compartilhamento seguro separados")
