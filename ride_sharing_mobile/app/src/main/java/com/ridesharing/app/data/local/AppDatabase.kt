package com.ridesharing.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.ridesharing.app.data.local.dao.CachedMessageDao
import com.ridesharing.app.data.local.dao.CachedRideDao
import com.ridesharing.app.data.local.dao.CachedRequestDao
import com.ridesharing.app.data.local.dao.CachedUserDao
import com.ridesharing.app.data.local.entity.CachedMessage
import com.ridesharing.app.data.local.entity.CachedRide
import com.ridesharing.app.data.local.entity.CachedRequest
import com.ridesharing.app.data.local.entity.CachedUser

@Database(
    entities = [
        CachedUser::class,
        CachedRide::class,
        CachedRequest::class,
        CachedMessage::class
    ],
    version = 7,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun cachedUserDao(): CachedUserDao
    abstract fun cachedRideDao(): CachedRideDao
    abstract fun cachedRequestDao(): CachedRequestDao
    abstract fun cachedMessageDao(): CachedMessageDao
}