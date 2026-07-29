package com.ridesharing.app.data.repository

import com.ridesharing.app.data.api.ApiService
import com.ridesharing.app.data.local.dao.CachedUserDao
import com.ridesharing.app.data.local.entity.CachedUser
import com.ridesharing.app.data.models.*
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.TokenManager
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val tokenManager: TokenManager,
    private val cachedUserDao: CachedUserDao
) {
    private val tag = "AUTH_REPOSITORY"

    suspend fun sendOtp(email: String, name: String? = null): Resource<String> {
        return try {
            val response = api.sendOtp(SendOtpRequest(email, name))
            if (response.isSuccessful) {
                Resource.Success(response.body()?.message ?: "OTP sent successfully")
            } else {
                Resource.Error(getErrorMessage(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun verifyOtp(email: String, otp: String): Resource<Boolean> {
        return try {
            val response = api.verifyOtp(VerifyOtpRequest(email, otp))
            if (response.isSuccessful) {
                Resource.Success(response.body()?.data?.verified ?: true)
            } else {
                Resource.Error(getErrorMessage(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun register(
        name: String, rollNo: String, email: String,
        phone: String, password: String
    ): Resource<AuthResponse> {
        return try {
            val response = api.register(RegisterRequest(name, rollNo, email, phone, password))
            if (response.isSuccessful) {
                val data = response.body()?.data
                if (data != null) {
                    data.accessToken?.let {
                        tokenManager.saveTokens(it, data.refreshToken ?: "")
                        AppLogger.d(tag, "Registration: tokens saved, verifying persistence...")
                        // Verify token was actually persisted
                        val savedToken = tokenManager.getAccessTokenSync()
                        AppLogger.d(tag, "Registration: token persistence verified: ${savedToken != null}")
                    }
                    data.user?.let {
                        tokenManager.saveUserId(it.id)
                        cachedUserDao.insertUser(it.toCached())
                        AppLogger.d(tag, "Registration: user ${it.id} cached")
                    }
                    Resource.Success(data)
                } else {
                    Resource.Error("Registration failed")
                }
            } else {
                Resource.Error(getErrorMessage(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun login(email: String, password: String): Resource<AuthResponse> {
        return try {
            AppLogger.d(tag, "Login request: email=$email")
            val response = api.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val data = response.body()?.data
                if (data != null) {
                    data.accessToken?.let {
                        tokenManager.saveTokens(it, data.refreshToken ?: "")
                        AppLogger.d(tag, "Login: tokens saved, verifying persistence...")
                        // Verify token was actually persisted
                        val savedToken = tokenManager.getAccessTokenSync()
                        val savedRefresh = tokenManager.getRefreshTokenSync()
                        AppLogger.d(tag, "Login: token persistence verified: accessToken=${savedToken != null}, refreshToken=${savedRefresh != null}")
                    }
                    data.user?.let {
                        tokenManager.saveUserId(it.id)
                        cachedUserDao.insertUser(it.toCached())
                        AppLogger.d(tag, "Login: user ${it.id} cached")
                    }
                    Resource.Success(data)
                } else {
                    AppLogger.w(tag, "Login: response data is null")
                    Resource.Error("Login failed")
                }
            } else {
                AppLogger.w(tag, "Login failed: ${response.code()}")
                Resource.Error(getErrorMessage(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "Login error: ${e.message}", e)
            Resource.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun refreshToken(): Resource<TokenResponse> {
        return try {
            val refreshToken = tokenManager.getRefreshTokenSync()
            if (refreshToken == null) {
                AppLogger.w(tag, "No refresh token available")
                return Resource.Error("No refresh token")
            }
            AppLogger.d(tag, "Refreshing token...")
            val response = api.refreshToken(RefreshTokenRequest(refreshToken))
            if (response.isSuccessful) {
                val data = response.body()?.data
                if (data != null) {
                    tokenManager.saveTokens(data.accessToken, data.refreshToken)
                    AppLogger.d(tag, "Token refreshed successfully via AuthRepository")
                    Resource.Success(data)
                } else {
                    Resource.Error("Token refresh failed")
                }
            } else {
                AppLogger.w(tag, "Token refresh failed: ${response.code()}, clearing session")
                tokenManager.clearAll()
                Resource.Error("Session expired. Please login again.")
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "Token refresh error: ${e.message}", e)
            Resource.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun logout(): Resource<String> {
        return try {
            AppLogger.d(tag, "Logging out...")
            val refreshToken = tokenManager.getRefreshTokenSync() ?: ""
            api.logout(RefreshTokenRequest(refreshToken))
            tokenManager.clearAll()
            cachedUserDao.deleteAll()
            AppLogger.d(tag, "Logout complete - tokens and cache cleared")
            Resource.Success("Logged out successfully")
        } catch (e: Exception) {
            tokenManager.clearAll()
            cachedUserDao.deleteAll()
            AppLogger.d(tag, "Logout complete (with error) - tokens and cache cleared")
            Resource.Success("Logged out successfully")
        }
    }

    suspend fun forgotPassword(emailOrPhone: String): Resource<String> {
        return try {
            val response = api.forgotPassword(ForgotPasswordRequest(emailOrPhone))
            if (response.isSuccessful) {
                Resource.Success(response.body()?.message ?: "If this account exists, a reset OTP has been sent.")
            } else {
                Resource.Error(getErrorMessage(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun resetPassword(email: String, otp: String, newPassword: String): Resource<String> {
        return try {
            val response = api.resetPassword(ResetPasswordRequest(email, otp, newPassword))
            if (response.isSuccessful) {
                Resource.Success(response.body()?.message ?: "Password reset successfully")
            } else {
                Resource.Error(getErrorMessage(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error occurred")
        }
    }

    suspend fun getMe(): Resource<User> {
        return try {
            AppLogger.d(tag, "Fetching current user profile...")
            val response = api.getMe()
            if (response.isSuccessful) {
                // Backend wraps user in { user: { ... } }
                val user = response.body()?.data?.user
                if (user != null) {
                    cachedUserDao.insertUser(user.toCached())
                    AppLogger.d(tag, "User profile fetched and cached: ${user.id}")
                    Resource.Success(user)
                } else {
                    AppLogger.w(tag, "getMe: user data is null")
                    Resource.Error("User not found")
                }
            } else {
                AppLogger.w(tag, "getMe failed: ${response.code()}")
                Resource.Error("Failed to fetch user")
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "getMe error: ${e.message}", e)
            Resource.Error(e.message ?: "Network error")
        }
    }

    fun isLoggedIn(): Boolean = tokenManager.isLoggedIn()

    private fun User.toCached() = CachedUser(
        id = id, name = name, email = email,
        rollNo = rollNo, phone = phone,
        domain = domain, profilePic = profilePic,
        isVerified = isVerified ?: false,
        createdAt = createdAt,
        ridesCount = _count?.rides ?: 0,
        requestsCount = _count?.sentRequests ?: 0
    )

    private fun getErrorMessage(code: Int, errorBody: String?): String {
        return when {
            code == 401 -> "Invalid credentials"
            code == 403 -> "Access denied"
            code == 404 -> "Not found"
            code == 409 -> "Already exists"
            errorBody != null -> errorBody
            else -> "Something went wrong"
        }
    }
}