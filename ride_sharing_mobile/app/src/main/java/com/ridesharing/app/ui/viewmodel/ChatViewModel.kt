package com.ridesharing.app.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ridesharing.app.data.local.dao.CachedUserDao
import com.ridesharing.app.data.models.ChatInfo
import com.ridesharing.app.data.models.Message
import com.ridesharing.app.data.models.PhoneShareResponse
import com.ridesharing.app.data.repository.ChatRepository
import com.ridesharing.app.data.repository.RequestRepository
import com.ridesharing.app.services.socket.SocketManager
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.AutoCleanupManager
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatUiState(
    val isLoading: Boolean = false,
    val messages: List<Message> = emptyList(),
    val chatInfo: ChatInfo? = null,
    val error: String? = null,
    val isSending: Boolean = false,
    val currentUserId: String? = null,
    val currentUserProfilePic: String? = null,
    // Multi-select states
    val isMultiSelectMode: Boolean = false,
    val selectedMessageIds: Set<String> = emptySet()
)

data class SnackbarEvent(
    val message: String,
    val actionLabel: String? = null,
    val action: (() -> Unit)? = null
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val chatRepository: ChatRepository,
    private val requestRepository: RequestRepository,
    private val socketManager: SocketManager,
    private val tokenManager: TokenManager,
    private val autoCleanupManager: AutoCleanupManager,
    private val cachedUserDao: CachedUserDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private var currentRequestId: String = ""
    private var lastRefreshTime: Long = 0

    private val tag = "CHAT_VM"
    private val refreshTag = "CHAT_REFRESH"
    private val imageTag = "CHAT_IMAGE"

    private val _snackbarEvent = MutableSharedFlow<SnackbarEvent>(extraBufferCapacity = 1)
    val snackbarEvent = _snackbarEvent.asSharedFlow()

    init {
        val userId = tokenManager.getUserIdSync()
        _uiState.value = _uiState.value.copy(currentUserId = userId)
        loadCurrentUserProfilePic()
    }

    private fun loadCurrentUserProfilePic() {
        viewModelScope.launch {
            val cached = cachedUserDao.getUserOnce()
            val profilePic = cached?.profilePic
            _uiState.value = _uiState.value.copy(currentUserProfilePic = profilePic)
        }
    }

    fun connectToChat(requestId: String) {
        currentRequestId = requestId
        // Load cached messages first
        loadCachedMessages(requestId)
        // Then load from API
        loadChatInfo(requestId)
        loadMessages(requestId)
        val userId = tokenManager.getUserIdSync() ?: ""
        socketManager.connect()
        socketManager.connectToChat(requestId, userId)
        socketManager.onNewMessage { message ->
            val currentMessages = _uiState.value.messages.toMutableList()
            if (currentMessages.none { it.id == message.id }) {
                currentMessages.add(message)
                _uiState.value = _uiState.value.copy(messages = currentMessages)
                // Cache socket message
                viewModelScope.launch {
                    chatRepository.cacheMessage(requestId, message)
                }
            }
        }
    }

    /**
     * Public method to check and refresh if socket is disconnected.
     * Can be called periodically from UI with lifecycle awareness.
     */
    fun refreshIfDisconnected() {
        if (!socketManager.isConnected.value) {
            refreshMessagesSilently()
        }
    }

    fun refreshMessagesSilently() {
        if (currentRequestId.isNotBlank()) {
            viewModelScope.launch {
                refreshMessagesSilently(currentRequestId)
            }
        }
    }

    /**
     * Internal implementation of silent refresh with deduplication and caching.
     */
    private suspend fun refreshMessagesSilently(requestId: String) {
        // Prevent too frequent refreshes (throttle to 5 seconds)
        val now = System.currentTimeMillis()
        if (now - lastRefreshTime < 5000) return
        lastRefreshTime = now

        when (val result = chatRepository.getMessages(requestId, page = 1, limit = 100)) {
            is Resource.Success -> {
                val fetchedMessages = result.data.messages

                // Get current messages
                val currentMessages = _uiState.value.messages

                // Merge and deduplicate: keep existing items in order, add any new ones
                val existingIds = currentMessages.map { it.id }.toSet()
                val newMessages = fetchedMessages.filter { it.id !in existingIds }

                val duplicateCount = fetchedMessages.size - (fetchedMessages.size - newMessages.size)
                if (duplicateCount > 0) {
                    AppLogger.d(refreshTag, "Duplicate count removed: $duplicateCount")
                }

                if (newMessages.isNotEmpty()) {
                    AppLogger.d(refreshTag, "New messages found: ${newMessages.size}")
                    // Merge and sort by createdAt timestamp (oldest first)
                    val mergedMessages = (currentMessages + newMessages)
                        .distinctBy { it.id }
                        .sortedBy { it.createdAt }

                    _uiState.value = _uiState.value.copy(
                        messages = mergedMessages,
                        error = null
                    )
                }

                AppLogger.d(refreshTag, "Refresh completed. Message count: ${_uiState.value.messages.size}")
            }
            is Resource.Error -> {
                // Handle network errors silently and retry
                AppLogger.w(refreshTag, "Refresh failed: ${result.message}. Will retry.")
            }
            is Resource.Loading -> {}
        }
    }

    /**
     * Force refresh messages (shows loading on first load, silent otherwise).
     */
    fun refreshMessages() {
        refreshMessagesSilently()
    }

    private fun loadCachedMessages(requestId: String) {
        viewModelScope.launch {
            val cached = chatRepository.getCachedMessages(requestId)
            if (cached.isNotEmpty()) {
                AppLogger.d(tag, "Loaded ${cached.size} cached messages for chat $requestId")
                val sorted = cached.sortedBy { it.createdAt }
                _uiState.value = _uiState.value.copy(messages = sorted)
            }
        }
    }

    private fun loadChatInfo(requestId: String) {
        viewModelScope.launch {
            when (val result = chatRepository.getChatInfo(requestId)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(chatInfo = result.data)
                }
                is Resource.Error -> {
                    AppLogger.w(tag, "loadChatInfo failed: ${result.message}")
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun loadMessages(requestId: String) {
        val currentMessages = _uiState.value.messages
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = chatRepository.getMessages(requestId)) {
                is Resource.Success -> {
                    val sortedMessages = result.data.messages.sortedBy { it.createdAt }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        messages = sortedMessages
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = currentMessages.isEmpty().let { if (it) result.message else null }
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    suspend fun sharePhone(requestId: String): Resource<PhoneShareResponse> {
        return requestRepository.sharePhone(requestId)
    }

    fun sendMessage(text: String) {
        if (text.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSending = true)
            when (val result = chatRepository.sendMessage(currentRequestId, text)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(isSending = false)
                    val currentMessages = _uiState.value.messages.toMutableList()
                    if (currentMessages.none { it.id == result.data.id }) {
                        currentMessages.add(result.data)
                    }
                    val sortedMessages = currentMessages.sortedBy { it.createdAt }
                    _uiState.value = _uiState.value.copy(messages = sortedMessages)

                    // Immediately refresh to get the message with server timestamp
                    refreshMessagesSilently(currentRequestId)
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isSending = false,
                        error = result.message
                    )
                }
                is Resource.Loading -> {}
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    // Refresh current user profile pic from cache (call after profile update)
    fun refreshCurrentUserProfilePic() {
        loadCurrentUserProfilePic()
    }

    // ─── Multi-Select Functions ──────────────────────────────────────────────

    /**
     * Toggles the selection state of a message. If entering multi-select mode,
     * set isMultiSelectMode to true.
     */
    fun toggleMessageSelection(messageId: String) {
        val current = _uiState.value.selectedMessageIds.toMutableSet()
        if (current.contains(messageId)) {
            current.remove(messageId)
        } else {
            current.add(messageId)
        }
        val isMultiSelect = current.isNotEmpty()
        _uiState.value = _uiState.value.copy(
            selectedMessageIds = current,
            isMultiSelectMode = isMultiSelect
        )
    }

    /**
     * Exits multi-select mode and clears all selections.
     */
    fun clearMessageSelection() {
        _uiState.value = _uiState.value.copy(
            isMultiSelectMode = false,
            selectedMessageIds = emptySet()
        )
    }

    /**
     * Selects all currently displayed messages.
     */
    fun selectAllMessages() {
        val allIds = _uiState.value.messages.map { it.id }.toSet()
        _uiState.value = _uiState.value.copy(
            selectedMessageIds = allIds,
            isMultiSelectMode = allIds.isNotEmpty()
        )
    }

    // ─── Delete Functions ────────────────────────────────────────────────────

    /**
     * Deletes the currently selected messages from local storage and UI.
     * No backend API call — purely local deletion.
     */
    fun deleteSelectedMessages() {
        val selectedIds = _uiState.value.selectedMessageIds.toList()
        if (selectedIds.isEmpty()) return

        viewModelScope.launch {
            // Remove from local Room database
            chatRepository.deleteMessagesLocally(selectedIds)

            // Remove from UI state immediately
            val currentMessages = _uiState.value.messages.toMutableList()
            currentMessages.removeAll { it.id in selectedIds.toSet() }
            _uiState.value = _uiState.value.copy(
                messages = currentMessages,
                isMultiSelectMode = false,
                selectedMessageIds = emptySet()
            )

            // Show snackbar
            _snackbarEvent.tryEmit(
                SnackbarEvent(
                    message = if (selectedIds.size == 1) "Message deleted" else "${selectedIds.size} messages deleted"
                )
            )
        }
    }

    /**
     * Deletes the entire conversation locally:
     * - Removes all cached messages from Room
     * - Marks the chat as deleted in SharedPreferences
     * - Exits multi-select mode
     */
    fun deleteConversation() {
        if (currentRequestId.isBlank()) return
        val requestId = currentRequestId

        viewModelScope.launch {
            chatRepository.deleteConversationLocally(requestId)
            _uiState.value = _uiState.value.copy(
                messages = emptyList(),
                isMultiSelectMode = false,
                selectedMessageIds = emptySet()
            )
            _snackbarEvent.tryEmit(
                SnackbarEvent(message = "Conversation deleted")
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        socketManager.disconnectFromChat(currentRequestId)
    }
}