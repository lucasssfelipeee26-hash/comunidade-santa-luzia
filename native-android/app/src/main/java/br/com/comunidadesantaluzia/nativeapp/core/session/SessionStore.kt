package br.com.comunidadesantaluzia.nativeapp.core.session

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.sessionDataStore by preferencesDataStore(name = "santa_luzia_session")

data class NativeSession(
    val loggedIn: Boolean = false,
    val userId: String? = null,
    val userName: String? = null,
    val userType: String? = null,
    val function: String? = null,
    val sessionCookie: String? = null,
)

class SessionStore(private val context: Context) {
    private object Keys {
        val loggedIn = booleanPreferencesKey("logged_in")
        val userId = stringPreferencesKey("user_id")
        val userName = stringPreferencesKey("user_name")
        val userType = stringPreferencesKey("user_type")
        val function = stringPreferencesKey("function")
        val sessionCookie = stringPreferencesKey("session_cookie")
    }

    val session: Flow<NativeSession> = context.sessionDataStore.data.map { prefs ->
        NativeSession(
            loggedIn = prefs[Keys.loggedIn] ?: false,
            userId = prefs[Keys.userId],
            userName = prefs[Keys.userName],
            userType = prefs[Keys.userType],
            function = prefs[Keys.function],
            sessionCookie = prefs[Keys.sessionCookie],
        )
    }

    suspend fun saveAuthenticatedSession(
        userId: String,
        userName: String,
        userType: String,
        function: String?,
        sessionCookie: String?,
    ) {
        context.sessionDataStore.edit { prefs ->
            prefs[Keys.loggedIn] = true
            prefs[Keys.userId] = userId
            prefs[Keys.userName] = userName
            prefs[Keys.userType] = userType
            function?.let { prefs[Keys.function] = it } ?: prefs.remove(Keys.function)
            sessionCookie?.takeIf { it.isNotBlank() }?.let { prefs[Keys.sessionCookie] = it }
        }
    }

    suspend fun updateCookie(cookie: String?) {
        context.sessionDataStore.edit { prefs ->
            if (cookie.isNullOrBlank()) prefs.remove(Keys.sessionCookie)
            else prefs[Keys.sessionCookie] = cookie
        }
    }

    suspend fun clear() {
        context.sessionDataStore.edit { it.clear() }
    }
}
