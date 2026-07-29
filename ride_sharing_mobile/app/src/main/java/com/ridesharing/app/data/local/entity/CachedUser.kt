package com.ridesharing.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_user")
data class CachedUser(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    val rollNo: String,
    val phone: String?,
    val domain: String?,
    val profilePic: String? = null,
    val isVerified: Boolean = false,
    val createdAt: String? = null,
    val ridesCount: Int = 0,
    val requestsCount: Int = 0
)
