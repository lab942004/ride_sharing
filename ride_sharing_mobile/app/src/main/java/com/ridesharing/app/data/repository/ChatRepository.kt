package com.ridesharing.app.data.repository

import android.util.Log
import com.ridesharing.app.data.api.ApiService
import com.ridesharing.app.data.local.ChatLocalStorageManager
import com.ridesharing.app.data.local.dao.CachedMessageDao
import com.ridesharing.app.data.local.entity.CachedMessage
import com.ridesharing.app.data.models.*
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.Resource
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatRepository @Inject constructor(
    private val api: ApiService,
    private val cachedMessageDao: CachedMessageDao,
    private val chatLocalStorage: ChatLocalStorageManager
) {
    private val tag = "CHAT_REPOSITORY"

    suspend fun getChatInfo(requestId: String): Resource<ChatInfo> {
        return try {
            val response = api.getChatInfo(requestId)
            if (response.isSuccessful) {
                val wrapper = response.body()?.data
                if (wrapper != null) {
                    Resource.Success(wrapper.chat)
                } else {
                    Resource.Error("Chat not found")
                }
            } else {
                val errorMsg = try {
                    val errorBody = response.errorBody()?.string()
                    com.google.gson.Gson().fromJson(errorBody, ApiResponse::class.java).message
                } catch (e: Exception) {
                    "Failed to load chat"
                }
                Resource.Error(errorMsg)
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    suspend fun getMessages(requestId: String, page: Int = 1, limit: Int = 50): Resource<MessagesWrapper> {
        return try {
            val response = api.getMessages(requestId, page, limit)
            if (response.isSuccessful) {
                val data = response.body()?.data
                if (data != null) {
                    AppLogger.d(tag, "getMessages success: ${data.messages.size} messages for chat $requestId")
                    // Optimized: Insert/replace messages. 
                    // Consider deleting only if you need to ensure cache is exactly same as server.
                    cachedMessageDao.insertMessages(data.messages.map { it.toCached(requestId) })
                    Resource.Success(data)
                } else {
                    AppLogger.w(tag, "getMessages: null data for $requestId")
                    val cached = cachedMessageDao.getMessagesForChatOnce(requestId)
                    Resource.Success(MessagesWrapper(messages = cached.map { it.toMessage() }))
                }
            } else {
                AppLogger.w(tag, "getMessages failed: ${response.code()}, falling back to cache")
                val cached = cachedMessageDao.getMessagesForChatOnce(requestId)
                Resource.Success(MessagesWrapper(messages = cached.map { it.toMessage() }))
            }
        } catch (e: Exception) {
            AppLogger.e(tag, "getMessages error: ${e.message}", e)
            val cached = cachedMessageDao.getMessagesForChatOnce(requestId)
            if (cached.isNotEmpty()) {
                AppLogger.d(tag, "Falling back to ${cached.size} cached messages")
            }
            Resource.Success(MessagesWrapper(messages = cached.map { it.toMessage() }))
        }
    }

    suspend fun sendMessage(requestId: String, text: String): Resource<Message> {
        return try {
            val response = api.sendMessage(requestId, SendMessageRequest(text))
            if (response.isSuccessful) {
                val message = response.body()?.data?.message
                if (message != null) {
                    AppLogger.d(tag, "sendMessage success: ${message.id}")
                    // Cache outgoing message
                    cachedMessageDao.insertMessage(message.toCached(requestId))
                    Resource.Success(message)
                } else {
                    Resource.Error("Failed to send message")
                }
            } else {
                Resource.Error("Failed to send message")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    /**
     * Get cached messages for a chat (for offline loading)
     */
    suspend fun getCachedMessages(requestId: String): List<Message> {
        val cached = cachedMessageDao.getMessagesForChatOnce(requestId)
        AppLogger.d(tag, "Loaded ${cached.size} cached messages for chat $requestId")
        return cached.map { it.toMessage() }
    }

    /**
     * Cache a single message received via socket
     */
    suspend fun cacheMessage(requestId: String, message: Message) {
        cachedMessageDao.insertMessage(message.toCached(requestId))
        AppLogger.d(tag, "Cached socket message: ${message.id} for chat $requestId")
    }

    /**
     * Locally delete selected messages from Room database.
     * This only hides messages on the device — no backend API call.
     */
    suspend fun deleteMessagesLocally(messageIds: List<String>) {
        if (messageIds.isEmpty()) return
        cachedMessageDao.deleteMessagesByIds(messageIds)
        AppLogger.d(tag, "Locally deleted ${messageIds.size} messages: $messageIds")
    }

    /**
     * Locally delete an entire conversation:
     * 1. Removes all cached messages for that chat from Room database.
     * 2. Marks the chat as deleted in SharedPreferences so it's hidden from ChatListScreen.
     */
    suspend fun deleteConversationLocally(requestId: String) {
        cachedMessageDao.deleteMessagesForChat(requestId)
        chatLocalStorage.addDeletedChat(requestId)
        AppLogger.d(tag, "Locally deleted conversation $requestId")
    }

    private fun Message.toCached(chatIdStr: String) = CachedMessage(
        id = id, chatId = chatIdStr, text = text,
        senderId = senderId, senderName = sender?.name,
        senderRollNo = sender?.rollNo, senderProfilePic = sender?.profilePic,
        createdAt = createdAt
    )

    private fun CachedMessage.toMessage() = Message(
        id = id, text = text, createdAt = createdAt,
        senderId = senderId,
        sender = if (senderName != null) RideCreator(id = senderId, name = senderName ?: "", rollNo = senderRollNo ?: "", profilePic = senderProfilePic) else null
    )
}