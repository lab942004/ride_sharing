package com.ridesharing.app.data.repository

import android.content.Context
import android.net.Uri
import android.util.Log
import com.ridesharing.app.data.api.ApiService
import com.ridesharing.app.data.local.dao.CachedUserDao
import com.ridesharing.app.data.local.entity.CachedUser
import com.ridesharing.app.data.models.*
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.CloudinaryUploader
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.TokenManager
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.InputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(
    private val api: ApiService,
    private val cachedUserDao: CachedUserDao,
    private val tokenManager: TokenManager,
    @ApplicationContext private val context: Context
) {
    suspend fun getProfile(): Resource<User> {
        return try {
            val response = api.getProfile()
            if (response.isSuccessful) {
                // Backend wraps user in { user: { ... } }
                val user = response.body()?.data?.user
                if (user != null) {
                    cachedUserDao.insertUser(user.toCached())
                    Resource.Success(user)
                } else {
                    val cached = cachedUserDao.getUserOnce()
                    if (cached != null) {
                        Resource.Success(cached.toUser())
                    } else {
                        Resource.Error("Profile not found")
                    }
                }
            } else {
                val cached = cachedUserDao.getUserOnce()
                if (cached != null) {
                    Resource.Success(cached.toUser())
                } else {
                    Resource.Error("Failed to load profile")
                }
            }
        } catch (e: Exception) {
            val cached = cachedUserDao.getUserOnce()
            if (cached != null) {
                Resource.Success(cached.toUser())
            } else {
                Resource.Error(e.message ?: "Network error")
            }
        }
    }

    suspend fun updateProfile(name: String?, phone: String?): Resource<User> {
        return try {
            val response = api.updateProfile(UpdateProfileRequest(name, phone))
            if (response.isSuccessful) {
                // Backend wraps user in { user: { ... } }
                val user = response.body()?.data?.user
                if (user != null) {
                    cachedUserDao.insertUser(user.toCached())
                    Resource.Success(user)
                } else {
                    Resource.Error("Failed to update profile")
                }
            } else {
                Resource.Error("Failed to update profile")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    /**
     * Removes the profile picture by sending an update with the name only.
     * Backend's updateProfile accepts optional name/phone and the profilePic
     * is only updated when a file is uploaded. To "remove" the photo, we
     * send a PATCH with just the name (no file part), which leaves profilePic unchanged.
     * For actual removal, we upload an empty/null file representation.
     * 
     * Since the backend only updates profilePic when a file is uploaded,
     * we send a multipart request with no file part to clear it.
     */
    suspend fun removeProfilePicture(): Resource<User> {
        return try {
            // Create an empty multipart body to indicate file removal
            val emptyFileBytes = byteArrayOf()
            val requestBody = emptyFileBytes.toRequestBody("image/*".toMediaTypeOrNull())
            val imagePart = MultipartBody.Part.createFormData("profilePic", "empty", requestBody)

            val response = api.uploadProfilePic(
                profilePic = imagePart,
                name = null,
                phone = null
            )
            if (response.isSuccessful) {
                val user = response.body()?.data?.user
                if (user != null) {
                    cachedUserDao.insertUser(user.toCached())
                    Resource.Success(user)
                } else {
                    Resource.Error("Failed to remove profile picture")
                }
            } else {
                Resource.Error("Failed to remove profile picture")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Remove photo error")
        }
    }

    suspend fun uploadProfilePicWithData(
        imageUri: Uri,
        name: String?,
        phone: String?
    ): Resource<User> {
        return try {
            AppLogger.d("PROFILE_UPLOAD", "Reading image from URI: $imageUri")
            val inputStream: InputStream? = context.contentResolver.openInputStream(imageUri)
            val bytes = inputStream?.readBytes() ?: return Resource.Error("Failed to read image")
            inputStream.close()
            AppLogger.d("PROFILE_UPLOAD", "Read ${bytes.size} bytes from image URI")

            val requestBody = bytes.toRequestBody("image/*".toMediaTypeOrNull())
            val imagePart = MultipartBody.Part.createFormData("profilePic", "profile.jpg", requestBody)
            AppLogger.d("PROFILE_UPLOAD", "Created multipart body: profilePic, size=${bytes.size}")

            val namePart = name?.toRequestBody("text/plain".toMediaTypeOrNull())
            val phonePart = phone?.toRequestBody("text/plain".toMediaTypeOrNull())

            AppLogger.d("PROFILE_UPLOAD", "Sending multipart PATCH to profile endpoint")
            val response = api.uploadProfilePic(
                profilePic = imagePart,
                name = namePart,
                phone = phonePart
            )
            AppLogger.d("PROFILE_UPLOAD", "Response status: ${response.code()} ${response.message()}")

            if (response.isSuccessful) {
                val body = response.body()
                AppLogger.d("PROFILE_UPLOAD", "Response body: success=${body?.success}, data=${body?.data}")
                // Backend wraps user in { user: { ... } }
                val user = body?.data?.user
                if (user != null) {
                    AppLogger.d("PROFILE_UPLOAD", "User received: id=${user.id}, profilePic=${user.profilePic}")
                    cachedUserDao.insertUser(user.toCached())
                    AppLogger.d("PROFILE_REFRESH", "Updated local cache with new profilePic")
                    Resource.Success(user)
                } else {
                    AppLogger.d("PROFILE_UPLOAD", "User was null in response")
                    Resource.Error("Failed to update profile")
                }
            } else {
                val errorBody = response.errorBody()?.string()
                AppLogger.d("PROFILE_UPLOAD", "Upload failed: code=${response.code()}, body=$errorBody")
                Resource.Error(errorBody ?: "Upload failed (${response.code()})")
            }
        } catch (e: Exception) {
            AppLogger.e("PROFILE_UPLOAD", "Upload exception", e)
            Resource.Error(e.message ?: "Upload error")
        }
    }

    /**
     * Uploads a profile picture directly to Cloudinary from the Android app,
     * then saves the returned URL to the local Room cache for instant UI refresh.
     *
     * The image is NOT sent through the backend. Only the URL is stored locally.
     * When the user loads their profile from the API, the backend returns whatever
     * profilePic was there before, but the local cache will have the new URL.
     *
     * @param imageUri The URI of the selected image.
     * @return Resource with the updated User (from local cache).
     */
    suspend fun uploadProfilePictureToCloudinary(imageUri: Uri): Resource<User> {
        return try {
            AppLogger.d("CLOUDINARY_REPO", "Starting Cloudinary upload for URI: $imageUri")

            // 1. Compress and prepare the image
            val compressedFile = CloudinaryUploader.compressAndPrepare(context, imageUri)
            if (compressedFile == null) {
                AppLogger.e("CLOUDINARY_REPO", "Failed to compress image")
                return Resource.Error("Failed to process image")
            }

            // 2. Upload to Cloudinary
            val secureUrl = CloudinaryUploader.upload(compressedFile)
            if (secureUrl == null) {
                AppLogger.e("CLOUDINARY_REPO", "Cloudinary upload failed")
                return Resource.Error("Image upload failed. Please try again.")
            }

            AppLogger.d("CLOUDINARY_REPO", "Cloudinary upload success: $secureUrl")

            // 3. Save URL to local cache immediately for instant UI refresh
            val cached = cachedUserDao.getUserOnce()
            if (cached != null) {
                val updatedCached = cached.copy(profilePic = secureUrl)
                cachedUserDao.insertUser(updatedCached)
                AppLogger.d("CLOUDINARY_REPO", "Updated local cache with new profilePic URL")

                val user = updatedCached.toUser()
                Resource.Success(user)
            } else {
                // No cached user yet - create one from the current state
                AppLogger.w("CLOUDINARY_REPO", "No cached user found, creating from scratch")
                Resource.Error("User not found in cache")
            }
        } catch (e: Exception) {
            AppLogger.e("CLOUDINARY_REPO", "Cloudinary upload exception", e)
            Resource.Error(e.message ?: "Image upload failed. Please try again.")
        }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String): Resource<String> {
        return try {
            val response = api.changePassword(ChangePasswordRequest(currentPassword, newPassword))
            if (response.isSuccessful) {
                Resource.Success("Password changed successfully")
            } else {
                Resource.Error("Failed to change password")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Network error")
        }
    }

    private fun User.toCached() = CachedUser(
        id = id, name = name, email = email,
        rollNo = rollNo, phone = phone,
        domain = domain, profilePic = profilePic,
        isVerified = isVerified ?: false,
        createdAt = createdAt,
        ridesCount = _count?.rides ?: 0,
        requestsCount = _count?.sentRequests ?: 0
    )

    private fun CachedUser.toUser() = User(
        id = id, name = name, email = email, rollNo = rollNo,
        phone = phone, domain = domain, profilePic = profilePic,
        isVerified = isVerified, createdAt = createdAt,
        _count = ProfileCount(rides = ridesCount, sentRequests = requestsCount)
    )
}