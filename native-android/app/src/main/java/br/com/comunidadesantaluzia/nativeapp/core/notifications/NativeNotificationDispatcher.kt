package br.com.comunidadesantaluzia.nativeapp.core.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.comunidadesantaluzia.nativeapp.MainActivity
import br.com.comunidadesantaluzia.nativeapp.core.data.NativeDatabase
import org.json.JSONArray
import org.json.JSONObject

internal class NativeNotificationDispatcher(
    private val context: Context,
    private val database: NativeDatabase,
) {
    private val prefs = context.getSharedPreferences("santa_luzia_native_notifications", Context.MODE_PRIVATE)

    fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Santa Luzia",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Escalas, formações, Jornada Litúrgica e avisos da Comunidade Santa Luzia"
                enableVibration(true)
            },
        )
    }

    fun deliverUnreadFromCache(ownerUserId: String, maxPerPass: Int = 8) {
        if (ownerUserId.isBlank()) return
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val cached = database.getDocument(NativeDatabase.userDocumentKey(ownerUserId, "notificacoes")) ?: return
        val root = runCatching { JSONObject(cached.payload) }.getOrNull() ?: return
        val array = root.optJSONArray("notificacoes") ?: JSONArray()
        val unseen = buildList {
            repeat(array.length()) { index ->
                val item = array.optJSONObject(index) ?: return@repeat
                if (!item.isNull("lida_em") && item.optLong("lida_em") > 0) return@repeat
                val id = item.optString("id")
                if (id.isBlank() || prefs.getBoolean("shown:$ownerUserId:$id", false)) return@repeat
                add(item)
            }
        }.sortedBy { it.optLong("criado_em") }.takeLast(maxPerPass)

        if (unseen.isEmpty()) return
        ensureChannel()
        unseen.forEach { item ->
            val id = item.optString("id")
            val title = item.optString("titulo", "Comunidade Santa Luzia")
            val message = item.optString("mensagem")
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("notificationHref", item.optString("href"))
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                "$ownerUserId:$id".hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()
            NotificationManagerCompat.from(context).notify("$ownerUserId:$id".hashCode(), notification)
            prefs.edit().putBoolean("shown:$ownerUserId:$id", true).apply()
        }
    }

    companion object {
        const val CHANNEL_ID = "santa_luzia_main"
    }
}
