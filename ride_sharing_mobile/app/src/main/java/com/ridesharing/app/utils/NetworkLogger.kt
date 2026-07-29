package com.ridesharing.app.utils

import android.util.Log
import com.ridesharing.app.BuildConfig
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NetworkLogger @Inject constructor() : Interceptor {
    private val tag = "RIDE_API"

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        if (!BuildConfig.DEBUG) {
            return chain.proceed(request)
        }

        val requestBody = request.body
        Log.d(tag, "═══════════════════════════════════════════")
        Log.d(tag, "→ ${request.method} ${request.url}")
        
        val startTime = System.currentTimeMillis()
        try {
            val response = chain.proceed(request)
            val duration = System.currentTimeMillis() - startTime
            Log.d(tag, "← ${response.code} ${response.message} (${duration}ms)")
            val responseBody = response.peekBody(2048)
            Log.d(tag, "← Body: ${responseBody.string()}")
            Log.d(tag, "═══════════════════════════════════════════")
            return response
        } catch (e: Exception) {
            Log.e(tag, "← Network error: ${e.message}")
            Log.d(tag, "═══════════════════════════════════════════")
            throw e
        }
    }
}
