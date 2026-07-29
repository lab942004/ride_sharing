package com.ridesharing.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ridesharing.app.data.local.entity.CachedRequest
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedRequestDao {
    @Query("SELECT * FROM cached_requests ORDER BY cachedAt DESC")
    fun getAllRequests(): Flow<List<CachedRequest>>

    @Query("SELECT * FROM cached_requests WHERE isOutgoing = :isOutgoing ORDER BY cachedAt DESC")
    fun getRequestsByType(isOutgoing: Boolean): Flow<List<CachedRequest>>

    @Query("SELECT * FROM cached_requests ORDER BY cachedAt DESC")
    suspend fun getAllRequestsOnce(): List<CachedRequest>

    @Query("SELECT * FROM cached_requests WHERE id = :requestId")
    suspend fun getRequestById(requestId: String): CachedRequest?

    @Query("SELECT * FROM cached_requests WHERE rideId = :rideId")
    suspend fun getRequestsByRideIdOnce(rideId: String): List<CachedRequest>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRequests(requests: List<CachedRequest>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRequest(request: CachedRequest)

    @Query("DELETE FROM cached_requests WHERE id = :requestId")
    suspend fun deleteRequest(requestId: String)

    @Query("DELETE FROM cached_requests")
    suspend fun deleteAll()
}
