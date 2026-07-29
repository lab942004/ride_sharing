package com.ridesharing.app.ui.viewmodel

import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ridesharing.app.data.local.dao.CachedUserDao
import com.ridesharing.app.data.models.User
import com.ridesharing.app.data.repository.ProfileRepository
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.Resource
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val error: String? = null,
    val isUpdating: Boolean = false,
    val updateSuccess: Boolean = false,
    val message: String? = null,
    val isUploadingImage: Boolean = false,
    val imageUploadSuccess: Boolean = false,
    val imageUploadError: String? = null
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profileRepository: ProfileRepository,
    private val cachedUserDao: CachedUserDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val tag = "AUTH_DEBUG"

    init {
        loadCachedProfile()
    }

    private fun loadCachedProfile() {
        viewModelScope.launch {
            val cached = cachedUserDao.getUserOnce()
            if (cached != null) {
                val user = User(
                    id = cached.id, name = cached.name, email = cached.email,
                    rollNo = cached.rollNo, phone = cached.phone,
                    domain = cached.domain, profilePic = cached.profilePic,
                    isVerified = cached.isVerified, createdAt = cached.createdAt,
                    _count = com.ridesharing.app.data.models.ProfileCount(
                        rides = cached.ridesCount,
                        sentRequests = cached.requestsCount
                    )
                )
                AppLogger.d(tag, "ProfileVM: Loaded cached profile: name=${user.name}, rides=${user._count?.rides}, requests=${user._count?.sentRequests}")
                _uiState.value = _uiState.value.copy(user = user)
            } else {
                AppLogger.d(tag, "ProfileVM: No cached profile found - will load from network")
            }
        }
    }

    fun loadProfile() {
        val currentUser = _uiState.value.user
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            AppLogger.d(tag, "ProfileVM: Loading profile from network...")
            when (val result = profileRepository.getProfile()) {
                is Resource.Success -> {
                    AppLogger.d(tag, "ProfileVM: Profile loaded: name=${result.data.name}, rides=${result.data._count?.rides}, requests=${result.data._count?.sentRequests}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        user = result.data
                    )
                }
                is Resource.Error -> {
                    AppLogger.w(tag, "ProfileVM: Profile load failed: ${result.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = currentUser?.let { null } ?: result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun updateProfile(name: String?, phone: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isUpdating = true, error = null)
            when (val result = profileRepository.updateProfile(name, phone)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isUpdating = false,
                        updateSuccess = true,
                        user = result.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isUpdating = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun uploadProfilePicture(imageUri: Uri, name: String?, phone: String?) {
        AppLogger.d("PROFILE_UPLOAD", "Starting Cloudinary upload for URI: $imageUri")
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isUploadingImage = true,
                imageUploadError = null,
                imageUploadSuccess = false
            )
            AppLogger.d("PROFILE_UPLOAD", "Uploading via Cloudinary direct upload")
            when (val result = profileRepository.uploadProfilePictureToCloudinary(imageUri)) {
                is Resource.Success -> {
                    AppLogger.d("PROFILE_UPLOAD", "Cloudinary upload success — new profilePic: ${result.data?.profilePic}")
                    _uiState.value = _uiState.value.copy(
                        isUploadingImage = false,
                        imageUploadSuccess = true,
                        user = result.data
                    )
                }
                is Resource.Error -> {
                    AppLogger.e("PROFILE_UPLOAD", "Cloudinary upload failed: ${result.message}")
                    _uiState.value = _uiState.value.copy(
                        isUploadingImage = false,
                        imageUploadSuccess = false,
                        imageUploadError = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun removeProfilePicture() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isUploadingImage = true,
                imageUploadError = null,
                imageUploadSuccess = false
            )
            when (val result = profileRepository.removeProfilePicture()) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isUploadingImage = false,
                        imageUploadSuccess = true,
                        user = result.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isUploadingImage = false,
                        imageUploadError = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isUpdating = true, error = null, message = null)
            when (val result = profileRepository.changePassword(currentPassword, newPassword)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isUpdating = false,
                        message = result.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isUpdating = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun clearState() {
        _uiState.value = _uiState.value.copy(
            updateSuccess = false,
            error = null,
            message = null,
            imageUploadError = null,
            imageUploadSuccess = false
        )
    }

    fun clearImageState() {
        _uiState.value = _uiState.value.copy(
            imageUploadError = null,
            imageUploadSuccess = false,
            isUploadingImage = false
        )
    }
}