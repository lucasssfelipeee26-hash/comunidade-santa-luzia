from pathlib import Path

root = Path(__file__).resolve().parents[2]
app = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/ReferenceSantaLuziaApp.kt"
area = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/ReferenceRestrictedArea.kt"
menu = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/RestrictedMenu.kt"
theme = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/theme/SantaLuziaTheme.kt"
gradle = root / "native-android/app/build.gradle.kts"
history = root / "native-android/REFERENCE-HISTORY.md"
activity = root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/MainActivity.kt"

for path in (app, area, menu, theme, gradle, history, activity):
    assert path.is_file(), f"Arquivo obrigatório ausente: {path}"

app_text = app.read_text(encoding="utf-8")
area_text = area.read_text(encoding="utf-8")
menu_text = menu.read_text(encoding="utf-8")
theme_text = theme.read_text(encoding="utf-8")
gradle_text = gradle.read_text(encoding="utf-8")
history_text = history.read_text(encoding="utf-8")
activity_text = activity.read_text(encoding="utf-8")

# Tokens exatos da Windows Beta / Manto Rubi.
for token in ("0xFF7B1326", "0xFF5A0B18", "0xFFD4AF37", "0xFFF2CF62", "0xFFFFF8EE", "0xFFFFFAF4", "0xFF3F171C", "0xFFDCC7B7"):
    assert token in theme_text, f"Token visual de referência ausente: {token}"

# Home final: exatamente quatro atalhos públicos aprovados.
for label in ("Centro Litúrgico", "Escala do Dia", "Biblioteca", "Liturgia Diária"):
    assert f'"{label}"' in app_text, f"Atalho público ausente: {label}"
assert app_text.count("ReferenceHomeCard(") == 5, "Esperada definição + 4 chamadas de ReferenceHomeCard"
assert '"Formação"' not in app_text[app_text.index("private fun ReferenceHomeScreen"):app_text.index("private fun ReferencePublicHeader")]
assert '"Seja um Membro"' not in app_text

# Arte real, sem repetir o ícone como hero.
assert 'reference/hero-adoracao.jpg' in app_text
assert 'include("hero-adoracao.jpg", "santa-luzia-logo.jpg")' in gradle_text
assert 'into("reference")' in gradle_text

# Login e sessão.
for marker in ("Bem-vindo ao Santa Luzia", "Continuar como visitante", "Usuário ou e-mail", "Esqueci a senha"):
    assert marker in app_text or marker in (root / "native-android/app/src/main/java/br/com/comunidadesantaluzia/nativeapp/ui/AuthActions.kt").read_text(encoding="utf-8"), marker
assert "Deseja sair?" in area_text
assert 'Text("Sim")' in area_text and 'Text("Não")' in area_text

# Barra inferior autenticada final.
nav_block = app_text[app_text.index("private val authenticatedReferenceNavigation"):app_text.index("private val moderatorReferenceRoutes")]
for label in ("Início", "Escala", "Formação", "Quiz"):
    assert f'"{label}"' in nav_block
assert nav_block.count("ReferenceNavItem(") == 4
assert "if (session.loggedIn" in app_text

# Painéis e organização administrativa.
for marker in ("Meu próximo compromisso", "Justificar uma ausência", "Registros administrativos são privados", "Acólitos", "Coroinhas", "Aguardando", "Advertências", "Atrasos", "Presenças"):
    assert marker in area_text, f"Elemento de painel ausente: {marker}"
assert "RestrictedMenuButton(" in area_text
assert "Administração e configurações ficam aqui — não no painel." in menu_text
assert 'CompactDashboardAction("Dados"' not in area_text
assert 'ModeratorShortcut("Dados"' not in area_text

# Regras finais que não podem regressar.
combined_ui = app_text + "\n" + area_text
for banned in ("porta", "personagem", "Meu relatório"):
    assert banned.lower() not in combined_ui.lower(), f"Regressão proibida encontrada na UI: {banned}"
assert "ReferenceSantaLuziaApp(app.container)" in activity_text
assert "SantaLuziaApp(app.container)" not in activity_text
assert "RestrictedMenuButton(" not in activity_text

# APK beta isolado da produção.
assert 'applicationId = "br.com.comunidadesantaluzia.nativebeta"' in gradle_text
assert 'versionCode = 30019' in gradle_text
assert 'versionName = "3.0.0-native-beta.19-r1"' in gradle_text

# Contrato histórico precisa citar decisões críticas.
for marker in ("RELATORIO-MOTION-BETA15.txt", "RELATORIO-MOTION-BETA16.txt", "RELATORIO-MOTION-BETA17.txt", "RELATORIO-MOTION-BETA18.txt", "Python/FastAPI", "Deep Scan", "Administração de dados", "Next.js hydration mismatch"):
    assert marker in history_text, f"Histórico obrigatório ausente: {marker}"

print("OK: fidelidade Windows Beta -> Android Kotlin/Python protegida pelo contrato de referência.")
