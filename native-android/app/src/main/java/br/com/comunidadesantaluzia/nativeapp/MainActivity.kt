package br.com.comunidadesantaluzia.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.com.comunidadesantaluzia.nativeapp.ui.SantaLuziaApp
import br.com.comunidadesantaluzia.nativeapp.ui.theme.SantaLuziaTheme

class MainActivity : ComponentActivity() {
    private val app: SantaLuziaApplication get() = application as SantaLuziaApplication

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        app.container.auditor.attach(this)
        setContent {
            SantaLuziaTheme {
                SantaLuziaApp(app.container)
            }
        }
    }

    override fun onDestroy() {
        if (isFinishing) app.container.auditor.detach()
        super.onDestroy()
    }
}
