package com.ridesharing.app.utils

import com.ridesharing.app.data.local.dao.CachedMessageDao
import com.ridesharing.app.data.local.dao.CachedRideDao
import com.ridesharing.app.data.local.dao.CachedRequestDao
import com.ridesharing.app.data.local.entity.CachedRide
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Orchestrates automatic cleanup of expired rides, chats, and requests.
 *
 * Runs cleanup on:
 * - App Launch
 * - Home Screen Open
 * - Requests Screen Open
 * - Chat Screen Open
 * - Every 30 minutes while app is active
 *
 * Uses RideExpiryManager for all time calculations (Asia/Kolkata timezone).
 * No backend modifications - all cleanup is local.
 */
@Singleton
class AutoCleanupManager @Inject constructor(
    private val rideExpiryManager: RideExpiryManager,
    private val cachedRideDao: CachedRideDao,
    private val cachedRequestDao: CachedRequestDao,
    private val cachedMessageDao: CachedMessageDao
) {
    private val tag = "AUTO_CLEANUP"
    private var cleanupJob: Job? = null

    companion object {
        // 30 minutes in milliseconds
        private const val CLEANUP_INTERVAL_MS = 30 * 60 * 1000L
    }

    /**
     * Starts the periodic cleanup background job (every 30 minutes).
     * Should be called when the app is launched.
     */
    fun startPeriodicCleanup(scope: CoroutineScope) {
        cleanupJob?.cancel()
        cleanupJob = scope.launch {
            AppLogger.d(tag, "Periodic cleanup started (interval: 30 minutes)")
            while (isActive) {
                runCleanup()
                delay(CLEANUP_INTERVAL_MS)
            }
        }
    }

    /**
     * Stops the periodic cleanup job.
     */
    fun stopPeriodicCleanup() {
        cleanupJob?.cancel()
        cleanupJob = null
        AppLogger.d(tag, "Periodic cleanup stopped")
    }

    private var lastCleanupTime: Long = 0

    /**
     * Runs the complete cleanup process immediately.
     * This is called on screen opens and app launch.
     *
     * Optimized with throttling to avoid excessive DB operations.
     */
    suspend fun runCleanup() {
        val now = System.currentTimeMillis()
        if (now - lastCleanupTime < 60_000) return 
        lastCleanupTime = now

        try {
            val allRides = cachedRideDao.getAllRidesOnce()
            if (allRides.isEmpty()) return

            for (ride in allRides) {
                processRideCleanup(ride)
            }
        } catch (e: Exception) {
            // Silently fail to avoid UI disruption
        }
    }

    /**
     * Processes cleanup for a single cached ride.
     *
     * 1. If ride is expired (current time > ride time): mark as expired, hide from UI
     * 2. If chat expiry time has passed (ride time + 3 days): delete conversation & requests
     */
    private suspend fun processRideCleanup(ride: CachedRide): CleanupResult {
        var isExpired = false
        var conversationDeleted = false
        var requestDeleted = false

        val rideDate = ride.date
        val rideTime = ride.time

        // RULE 1: Check if ride is expired
        if (rideExpiryManager.isRideExpired(rideDate, rideTime)) {
            isExpired = true

            // Mark as expired locally if not already marked
            if (!rideExpiryManager.isRideExpiredLocally(ride.id)) {
                rideExpiryManager.markRideExpired(ride.id)
                AppLogger.d(tag, "Ride ${ride.id} (${ride.from} -> ${ride.to}) marked as expired")
            }

            // RULE 2: Check if conversation should be deleted (ride time + 3 days)
            if (rideExpiryManager.shouldDeleteConversation(rideDate, rideTime)) {
                // Delete all cached messages linked to this ride
                // Find request IDs associated with this ride
                val linkedRequests = cachedRequestDao.getRequestsByRideIdOnce(ride.id)
                for (req in linkedRequests) {
                    if (!rideExpiryManager.isConversationDeleted(req.id)) {
                        // Mark conversation as deleted
                        rideExpiryManager.markConversationDeleted(req.id)
                        // Delete messages for this conversation
                        cachedMessageDao.deleteMessagesForChat(req.id)
                        conversationDeleted = true
                        AppLogger.d(tag, "Conversation ${req.id} (ride ${ride.id}) auto-deleted")
                    }
                }
            }

            // RULE 3: Check if requests should be deleted (ride time + 3 days)
            if (rideExpiryManager.shouldDeleteRequest(rideDate, rideTime)) {
                val linkedRequests = cachedRequestDao.getRequestsByRideIdOnce(ride.id)
                for (req in linkedRequests) {
                    if (!rideExpiryManager.isRequestDeleted(req.id)) {
                        rideExpiryManager.markRequestDeleted(req.id)
                        // Remove from cached requests
                        cachedRequestDao.deleteRequest(req.id)
                        requestDeleted = true
                        AppLogger.d(tag, "Request ${req.id} (ride ${ride.id}) auto-deleted")
                    }
                }
            }
        }

        return CleanupResult(isExpired, conversationDeleted, requestDeleted)
    }

    /**
     * Runs cleanup and returns lists of expired and deleted item IDs for UI filtering.
     */
    suspend fun cleanupAndGetFilteredIds(): CleanupFilterData {
        runCleanup()
        return CleanupFilterData(
            expiredRideIds = rideExpiryManager.getExpiredRideIds(),
            deletedConversationIds = rideExpiryManager.getDeletedConversationIds(),
            deletedRequestIds = rideExpiryManager.getDeletedRequestIds()
        )
    }

    data class CleanupResult(
        val isExpired: Boolean,
        val conversationDeleted: Boolean,
        val requestDeleted: Boolean
    )

    data class CleanupFilterData(
        val expiredRideIds: Set<String>,
        val deletedConversationIds: Set<String>,
        val deletedRequestIds: Set<String>
    )
}