#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "native-android" / "app" / "src" / "main" / "java" / "br" / "com" / "comunidadesantaluzia" / "nativeapp"

activity = (NATIVE / "MainActivity.kt").read_text(encoding="utf-8")
dispatcher = (NATIVE / "core" / "notifications" / "NativeNotificationDispatcher.kt").read_text(encoding="utf-8")
bus = (NATIVE / "core" / "notifications" / "NotificationNavigationBus.kt").read_text(encoding="utf-8")
center = (NATIVE / "features" / "notifications" / "NotificationsFeature.kt").read_text(encoding="utf-8")
app = (NATIVE / "ui" / "ReferenceSantaLuziaApp.kt").read_text(encoding="utf-8")

errors: list[str] = []

def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)

require('putExtra("notificationHref"' in dispatcher, "Notificação do sistema não transporta notificationHref")
require('publishIntentAfterOptionalDebugSession(intent)' in activity, "Cold start não encaminha o Intent de notificação")
require('override fun onNewIntent(intent: Intent)' in activity, "App já aberto não trata novo Intent de notificação")
require(activity.count('publishIntentAfterOptionalDebugSession(intent)') >= 2, "Warm start não encaminha o Intent de notificação")
require('NotificationNavigationBus.publish(notificationHref)' in activity, "Encaminhador do Intent não publica notificationHref")
require('onOpenHref: (String) -> Unit = NotificationNavigationBus::publish' in center, "Central interna não usa o mesmo roteamento das notificações do sistema")
require('notification.href?.let(onOpenHref)' in center, "Toque na notificação interna não abre seu destino")
require('it.startsWith("/") && it.length <= 500' in bus, "Barramento aceita destino externo ou sem limite")
require('NotificationNavigationBus.href.collectAsStateWithLifecycle()' in app, "Compose não observa o destino pendente")
require('container.sessionStore.session.first()' in app and 'sessionReady = true' in app, "Deep-link não espera restauração da sessão")
require('protectedReferenceRoutes' in app and '!session.loggedIn' in app, "Rotas privadas de notificação não exigem sessão")
require('afterLoginRoute = destination' in app, "Destino privado não é preservado até o login")
require('NotificationNavigationBus.consume(href)' in app, "Destino processado não é consumido")
require('private val moderatorReferenceRoutes = setOf(' in app, "Conjunto central de rotas de moderador ausente")
require('destination in moderatorReferenceRoutes && session.loggedIn && session.userType != "moderador"' in app, "Deep-links administrativos não protegem o papel de moderador")
for route in ('ReferenceRoute.Administration', 'ReferenceRoute.AdminQuizzes', 'ReferenceRoute.ThemeAdmin', 'ReferenceRoute.ArchiveAdmin', 'ReferenceRoute.Diagnostics'):
    require(route in app, f"Rota administrativa protegida ausente: {route}")

expected_routes = {
    '"escala" in path -> ReferenceRoute.Scale': "Escala",
    '"formacao" in path -> ReferenceRoute.Formation': "Formação",
    '"ranking" in path -> ReferenceRoute.Ranking': "Ranking",
    '"atras" in path || "pontual" in path -> ReferenceRoute.Delays': "Atrasos",
    '"perfis" in path -> ReferenceRoute.Profiles': "Perfis",
    '"registro" in path || "presenca" in path -> ReferenceRoute.Records': "Registros/presenças",
    '"notific" in path -> ReferenceRoute.Notifications': "Notificações",
    '"biblioteca" in path -> ReferenceRoute.Library': "Biblioteca",
    '"centro-liturgico" in path -> ReferenceRoute.LiturgyCenter': "Centro Litúrgico",
    '"liturgia" in path -> ReferenceRoute.Liturgy': "Liturgia",
    '"/moderador/tema" in path || "/admin/cores" in path -> ReferenceRoute.ThemeAdmin': "Cores do Site",
    '"/moderador/ranking" in path || "/admin/quizzes" in path -> ReferenceRoute.AdminQuizzes': "Quizzes administrativos",
    '"acervo-liturgico" in path || "/admin/acervo" in path -> ReferenceRoute.ArchiveAdmin': "Acervo Litúrgico administrativo",
}
for token, label in expected_routes.items():
    require(token in app, f"Mapeamento de deep-link ausente: {label}")

if errors:
    print("AUDITORIA DE NAVEGAÇÃO POR NOTIFICAÇÃO — FALHOU", file=sys.stderr)
    for error in errors:
        print(f"✗ {error}", file=sys.stderr)
    raise SystemExit(1)

print("AUDITORIA DE NAVEGAÇÃO POR NOTIFICAÇÃO")
print("✓ cold start, warm start e central interna")
print("✓ somente caminhos internos")
print("✓ sessão restaurada antes da navegação")
print("✓ rotas privadas redirecionam ao login")
print("✓ todas as rotas administrativas exigem moderador")
print("✓ destinos legados principais mapeados para telas nativas")