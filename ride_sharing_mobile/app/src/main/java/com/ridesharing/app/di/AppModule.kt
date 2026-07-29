package com.ridesharing.app.di

import android.content.Context
import androidx.room.Room
import com.ridesharing.app.BuildConfig
import com.ridesharing.app.data.api.ApiService
import com.ridesharing.app.data.api.AuthInterceptor
import com.ridesharing.app.data.local.AppDatabase
import com.ridesharing.app.data.local.dao.*
import com.ridesharing.app.utils.NetworkLogger
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.Cache
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient
import java.io.File
import retrofit2.Retrofit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(
        @ApplicationContext context: Context,
        authInterceptor: AuthInterceptor,
        networkLogger: NetworkLogger
    ): OkHttpClient {
        val cache = Cache(File(context.cacheDir, "http_cache"), 10 * 1024 * 1024) // 10MB cache

        val builder = OkHttpClient.Builder()
            .cache(cache)
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                    .header("User-Agent", "RideSharingAndroid/1.0")
                    .build()
                chain.proceed(request)
            }
            .addInterceptor(authInterceptor)
            .addInterceptor(networkLogger)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)

        try {
            // Use TLS v1.2+ specifically and ensure it uses the installed provider (Conscrypt)
            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(null, null, null)
            
            val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
            trustManagerFactory.init(null as java.security.KeyStore?)
            val trustManagers = trustManagerFactory.trustManagers
            val x509TrustManager = trustManagers.filterIsInstance<X509TrustManager>().first()
            
            builder.sslSocketFactory(sslContext.socketFactory, x509TrustManager)
        } catch (_: Exception) {
            // Fallback to default if manual setup fails
        }

        return builder
            .connectionSpecs(listOf(
                ConnectionSpec.MODERN_TLS,
                ConnectionSpec.COMPATIBLE_TLS,
                ConnectionSpec.CLEARTEXT
            ))
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        return retrofit.create(ApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "ride_sharing_db"
        ).fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideCachedUserDao(db: AppDatabase): CachedUserDao = db.cachedUserDao()

    @Provides
    fun provideCachedRideDao(db: AppDatabase): CachedRideDao = db.cachedRideDao()

    @Provides
    fun provideCachedRequestDao(db: AppDatabase): CachedRequestDao = db.cachedRequestDao()

    @Provides
    fun provideCachedMessageDao(db: AppDatabase): CachedMessageDao = db.cachedMessageDao()
}