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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.comunidadesantaluzia.nativeapp.core.notifications.NotificationNavigationBus
import br.com.comunidadesantaluzia.nativeapp.core.session.NativeSession
import br.com.comunidadesantaluzia.nativeapp.ui.RestrictedMenuButton
import br.com.comunidadesantaluzia.nativeapp.ui.SantaLuziaApp
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaLuziaTheme

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
        NotificationNavigationBus.publish(intent?.getStringExtra("notificationHref"))
        requestNotificationPermissionIfNeeded()
        setContent {
            SantaLuziaTheme {
                val session by app.container.sessionStore.session.collectAsStateWithLifecycle(initialValue = NativeSession())
                Box(Modifier.fillMaxSize()) {
                    SantaLuziaApp(app.container)
                    if (session.loggedIn) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(top = 18.dp, end = 12.dp),
                        ) {
                            RestrictedMenuButton(
                                session = session,
                                onNavigateHref = NotificationNavigationBus::publish,
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        NotificationNavigationBus.publish(intent.getStringExtra("notificationHref"))
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
