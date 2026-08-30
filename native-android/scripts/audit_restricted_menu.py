from pathlib import Path

root = Path(__file__).resolve().parents[2]
menu = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/RestrictedMenu.kt"
app = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/SantaLuziaApp.kt"
activity = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/MainActivity.kt"
legacy = root / "components/area-menu.tsx"

for path in (menu, app, activity, legacy):
    assert path.is_file(), f"Arquivo obrigatório ausente: {path}"

menu_text = menu.read_text(encoding="utf-8")
app_text = app.read_text(encoding="utf-8")
activity_text = activity.read_text(encoding="utf-8")
legacy_text = legacy.read_text(encoding="utf-8")

labels = ["Perfis", "Atrasos", "Jornada", "Escalas", "Formação", "Presenças", "Registro", "Quizzes", "Dados", "Cores", "Diagnóstico"]
for label in labels:
    assert f'"{label}"' in menu_text, f"Atalho nativo ausente: {label}"

assert menu_text.count("RestrictedMenuItem(") >= 15  # 4 de membro + 11 de moderador
assert 'RestrictedMenuButton(' in activity_text
assert 'NotificationNavigationBus::publish' in activity_text
assert 'if (session.loggedIn)' in activity_text
assert 'AreaAction("Administração de dados"' not in app_text
assert 'Route.AdminQuizzes("admin-quizzes")' in app_text
assert 'Route.ThemeAdmin("admin-cores")' in app_text
assert 'Route.ArchiveAdmin("admin-acervo")' in app_text
assert '"diagnostico" in path -> Route.Diagnostics' in app_text
assert '"/moderador/tema" in path || "/admin/cores" in path -> Route.ThemeAdmin' in app_text
assert '"/moderador/ranking" in path || "/admin/quizzes" in path -> Route.AdminQuizzes' in app_text
assert 'destination in moderatorRoutes' in app_text

# Confere que os rótulos principais continuam existindo também no menu aprovado da Beta.
for label in ("Perfis", "Atrasos", "Jornada", "Escalas", "Formação", "Presenças", "Registro", "Quizzes", "Dados", "Cores", "Diagnóstico"):
    assert label in legacy_text, f"Referência Beta não contém {label}"

print("OK: menu restrito nativo preserva os 11 atalhos de moderador, fica disponível com sessão e mantém Administração fora do dashboard principal.")
