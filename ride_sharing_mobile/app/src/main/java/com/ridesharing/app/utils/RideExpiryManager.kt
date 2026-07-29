package com.ridesharing.app.utils

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Smart Auto-Delete System for Rides, Chats, and Requests.
 *
 * All time calculations use Asia/Kolkata timezone consistently.
 * No backend modifications, no API changes, no PostgreSQL changes.
 *
 * RULE 1: Ride card disappears immediately after ride date/time passes.
 * RULE 2: Chats remain available for 3 days after ride expiry, then auto-deleted.
 * RULE 3: Requests linked to expired rides remain for 3 days, then auto-deleted.
 */
@Singleton
class RideExpiryManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val sharedPreferences: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val tag = "RIDE_EXPIRY"

    companion object {
        private const val PREFS_NAME = "ride_expiry_prefs"
        private const val KEY_EXPIRED_RIDES = "expired_rides"
        private const val KEY_DELETED_CONVERSATIONS = "deleted_conversations"
        private const val KEY_DELETED_REQUESTS = "deleted_requests"

        // Asia/Kolkata timezone
        private val KOLKATA_ZONE = ZoneId.of("Asia/Kolkata")

        // 3 days in milliseconds
        private const val THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000L
    }

    /**
     * Returns the current time in Asia/Kolkata timezone.
     */
    private fun nowKolkata(): ZonedDateTime {
        return ZonedDateTime.now(KOLKATA_ZONE)
    }

    /**
     * Converts current time to epoch millis in Asia/Kolkata.
     */
    private fun nowKolkataMillis(): Long {
        return nowKolkata().toInstant().toEpochMilli()
    }

    /**
     * Combines a ride date and time string into a ZonedDateTime at Asia/Kolkata.
     *
     * @param rideDate Backend date string (e.g., "2026-06-20T00:00:00.000Z" or "2026-06-20")
     * @param rideTime Backend time string ("HH:MM" 24-hour format)
     * @return ZonedDateTime at Asia/Kolkata, or null if parsing fails
     */
    fun getRideDateTime(rideDate: String, rideTime: String): ZonedDateTime? {
        // Extract date part (first 10 chars: YYYY-MM-DD)
        val datePart = rideDate.take(10)
        val localDate = try {
            LocalDate.parse(datePart, DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (e: Exception) {
            AppLogger.e(tag, "Failed to parse date: $rideDate", e)
            return null
        }

        // Parse time
        val timeParts = rideTime.split(":")
        if (timeParts.size < 2) {
            AppLogger.e(tag, "Invalid time format: $rideTime")
            return null
        }
        val hour = timeParts[0].toIntOrNull() ?: return null
        val minute = timeParts[1].toIntOrNull() ?: return null
        val localTime = LocalTime.of(hour, minute)

        // Combine at Asia/Kolkata timezone
        val localDateTime = LocalDateTime.of(localDate, localTime)
        return localDateTime.atZone(KOLKATA_ZONE)
    }

    /**
     * Gets the ride date/time as epoch millis for comparison.
     */
    fun getRideDateTimeMillis(rideDate: String, rideTime: String): Long? {
        return getRideDateTime(rideDate, rideTime)?.toInstant()?.toEpochMilli()
    }

    /**
     * RULE 1: Checks if a ride is expired based on its date and time.
     *
     * @return true if current time (Asia/Kolkata) is after the ride's departure time
     */
    fun isRideExpired(rideDate: String, rideTime: String): Boolean {
        val rideDateTime = getRideDateTime(rideDate, rideTime) ?: return false
        val isExpired = nowKolkata().isAfter(rideDateTime)

        if (isExpired) {
            AppLogger.d(tag, "=== isRideExpired ===")
            AppLogger.d(tag, "Ride: $rideDate $rideTime")
            AppLogger.d(tag, "Ride DateTime (Kolkata): $rideDateTime")
            AppLogger.d(tag, "Current Time (Kolkata): ${nowKolkata()}")
            AppLogger.d(tag, "Result: EXPIRED")
        }

        return isExpired
    }

    /**
     * RULE 2: Calculates when the chat associated with this ride should be auto-deleted.
     * Chat expiry = ride date/time + 3 days.
     *
     * @return ZonedDateTime (Asia/Kolkata) when chat should be deleted, or null if parsing fails
     */
    fun getChatDeletionTime(rideDate: String, rideTime: String): ZonedDateTime? {
        val rideDateTime = getRideDateTime(rideDate, rideTime) ?: return null
        return rideDateTime.plusDays(3)
    }

    /**
     * Returns the chat deletion time as epoch millis.
     */
    fun getChatDeletionTimeMillis(rideDate: String, rideTime: String): Long? {
        return getChatDeletionTime(rideDate, rideTime)?.toInstant()?.toEpochMilli()
    }

    /**
     * RULE 2: Checks if a conversation linked to this ride should be deleted.
     *
     * @return true if current time (Asia/Kolkata) is past chat expiry time
     */
    fun shouldDeleteConversation(rideDate: String, rideTime: String): Boolean {
        val deletionTime = getChatDeletionTime(rideDate, rideTime) ?: return false
        val shouldDelete = nowKolkata().isAfter(deletionTime)

        if (shouldDelete) {
            AppLogger.d(tag, "=== shouldDeleteConversation ===")
            AppLogger.d(tag, "Ride: $rideDate $rideTime")
            AppLogger.d(tag, "Deletion Time (Kolkata): $deletionTime")
            AppLogger.d(tag, "Current Time (Kolkata): ${nowKolkata()}")
            AppLogger.d(tag, "Result: DELETE")
        }

        return shouldDelete
    }

    /**
     * RULE 3: Checks if a request linked to this ride should be deleted.
     * Same as chat deletion - 3 days after ride expiry.
     *
     * @return true if current time (Asia/Kolkata) is past request deletion time
     */
    fun shouldDeleteRequest(rideDate: String, rideTime: String): Boolean {
        return shouldDeleteConversation(rideDate, rideTime)
    }

    /**
     * Returns the number of milliseconds until the ride expires.
     * Positive value = time remaining, negative/zero = already expired.
     */
    fun getTimeUntilExpiry(rideDate: String, rideTime: String): Long {
        val rideMillis = getRideDateTimeMillis(rideDate, rideTime) ?: return 0L
        return rideMillis - nowKolkataMillis()
    }

    /**
     * Returns the number of milliseconds until the conversation should be deleted.
     * Positive value = time remaining, negative/zero = should be deleted.
     */
    fun getTimeUntilChatDeletion(rideDate: String, rideTime: String): Long {
        val deletionMillis = getChatDeletionTimeMillis(rideDate, rideTime) ?: return 0L
        return deletionMillis - nowKolkataMillis()
    }

    // ─── Persistent Storage for Expired Items ──────────────────────────────────

    /**
     * Marks a ride as expired in local SharedPreferences.
     */
    fun markRideExpired(rideId: String) {
        val expired = getExpiredRideIds().toMutableSet()
        expired.add(rideId)
        sharedPreferences.edit()
            .putStringSet(KEY_EXPIRED_RIDES, expired)
            .apply()
        AppLogger.d(tag, "Ride $rideId marked as expired locally")
    }

    /**
     * Returns the set of ride IDs that have been locally marked as expired.
     */
    fun getExpiredRideIds(): Set<String> {
        return sharedPreferences.getStringSet(KEY_EXPIRED_RIDES, emptySet()) ?: emptySet()
    }

    /**
     * Checks if a specific ride has been locally marked as expired.
     */
    fun isRideExpiredLocally(rideId: String): Boolean {
        return getExpiredRideIds().contains(rideId)
    }

    /**
     * Marks a conversation (requestId) as deleted in local SharedPreferences.
     */
    fun markConversationDeleted(requestId: String) {
        val deleted = getDeletedConversationIds().toMutableSet()
        deleted.add(requestId)
        sharedPreferences.edit()
            .putStringSet(KEY_DELETED_CONVERSATIONS, deleted)
            .apply()
        AppLogger.d(tag, "Conversation $requestId marked as auto-deleted")
    }

    /**
     * Returns the set of conversation requestIds that have been auto-deleted.
     */
    fun getDeletedConversationIds(): Set<String> {
        return sharedPreferences.getStringSet(KEY_DELETED_CONVERSATIONS, emptySet()) ?: emptySet()
    }

    /**
     * Checks if a specific conversation has been auto-deleted.
     */
    fun isConversationDeleted(requestId: String): Boolean {
        return getDeletedConversationIds().contains(requestId)
    }

    /**
     * Marks a request as deleted in local SharedPreferences.
     */
    fun markRequestDeleted(requestId: String) {
        val deleted = getDeletedRequestIds().toMutableSet()
        deleted.add(requestId)
        sharedPreferences.edit()
            .putStringSet(KEY_DELETED_REQUESTS, deleted)
            .apply()
        AppLogger.d(tag, "Request $requestId marked as auto-deleted")
    }

    /**
     * Returns the set of request IDs that have been auto-deleted.
     */
    fun getDeletedRequestIds(): Set<String> {
        return sharedPreferences.getStringSet(KEY_DELETED_REQUESTS, emptySet()) ?: emptySet()
    }

    /**
     * Checks if a specific request has been auto-deleted.
     */
    fun isRequestDeleted(requestId: String): Boolean {
        return getDeletedRequestIds().contains(requestId)
    }

    /**
     * Clears all locally stored expiry/deletion data (for testing/reset).
     */
    fun clearAll() {
        sharedPreferences.edit()
            .remove(KEY_EXPIRED_RIDES)
            .remove(KEY_DELETED_CONVERSATIONS)
            .remove(KEY_DELETED_REQUESTS)
            .apply()
        AppLogger.d(tag, "All expiry/deletion data cleared")
    }

    /**
     * Helper: Parses date string to extract just the date part.
     */
    fun extractDate(dateStr: String): String {
        return dateStr.take(10)
    }
}