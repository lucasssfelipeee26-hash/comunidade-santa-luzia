#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android" / "app" / "src" / "main" / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"

activity = (NATIVE / "MainActivity.kt").read_text(encoding="utf-8")
dispatcher = (NATIVE / "core" / "notifications" / "NativeNotificationDispatcher.kt").read_text(encoding="utf-8")
bus = (NATIVE / "core" / "notifications" / "NotificationNavigationBus.kt").read_text(encoding="utf-8")
app = (NATIVE / "ui" / "SantaLuziaApp.kt").read_text(encoding="utf-8")

errors: list[str] = []

def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)

require('putExtra("notificationHref"' in dispatcher, "Notificação do sistema não transporta notificationHref")
require('NotificationNavigationBus.publish(intent?.getStringExtra("notificationHref"))' in activity, "Cold start não publica o destino da notificação")
require('override fun onNewIntent(intent: Intent)' in activity, "App já aberto não trata novo Intent de notificação")
require('NotificationNavigationBus.publish(intent.getStringExtra("notificationHref"))' in activity, "Warm start não publica o destino da notificação")
require('it.startsWith("/") && it.length <= 500' in bus, "Barramento aceita destino externo ou sem limite")
require('NotificationNavigationBus.href.collectAsStateWithLifecycle()' in app, "Compose não observa o destino pendente")
require('container.sessionStore.session.first()' in app and 'sessionReady = true' in app, "Deep-link não espera restauração da sessão")
require('protectedNotificationRoutes' in app and '!session.loggedIn' in app, "Rotas privadas de notificação não exigem sessão")
require('afterLoginRoute = destination' in app, "Destino privado não é preservado até o login")
require('NotificationNavigationBus.consume(href)' in app, "Destino processado não é consumido")
require('destination == Route.Administration && session.loggedIn && session.userType != "moderador"' in app, "Deep-link administrativo não protege papel de moderador")

expected_routes = {
    '"escala" in path -> Route.Scale': "Escala",
    '"formacao" in path -> Route.Formation': "Formação",
    '"ranking" in path -> Route.Ranking': "Ranking",
    '"atras" in path || "pontual" in path -> Route.Delays': "Atrasos",
    '"perfis" in path -> Route.Profiles': "Perfis",
    '"registro" in path || "presenca" in path -> Route.Records': "Registros/presenças",
    '"notific" in path -> Route.Notifications': "Notificações",
    '"biblioteca" in path -> Route.Library': "Biblioteca",
    '"centro-liturgico" in path -> Route.LiturgyCenter': "Centro Litúrgico",
    '"liturgia" in path -> Route.Liturgy': "Liturgia",
}
for token, label in expected_routes.items():
    require(token in app, f"Mapeamento de deep-link ausente: {label}")

if errors:
    print("AUDITORIA DE NAVEGAÇÃO POR NOTIFICAÇÃO — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA DE NAVEGAÇÃO POR NOTIFICAÇÃO")
print("✓ cold start e warm start")
print("✓ somente caminhos internos")
print("✓ sessão restaurada antes da navegação")
print("✓ rotas privadas redirecionam ao login")
print("✓ administração exige moderador")
print("✓ destinos legados principais mapeados para telas nativas")
