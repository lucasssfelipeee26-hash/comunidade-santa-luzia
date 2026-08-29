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
        // A atualização imediata também usa NetworkType.CONNECTED. Portanto, se o app
        // abrir sem internet, nada bloqueia a interface: o WorkManager mantém a tarefa
        // aguardando e sincroniza quizzes, notificações, escalas e demais caches assim
        // que o aparelho voltar a ter conexão.
        SyncScheduler.syncNow(this)
    }
}
