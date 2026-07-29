package com.ridesharing.app.ui.requests

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ridesharing.app.data.models.RideRequest
import com.ridesharing.app.ui.components.EmptyState
import com.ridesharing.app.ui.components.StatusChip
import com.ridesharing.app.ui.components.UserAvatar
import com.ridesharing.app.ui.viewmodel.RequestViewModel
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.RideTimeUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestsScreen(
    requestViewModel: RequestViewModel,
    onNavigateToChat: (String) -> Unit
) {
    val uiState by requestViewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        AppLogger.d("REQUESTS", "RequestsScreen opened - triggering cleanup and loading requests")
        requestViewModel.triggerCleanup()
        requestViewModel.loadRequests()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Requests", fontWeight = FontWeight.SemiBold) }
        )

        TabRow(selectedTabIndex = selectedTab) {
            Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Incoming") })
            Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Outgoing") })
        }

        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            // Optimized: Use remember to filter requests only when state or tab changes
            val filteredRequests = remember(uiState.requests, selectedTab) {
                if (selectedTab == 0) {
                    uiState.requests.filter { it.ride?.isOwner == true }
                } else {
                    uiState.requests.filter { it.ride?.isOwner == false }
                }
            }

            if (filteredRequests.isEmpty()) {
                EmptyState(
                    icon = { Icon(Icons.Default.Inbox, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant) },
                    title = if (selectedTab == 0) "No incoming requests" else "No outgoing requests",
                    subtitle = "Requests will appear here"
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredRequests, key = { it.id }) { request ->
                        RequestCard(
                            request = request,
                            isIncoming = selectedTab == 0,
                            onAccept = { requestViewModel.updateRequest(request.id, "ACCEPTED") },
                            onReject = { requestViewModel.updateRequest(request.id, "REJECTED") },
                            onChat = { onNavigateToChat(request.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun RequestCard(
    request: RideRequest,
    isIncoming: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onChat: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                UserAvatar(
                    name = if (isIncoming) request.requester?.name ?: "U" else request.rideCreator?.name ?: "U",
                    profilePicUrl = if (isIncoming) request.requester?.profilePic else request.rideCreator?.profilePic
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (isIncoming) request.requester?.name ?: "Unknown" else request.rideCreator?.name ?: "Unknown",
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "${request.ride?.from ?: ""} → ${request.ride?.to ?: ""}",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    val formattedTime = remember(request.ride?.date, request.ride?.time) {
                        if (request.ride != null) RideTimeUtils.formatRideTime(request.ride.date, request.ride.time)
                        else ""
                    }
                    Text(
                        text = formattedTime,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                StatusChip(status = request.status)
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (isIncoming && request.status == "PENDING") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onReject,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Reject")
                    }
                    Button(
                        onClick = onAccept,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Accept")
                    }
                }
            }

            if (request.status == "ACCEPTED") {
                Button(
                    onClick = onChat,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Chat, null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Chat")
                }
            }
        }
    }
}