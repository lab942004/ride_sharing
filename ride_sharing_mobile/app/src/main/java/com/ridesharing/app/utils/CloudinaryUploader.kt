package com.ridesharing.app.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/**
 * Uploads profile images directly from the Android app to Cloudinary.
 * Does NOT send the image through the backend.
 *
 * After a successful upload the returned secure_url can be persisted
 * via the existing profile update API.
 */
object CloudinaryUploader {

    private const val TAG = "CLOUDINARY"

    // ─── Configuration ──────────────────────────────────────────────────────────
    // These must match your Cloudinary account.  The upload preset must be
    // configured as "Unsigned" in the Cloudinary Settings → Upload page.
    private const val CLOUD_NAME = "dkxmxjmzg"
    private const val UPLOAD_PRESET = "ride_sharing_profile"
    private const val MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024L    // 5 MB

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * Uploads an image file to Cloudinary.
     *
     * @param imageFile   The compressed image file to upload.
     * @return The secure Cloudinary URL on success, or null on failure.
     */
    suspend fun upload(imageFile: File): String? {
        return try {
            AppLogger.d(TAG, "Starting upload: ${imageFile.name}, size=${imageFile.length()}")

            // Build multipart request for Cloudinary unsigned upload
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", imageFile.name,
                    imageFile.asRequestBody("image/*".toMediaTypeOrNull()))
                .addFormDataPart("upload_preset", UPLOAD_PRESET)
                .addFormDataPart("folder", "profile_pictures")
                .build()

            val request = Request.Builder()
                .url("https://api.cloudinary.com/v1_1/$CLOUD_NAME/image/upload")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()
            AppLogger.d(TAG, "Cloudinary response code: ${response.code}")

            if (response.isSuccessful && responseBody != null) {
                val json = JSONObject(responseBody)
                val secureUrl = json.optString("secure_url")
                AppLogger.d(TAG, "Upload successful: $secureUrl")
                secureUrl
            } else {
                AppLogger.e(TAG, "Upload failed: $responseBody")
                null
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Upload exception", e)
            null
        }
    }

    /**
     * Compresses an image from the given [uri] and returns a [File] suitable
     * for upload.  The file is placed in the app's cache directory.
     *
     * @return A compressed File, or null if reading / decoding fails.
     */
    fun compressAndPrepare(context: Context, uri: Uri): File? {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            val originalBytes = inputStream.readBytes()
            inputStream.close()

            AppLogger.d(TAG, "Original image size: ${originalBytes.size} bytes")

            // Decode to bitmap & compress to JPEG  (max dimension 1024 px)
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeByteArray(originalBytes, 0, originalBytes.size, options)

            // Calculate sample size to keep max dimension ~1024 px
            val maxDimension = 1024
            val scaleFactor = maxOf(
                options.outWidth / maxDimension,
                options.outHeight / maxDimension,
                1
            )
            val sampleOptions = BitmapFactory.Options().apply {
                inSampleSize = scaleFactor
            }
            val bitmap = BitmapFactory.decodeByteArray(originalBytes, 0, originalBytes.size, sampleOptions)
                ?: return null

            // Compress to JPEG with 80% quality
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
            val compressedBytes = outputStream.toByteArray()
            bitmap.recycle()

            AppLogger.d(TAG, "Compressed image size: ${compressedBytes.size} bytes")

            // If still over the size limit, reduce quality further
            var quality = 80
            var finalBytes = compressedBytes
            while (finalBytes.size > MAX_IMAGE_SIZE_BYTES && quality > 10) {
                quality -= 10
                val bs = ByteArrayOutputStream()
                val bmp = BitmapFactory.decodeByteArray(compressedBytes, 0, compressedBytes.size)
                bmp?.compress(Bitmap.CompressFormat.JPEG, quality, bs)
                finalBytes = bs.toByteArray()
                bmp?.recycle()
                AppLogger.d(TAG, "Re-compressed at quality=$quality: ${finalBytes.size} bytes")
            }

            // Write to cache file
            val cacheDir = context.cacheDir
            val outputFile = File(cacheDir, "cloudinary_${System.currentTimeMillis()}.jpg")
            FileOutputStream(outputFile).use { fos ->
                fos.write(finalBytes)
                fos.flush()
            }

            AppLogger.d(TAG, "Final file: ${outputFile.absolutePath}, size=${outputFile.length()}")
            outputFile
        } catch (e: Exception) {
            AppLogger.e(TAG, "Compress error", e)
            null
        }
    }

    /**
     * Checks if the given image URI is within the 5 MB size limit.
     */
    fun isWithinSizeLimit(context: Context, uri: Uri): Boolean {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return false
            val size = inputStream.available().toLong()
            inputStream.close()
            size <= MAX_IMAGE_SIZE_BYTES
        } catch (e: Exception) {
            true // If we can't check, let the compressor handle it
        }
    }
}