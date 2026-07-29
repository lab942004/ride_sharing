package com.ridesharing.app.data.repository

import android.util.Log
import com.ridesharing.app.data.api.ApiService
import com.ridesharing.app.data.local.ChatLocalStorageManager
import com.ridesharing.app.data.local.dao.CachedMessageDao
import com.ridesharing.app.data.local.dao.CachedRequestDao
import com.ridesharing.app.data.local.entity.CachedRequest
import com.ridesharing.app.data.models.*
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.Resource
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RequestRepository @Inject constructor(
    private val api: ApiService,
    private val cachedRequestDao: CachedRequestDao,
    private val chatLocalStorage: ChatLocalStorageManager,
    private val cachedMessageDao: CachedMessageDao
) {
    private val tag = "REQ_REPO"

    suspend fun getRequests(): Resource<List<RideRequest>> {
        return try {
            val response = api.getRequests()
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    val sent = apiResponse.data?.sent?.map { it.copy(ride = it.ride?.copy(isOwner = false)) } ?: emptyList()
                    val received = apiResponse.data?.received?.map { it.copy(ride = it.ride?.copy(isOwner = true)) } ?: emptyList()
                    val allRequests = sent + received
                    AppLogger.d(tag, "getRequests success: ${allRequests.size} requests (sent=${sent.size}, received=${received.size})")
                    // Cache after successful API call, not before
                    cachedRequestDao.deleteAll()
                    cachedRequestDao.insertRequests(allRequests.map { it.toCached() })
                    Resource.Success(allRequests)
                } else {
                    AppLogger.w(tag, "getRequests API returned success=false")
                    Resource.Error(apiResponse?.message ?: "Failed to fetch requests")
                }
            } else {
                AppLogger.w(tag, "getRequests failed: ${response.code()}, falling back to cache")
                val cached = cachedRequestDao.getAllRequestsOnce()
                if (cached.isNotEmpty()) {
                    Resource.Success(cached.map { it.toRideRequest() })
                } else {
                    Resource.Error("Error: ${response.code()} ${response.message()}")
                }
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "getRequests error: ${e.message}", e)
            val cached = cachedRequestDao.getAllRequestsOnce()
            if (cached.isNotEmpty()) {
                AppLogger.d(tag, "Falling back to ${cached.size} cached requests")
                Resource.Success(cached.map { it.toRideRequest() })
            } else {
                Resource.Error(e.message ?: "Network error")
            }
        }
    }

    suspend fun createRequest(rideId: String): Resource<RideRequest> {
        return try {
            val response = api.createRequest(CreateRequestRequest(rideId))
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data?.request != null) {
                    AppLogger.d(tag, "createRequest success for rideId=$rideId")
                    Resource.Success(apiResponse.data.request)
                } else {
                    Resource.Error(apiResponse?.message ?: "Failed to create request")
                }
            } else {
                Resource.Error("Error: ${response.code()} ${response.message()}")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    suspend fun updateRequest(requestId: String, status: String): Resource<RideRequest> {
        return try {
            val response = api.updateRequest(requestId, UpdateRequestRequest(status))
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data?.request != null) {
                    AppLogger.d(tag, "updateRequest success: id=$requestId, status=$status")
                    Resource.Success(apiResponse.data.request)
                } else {
                    Resource.Error(apiResponse?.message ?: "Failed to update request")
                }
            } else {
                Resource.Error("Error: ${response.code()} ${response.message()}")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    suspend fun deleteRequest(requestId: String): Resource<String> {
        return try {
            val response = api.deleteRequest(requestId)
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    cachedRequestDao.deleteRequest(requestId)
                    Resource.Success(apiResponse.message ?: "Request deleted")
                } else {
                    Resource.Error(apiResponse?.message ?: "Failed to delete request")
                }
            } else {
                Resource.Error("Error: ${response.code()} ${response.message()}")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    /**
     * Returns only accepted requests (chats), filtering out locally deleted ones.
     * This is used for the Chat List screen.
     */
    suspend fun getAcceptedChats(): Resource<List<RideRequest>> {
        return try {
            val response = api.getRequests()
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    val sent = apiResponse.data?.sent?.map { it.copy(ride = it.ride?.copy(isOwner = false)) } ?: emptyList()
                    val received = apiResponse.data?.received?.map { it.copy(ride = it.ride?.copy(isOwner = true)) } ?: emptyList()
                    val allRequests = sent + received
                    val acceptedChats = allRequests.filter { it.status == "ACCEPTED" }
                    val deletedChatIds = chatLocalStorage.getDeletedChats()
                    val visibleChats = acceptedChats.filter { it.id !in deletedChatIds }
                    AppLogger.d(tag, "getAcceptedChats: total accepted=${acceptedChats.size}, deleted=${deletedChatIds.size}, visible=${visibleChats.size}")
                    // Cache after successful API call
                    cachedRequestDao.deleteAll()
                    cachedRequestDao.insertRequests(allRequests.map { it.toCached() })
                    Resource.Success(visibleChats)
                } else {
                    AppLogger.w(tag, "getAcceptedChats API returned success=false, falling back to cache")
                    val cached = cachedRequestDao.getAllRequestsOnce()
                    val cachedAccepted = cached.map { it.toRideRequest() }.filter { it.status == "ACCEPTED" }
                    val deletedChatIds = chatLocalStorage.getDeletedChats()
                    val visibleChats = cachedAccepted.filter { it.id !in deletedChatIds }
                    Resource.Success(visibleChats)
                }
            } else {
                AppLogger.w(tag, "getAcceptedChats failed: ${response.code()}, falling back to cache")
                val cached = cachedRequestDao.getAllRequestsOnce()
                val cachedAccepted = cached.map { it.toRideRequest() }.filter { it.status == "ACCEPTED" }
                val deletedChatIds = chatLocalStorage.getDeletedChats()
                val visibleChats = cachedAccepted.filter { it.id !in deletedChatIds }
                Resource.Success(visibleChats)
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "getAcceptedChats error: ${e.message}", e)
            val cached = cachedRequestDao.getAllRequestsOnce()
            val cachedAccepted = cached.map { it.toRideRequest() }.filter { it.status == "ACCEPTED" }
            val deletedChatIds = chatLocalStorage.getDeletedChats()
            val visibleChats = cachedAccepted.filter { it.id !in deletedChatIds }
            Resource.Success(visibleChats)
        }
    }

    /**
     * Locally hides a single chat without calling any backend API.
     * Stores the chat ID in SharedPreferences so it's hidden from ChatListScreen.
     * Also removes cached messages for that chat from Room database.
     */
    suspend fun deleteChatLocally(requestId: String): Resource<String> {
        return try {
            chatLocalStorage.addDeletedChat(requestId)
            cachedMessageDao.deleteMessagesForChat(requestId)
            AppLogger.d(tag, "deleteChatLocally: hidden chat $requestId")
            Resource.Success("Chat hidden successfully")
        } catch (e: Exception) {
            AppLogger.e(tag, "deleteChatLocally error: ${e.message}", e)
            chatLocalStorage.addDeletedChat(requestId)
            Resource.Success("Chat hidden successfully")
        }
    }

    /**
     * Locally hides all accepted chats without calling any backend API.
     * Stores deleted chat IDs in SharedPreferences and clears local Room cache.
     */
    suspend fun deleteAllChatsLocally(): Resource<String> {
        return try {
            val response = api.getRequests()
            val deletedIds = mutableSetOf<String>()
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    val sent = apiResponse.data?.sent ?: emptyList()
                    val received = apiResponse.data?.received ?: emptyList()
                    val allRequests = sent + received
                    val acceptedChats = allRequests.filter { it.status == "ACCEPTED" }
                    deletedIds.addAll(acceptedChats.map { it.id })
                    AppLogger.d(tag, "deleteAllChatsLocally: found ${acceptedChats.size} accepted chats to hide")
                }
            } else {
                // Fallback: mark all locally cached ACCEPTED requests as deleted
                AppLogger.w(tag, "deleteAllChatsLocally: API call failed, using cached data")
            }
            // Also mark any cached accepted requests
            val cached = cachedRequestDao.getAllRequestsOnce()
            val cachedAccepted = cached.filter { it.status == "ACCEPTED" }
            deletedIds.addAll(cachedAccepted.map { it.id })

            chatLocalStorage.addDeletedChats(deletedIds)
            AppLogger.d(tag, "deleteAllChatsLocally: total ${deletedIds.size} chats hidden successfully")
            Resource.Success("All chats hidden successfully")
        } catch (e: Exception) {
            AppLogger.e(tag, "deleteAllChatsLocally error: ${e.message}", e)
            // Try to get cached
            val cached = cachedRequestDao.getAllRequestsOnce()
            val cachedAccepted = cached.filter { it.status == "ACCEPTED" }
            val deletedIds = cachedAccepted.map { it.id }.toSet()
            chatLocalStorage.addDeletedChats(deletedIds)
            AppLogger.d(tag, "deleteAllChatsLocally (fallback): ${deletedIds.size} chats hidden")
            Resource.Success("All chats hidden successfully")
        }
    }

    suspend fun sharePhone(requestId: String): Resource<PhoneShareResponse> {
        return try {
            val response = api.sharePhone(requestId, SharePhoneRequest())
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    Resource.Success(apiResponse.data)
                } else {
                    Resource.Error(apiResponse?.message ?: "Failed to share phone")
                }
            } else {
                Resource.Error("Error: ${response.code()} ${response.message()}")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    private fun RideRequest.toCached() = CachedRequest(
        id = id, status = status, phoneShared = phoneShared,
        rideId = rideId, rideFrom = ride?.from, rideTo = ride?.to,
        rideDate = ride?.date, rideTime = ride?.time,
        rideVehicleType = ride?.vehicleType,
        requesterId = requesterId, requesterName = requester?.name,
        requesterRollNo = requester?.rollNo,
        rideCreatorId = rideCreatorId, rideCreatorName = rideCreator?.name,
        rideCreatorRollNo = rideCreator?.rollNo
    )

    private fun CachedRequest.toRideRequest() = RideRequest(
        id = id, status = status, phoneShared = phoneShared,
        rideId = rideId ?: "",
        ride = if (rideFrom != null) Ride(
            id = rideId ?: "", from = rideFrom ?: "", to = rideTo ?: "",
            date = rideDate ?: "", time = rideTime ?: "",
            vehicleType = rideVehicleType ?: "", availableSeats = 0,
            isFull = false, isExpired = false, createdById = "",
            createdBy = if (rideCreatorName != null) RideCreator(
                id = rideCreatorId ?: "", name = rideCreatorName ?: "", rollNo = rideCreatorRollNo ?: ""
            ) else null
        ) else null,
        requesterId = requesterId ?: "",
        requester = if (requesterName != null) RideCreator(
            id = requesterId ?: "", name = requesterName ?: "", rollNo = requesterRollNo ?: ""
        ) else null,
        rideCreatorId = rideCreatorId ?: "",
        rideCreator = if (rideCreatorName != null) RideCreator(
            id = rideCreatorId ?: "", name = rideCreatorName ?: "", rollNo = rideCreatorRollNo ?: ""
        ) else null
    )
}