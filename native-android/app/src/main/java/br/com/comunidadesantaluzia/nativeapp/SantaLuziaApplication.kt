package br.com.comunidadesantaluzia.nativeapp

import android.app.Application
import br.com.comunidadesantaluzia.nativeapp.core.AppContainer
import br.com.comunidadesantaluzia.nativeapp.core.sync.SyncScheduler
import java.util.concurrent.Executors

class SantaLuziaApplication : Application() {
    internal lateinit var container: AppContainer
        private set

    private val startupExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "santa-luzia-startup").apply { isDaemon = true }
    }

    override fun onCreate() {
        super.onCreate()
        // O container só instancia objetos leves. Nenhuma rede/abertura do SQLite deve
        // ser condição para a primeira tela aparecer.
        container = AppContainer(this)
        container.auditor.install()

        // WorkManager e sincronização podem inicializar bancos próprios. Isso não deve
        // competir com o primeiro frame do Compose, principalmente em Android 10 ou
        // aparelhos lentos. As duas operações são seguras fora da main thread.
        startupExecutor.execute {
            runCatching { SyncScheduler.ensurePeriodicSync(this) }
                .onFailure { container.auditor.recordAsync("warning", "startup-sync-schedule", "Falha ao agendar sincronização periódica", it.javaClass.simpleName) }
            runCatching { SyncScheduler.syncNow(this) }
                .onFailure { container.auditor.recordAsync("warning", "startup-sync-now", "Falha ao solicitar sincronização inicial", it.javaClass.simpleName) }
        }
    }

    override fun onTerminate() {
        startupExecutor.shutdownNow()
        container.auditor.shutdown()
        super.onTerminate()
    }
}