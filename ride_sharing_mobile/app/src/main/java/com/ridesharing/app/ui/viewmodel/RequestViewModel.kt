package com.ridesharing.app.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ridesharing.app.data.local.ChatLocalStorageManager
import com.ridesharing.app.data.local.dao.CachedMessageDao
import com.ridesharing.app.data.local.dao.CachedRequestDao
import com.ridesharing.app.data.models.RideRequest
import com.ridesharing.app.data.repository.RequestRepository
import com.ridesharing.app.services.socket.SocketManager
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.AutoCleanupManager
import com.ridesharing.app.utils.Resource
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RequestUiState(
    val isLoading: Boolean = false,
    val requests: List<RideRequest> = emptyList(),
    val error: String? = null,
    val actionSuccess: Boolean = false
)

@HiltViewModel
class RequestViewModel @Inject constructor(
    private val requestRepository: RequestRepository,
    private val socketManager: SocketManager,
    private val cachedRequestDao: CachedRequestDao,
    private val cachedMessageDao: CachedMessageDao,
    private val chatLocalStorage: ChatLocalStorageManager,
    private val autoCleanupManager: AutoCleanupManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(RequestUiState())
    val uiState: StateFlow<RequestUiState> = _uiState.asStateFlow()

    private val tag = "REQ_VM"
    private val chatDeleteTag = "CHAT_DELETE"

    init {
        // Run cleanup on initialization
        triggerCleanup()
        loadCachedRequests()
        viewModelScope.launch {
            socketManager.requestUpdate.collectLatest {
                loadRequests()
            }
        }
    }

    /**
     * Triggers the auto-cleanup process.
     * This is called on init and can be called from UI screens when they open.
     */
    fun triggerCleanup() {
        viewModelScope.launch {
            autoCleanupManager.runCleanup()
            // After cleanup, reload from cache to reflect any auto-deletions
            val cached = cachedRequestDao.getAllRequestsOnce()
            if (cached.isNotEmpty()) {
                val requests = cached.map { it.toRideRequest() }
                AppLogger.d(tag, "After cleanup: ${requests.size} requests remain in cache")
                _uiState.value = _uiState.value.copy(requests = requests)
            }
        }
    }

    private fun loadCachedRequests() {
        viewModelScope.launch {
            val cached = cachedRequestDao.getAllRequestsOnce()
            if (cached.isNotEmpty()) {
                val requests = cached.map { it.toRideRequest() }
                AppLogger.d(tag, "Loaded ${requests.size} requests from local cache")
                _uiState.value = _uiState.value.copy(requests = requests)
            }
        }
    }

    fun loadRequests() {
        val currentRequests = _uiState.value.requests
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = requestRepository.getRequests()) {
                is Resource.Success -> {
                    // Filter out locally deleted chats for Requests screen
                    val deletedChatIds = chatLocalStorage.getDeletedChats()
                    var filteredRequests = result.data
                    if (deletedChatIds.isNotEmpty()) {
                        // Only filter out ACCEPTED requests that were deleted
                        filteredRequests = result.data.filter { request ->
                            if (request.status == "ACCEPTED") {
                                request.id !in deletedChatIds
                            } else {
                                true // Always show non-accepted requests
                            }
                        }
                        AppLogger.d(tag, "Filtered ${result.data.size - filteredRequests.size} deleted accepted requests from Requests screen")
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        requests = filteredRequests
                    )
                }
                is Resource.Error -> {
                    // Preserve existing requests on error
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = currentRequests.isEmpty().let { if (it) result.message else null },
                        requests = currentRequests
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun createRequest(rideId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = requestRepository.createRequest(rideId)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        actionSuccess = true
                    )
                    loadRequests()
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

    fun updateRequest(requestId: String, status: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = requestRepository.updateRequest(requestId, status)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        actionSuccess = true
                    )
                    loadRequests()
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

    fun sharePhone(requestId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = requestRepository.sharePhone(requestId)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        actionSuccess = true
                    )
                    loadRequests()
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

    fun deleteRequest(requestId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = requestRepository.deleteRequest(requestId)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        actionSuccess = true
                    )
                    loadRequests()
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

    /**
     * Locally hides a single chat without calling any backend API.
     * Stores the chat ID in SharedPreferences so it's hidden from ChatListScreen.
     * Also refreshes the Requests screen to hide deleted accepted requests.
     */
    fun deleteChatLocally(requestId: String) {
        viewModelScope.launch {
            when (val result = requestRepository.deleteChatLocally(requestId)) {
                is Resource.Success -> {
                    AppLogger.d(chatDeleteTag, "Chat $requestId hidden successfully")
                    loadAcceptedChats()
                    loadRequests()
                }
                is Resource.Error -> {
                    AppLogger.e(chatDeleteTag, "Delete chat failed: ${result.message}")
                }
                is Resource.Loading -> {}
            }
        }
    }

    /**
     * Loads only accepted requests (chats), filtering out locally deleted ones.
     * Used by ChatListScreen.
     */
    fun loadAcceptedChats() {
        val currentRequests = _uiState.value.requests
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = requestRepository.getAcceptedChats()) {
                is Resource.Success -> {
                    AppLogger.d(chatDeleteTag, "Total chats before delete = ${result.data.size}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        requests = result.data
                    )
                }
                is Resource.Error -> {
                    AppLogger.w(chatDeleteTag, "loadAcceptedChats failed: ${result.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = currentRequests.isEmpty().let { if (it) result.message else null },
                        requests = currentRequests
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    /**
     * Deletes all chats locally (does NOT call backend delete API).
     * Hides all accepted chats by storing their IDs in SharedPreferences.
     * Refreshes both Chat list and Requests screen.
     */
    fun deleteAllChatsLocally() {
        AppLogger.d(chatDeleteTag, "Delete All Chats clicked")
        viewModelScope.launch {
            // Count total accepted chats before delete
            val currentCount = _uiState.value.requests.count { it.status == "ACCEPTED" }
            AppLogger.d(chatDeleteTag, "Total chats before delete = $currentCount")

            when (val result = requestRepository.deleteAllChatsLocally()) {
                is Resource.Success -> {
                    AppLogger.d(chatDeleteTag, "Chats hidden successfully")
                    // Clear cached messages from local database
                    cachedMessageDao.deleteAll()
                    // Reload both views to reflect deleted chats
                    loadAcceptedChats()
                    loadRequests()
                    AppLogger.d(chatDeleteTag, "Chat list and requests refreshed")
                }
                is Resource.Error -> {
                    AppLogger.e(chatDeleteTag, "Delete all chats failed: ${result.message}")
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun clearActionState() {
        _uiState.value = _uiState.value.copy(actionSuccess = false)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    private fun com.ridesharing.app.data.local.entity.CachedRequest.toRideRequest(): RideRequest {
        return RideRequest(
            id = id, status = status, phoneShared = phoneShared,
            rideId = rideId,
            ride = if (rideFrom != null) com.ridesharing.app.data.models.Ride(
                id = rideId, from = rideFrom ?: "", to = rideTo ?: "",
                date = rideDate ?: "", time = rideTime ?: "",
                vehicleType = rideVehicleType ?: "", availableSeats = 0,
                isFull = false, isExpired = false, createdById = "",
                createdBy = if (rideCreatorName != null) com.ridesharing.app.data.models.RideCreator(
                    id = rideCreatorId ?: "", name = rideCreatorName ?: "", rollNo = rideCreatorRollNo ?: ""
                ) else null
            ) else null,
            requesterId = requesterId,
            requester = if (requesterName != null) com.ridesharing.app.data.models.RideCreator(
                id = requesterId ?: "", name = requesterName ?: "", rollNo = requesterRollNo ?: ""
            ) else null,
            rideCreatorId = rideCreatorId ?: "",
            rideCreator = if (rideCreatorName != null) com.ridesharing.app.data.models.RideCreator(
                id = rideCreatorId ?: "", name = rideCreatorName ?: "", rollNo = rideCreatorRollNo ?: ""
            ) else null
        )
    }
}