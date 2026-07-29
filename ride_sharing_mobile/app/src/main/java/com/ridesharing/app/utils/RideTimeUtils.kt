package com.ridesharing.app.utils

import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.TimeZone

/**
 * Utility class for ride time formatting and display.
 *
 * IMPORTANT: Backend stores ride.date and ride.time as SEPARATE fields.
 * - ride.date = ISO date string (e.g., "2026-06-20T00:00:00.000Z") or "2026-06-20"
 *   The time component of this value is ALWAYS midnight UTC (Prisma default).
 *   We ONLY use the year/month/day portion.
 * - ride.time = "HH:MM" 24-hour string (e.g., "00:20")
 *
 * These two fields together represent the user's LOCAL time.
 * We NEVER convert between timezones because the backend does NOT store UTC timestamps
 * for rides - it stores separate date + time fields.
 */
object RideTimeUtils {

    private const val TAG = "RIDE_TIME"

    /**
     * Extracts the date part (year, month, day) from the backend date string
     * and combines it with the time string as a LocalDateTime at the device timezone.
     *
     * The backend's date field is a date-only value stored as midnight UTC in Prisma.
     * We ignore the time-of-day part and only use YYYY-MM-DD.
     *
     * @param rideDate Backend date string (ISO format or "YYYY-MM-DD")
     * @param rideTime Backend time string ("HH:MM" 24-hour format)
     * @return ZonedDateTime at device local timezone, or null if parsing fails
     */
    fun toLocalDateTime(rideDate: String, rideTime: String): ZonedDateTime? {
        // Step 1: Extract LocalDate from the date string (ignore time-of-day)
        val localDate = parseDateAsLocalDate(rideDate) ?: return null

        // Step 2: Parse the time string
        val timeParts = rideTime.split(":")
        if (timeParts.size < 2) {
            AppLogger.e(TAG, "Invalid time format: $rideTime")
            return null
        }
        val hour = timeParts[0].toIntOrNull() ?: return null
        val minute = timeParts[1].toIntOrNull() ?: return null
        val localTime = LocalTime.of(hour, minute)

        // Step 3: Combine as LocalDateTime at device timezone
        // NO UTC CONVERSION - the date+time represents the user's local time directly
        val deviceZone = ZoneId.systemDefault()
        val localDateTime = LocalDateTime.of(localDate, localTime)
        val result = localDateTime.atZone(deviceZone)

        AppLogger.d(TAG, "=== toLocalDateTime ===")
        AppLogger.d(TAG, "Input Date = $rideDate")
        AppLogger.d(TAG, "Input Time = $rideTime")
        AppLogger.d(TAG, "Parsed LocalDate = $localDate")
        AppLogger.d(TAG, "Parsed LocalTime = $localTime")
        AppLogger.d(TAG, "Device Zone = $deviceZone")
        AppLogger.d(TAG, "Result = $result")
        AppLogger.d(TAG, "TimeZone = ${TimeZone.getDefault().id}")

        return result
    }

