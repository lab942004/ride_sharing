package com.ridesharing.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ridesharing.app.data.local.entity.CachedMessage
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedMessageDao {
    @Query("SELECT * FROM cached_messages WHERE chatId = :chatId AND isDeleted = 0 ORDER BY createdAt ASC")
    fun getMessagesForChat(chatId: String): Flow<List<CachedMessage>>

    @Query("SELECT * FROM cached_messages WHERE chatId = :chatId AND isDeleted = 0 ORDER BY createdAt ASC")
    suspend fun getMessagesForChatOnce(chatId: String): List<CachedMessage>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessages(messages: List<CachedMessage>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: CachedMessage)

    @Query("DELETE FROM cached_messages WHERE chatId = :chatId")
    suspend fun deleteMessagesForChat(chatId: String)

    @Query("DELETE FROM cached_messages WHERE id IN (:messageIds)")
    suspend fun deleteMessagesByIds(messageIds: List<String>)

    @Query("DELETE FROM cached_messages")
    suspend fun deleteAll()
}
