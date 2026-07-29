package com.ridesharing.app.services.notification

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ridesharing.app.R
import com.ridesharing.app.RideSharingApp
import com.ridesharing.app.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class RideSharingMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to server for push notifications
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val notificationType = message.data["type"] ?: "general"
        val title = message.data["title"] ?: message.notification?.title ?: "RideShare"
        val body = message.data["body"] ?: message.notification?.body ?: "You have a new notification"
        val requestId = message.data["requestId"]
        val rideId = message.data["rideId"]
        val chatId = message.data["chatId"]

        val channelId = when (notificationType) {
            "chat" -> RideSharingApp.CHANNEL_CHAT
            "otp" -> RideSharingApp.CHANNEL_OTP
            else -> RideSharingApp.CHANNEL_GENERAL
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_type", notificationType)
            requestId?.let { putExtra("requestId", it) }
            rideId?.let { putExtra("rideId", it) }
            chatId?.let { putExtra("chatId", it) }
        }

        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent, pendingIntentFlags
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(
                System.currentTimeMillis().toInt(),
                notification
            )
        } catch (e: SecurityException) {
            // Permission not granted for notifications
        }
    }
}