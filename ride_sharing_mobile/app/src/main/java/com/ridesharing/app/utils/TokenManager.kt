package com.ridesharing.app.utils

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.ridesharing.app.utils.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val tag = "AUTH_DEBUG"

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val _accessToken = MutableStateFlow<String?>(null)
    val accessTokenFlow: StateFlow<String?> = _accessToken.asStateFlow()

    private val _refreshToken = MutableStateFlow<String?>(null)
    val refreshTokenFlow: StateFlow<String?> = _refreshToken.asStateFlow()

    private val _userId = MutableStateFlow<String?>(null)
    val userIdFlow: StateFlow<String?> = _userId.asStateFlow()

    init {
        // Load tokens from persistent storage on creation
        val storedAccess = getAccessTokenSync()
        val storedRefresh = getRefreshTokenSync()
        val storedUserId = getUserIdSync()
        _accessToken.value = storedAccess
        _refreshToken.value = storedRefresh
        _userId.value = storedUserId
        AppLogger.d(tag, "TokenManager initialized: accessToken=${storedAccess != null}, refreshToken=${storedRefresh != null}, userId=${storedUserId}")
    }

    fun saveTokens(accessToken: String, refreshToken: String) {
        AppLogger.d(tag, "Storing tokens: accessToken=$accessToken, refreshToken=$refreshToken")
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .commit()  // Use commit() for synchronous write to ensure persistence
        _accessToken.value = accessToken
        _refreshToken.value = refreshToken
        AppLogger.d(tag, "Tokens stored and committed successfully")
    }

    fun saveUserId(userId: String) {
        AppLogger.d(tag, "Storing userId: $userId")
        sharedPreferences.edit()
            .putString(KEY_USER_ID, userId)
            .commit()  // Use commit() for synchronous write
        _userId.value = userId
        AppLogger.d(tag, "UserId stored and committed successfully")
    }

    fun getAccessTokenSync(): String? {
        val token = try {
            sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
        } catch (e: Exception) {
            AppLogger.e(tag, "Error reading access token: ${e.message}")
            null
        }
        AppLogger.d(tag, "getAccessTokenSync: ${if (token != null) "found" else "null"}")
        return token
    }

    fun getRefreshTokenSync(): String? {
        val token = try {
            sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        } catch (e: Exception) {
            AppLogger.e(tag, "Error reading refresh token: ${e.message}")
            null
        }
        AppLogger.d(tag, "getRefreshTokenSync: ${if (token != null) "found" else "null"}")
        return token
    }

    fun getUserIdSync(): String? {
        val userId = try {
            sharedPreferences.getString(KEY_USER_ID, null)
        } catch (e: Exception) {
            AppLogger.e(tag, "Error reading userId: ${e.message}")
            null
        }
        AppLogger.d(tag, "getUserIdSync: ${if (userId != null) "found" else "null"}")
        return userId
    }

    fun getAccessToken() = _accessToken.asStateFlow()
    fun getRefreshToken() = _refreshToken.asStateFlow()
    fun getUserId() = _userId.asStateFlow()

    fun updateAccessToken(accessToken: String) {
        AppLogger.d(tag, "Updating access token")
        sharedPreferences.edit().putString(KEY_ACCESS_TOKEN, accessToken).commit()
        _accessToken.value = accessToken
        AppLogger.d(tag, "Access token updated successfully")
    }

    fun clearAll() {
        AppLogger.d(tag, "Clearing ALL tokens - user is being logged out")
        sharedPreferences.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_USER_ID)
            .commit()  // Use commit() for synchronous write
        _accessToken.value = null
        _refreshToken.value = null
        _userId.value = null
        AppLogger.d(tag, "All tokens cleared successfully")
    }

    fun isLoggedIn(): Boolean {
        val hasToken = getAccessTokenSync() != null
        AppLogger.d(tag, "isLoggedIn: $hasToken")
        return hasToken
    }

    companion object {
        private const val PREFS_NAME = "ride_sharing_secure_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
    }
}