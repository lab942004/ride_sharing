package com.ridesharing.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_rides")
data class CachedRide(
    @PrimaryKey val id: String,
    val from: String,
    val to: String,
    val date: String,
    val time: String,
    val vehicleType: String,
    val availableSeats: Int,
    val isFull: Boolean = false,
    val isExpired: Boolean = false,
    val createdById: String?,
    val creatorName: String?,
    val creatorRollNo: String?,
    val userRequestStatus: String? = null,
    val userRequestId: String? = null,
    val isOwner: Boolean = false,
    val acceptedCount: Int = 0,
    val cachedAt: Long = System.currentTimeMillis()
)