package com.ridesharing.app.ui.chat

import android.util.Log
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ridesharing.app.data.models.RideRequest
import com.ridesharing.app.ui.components.EmptyState
import com.ridesharing.app.ui.components.StatusChip
import com.ridesharing.app.ui.components.UserAvatar
import com.ridesharing.app.ui.viewmodel.RequestViewModel
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.RideTimeUtils
import kotlinx.coroutines.launch

private const val TAG = "CHAT_IMAGE"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    requestViewModel: RequestViewModel,
    onNavigateToChat: (String) -> Unit
) {
    val uiState by requestViewModel.uiState.collectAsStateWithLifecycle()
    var showDeleteAllDialog by remember { mutableStateOf(false) }
    var deleteChatId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    // Trigger cleanup and load only accepted chats
    LaunchedEffect(Unit) {
        requestViewModel.triggerCleanup()
        requestViewModel.loadAcceptedChats()
    }

    // Filter to show only accepted chats (status == "ACCEPTED")
    val acceptedChats = remember(uiState.requests) {
        uiState.requests.filter { it.status == "ACCEPTED" }
    }

    // Confirmation dialog for Delete All Chats
    if (showDeleteAllDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteAllDialog = false },
            icon = {
                Icon(
                    Icons.Default.DeleteForever,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(32.dp)
                )
            },
            title = {
                Text(
                    "Delete All Chats?",
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Text(
                    "This action will remove all chat conversations from your device. This cannot be undone.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteAllDialog = false
                        requestViewModel.deleteAllChatsLocally()
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                message = "All chats cleared",
                                withDismissAction = true
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(Icons.Default.Delete, "Delete", modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Delete")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showDeleteAllDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Confirmation dialog for Delete Single Chat
    if (deleteChatId != null) {
        AlertDialog(
            onDismissRequest = { deleteChatId = null },
            icon = {
                Icon(
                    Icons.Default.DeleteForever,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(32.dp)
                )
            },
            title = {
                Text(
                    "Delete Chat?",
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Text(
                    "This will remove this conversation and all its messages from your device. This cannot be undone.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val id = deleteChatId
                        deleteChatId = null
                        if (id != null) {
                            requestViewModel.deleteChatLocally(id)
                            scope.launch {
                                snackbarHostState.showSnackbar(
                                    message = "Conversation deleted",
                                    withDismissAction = true
                                )
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(Icons.Default.Delete, "Delete", modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Delete")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { deleteChatId = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text("Chats", fontWeight = FontWeight.SemiBold)
                },
                actions = {
                    if (acceptedChats.isNotEmpty()) {
                        IconButton(onClick = { showDeleteAllDialog = true }) {
                            Icon(
                                Icons.Default.DeleteSweep,
                                "Delete All Chats",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {

            if (uiState.isLoading && acceptedChats.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (acceptedChats.isEmpty()) {
                // Empty state
                Box(modifier = Modifier.fillMaxSize()) {
                    EmptyState(
                        icon = {
                            Icon(
                                Icons.AutoMirrored.Filled.Chat,
                                null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        title = "No Conversations Yet",
                        subtitle = "Accepted ride requests will appear here as chats"
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(acceptedChats, key = { it.id }) { request ->
                        ChatListItem(
                            request = request,
                            onClick = { onNavigateToChat(request.id) },
                            onDelete = { deleteChatId = request.id }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatListItem(
    request: RideRequest,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val otherPerson = if (request.ride?.isOwner == true) {
        request.requester
    } else {
        request.rideCreator
    }

    val profilePicUrl = otherPerson?.profilePic
    val otherName = otherPerson?.name ?: "Unknown User"

    // Log profile image for chat list
    AppLogger.d(TAG, "ChatListItem - User: $otherName, ProfileImage URL: ${profilePicUrl ?: "null (no profile pic)"}")

    var showMenu by remember { mutableStateOf(false) }

    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            UserAvatar(
                name = otherPerson?.name ?: "U",
                profilePicUrl = profilePicUrl,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = otherName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Text(
                        text = request.ride?.let { RideTimeUtils.getTimeLabel(it.date, it.time) } ?: "",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${request.ride?.from ?: ""} \u2192 ${request.ride?.to ?: ""}",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Schedule,
                        null,
                        modifier = Modifier.size(12.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = request.ride?.let { RideTimeUtils.formatRideTime(it.date, it.time) } ?: "",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            // 3-dot menu for delete
            Box {
                IconButton(onClick = { showMenu = true }) {
                    Icon(
                        Icons.Default.MoreVert,
                        "More options",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                DropdownMenu(
                    expanded = showMenu,
                    onDismissRequest = { showMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Delete Chat", color = MaterialTheme.colorScheme.error) },
                        onClick = {
                            showMenu = false
                            onDelete()
                        },
                        leadingIcon = {
                            Icon(
                                Icons.Default.DeleteForever,
                                "Delete",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    )
                }
            }
        }
    }
}