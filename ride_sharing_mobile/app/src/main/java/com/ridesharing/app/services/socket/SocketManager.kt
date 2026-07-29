package com.ridesharing.app.services.socket

import com.ridesharing.app.BuildConfig
import com.ridesharing.app.data.models.Message
import com.ridesharing.app.data.models.RideCreator
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.TokenManager
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SocketManager @Inject constructor(
    private val tokenManager: TokenManager
) {
    private var socket: Socket? = null
    private val currentChatRooms = mutableSetOf<String>()
    private var onMessageCallback: ((Message) -> Unit)? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _newMessage = MutableSharedFlow<JSONObject>(extraBufferCapacity = 64)
    val newMessage: SharedFlow<JSONObject> = _newMessage.asSharedFlow()

    private val _userTyping = MutableSharedFlow<JSONObject>(extraBufferCapacity = 16)
    val userTyping: SharedFlow<JSONObject> = _userTyping.asSharedFlow()

    private val _userStoppedTyping = MutableSharedFlow<JSONObject>(extraBufferCapacity = 16)
    val userStoppedTyping: SharedFlow<JSONObject> = _userStoppedTyping.asSharedFlow()

    private val _joinedChat = MutableSharedFlow<JSONObject>(extraBufferCapacity = 16)
    val joinedChat: SharedFlow<JSONObject> = _joinedChat.asSharedFlow()

    private val _socketError = MutableSharedFlow<JSONObject>(extraBufferCapacity = 16)
    val socketError: SharedFlow<JSONObject> = _socketError.asSharedFlow()

    private val _newRide = MutableSharedFlow<JSONObject>(extraBufferCapacity = 16)
    val newRide: SharedFlow<JSONObject> = _newRide.asSharedFlow()

    private val _requestUpdate = MutableSharedFlow<JSONObject>(extraBufferCapacity = 16)
    val requestUpdate: SharedFlow<JSONObject> = _requestUpdate.asSharedFlow()

    fun connect() {
        if (socket?.connected() == true) return

        val token = tokenManager.getAccessTokenSync()
        if (token.isNullOrEmpty()) return

        try {
            val options = IO.Options().apply {
                // Backend expects auth: { token: "Bearer <jwt>" }
                auth = mapOf("token" to "Bearer $token")
                forceNew = false // Optimized: Reuse connection if possible
                reconnection = true
                reconnectionAttempts = 10 // Limit attempts to save battery
                reconnectionDelay = 2000 // Increase delay
                reconnectionDelayMax = 10000 // Increase max delay
                timeout = 15000
            }

            socket = IO.socket(BuildConfig.SOCKET_URL, options)

            socket?.on(Socket.EVENT_CONNECT) {
                _isConnected.value = true
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                _isConnected.value = false
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) {
                _isConnected.value = false
            }

            // Backend emits "new_request" for incoming ride requests (to ride owner)
            socket?.on("new_request") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0] as? JSONObject
                    data?.let { _newRide.tryEmit(it) }
                }
            }

            // Backend emits "request_status" for request accept/reject (to requester)
            socket?.on("request_status") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0] as? JSONObject
                    data?.let { _requestUpdate.tryEmit(it) }
                }
            }

            socket?.on("new_message") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0] as? JSONObject
                    data?.let { json ->
                        _newMessage.tryEmit(json)
                        try {
                            val message = Message(
                                id = json.optString("id", ""),
                                text = json.optString("text", ""),
                                createdAt = json.optString("createdAt", ""),
                                senderId = json.optString("senderId", ""),
                                sender = if (json.has("sender")) {
                                    val s = json.getJSONObject("sender")
                                    RideCreator(
                                        id = s.optString("id", ""),
                                        name = s.optString("name", ""),
                                        rollNo = s.optString("rollNo", "")
                                    )
                                } else null
                            )
                            onMessageCallback?.invoke(message)
                        } catch (_: Exception) {}
                    }
                }
            }

            socket?.on("user_typing") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0] as? JSONObject
                    data?.let { _userTyping.tryEmit(it) }
                }
            }

            socket?.on("user_stop_typing") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0] as? JSONObject
                    data?.let { _userStoppedTyping.tryEmit(it) }
                }
            }

            socket?.on("joined_chat") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0] as? JSONObject
                    data?.let { _joinedChat.tryEmit(it) }
                }
            }

            socket?.on("error") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0] as? JSONObject
                    data?.let { _socketError.tryEmit(it) }
                }
            }

            socket?.connect()
        } catch (e: Exception) {
            AppLogger.e("SOCKET", "Connection error: ${e.message}", e)
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        _isConnected.value = false
        currentChatRooms.clear()
        onMessageCallback = null
    }

    fun connectToChat(requestId: String, userId: String) {
        currentChatRooms.add(requestId)
        joinChat(requestId)
    }

    fun disconnectFromChat(requestId: String) {
        currentChatRooms.remove(requestId)
        leaveChat(requestId)
    }

    fun onNewMessage(callback: (Message) -> Unit) {
        onMessageCallback = callback
    }

    fun joinChat(requestId: String) {
        socket?.emit("join_chat", JSONObject().apply {
            put("requestId", requestId)
        })
    }

    fun leaveChat(requestId: String) {
        socket?.emit("leave_chat", JSONObject().apply {
            put("requestId", requestId)
        })
    }

    fun sendMessage(requestId: String, text: String) {
        socket?.emit("send_message", JSONObject().apply {
            put("requestId", requestId)
            put("text", text)
        })
    }

    fun sendTyping(requestId: String) {
        socket?.emit("typing", JSONObject().apply {
            put("requestId", requestId)
        })
    }

    fun sendStopTyping(requestId: String) {
        socket?.emit("stop_typing", JSONObject().apply {
            put("requestId", requestId)
        })
    }
}