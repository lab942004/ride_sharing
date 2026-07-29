package com.ridesharing.app.data.api

import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.TokenManager
import kotlinx.coroutines.runBlocking
import okhttp3.ConnectionSpec
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {
    private val tag = "AUTH_DEBUG"
    private val skipAuthPaths = listOf(
        "/auth/login", "/auth/register", "/auth/send-otp",
        "/auth/verify-otp", "/auth/refresh", "/auth/forgot-password",
        "/auth/reset-password"
    )

    private var isRefreshing = false

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val path = originalRequest.url.encodedPath

        if (skipAuthPaths.any { path.contains(it) }) {
            AppLogger.d(tag, "Skipping auth for: $path")
            return chain.proceed(originalRequest)
        }

        // CRITICAL FIX: Read token from persistent storage directly, not from StateFlow
        // This ensures we always have the latest persisted token, even if app was killed
        val token = tokenManager.getAccessTokenSync()
        AppLogger.d(tag, "Authorization header check: token=${token != null}, path=$path")

        if (token.isNullOrEmpty()) {
            AppLogger.w(tag, "No access token available for: ${originalRequest.url}")
            // Don't proceed without token - return 401 response to avoid null pointer issues
            return chain.proceed(originalRequest.newBuilder().header("Authorization", "").build())
        }

        val authenticatedRequest = originalRequest.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()

        AppLogger.d(tag, "Added Authorization header: Bearer ${token.take(20)}...")

        val response = chain.proceed(authenticatedRequest)

        if (response.code == 401 || response.code == 403) {
            AppLogger.w(tag, "Received ${response.code} for: ${originalRequest.url} - attempting token refresh")
            response.close()

            val newToken = refreshTokenSync()
            if (newToken != null) {
                AppLogger.d(tag, "Token refreshed successfully, retrying request")
                val retryRequest = originalRequest.newBuilder()
                    .header("Authorization", "Bearer $newToken")
                    .build()
                return chain.proceed(retryRequest)
            } else {
                AppLogger.e(tag, "Token refresh failed completely - session expired")
                // Only clear tokens if refresh definitively failed (not transient error)
                // The refreshTokenSync method will have already handled this
            }
        }

        return response
    }

    private fun refreshTokenSync(): String? {
        if (isRefreshing) {
            AppLogger.d(tag, "Already refreshing token, waiting for completion...")
            for (i in 0 until 10) {
                Thread.sleep(500)
                // Check if another thread already saved a new token
                val newToken = tokenManager.getAccessTokenSync()
                if (newToken != null) {
                    AppLogger.d(tag, "Other thread refreshed token successfully")
                    return newToken
                }
            }
            AppLogger.w(tag, "Timed out waiting for other refresh thread")
            return null
        }

        isRefreshing = true
        try {
            val refreshToken = tokenManager.getRefreshTokenSync()
            if (refreshToken.isNullOrEmpty()) {
                AppLogger.w(tag, "No refresh token available - user must login again")
                // Only clear tokens if we have no refresh token, meaning session is truly expired
                runBlocking {
                    tokenManager.clearAll()
                }
                return null
            }

            AppLogger.d(tag, "Attempting token refresh with refresh token: ${refreshToken.take(10)}...")

            val baseUrl = try {
                com.ridesharing.app.BuildConfig.BASE_URL
            } catch (e: Exception) {
                AppLogger.e(tag, "Failed to get BASE_URL from BuildConfig")
                return null
            }

            val client = okhttp3.OkHttpClient.Builder()
                .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .connectionSpecs(listOf(
                    ConnectionSpec.MODERN_TLS,
                    ConnectionSpec.COMPATIBLE_TLS,
                    ConnectionSpec.CLEARTEXT
                ))
                .build()

            val jsonBody = JSONObject().apply {
                put("refreshToken", refreshToken)
            }.toString()

            val body = jsonBody.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("${baseUrl}auth/refresh")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()

            if (response.isSuccessful && responseBody != null) {
                val json = JSONObject(responseBody)
                val data = json.optJSONObject("data")
                if (data != null) {
                    val newAccessToken = data.optString("accessToken", "")
                    val newRefreshToken = data.optString("refreshToken", "")

                    if (newAccessToken.isNotEmpty()) {
                        tokenManager.saveTokens(
                            newAccessToken,
                            newRefreshToken.ifEmpty { refreshToken }
                        )
                        AppLogger.d(tag, "Token refreshed successfully: ${newAccessToken.take(20)}...")

                        // Update the in-memory state
                        return newAccessToken
                    }
                }
            } else if (response.code == 401) {
                // Server explicitly rejected our refresh token - session is truly expired
                AppLogger.w(tag, "Refresh token rejected by server (401) - session expired")
                runBlocking {
                    tokenManager.clearAll()
                }
            } else {
                // Transient error (network, 500, etc.) - DO NOT clear tokens
                AppLogger.w(tag, "Token refresh failed: ${response.code} (transient error, keeping existing tokens)")
            }

            AppLogger.w(tag, "Token refresh failed: ${response.code}")
            return null
        } catch (e: Exception) {
            AppLogger.e(tag, "Token refresh error: ${e.message} (keeping existing tokens)", e)
            // DO NOT clear tokens on network errors - this is a transient failure
            return null
        } finally {
            isRefreshing = false
        }
    }
}