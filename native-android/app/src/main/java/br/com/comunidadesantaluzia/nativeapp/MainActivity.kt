package br.com.comunidadesantaluzia.nativeapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
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
        requestNotificationPermissionIfNeeded()
        setContent {
            SantaLuziaTheme {
                SantaLuziaApp(app.container)
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
