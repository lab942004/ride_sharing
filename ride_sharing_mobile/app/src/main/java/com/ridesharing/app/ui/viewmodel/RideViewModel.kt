package com.ridesharing.app.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ridesharing.app.data.local.dao.CachedRideDao
import com.ridesharing.app.data.local.entity.CachedRide
import com.ridesharing.app.data.models.CreateRideRequest
import com.ridesharing.app.data.models.Ride
import com.ridesharing.app.data.models.RideFilters
import com.ridesharing.app.data.repository.RideRepository
import com.ridesharing.app.services.socket.SocketManager
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.AutoCleanupManager
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.RideExpiryManager
import com.ridesharing.app.utils.RideTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RideListUiState(
    val isLoading: Boolean = false,
    val rides: List<Ride> = emptyList(),
    val myRides: List<Ride> = emptyList(),
    val error: String? = null,
    val currentRide: Ride? = null,
    val filters: RideFilters = RideFilters()
)

@HiltViewModel
class RideViewModel @Inject constructor(
    private val rideRepository: RideRepository,
    private val socketManager: SocketManager,
    private val cachedRideDao: CachedRideDao,
    private val rideExpiryManager: RideExpiryManager,
    private val autoCleanupManager: AutoCleanupManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(RideListUiState())
    val uiState: StateFlow<RideListUiState> = _uiState.asStateFlow()

    private val _createRideState = MutableStateFlow<Resource<Ride>?>(null)
    val createRideState: StateFlow<Resource<Ride>?> = _createRideState.asStateFlow()

    private val tag = "RIDE_VM"

    init {
        // Start periodic cleanup (every 30 minutes)
        autoCleanupManager.startPeriodicCleanup(viewModelScope)
        loadCachedRides()
        observeSocketEvents()
    }

    /**
     * Load cached rides first so UI is never empty while API refreshes
     */
    private fun loadCachedRides() {
        viewModelScope.launch {
            val cachedRides = cachedRideDao.getAllRidesOnce()
            if (cachedRides.isNotEmpty()) {
                val rides = cachedRides.map { it.toRide() }.filterExpired()
                AppLogger.d(tag, "Loaded ${rides.size} rides from local cache")
                _uiState.value = _uiState.value.copy(rides = rides)
            }
        }
    }

    private fun List<Ride>.filterExpired(): List<Ride> {
        return this.filter { ride ->
            val isExpired = RideTimeUtils.isRideExpired(ride.date, ride.time)
            if (isExpired) {
                AppLogger.d("RIDE_EXPIRY", "Hiding expired ride: ${ride.id} (${ride.from} → ${ride.to}, date=${ride.date}, time=${ride.time})")
            }
            !isExpired
        }
    }

    /**
     * Public method to refresh expired rides locally.
     * Can be called from UI with lifecycle awareness.
     */
    fun refreshExpiredRides() {
        val currentRides = _uiState.value.rides
        val currentMyRides = _uiState.value.myRides
        val filteredRides = currentRides.filterExpired()
        val filteredMyRides = currentMyRides.filterExpired()

        if (filteredRides.size != currentRides.size || filteredMyRides.size != currentMyRides.size) {
            AppLogger.d("RIDE_EXPIRY", "Removed ${currentRides.size - filteredRides.size} expired rides")
            _uiState.value = _uiState.value.copy(
                rides = filteredRides,
                myRides = filteredMyRides
            )
        }
    }

    private fun observeSocketEvents() {
        viewModelScope.launch {
            socketManager.newRide.collectLatest {
                loadRides(_uiState.value.filters)
            }
        }
        viewModelScope.launch {
            socketManager.requestUpdate.collectLatest { json ->
                val rideId = json.optString("rideId")
                if (rideId.isNotEmpty()) {
                    if (_uiState.value.currentRide?.id == rideId) {
                        loadRideDetails(rideId)
                    }
                    loadMyRides()
                    loadRides(_uiState.value.filters)
                }
            }
        }
    }

    fun loadRides(filters: RideFilters = RideFilters()) {
        val currentRides = _uiState.value.rides
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, filters = filters)
            when (val result = rideRepository.getRides(filters)) {
                is Resource.Success -> {
                    val filteredRides = result.data.filterExpired()
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        rides = filteredRides
                    )
                }
                is Resource.Error -> {
                    // Preserve existing rides on error - don't replace with empty
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = currentRides.isEmpty().let { if (it) result.message else null },
                        rides = currentRides
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun loadMyRides() {
        val currentMyRides = _uiState.value.myRides
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = rideRepository.getMyRides()) {
                is Resource.Success -> {
                    val filteredMyRides = result.data.filterExpired()
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        myRides = filteredMyRides
                    )
                }
                is Resource.Error -> {
                    // Preserve existing rides on error
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = currentMyRides.isEmpty().let { if (it) result.message else null },
                        myRides = currentMyRides
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun loadRideDetails(rideId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = rideRepository.getRideById(rideId)) {
                is Resource.Success -> {
                    val ride = result.data
                    val isExpired = RideTimeUtils.isRideExpired(ride.date, ride.time)
                    val updatedRide = if (isExpired) ride.copy(isExpired = true) else ride
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        currentRide = updatedRide
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

    fun createRide(request: CreateRideRequest) {
        viewModelScope.launch {
            _createRideState.value = Resource.Loading
            val result = rideRepository.createRide(request)
            _createRideState.value = result
        }
    }

    fun deleteRide(rideId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            rideRepository.deleteRide(rideId)
            loadMyRides()
        }
    }

    fun clearCreateState() {
        _createRideState.value = null
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    private fun CachedRide.toRide(): Ride {
        return Ride(
            id = id, from = from, to = to, date = date, time = time,
            vehicleType = vehicleType, availableSeats = availableSeats,
            isFull = isFull, isExpired = isExpired,
            createdById = createdById, isOwner = isOwner,
            userRequestStatus = userRequestStatus,
            userRequestId = userRequestId,
            createdBy = if (creatorName != null) com.ridesharing.app.data.models.RideCreator(
                id = createdById ?: "", name = creatorName ?: "", rollNo = creatorRollNo ?: ""
            ) else null,
            _count = com.ridesharing.app.data.models.RequestCount(acceptedCount)
        )
    }
}