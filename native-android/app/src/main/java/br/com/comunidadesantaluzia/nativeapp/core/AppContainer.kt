package br.com.comunidadesantaluzia.nativeapp.core

import android.content.Context
import br.com.comunidadesantaluzia.nativeapp.core.audit.SantaLuziaAuditor
import br.com.comunidadesantaluzia.nativeapp.core.data.NativeDatabase
import br.com.comunidadesantaluzia.nativeapp.core.data.SantaLuziaRepository
import br.com.comunidadesantaluzia.nativeapp.core.liturgy.OfflineLiturgyRepository
import br.com.comunidadesantaluzia.nativeapp.core.network.NativeHttpClient
import br.com.comunidadesantaluzia.nativeapp.core.session.SessionStore

internal class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val database = NativeDatabase(appContext)
    val sessionStore = SessionStore(appContext)
    val httpClient = NativeHttpClient(sessionStore)
    val repository = SantaLuziaRepository(database, httpClient, sessionStore)
    val liturgy = OfflineLiturgyRepository(appContext)
    val auditor = SantaLuziaAuditor(appContext, database)
}
