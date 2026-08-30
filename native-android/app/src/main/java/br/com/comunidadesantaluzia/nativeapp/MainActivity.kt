package br.com.comunidadesantaluzia.nativeapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import br.com.comunidadesantaluzia.nativeapp.core.notifications.NotificationNavigationBus
import br.com.comunidadesantaluzia.nativeapp.ui.ReferenceSantaLuziaApp
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaLuziaTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val app: SantaLuziaApplication get() = application as SantaLuziaApplication

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        // A central interna continua funcionando mesmo quando o usuário não concede
        // a permissão do sistema; somente o alerta fora do app fica desativado.
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        app.container.auditor.attach(this)
        publishIntentAfterOptionalDebugSession(intent)
        requestNotificationPermissionIfNeeded()
        setContent {
            SantaLuziaTheme {
                ReferenceSantaLuziaApp(app.container)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        publishIntentAfterOptionalDebugSession(intent)
    }

    private fun publishIntentAfterOptionalDebugSession(intent: Intent?) {
        val notificationHref = intent?.getStringExtra("notificationHref")
        val debugRole = intent?.getStringExtra("debugRole")
        if (BuildConfig.DEBUG && !debugRole.isNullOrBlank()) {
            lifecycleScope.launch {
                val moderator = debugRole.equals("moderator", ignoreCase = true) || debugRole.equals("moderador", ignoreCase = true)
                app.container.sessionStore.saveAuthenticatedSession(
                    userId = intent?.getStringExtra("debugId") ?: if (moderator) "debug-moderator" else "debug-member",
                    userName = intent?.getStringExtra("debugName") ?: if (moderator) "Moderador de Teste" else "Membro de Teste",
                    userType = if (moderator) "moderador" else "membro",
                    function = intent?.getStringExtra("debugFunction") ?: if (moderator) "Moderador" else "Coroinha",
                    sessionCookie = null,
                )
                NotificationNavigationBus.publish(notificationHref ?: if (moderator) "/area-restrita/moderador" else "/area-restrita/membro")
            }
        } else {
            NotificationNavigationBus.publish(notificationHref)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onDestroy() {
        if (isFinishing) app.container.auditor.detach()
        super.onDestroy()
    }
}
