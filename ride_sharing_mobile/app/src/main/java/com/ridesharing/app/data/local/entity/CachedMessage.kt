package com.ridesharing.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_messages")
data class CachedMessage(
    @PrimaryKey val id: String,
    val chatId: String,
    val text: String,
    val senderId: String,
    val senderName: String?,
    val senderRollNo: String?,
    val senderProfilePic: String? = null,
    val createdAt: String,
    val isDeleted: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)