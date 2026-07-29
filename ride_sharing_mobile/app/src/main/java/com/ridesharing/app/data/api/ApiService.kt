package com.ridesharing.app.data.api

import com.ridesharing.app.data.models.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ─── Auth ─────────────────────────────────────────────────────────────────
    @POST("auth/send-otp")
    suspend fun sendOtp(@Body request: SendOtpRequest): Response<ApiResponse<Any>>

    @POST("auth/verify-otp")
    suspend fun verifyOtp(@Body request: VerifyOtpRequest): Response<ApiResponse<OtpVerifyResponse>>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<AuthResponse>>

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<AuthResponse>>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<ApiResponse<TokenResponse>>

    @POST("auth/logout")
    suspend fun logout(@Body request: RefreshTokenRequest): Response<ApiResponse<Any>>

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<ApiResponse<Any>>

    @POST("auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): Response<ApiResponse<Any>>

    @GET("auth/me")
    suspend fun getMe(): Response<ApiResponse<UserWrapper>>

    // ─── Profile ──────────────────────────────────────────────────────────────
    @GET("profile")
    suspend fun getProfile(): Response<ApiResponse<UserWrapper>>

    @PATCH("profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): Response<ApiResponse<UserWrapper>>

    @PATCH("profile/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Any>>

    @Multipart
    @PATCH("profile")
    suspend fun uploadProfilePic(
        @Part profilePic: MultipartBody.Part,
        @Part("name") name: RequestBody? = null,
        @Part("phone") phone: RequestBody? = null
    ): Response<ApiResponse<UserWrapper>>

    // ── Rides ────────────────────────────────────────────────────────────────
    // Backend: POST /rides -> { data: { ride: Ride } }
    @POST("rides")
    suspend fun createRide(@Body request: CreateRideRequest): Response<ApiResponse<RideWrapper>>

    // Backend: GET /rides -> { data: { rides: [...], pagination: {...} } }
    @GET("rides")
    suspend fun getRides(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("date") date: String? = null,
        @Query("vehicleType") vehicleType: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10
    ): Response<ApiResponse<RidesData>>

    // Backend: GET /rides/my -> { data: { rides: [...] } }
    @GET("rides/my")
    suspend fun getMyRides(): Response<ApiResponse<RidesData>>

    // Backend: GET /rides/:id -> { data: { ride: Ride } }
    @GET("rides/{id}")
    suspend fun getRideById(@Path("id") rideId: String): Response<ApiResponse<RideWrapper>>

    // Backend: DELETE /rides/:id -> { data: { message: string } } or just success
    @DELETE("rides/{id}")
    suspend fun deleteRide(@Path("id") rideId: String): Response<ApiResponse<Any>>

    @DELETE("requests/{id}")
    suspend fun deleteRequest(@Path("id") requestId: String): Response<ApiResponse<Any>>

    // ─── Requests ─────────────────────────────────────────────────────────────
    // Backend: POST /requests -> { data: { request: RideRequest } }
    @POST("requests")
    suspend fun createRequest(@Body request: CreateRequestRequest): Response<ApiResponse<CreateRequestWrapper>>

    // Backend: GET /requests -> { data: { sent: [...], received: [...] } }
    @GET("requests")
    suspend fun getRequests(): Response<ApiResponse<RequestsWrapper>>

    // Backend: PATCH /requests/:id -> { data: { request: { id, status, ... } } }
    @PATCH("requests/{id}")
    suspend fun updateRequest(
        @Path("id") requestId: String,
        @Body request: UpdateRequestRequest
    ): Response<ApiResponse<UpdateRequestWrapper>>

    // Backend: PATCH /requests/:id/share-phone -> { data: PhoneShareResponse }
    // Backend does NOT read the request body; it only uses path param and auth user.
    @PATCH("requests/{id}/share-phone")
    suspend fun sharePhone(
        @Path("id") requestId: String,
        @Body body: SharePhoneRequest
    ): Response<ApiResponse<PhoneShareResponse>>

    // ─── Chat ─────────────────────────────────────────────────────────────────
    // Backend: GET /chats/:requestId -> { data: { chat: { id, requestId, participants, ride, ... } } }
    @GET("chats/{requestId}")
    suspend fun getChatInfo(@Path("requestId") requestId: String): Response<ApiResponse<ChatWrapper>>

    // Backend: GET /chats/:requestId/messages -> { data: { messages: [...], pagination: {...}, chatId: "..." } }
    @GET("chats/{requestId}/messages")
    suspend fun getMessages(
        @Path("requestId") requestId: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<ApiResponse<MessagesWrapper>>

    // Backend: POST /chats/:requestId/messages -> { data: { message: Message } }
    @POST("chats/{requestId}/messages")
    suspend fun sendMessage(
        @Path("requestId") requestId: String,
        @Body request: SendMessageRequest
    ): Response<ApiResponse<MessageWrapper>>
}