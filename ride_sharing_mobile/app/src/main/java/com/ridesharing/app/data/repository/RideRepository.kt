package com.ridesharing.app.data.repository

import android.util.Log
import com.ridesharing.app.data.api.ApiService
import com.ridesharing.app.data.local.dao.CachedRideDao
import com.ridesharing.app.data.local.entity.CachedRide
import com.ridesharing.app.data.models.*
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.Resource
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RideRepository @Inject constructor(
    private val api: ApiService,
    private val cachedRideDao: CachedRideDao
) {
    private val tag = "RIDE_REPOSITORY"

    suspend fun getRides(filters: RideFilters): Resource<List<Ride>> {
        return try {
            val response = api.getRides(
                from = filters.from,
                to = filters.to,
                date = filters.date,
                vehicleType = filters.vehicleType,
                page = filters.page,
                limit = filters.limit
            )
            if (response.isSuccessful) {
                val rides = response.body()?.data?.rides ?: emptyList()
                AppLogger.d(tag, "getRides success: ${rides.size} rides loaded")
                // Optimized: Only insert/replace, don't delete all to avoid UI flicker and unnecessary I/O
                cachedRideDao.insertRides(rides.map { it.toCachedRide() })
                Resource.Success(rides)
            } else {
                AppLogger.w(tag, "getRides failed: ${response.code()}, falling back to cache")
                val cached = cachedRideDao.getAllRidesOnce()
                if (cached.isNotEmpty()) {
                    Resource.Success(cached.map { it.toRide() })
                } else {
                    Resource.Error("Failed to fetch rides")
                }
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "getRides error: ${e.message}", e)
            val cached = cachedRideDao.getAllRidesOnce()
            if (cached.isNotEmpty()) {
                AppLogger.d(tag, "Falling back to ${cached.size} cached rides")
                Resource.Success(cached.map { it.toRide() })
            } else {
                Resource.Error(e.message ?: "Network error")
            }
        }
    }

    suspend fun getMyRides(): Resource<List<Ride>> {
        return try {
            val response = api.getMyRides()
            if (response.isSuccessful) {
                val rides = response.body()?.data?.rides ?: emptyList()
                AppLogger.d(tag, "getMyRides success: ${rides.size} rides")
                // Cache my rides separately
                cachedRideDao.insertRides(rides.map { it.toCachedRide() })
                Resource.Success(rides)
            } else {
                AppLogger.w(tag, "getMyRides failed: ${response.code()}")
                Resource.Error("Failed to fetch your rides")
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "getMyRides error: ${e.message}", e)
            Resource.Error(e.message ?: "Network error")
        }
    }

    suspend fun getRideById(rideId: String): Resource<Ride> {
        return try {
            val response = api.getRideById(rideId)
            if (response.isSuccessful) {
                val ride = response.body()?.data?.ride
                if (ride != null) {
                    ride.let { cachedRideDao.insertRide(it.toCachedRide()) }
                    Resource.Success(ride)
                } else {
                    val cached = cachedRideDao.getRideById(rideId)
                    if (cached != null) {
                        Resource.Success(cached.toRide())
                    } else {
                        Resource.Error("Ride not found")
                    }
                }
            } else {
                val cached = cachedRideDao.getRideById(rideId)
                if (cached != null) {
                    Resource.Success(cached.toRide())
                } else {
                    Resource.Error("Ride not found")
                }
            }
        } catch (e: Exception) {
            val cached = cachedRideDao.getRideById(rideId)
            if (cached != null) {
                Resource.Success(cached.toRide())
            } else {
                Resource.Error(e.message ?: "Network error")
            }
        }
    }

    suspend fun createRide(request: CreateRideRequest): Resource<Ride> {
        return try {
            val response = api.createRide(request)
            if (response.isSuccessful) {
                val ride = response.body()?.data?.ride
                if (ride != null) {
                    Resource.Success(ride)
                } else {
                    Resource.Error("Failed to create ride: Empty response")
                }
            } else {
                val errorMsg = try {
                    val errorBody = response.errorBody()?.string()
                    val apiResponse = com.google.gson.Gson().fromJson(errorBody, ApiResponse::class.java)
                    apiResponse.message
                } catch (e: Exception) {
                    "Failed to create ride (${response.code()})"
                }
                Resource.Error(errorMsg)
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    suspend fun deleteRide(rideId: String): Resource<String> {
        return try {
            val response = api.deleteRide(rideId)
            if (response.isSuccessful) {
                cachedRideDao.deleteRide(rideId)
                Resource.Success("Ride deleted successfully")
            } else {
                Resource.Error("Failed to delete ride")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    private fun Ride.toCachedRide() = CachedRide(
        id = id, from = from, to = to, date = date, time = time,
        vehicleType = vehicleType, availableSeats = availableSeats,
        isFull = isFull, isExpired = isExpired,
        createdById = createdById, creatorName = createdBy?.name,
        creatorRollNo = createdBy?.rollNo,
        userRequestStatus = userRequestStatus,
        userRequestId = userRequestId,
        isOwner = isOwner ?: false,
        acceptedCount = _count?.requests ?: 0
    )

    private fun CachedRide.toRide() = Ride(
        id = id, from = from, to = to, date = date, time = time,
        vehicleType = vehicleType, availableSeats = availableSeats,
        isFull = isFull, isExpired = isExpired,
        createdById = createdById, isOwner = isOwner,
        userRequestStatus = userRequestStatus,
        userRequestId = userRequestId,
        createdBy = if (creatorName != null) RideCreator(
            id = createdById ?: "", name = creatorName ?: "", rollNo = creatorRollNo ?: ""
        ) else null,
        _count = RequestCount(acceptedCount)
    )
}