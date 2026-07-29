package com.ridesharing.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ridesharing.app.data.local.entity.CachedRide
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedRideDao {
    @Query("SELECT * FROM cached_rides ORDER BY date ASC")
    fun getAllRides(): Flow<List<CachedRide>>

    @Query("SELECT * FROM cached_rides ORDER BY date ASC")
    suspend fun getAllRidesOnce(): List<CachedRide>

    @Query("SELECT * FROM cached_rides WHERE id = :rideId")
    suspend fun getRideById(rideId: String): CachedRide?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRides(rides: List<CachedRide>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRide(ride: CachedRide)

    @Query("DELETE FROM cached_rides WHERE id = :rideId")
    suspend fun deleteRide(rideId: String)

    @Query("DELETE FROM cached_rides")
    suspend fun deleteAll()
}
