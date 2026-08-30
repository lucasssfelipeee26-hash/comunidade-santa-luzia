from pathlib import Path

root = Path(__file__).resolve().parents[2]
feature = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/features/admin/LiturgyArchiveAdminFeature.kt"
admin = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/features/admin/AdminDataFeature.kt"
client = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/core/network/NativeHttpClient.kt"
api = root / "app/api/admin/acervo-liturgico/route.ts"
storage = root / "lib/acervo-liturgico-storage.ts"
manifest_api = root / "app/api/acervo-liturgico/manifest/route.ts"
file_api = root / "app/api/acervo-liturgico/arquivo/route.ts"

for path in (feature, admin, client, api, storage, manifest_api, file_api):
    assert path.is_file(), f"Arquivo obrigatório ausente: {path}"

feature_text = feature.read_text(encoding="utf-8")
admin_text = admin.read_text(encoding="utf-8")
client_text = client.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")
storage_text = storage.read_text(encoding="utf-8")
manifest_api_text = manifest_api.read_text(encoding="utf-8")
file_api_text = file_api.read_text(encoding="utf-8")

assert 'MAX_ARCHIVE_BYTES = 30 * 1024 * 1024' in feature_text
assert 'ActivityResultContracts.OpenDocument()' in feature_text
assert 'endsWith(".tar")' in feature_text
assert 'requestMultipart(' in feature_text
assert 'path = "/api/admin/acervo-liturgico"' in feature_text
assert 'fieldName = "arquivo"' in feature_text
assert 'mimeType = "application/x-tar"' in feature_text
assert 'LiturgyArchiveAdminScreen(container = container' in admin_text
assert 'showArchiveAdmin = true' in admin_text
assert 'internal data class MultipartUpload' in client_text
assert 'arquivo.size > 30 * 1024 * 1024' in api_text
assert 'arquivo.name.toLowerCase().endsWith(".tar")' in api_text
assert 'Apenas moderadores.' in api_text
assert 'mutateOfflineFirst' not in feature_text
assert 'enqueue' not in feature_text.lower()

# O upload administrativo precisa alterar de verdade a fonte pública servida.
assert 'function lerManifestoPersistenteValido()' in storage_text
assert 'const persistente = lerManifestoPersistenteValido()' in storage_text
assert 'if (persistente) return persistente' in storage_text
assert 'const persistenteManifesto = lerManifestoPersistenteValido()' in storage_text
assert 'if (persistenteManifesto)' in storage_text
assert 'const arquivosEsperados = arquivosDoManifesto(manifesto)' in storage_text
assert 'const faltantes = arquivosEsperados.filter' in storage_text
assert 'escritos.filter((item) => item !== "manifest.json")' in storage_text
assert 'fs.copyFileSync(path.join(temporario, "manifest.json")' in storage_text
assert storage_text.index('escritos.filter((item) => item !== "manifest.json")') < storage_text.index('fs.copyFileSync(path.join(temporario, "manifest.json")')
assert 'lerManifestoAcervo()' in manifest_api_text
assert 'caminhoArquivoAcervo(nome)' in file_api_text

print("OK: administração do acervo usa .tar até 30 MB, multipart autenticado, não entra na fila offline e o pacote validado passa a ser a fonte pública servida.")