    /**
     * Parses the backend date string into a LocalDate, ignoring any time-of-day component.
     *
     * Accepts formats:
     * - "2026-06-20T00:00:00.000Z" (ISO with time)
     * - "2026-06-20T00:00:00.000+00:00" (ISO with offset)
     * - "2026-06-20" (simple date)
     */
    private fun parseDateAsLocalDate(dateStr: String): LocalDate? {
        return try {
            // Try full ISO format first (e.g., "2026-06-20T00:00:00.000Z")
            LocalDate.parse(dateStr.take(10), DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (e: Exception) {
            try {
                // Try direct date format
                LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE)
            } catch (e2: Exception) {
                AppLogger.e(TAG, "Failed to parse date: $dateStr", e)
                null
            }
        }
    }

    /**
     * Checks if a ride is expired based on its date and time.
     *
     * @param rideDate Backend date string
     * @param rideTime Backend time string (HH:MM)
     * @return true if the ride's departure time has passed
     */
    fun isRideExpired(rideDate: String, rideTime: String): Boolean {
        val rideLocal = toLocalDateTime(rideDate, rideTime) ?: return false
        val now = ZonedDateTime.now(ZoneId.systemDefault())
        val isExpired = now.isAfter(rideLocal)

        AppLogger.d(TAG, "=== isRideExpired ===")
        AppLogger.d(TAG, "Ride Date = $rideDate")
        AppLogger.d(TAG, "Ride Time = $rideTime")
        AppLogger.d(TAG, "Ride Local = $rideLocal")
        AppLogger.d(TAG, "Device Time = $now")
        AppLogger.d(TAG, "Expired = $isExpired")
        AppLogger.d(TAG, "Device Zone = ${ZoneId.systemDefault()}")
        AppLogger.d(TAG, "TimeZone = ${TimeZone.getDefault().id}")

        return isExpired
    }

    /**
     * Returns a human-readable string of the time remaining until the ride starts.
     *
     * Examples:
     *   - "Starts in 15 minutes"
     *   - "Starts in 2 hours"
     *   - "Today"
     *   - "Tomorrow"
     *   - "Starts on Jun 20"
     *
     * @return Formatted remaining time string, or null if parsing fails
     */
    fun getRemainingTime(rideDate: String, rideTime: String): String? {
        val rideLocal = toLocalDateTime(rideDate, rideTime) ?: return null
        val now = ZonedDateTime.now(ZoneId.systemDefault())

        if (now.isAfter(rideLocal)) {
            return null // Ride is expired
        }

        val duration = Duration.between(now, rideLocal)
        val minutes = duration.toMinutes()
        val hours = duration.toHours()
        val days = duration.toDays()

        val rideLocalDate = rideLocal.toLocalDate()
        val today = now.toLocalDate()
        val tomorrow = today.plusDays(1)

        return when {
            minutes < 1 -> "Starting now"
            minutes < 60 -> "Starts in $minutes minute${if (minutes != 1L) "s" else ""}"
            hours < 24 && rideLocalDate == today -> {
                if (hours < 2) "Starts in $hours hour${if (hours != 1L) "s" else ""}"
                else "Today at ${rideLocal.format(DateTimeFormatter.ofPattern("h:mm a"))}"
            }
            rideLocalDate == tomorrow -> "Tomorrow at ${rideLocal.format(DateTimeFormatter.ofPattern("h:mm a"))}"
            days < 7 -> {
                val dayName = rideLocal.format(DateTimeFormatter.ofPattern("EEEE"))
                "$dayName at ${rideLocal.format(DateTimeFormatter.ofPattern("h:mm a"))}"
            }
            else -> rideLocal.format(DateTimeFormatter.ofPattern("MMM d, h:mm a"))
        }
    }

    /**
     * Formats the backend ride date and time into a localized string.
     *
     * Examples:
     *   - "Today, 6:30 PM"
     *   - "Tomorrow, 8:00 AM"
     *   - "Mon, 10:30 AM"
     *   - "Jun 20, 3:45 PM"
     */
    fun formatRideTime(rideDate: String, rideTime: String): String {
        val rideLocal = toLocalDateTime(rideDate, rideTime) ?: return "$rideDate $rideTime"

        val now = ZonedDateTime.now(ZoneId.systemDefault())
        val rideLocalDate = rideLocal.toLocalDate()
        val today = now.toLocalDate()
        val tomorrow = today.plusDays(1)

        val timeFormatted = rideLocal.format(DateTimeFormatter.ofPattern("h:mm a"))
        val dateFormatted = when (rideLocalDate) {
            today -> "Today"
            tomorrow -> "Tomorrow"
            else -> rideLocal.format(DateTimeFormatter.ofPattern("EEE, MMM d"))
        }

        AppLogger.d(TAG, "=== formatRideTime ===")
        AppLogger.d(TAG, "Selected Time = $rideTime")
        AppLogger.d(TAG, "Saved Time = $timeFormatted")
        AppLogger.d(TAG, "Displayed Time = $dateFormatted, $timeFormatted")
        AppLogger.d(TAG, "Device Zone = ${ZoneId.systemDefault()}")

        return "$dateFormatted, $timeFormatted"
    }

    /**
     * Returns a concise time label for ride cards.
     *
     * Examples:
     *   - "Today"
     *   - "Tomorrow"
     *   - "Starts in 15m"
     *   - "Starts in 2h"
     *   - "Jun 20"
     *   - "Expired" (if expired)
     */
    fun getTimeLabel(rideDate: String, rideTime: String): String {
        val rideLocal = toLocalDateTime(rideDate, rideTime) ?: return rideDate
        val now = ZonedDateTime.now(ZoneId.systemDefault())

        if (now.isAfter(rideLocal)) {
            return "Expired"
        }

        val duration = Duration.between(now, rideLocal)
        val minutes = duration.toMinutes()
        val hours = duration.toHours()
        val days = duration.toDays()

        val rideLocalDate = rideLocal.toLocalDate()
        val today = now.toLocalDate()
        val tomorrow = today.plusDays(1)

        return when {
            minutes < 1 -> "Starting now"
            minutes < 60 -> "Starts in ${minutes}m"
            hours < 24 && rideLocalDate == today -> "Today"
            rideLocalDate == tomorrow -> "Tomorrow"
            days < 7 -> rideLocal.format(DateTimeFormatter.ofPattern("EEEE"))
            else -> rideLocal.format(DateTimeFormatter.ofPattern("MMM d"))
        }
    }

    /**
     * Formats the ride time for detail screen display.
     * Shows the full date and time in device timezone.
     *
     * Example: "Sat, Jun 20, 2026 at 12:20 AM"
     */
    fun formatRideDateTime(rideDate: String, rideTime: String): String {
        val rideLocal = toLocalDateTime(rideDate, rideTime) ?: return "$rideDate at $rideTime"
        val result = rideLocal.format(DateTimeFormatter.ofPattern("EEE, MMM d, yyyy 'at' h:mm a"))

        AppLogger.d(TAG, "=== formatRideDateTime ===")
        AppLogger.d(TAG, "Selected Time = $rideTime")
        AppLogger.d(TAG, "Saved Time = $result")
        AppLogger.d(TAG, "Displayed Time = $result")
        AppLogger.d(TAG, "Device Zone = ${ZoneId.systemDefault()}")

        return result
    }

    /**
     * Parses date and time strings into a LocalDateTime.
     * This is useful for create/edit ride screens to get a structured date-time object.
     *
     * @param date Date string in "YYYY-MM-DD" format
     * @param time Time string in "HH:MM" 24-hour format
     * @return LocalDateTime at the device timezone
     */
    fun parseRideDateTime(date: String, time: String): LocalDateTime? {
        return try {
            val localDate = LocalDate.parse(date, DateTimeFormatter.ISO_LOCAL_DATE)
            val timeParts = time.split(":")
            if (timeParts.size < 2) return null
            val hour = timeParts[0].toIntOrNull() ?: return null
            val minute = timeParts[1].toIntOrNull() ?: return null
            val localTime = LocalTime.of(hour, minute)
            LocalDateTime.of(localDate, localTime)
        } catch (e: Exception) {
            AppLogger.e(TAG, "parseRideDateTime failed: date=$date, time=$time", e)
            null
        }
    }
}