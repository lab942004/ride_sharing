package com.ridesharing.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ridesharing.app.data.models.Ride
import com.ridesharing.app.data.models.RideRequest
import com.ridesharing.app.data.repository.ChatRepository
import com.ridesharing.app.data.repository.RequestRepository
import com.ridesharing.app.data.repository.RideRepository
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.RideTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RideDetailUiState(
    val isLoading: Boolean = false,
    val ride: Ride? = null,
    val isRequesting: Boolean = false,
    val isDeleting: Boolean = false,
    val isSharingPhone: Boolean = false,
    val requestStatus: String? = null,
    val currentRequestId: String? = null,
    val error: String? = null,
    val phoneShareMsg: String? = null,
    val phoneData: PhoneShareContactData? = null
)

data class PhoneShareContactData(
    val name: String,
    val phone: String
)

@HiltViewModel
class RideDetailViewModel @Inject constructor(
    private val rideRepository: RideRepository,
    private val requestRepository: RequestRepository,
    private val chatRepository: ChatRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(RideDetailUiState())
    val uiState: StateFlow<RideDetailUiState> = _uiState.asStateFlow()

    fun loadRideDetails(rideId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = rideRepository.getRideById(rideId)) {
                is Resource.Success -> {
                    val ride = result.data
                    var requestId = ride.userRequestId
                    var status = ride.userRequestStatus

                    if (requestId == null) {
                        // Fallback check
                        val matchingReq = ride.requests?.firstOrNull()
                        if (matchingReq != null) {
                            requestId = matchingReq.id
                            status = matchingReq.status
                        } else {
                            // Deeper fallback
                            val reqs = requestRepository.getRequests()
                            if (reqs is Resource.Success) {
                                val match = reqs.data.find { it.rideId == rideId }
                                if (match != null) {
                                    requestId = match.id
                                    status = match.status
                                }
                            }
                        }
                    }

                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        ride = ride,
                        currentRequestId = requestId,
                        requestStatus = status
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

    fun requestJoinRide(rideId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRequesting = true, error = null)
            when (val result = requestRepository.createRequest(rideId)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isRequesting = false,
                        requestStatus = result.data.status,
                        currentRequestId = result.data.id
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isRequesting = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun deleteRide(rideId: String, onDeleted: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isDeleting = true)
            when (val result = rideRepository.deleteRide(rideId)) {
                is Resource.Success -> onDeleted()
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isDeleting = false,
                        error = "Failed to delete ride"
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun sharePhone() {
        val requestId = _uiState.value.currentRequestId ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSharingPhone = true, error = null)
            when (val result = requestRepository.sharePhone(requestId)) {
                is Resource.Success -> {
                    val data = result.data
                    if (data.bothConfirmed && data.phones != null) {
                        val isOwner = _uiState.value.ride?.isOwner == true
                        val name = if (isOwner) data.phones.requesterName else data.phones.creatorName
                        val phone = if (isOwner) data.phones.requesterPhone else data.phones.creatorPhone
                        
                        _uiState.value = _uiState.value.copy(
                            isSharingPhone = false,
                            phoneData = PhoneShareContactData(name ?: "User", phone ?: "")
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isSharingPhone = false,
                            phoneShareMsg = if (data.creatorConfirmed || data.requesterConfirmed) 
                                "Waiting for other party to confirm sharing..." 
                                else "Phone sharing request sent"
                        )
                    }
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isSharingPhone = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
