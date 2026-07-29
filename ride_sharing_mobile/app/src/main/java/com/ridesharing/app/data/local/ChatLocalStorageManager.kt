package com.ridesharing.app.data.local

import android.content.Context
import android.content.SharedPreferences
import com.ridesharing.app.utils.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatLocalStorageManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val sharedPreferences: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val tag = "CHAT_DELETE"

    /**
     * Stores a set of request IDs that have been hidden/deleted by the user.
     */
    fun addDeletedChat(requestId: String) {
        val deleted = getDeletedChats().toMutableSet()
        deleted.add(requestId)
        sharedPreferences.edit()
            .putStringSet(KEY_DELETED_CHATS, deleted)
            .apply()
        AppLogger.d(tag, "Chat $requestId added to deleted list")
    }

    /**
     * Stores multiple request IDs as deleted at once.
     */
    fun addDeletedChats(requestIds: Set<String>) {
        val deleted = getDeletedChats().toMutableSet()
        deleted.addAll(requestIds)
        sharedPreferences.edit()
            .putStringSet(KEY_DELETED_CHATS, deleted)
            .apply()
        AppLogger.d(tag, "Added ${requestIds.size} chats to deleted list. Total deleted: ${deleted.size}")
    }

    /**
     * Returns the set of all deleted/hidden chat request IDs.
     */
    fun getDeletedChats(): Set<String> {
        return sharedPreferences.getStringSet(KEY_DELETED_CHATS, emptySet()) ?: emptySet()
    }

    /**
     * Checks if a specific request ID has been deleted.
     */
    fun isChatDeleted(requestId: String): Boolean {
        return getDeletedChats().contains(requestId)
    }

    /**
     * Clears all deleted chat IDs (for undo/reset purposes).
     */
    fun clearDeletedChats() {
        sharedPreferences.edit()
            .remove(KEY_DELETED_CHATS)
            .apply()
        AppLogger.d(tag, "All deleted chat records cleared")
    }

    companion object {
        private const val PREFS_NAME = "ride_sharing_chat_prefs"
        private const val KEY_DELETED_CHATS = "deleted_chats"
    }
}