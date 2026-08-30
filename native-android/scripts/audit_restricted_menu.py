from pathlib import Path

root = Path(__file__).resolve().parents[2]
menu = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/RestrictedMenu.kt"
area = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/ReferenceRestrictedArea.kt"
app = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/ReferenceSantaLuziaApp.kt"
activity = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/MainActivity.kt"
history = root / "native-android/REFERENCE-HISTORY.md"

for path in (menu, area, app, activity, history):
    assert path.is_file(), f"Arquivo obrigatório ausente: {path}"

menu_text = menu.read_text(encoding="utf-8")
area_text = area.read_text(encoding="utf-8")
app_text = app.read_text(encoding="utf-8")
activity_text = activity.read_text(encoding="utf-8")
history_text = history.read_text(encoding="utf-8")

member_labels = ["Meu perfil", "Atrasos", "Jornada", "Escala", "Formação"]
moderator_labels = ["Painel", "Atrasos", "Jornada", "Escalas", "Formação", "Presenças", "Registro", "Quizzes", "Cores", "Escala pública", "Dados", "Acervo", "Auditor"]
for label in member_labels + moderator_labels:
    assert f'"{label}"' in menu_text, f"Atalho nativo ausente: {label}"

assert menu_text.count("RestrictedMenuItem(") >= 18, "Esperados 5 atalhos de membro + 13 de moderador"
assert "RestrictedMenuButton(" in area_text, "Menu deve estar integrado ao cabeçalho da Área Restrita"
assert "RestrictedMenuButton(" not in activity_text, "Menu flutuante global não deve voltar"
assert "ReferenceSantaLuziaApp(app.container)" in activity_text
assert "ReferenceRestrictedAreaScreen(" in app_text
assert '"/admin/dados"' in menu_text and '"/area-restrita/moderador/diagnostico"' in menu_text
assert 'Administração e configurações ficam aqui — não no painel.' in menu_text
assert 'Administração de dados` fica aqui e nunca como um grande cartão do dashboard.' in history_text
assert 'Meu relatório' in history_text and 'NÃO reintroduzir' in history_text
assert '"Meu relatório"' not in app_text

print("OK: menu restrito final está integrado ao painel, preserva membro/moderador e mantém Administração fora do dashboard.")
