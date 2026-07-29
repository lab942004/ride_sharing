package com.ridesharing.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import org.conscrypt.Conscrypt
import java.security.Security
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class RideSharingApp : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()
        // Install Conscrypt as the primary security provider to fix SSL issues on older/broken Android devices
        Security.insertProviderAt(Conscrypt.newProvider(), 1)
        createNotificationChannels()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            val generalChannel = NotificationChannel(
                CHANNEL_GENERAL,
                "General Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Ride requests, confirmations and ride reminders"
                enableVibration(true)
            }

            val chatChannel = NotificationChannel(
                CHANNEL_CHAT,
                "Chat Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "New chat messages"
                enableVibration(true)
                setShowBadge(true)
            }

            val otpChannel = NotificationChannel(
                CHANNEL_OTP,
                "OTP Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "OTP verification codes"
            }

            notificationManager.createNotificationChannel(generalChannel)
            notificationManager.createNotificationChannel(chatChannel)
            notificationManager.createNotificationChannel(otpChannel)
        }
    }

    companion object {
        const val CHANNEL_GENERAL = "rides_general"
        const val CHANNEL_CHAT = "rides_chat"
        const val CHANNEL_OTP = "rides_otp"
    }
}