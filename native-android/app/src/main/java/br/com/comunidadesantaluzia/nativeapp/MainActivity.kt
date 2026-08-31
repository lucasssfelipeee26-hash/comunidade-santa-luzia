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
        requestNotificationPermissionIfNeeded()

        val launchIntent = intent
        val debugRole = launchIntent.getStringExtra("debugRole")
        if (BuildConfig.DEBUG && !debugRole.isNullOrBlank()) {
            lifecycleScope.launch {
                seedDebugSessionAndPublish(launchIntent, debugRole)
                setReferenceContent()
            }
        } else {
            NotificationNavigationBus.publish(launchIntent.getStringExtra("notificationHref"))
            setReferenceContent()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val debugRole = intent.getStringExtra("debugRole")
        if (BuildConfig.DEBUG && !debugRole.isNullOrBlank()) {
            lifecycleScope.launch {
                seedDebugSessionAndPublish(intent, debugRole)
            }
        } else {
            NotificationNavigationBus.publish(intent.getStringExtra("notificationHref"))
        }
    }

    private suspend fun seedDebugSessionAndPublish(intent: Intent, debugRole: String) {
        val moderator = debugRole.equals("moderator", ignoreCase = true) ||
            debugRole.equals("moderador", ignoreCase = true)
        app.container.sessionStore.saveAuthenticatedSession(
            userId = intent.getStringExtra("debugId") ?: if (moderator) "debug-moderator" else "debug-member",
            userName = intent.getStringExtra("debugName") ?: if (moderator) "Moderador de Teste" else "Membro de Teste",
            userType = if (moderator) "moderador" else "membro",
            function = intent.getStringExtra("debugFunction") ?: if (moderator) "Moderador" else "Coroinha",
            sessionCookie = null,
        )
        NotificationNavigationBus.publish(
            intent.getStringExtra("notificationHref")
                ?: if (moderator) "/area-restrita/moderador" else "/area-restrita/membro",
        )
    }

    private fun setReferenceContent() {
        setContent {
            SantaLuziaTheme {
                ReferenceSantaLuziaApp(app.container)
            }
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
