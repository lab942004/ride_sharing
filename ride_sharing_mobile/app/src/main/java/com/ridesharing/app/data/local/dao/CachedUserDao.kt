package com.ridesharing.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ridesharing.app.data.local.entity.CachedUser
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedUserDao {
    @Query("SELECT * FROM cached_user LIMIT 1")
    fun getUser(): Flow<CachedUser?>

    @Query("SELECT * FROM cached_user LIMIT 1")
    suspend fun getUserOnce(): CachedUser?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: CachedUser)

    @Query("DELETE FROM cached_user")
    suspend fun deleteAll()
}