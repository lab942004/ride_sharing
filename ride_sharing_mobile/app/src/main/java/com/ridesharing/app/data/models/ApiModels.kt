package com.ridesharing.app.data.models

import com.google.gson.annotations.SerializedName

// ─── API Response Wrapper ────────────────────────────────────────────────────
data class ApiResponse<T>(
    val success: Boolean,
    val message: String,
    val data: T?
)

data class RidesData(
    val rides: List<Ride>?,
    val pagination: Pagination?
)

data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val pages: Int
)

// ─── Single-entity wrappers (backend wraps in { ride: {...} }, { request: {...} }, { chat: {...} }) ──
data class RideWrapper(val ride: Ride)
data class RequestWrapper(val request: RideRequest)
data class CreateRequestWrapper(val request: RideRequest)
data class UpdateRequestWrapper(val request: RideRequest)
data class MessageWrapper(val message: Message)
data class UserWrapper(val user: User)
data class ChatWrapper(val chat: ChatInfo)

// ─── Requests wrapper (backend returns { sent: [...], received: [...] }) ─────
data class RequestsWrapper(
    val sent: List<RideRequest>?,
    val received: List<RideRequest>?
)

// ─── Chat wrapper (backend returns chat info directly in data) ──────────────
data class MessagesWrapper(
    val messages: List<Message>,
    val pagination: Pagination? = null,
    val chatId: String? = null
)

// ─── Auth Models ─────────────────────────────────────────────────────────────
data class SendOtpRequest(val email: String, val name: String? = null)
data class VerifyOtpRequest(val email: String, val otp: String)
data class RegisterRequest(
    val name: String,
    val rollNo: String,
    val email: String,
    val phone: String,
    val password: String
)
data class LoginRequest(val email: String, val password: String)
data class RefreshTokenRequest(val refreshToken: String)
data class ForgotPasswordRequest(val emailOrPhone: String)
data class ResetPasswordRequest(val email: String, val otp: String, val newPassword: String)

data class AuthResponse(
    val user: User?,
    val accessToken: String?,
    val refreshToken: String?
)

data class TokenResponse(
    val accessToken: String,
    val refreshToken: String
)

data class OtpVerifyResponse(
    val verified: Boolean
)

// ─── User Model ──────────────────────────────────────────────────────────────
data class User(
    val id: String,
    val name: String,
    val email: String,
    @SerializedName("rollNo") val rollNo: String,
    val phone: String? = null,
    val domain: String? = null,
    val profilePic: String? = null,
    val isVerified: Boolean? = null,
    val createdAt: String? = null,
    val _count: ProfileCount? = null
)

data class ProfileCount(
    val rides: Int = 0,
    val sentRequests: Int = 0
)

data class UpdateProfileRequest(
    val name: String? = null,
    val phone: String? = null
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

// ─── Ride Models ─────────────────────────────────────────────────────────────
data class Ride(
    val id: String,
    val from: String,
    val to: String,
    val date: String,           // Backend returns ISO date string from Prisma (e.g., "2024-03-20T00:00:00.000Z")
    val time: String,           // Backend stores as "HH:MM" string
    val vehicleType: String,
    val availableSeats: Int,
    val isFull: Boolean = false,
    val isExpired: Boolean = false,
    val domain: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val createdById: String? = null,
    val createdBy: RideCreator? = null,
    val isOwner: Boolean? = null,
    val userRequestStatus: String? = null,
    val userRequestId: String? = null,
    val _count: RequestCount? = null,
    val requests: List<RideRequest>? = null
)

data class RideCreator(
    val id: String,
    val name: String,
    @SerializedName("rollNo") val rollNo: String,
    val email: String? = null,
    val phone: String? = null,
    val profilePic: String? = null
)

data class RequestCount(
    val requests: Int
)

data class CreateRideRequest(
    val from: String,
    val to: String,
    val date: String,       // Backend expects YYYY-MM-DD
    val time: String,       // Backend expects HH:MM (24-hour)
    val vehicleType: String,
    val availableSeats: Int
)

data class RideFilters(
    val from: String? = null,
    val to: String? = null,
    val date: String? = null,
    val vehicleType: String? = null,
    val page: Int = 1,
    val limit: Int = 10
)

// ─── Request Models ──────────────────────────────────────────────────────────
data class RideRequest(
    val id: String,
    val status: String,
    @SerializedName("phoneShared") val phoneShared: Boolean = false,
    @SerializedName("creatorPhoneConfirmed") val creatorPhoneConfirmed: Boolean = false,
    @SerializedName("requesterPhoneConfirmed") val requesterPhoneConfirmed: Boolean = false,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val rideId: String,
    val ride: Ride? = null,
    val requesterId: String? = null,
    val requester: RideCreator? = null,
    val rideCreatorId: String? = null,
    val rideCreator: RideCreator? = null
)

data class CreateRequestRequest(val rideId: String)
data class UpdateRequestRequest(val status: String)

// ─── Chat Models ─────────────────────────────────────────────────────────────
/**
 * Backend GET /chats/:requestId returns: { data: { chat: { id, requestId, participants, ride } } }
 * ChatWrapper(val chat: ChatInfo) wraps this response.
 */
data class ChatInfo(
    @SerializedName("id") val chatId: String? = null,
    val requestId: String? = null,
    val createdAt: String? = null,
    val participants: List<RideCreator>? = null,   // Backend returns participants array
    val ride: Ride? = null,
    val requester: RideCreator? = null,            // Derived from participants for convenience
    val rideCreator: RideCreator? = null,
    @SerializedName("phoneShared") val phoneShared: Boolean = false,
    val currentUserId: String? = null,
    val status: String? = null
)

data class PhoneShareResponse(
    val message: String,
    val bothConfirmed: Boolean = false,
    @SerializedName("creatorConfirmed") val creatorConfirmed: Boolean = false,
    @SerializedName("requesterConfirmed") val requesterConfirmed: Boolean = false,
    val phones: PhoneData? = null
)

data class PhoneData(
    val creatorPhone: String? = null,
    val requesterPhone: String? = null,
    val creatorName: String? = null,
    val requesterName: String? = null
)

data class Message(
    val id: String,
    val text: String,
    val createdAt: String,
    val senderId: String = "",
    val sender: RideCreator? = null
)

/**
 * Request body for PATCH /requests/:id/share-phone endpoint.
 * Backend does NOT read the request body; it only uses the path param (:id) and
 * the authenticated user from the JWT token. An empty JSON object `{}` is sent.
 */
class SharePhoneRequest

data class SendMessageRequest(val text: String)
