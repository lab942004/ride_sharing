package com.ridesharing.app.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ridesharing.app.data.local.dao.CachedUserDao
import com.ridesharing.app.data.models.AuthResponse
import com.ridesharing.app.data.repository.AuthRepository
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false,
    val otpVerified: Boolean = false,
    val message: String? = null,
    val authResponse: AuthResponse? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager,
    private val cachedUserDao: CachedUserDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val tag = "AUTH_DEBUG"

    init {
        restoreSession()
    }

    /**
     * Restore session from local storage to survive app restarts and process death.
     * Reads tokens directly from SharedPreferences to ensure persistence is verified.
     */
    private fun restoreSession() {
        viewModelScope.launch {
            AppLogger.d(tag, "===== SESSION RESTORATION STARTED =====")

            // Read tokens directly from persistent storage
            val accessToken = tokenManager.getAccessTokenSync()
            val refreshToken = tokenManager.getRefreshTokenSync()
            val userId = tokenManager.getUserIdSync()

            AppLogger.d(tag, "Session restore: accessToken=${accessToken != null}, refreshToken=${refreshToken != null}, userId=$userId")

            if (accessToken != null) {
                // Also try to restore cached user data
                val cachedUser = cachedUserDao.getUserOnce()
                if (cachedUser != null) {
                    AppLogger.d(tag, "Session restored from cache: name=${cachedUser.name}, email=${cachedUser.email}")
                } else {
                    AppLogger.d(tag, "Session restored (token present), but no cached user data")
                }
                _uiState.value = _uiState.value.copy(isLoggedIn = true)
                AppLogger.d(tag, "Session restoration: SUCCESS - user is logged in")
            } else {
                AppLogger.d(tag, "Session restoration: no token found - user not logged in")
            }

            AppLogger.d(tag, "===== SESSION RESTORATION COMPLETE =====")
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            AppLogger.d(tag, "Login attempt for: $email")
            when (val result = authRepository.login(email.trim(), password)) {
                is Resource.Success -> {
                    AppLogger.d(tag, "Login successful")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        authResponse = result.data
                    )
                }
                is Resource.Error -> {
                    AppLogger.w(tag, "Login failed: ${result.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun register(name: String, rollNo: String, email: String, phone: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            AppLogger.d(tag, "Register attempt for: $email")
            when (val result = authRepository.register(name, rollNo, email, phone, password)) {
                is Resource.Success -> {
                    AppLogger.d(tag, "Registration successful")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoggedIn = true,
                        authResponse = result.data
                    )
                }
                is Resource.Error -> {
                    AppLogger.w(tag, "Registration failed: ${result.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun sendOtp(email: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, message = null)
            when (val result = authRepository.sendOtp(email)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = result.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun verifyOtp(email: String, otp: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = authRepository.verifyOtp(email, otp)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        otpVerified = true
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun forgotPassword(emailOrPhone: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, message = null)
            when (val result = authRepository.forgotPassword(emailOrPhone)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = result.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun resetPassword(email: String, otp: String, newPassword: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, message = null)
            when (val result = authRepository.resetPassword(email, otp, newPassword)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = result.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            AppLogger.d(tag, "Logging out")
            authRepository.logout()
            _uiState.value = AuthUiState()
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null, message = null)
    }
}