package br.com.comunidadesantaluzia.nativeapp

import android.app.Application
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.sync.SyncScheduler

class SantaLuziaApplication : Application() {
    internal lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        container.auditor.install()
        SyncScheduler.ensurePeriodicSync(this)
    }
}
