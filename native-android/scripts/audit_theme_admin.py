from pathlib import Path

root = Path(__file__).resolve().parents[2]
feature = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/features/admin/ThemeAdminFeature.kt"
admin = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/features/admin/AdminDataFeature.kt"
api = root / "app/api/configuracao/tema/route.ts"
shared = root / "lib/site-theme-shared.ts"

for path in (feature, admin, api, shared):
    assert path.is_file(), f"Arquivo obrigatório ausente: {path}"

feature_text = feature.read_text(encoding="utf-8")
admin_text = admin.read_text(encoding="utf-8")
api_text = api.read_text(encoding="utf-8")
shared_text = shared.read_text(encoding="utf-8")

for theme_id in ("manto-rubi", "bordo-ouro", "marfim-rubi", "vinho-dourado"):
    assert theme_id in feature_text, f"Tema nativo ausente: {theme_id}"
    assert theme_id in shared_text, f"Tema Beta ausente: {theme_id}"

assert 'readLocalFirst("site-theme", "/api/configuracao/tema", authenticated = false)' in feature_text
assert 'mutateOnlineOnly("POST", "/api/configuracao/tema", payload)' in feature_text
assert 'ThemeAdminScreen(container = container' in admin_text
assert 'showThemeAdmin = true' in admin_text
assert 'A escolha altera somente o site público' in feature_text
assert 'Apenas moderadores podem alterar as cores do site.' in api_text
assert 'sessao.tipo !== "moderador"' in api_text
assert 'mutateOfflineFirst' not in feature_text
assert 'enqueue' not in feature_text.lower()

print("OK: administração nativa de tema preserva as quatro paletas da Beta e não enfileira mudança global offline.")
