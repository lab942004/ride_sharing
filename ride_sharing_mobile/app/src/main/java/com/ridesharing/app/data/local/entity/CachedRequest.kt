package com.ridesharing.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_requests")
data class CachedRequest(
    @PrimaryKey val id: String,
    val status: String,
    val phoneShared: Boolean = false,
    val rideId: String,
    val rideFrom: String?,
    val rideTo: String?,
    val rideDate: String?,
    val rideTime: String?,
    val rideVehicleType: String?,
    val requesterId: String?,
    val requesterName: String?,
    val requesterRollNo: String?,
    val rideCreatorId: String?,
    val rideCreatorName: String?,
    val rideCreatorRollNo: String?,
    val isOutgoing: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)