package com.ridesharing.app.utils

import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * Utility class for formatting chat message timestamps.
 *
 * Backend stores all timestamps in UTC (ISO 8601 format).
 * All display conversions use the device's local timezone.
 *
 * Format rules:
 * - Today:          01:07 PM
 * - Yesterday:      Yesterday, 01:07 PM
 * - This year:      Jun 16, 01:07 PM
 * - Other years:    Jun 16, 2024, 01:07 PM
 */
object ChatTimeUtils {

    private const val TAG = "CHAT_TIME"

    private val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.getDefault())
    private val dateTimeFormatter = DateTimeFormatter.ofPattern("MMM dd, h:mm a", Locale.getDefault())
    private val dateTimeYearFormatter = DateTimeFormatter.ofPattern("MMM dd, yyyy, h:mm a", Locale.getDefault())

    /**
     * Parses a UTC ISO 8601 timestamp string and converts it to the device's local timezone.
     *
     * Accepts formats:
     * - "2026-06-16T12:00:00.000Z"
     * - "2026-06-16T12:00:00Z"
     * - "2026-06-16T12:00:00+00:00"
     * - "2026-06-16T12:00:00"
     *
     * @param isoDate UTC timestamp string from backend
     * @return ZonedDateTime in device local timezone, or null if parsing fails
     */
    fun parseUtcToLocal(isoDate: String): ZonedDateTime? {
        return try {
            // Handle various ISO formats
            val instant = when {
                isoDate.endsWith("Z") || isoDate.endsWith("+00:00") -> {
                    // Standard ISO with timezone indicator
                    Instant.parse(isoDate)
                }
                isoDate.contains("+") || isoDate.contains("Z") -> {
                    Instant.parse(isoDate)
                }
                else -> {
                    // No timezone info - assume UTC and append Z
                    if (isoDate.contains("T")) {
                        Instant.parse(isoDate + "Z")
                    } else {
                        Instant.parse(isoDate.take(19) + "Z")
                    }
                }
            }

            val localDateTime = instant.atZone(ZoneId.of("UTC"))
                .withZoneSameInstant(ZoneId.systemDefault())

            AppLogger.d(TAG, "Raw UTC: $isoDate")
            AppLogger.d(TAG, "Converted local: $localDateTime")
            AppLogger.d(TAG, "Device timezone: ${ZoneId.systemDefault()}")

            localDateTime
        } catch (e: Exception) {
            AppLogger.e(TAG, "Failed to parse timestamp: $isoDate", e)
            AppLogger.d(TAG, "Raw UTC (failed): $isoDate")
            AppLogger.d(TAG, "Device timezone: ${ZoneId.systemDefault()}")
            null
        }
    }

    /**
     * Formats a UTC ISO timestamp string for display in the chat bubble.
     *
     * If parsing fails, returns the first 16 characters of the raw string as fallback.
     *
     * @param isoDate UTC timestamp string from backend
     * @return Formatted time string according to the rules:
     *         - Today:      01:07 PM
     *         - Yesterday:  Yesterday, 01:07 PM
     *         - This year:  Jun 16, 01:07 PM
     *         - Other:      Jun 16, 2024, 01:07 PM
     */
    fun formatMessageTime(isoDate: String): String {
        val localZoned = parseUtcToLocal(isoDate) ?: return isoDate.take(16)

        val now = ZonedDateTime.now(ZoneId.systemDefault())
        val localDate = localZoned.toLocalDate()
        val today = now.toLocalDate()
        val yesterday = today.minus(1, ChronoUnit.DAYS)

        return when {
            localDate.equals(today) -> {
                // Today: 01:07 PM
                localZoned.format(timeFormatter)
            }
            localDate.equals(yesterday) -> {
                // Yesterday: Yesterday, 01:07 PM
                "Yesterday, ${localZoned.format(timeFormatter)}"
            }
            localZoned.year == now.year -> {
                // Same year: Jun 16, 01:07 PM
                localZoned.format(dateTimeFormatter)
            }
            else -> {
                // Different year: Jun 16, 2024, 01:07 PM
                localZoned.format(dateTimeYearFormatter)
            }
        }
    }
}