package com.ridesharing.app.ui.chat

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.SubcomposeAsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.size.Size
import com.ridesharing.app.data.models.Message
import com.ridesharing.app.ui.components.StatusChip
import com.ridesharing.app.ui.viewmodel.ChatViewModel
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.ChatTimeUtils
import com.ridesharing.app.utils.Resource
import com.ridesharing.app.utils.RideTimeUtils
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// ─── Colors ──────────────────────────────────────────────────────────────────────
private val OutgoingGradientStart = Color(0xFF2563EB)
private val OutgoingGradientEnd = Color(0xFF3B82F6)
private val ChatBgLightStart = Color(0xFFF8FAFC)
private val ChatBgLightEnd = Color(0xFFEEF2FF)
private val ChatBgDarkStart = Color(0xFF0F172A)
private val ChatBgDarkEnd = Color(0xFF1E293B)
private val IncomingBubbleLight = Color.White
private val IncomingBubbleDark = Color(0xFF1E293B)
private val HeaderBgLight = Color(0xFFF8FAFC)
private val HeaderBgDark = Color(0xFF1E293B)
private val DateSeparatorText = Color(0xFF94A3B8)
private val OnlineGreen = Color(0xFF22C55E)
private val GlassBorderLight = Color(0x33FFFFFF)
private val GlassBorderDark = Color(0x331E293B)
private val ShadowColor = Color(0x1A000000)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatDetailScreen(
    requestId: String,
    chatViewModel: ChatViewModel,
    onBack: () -> Unit
) {
    val uiState by chatViewModel.uiState.collectAsStateWithLifecycle()
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    var showPhoneDialog by remember { mutableStateOf(false) }
    var phoneNumbers by remember { mutableStateOf<Pair<String?, String?>?>(null) }
    var phoneNames by remember { mutableStateOf<Pair<String?, String?>?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val clipboardManager = LocalClipboardManager.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Detect dark mode
    val isDark = isSystemInDarkTheme() || MaterialTheme.colorScheme.background == Color(0xFF111318)

    // Delete confirmation dialogs
    var showDeleteMessagesDialog by remember { mutableStateOf(false) }
    var showDeleteConversationDialog by remember { mutableStateOf(false) }

    // Snackbar
    val snackbarHostState = remember { SnackbarHostState() }

    // Collect snackbar events
    LaunchedEffect(Unit) {
        chatViewModel.snackbarEvent.collect { event ->
            snackbarHostState.showSnackbar(
                message = event.message,
                withDismissAction = true
            )
        }
    }

    // Call permission launcher
    val callPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            val phone = phoneNumbers?.first ?: phoneNumbers?.second ?: ""
            if (phone.isNotBlank()) {
                val intent = Intent(Intent.ACTION_CALL).apply {
                    data = Uri.parse("tel:$phone")
                }
                try {
                    context.startActivity(intent)
                } catch (e: Exception) { }
            }
        }
    }

    // Connect to chat when screen becomes visible
    LaunchedEffect(requestId) {
        AppLogger.d("CHAT", "ChatDetailScreen opened for $requestId")
        chatViewModel.connectToChat(requestId)
    }

    // Lifecycle-aware auto-refresh (only when screen is visible)
    LaunchedEffect(Unit) {
        lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                delay(30_000L) // Check every 30 seconds
                chatViewModel.refreshIfDisconnected()
            }
        }
    }

    // Smart auto-scroll
    val messagesSize = uiState.messages.size
    val isNearBottom by remember {
        derivedStateOf {
            val layoutInfo = listState.layoutInfo
            if (layoutInfo.totalItemsCount == 0) true
            else {
                val lastVisibleItem = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                lastVisibleItem >= layoutInfo.totalItemsCount - 3
            }
        }
    }

    LaunchedEffect(messagesSize) {
        if (messagesSize > 0 && isNearBottom) {
            listState.animateScrollToItem(messagesSize - 1)
        }
    }

    // Show scroll-to-bottom button when not near bottom
    val showScrollToBottom by remember {
        derivedStateOf {
            val layoutInfo = listState.layoutInfo
            if (layoutInfo.totalItemsCount == 0) false
            else {
                val lastVisibleItem = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                lastVisibleItem < layoutInfo.totalItemsCount - 4
            }
        }
    }

    val currentPhoneNumbers = phoneNumbers
    val currentPhoneNames = phoneNames
    if (showPhoneDialog && currentPhoneNumbers != null) {
        AlertDialog(
            onDismissRequest = { showPhoneDialog = false },
            title = {
                Text(
                    "Contact Information",
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (currentPhoneNumbers.first != null) {
                        ContactInfoCard(
                            name = currentPhoneNames?.first ?: "Ride Owner",
                            phone = currentPhoneNumbers.first ?: "",
                            onCall = {
                                showPhoneDialog = false
                                val permission = Manifest.permission.CALL_PHONE
                                if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
                                    val intent = Intent(Intent.ACTION_CALL).apply {
                                        data = Uri.parse("tel:${currentPhoneNumbers.first}")
                                    }
                                    context.startActivity(intent)
                                } else {
                                    phoneNumbers = currentPhoneNumbers
                                    phoneNames = currentPhoneNames
                                    callPermissionLauncher.launch(permission)
                                }
                            },
                            onCopy = {
                                clipboardManager.setText(AnnotatedString(currentPhoneNumbers.first ?: ""))
                            },
                            onWhatsApp = {
                                val url = "https://wa.me/${currentPhoneNumbers.first?.replace("+", "")?.replace(" ", "")}"
                                try {
                                    val intent = Intent(Intent.ACTION_VIEW).apply {
                                        data = Uri.parse(url)
                                    }
                                    context.startActivity(intent)
                                } catch (e: Exception) { }
                            },
                            onSms = {
                                val intent = Intent(Intent.ACTION_SENDTO).apply {
                                    data = Uri.parse("smsto:${currentPhoneNumbers.first}")
                                }
                                context.startActivity(intent)
                            }
                        )
                    }
                    if (currentPhoneNumbers.second != null) {
                        ContactInfoCard(
                            name = currentPhoneNames?.second ?: "Requester",
                            phone = currentPhoneNumbers.second ?: "",
                            onCall = {
                                showPhoneDialog = false
                                val permission = Manifest.permission.CALL_PHONE
                                if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
                                    val intent = Intent(Intent.ACTION_CALL).apply {
                                        data = Uri.parse("tel:${currentPhoneNumbers.second}")
                                    }
                                    context.startActivity(intent)
                                } else {
                                    phoneNumbers = currentPhoneNumbers
                                    phoneNames = currentPhoneNames
                                    callPermissionLauncher.launch(permission)
                                }
                            },
                            onCopy = {
                                clipboardManager.setText(AnnotatedString(currentPhoneNumbers.second ?: ""))
                            },
                            onWhatsApp = {
                                val url = "https://wa.me/${currentPhoneNumbers.second?.replace("+", "")?.replace(" ", "")}"
                                try {
                                    val intent = Intent(Intent.ACTION_VIEW).apply {
                                        data = Uri.parse(url)
                                    }
                                    context.startActivity(intent)
                                } catch (e: Exception) { }
                            },
                            onSms = {
                                val intent = Intent(Intent.ACTION_SENDTO).apply {
                                    data = Uri.parse("smsto:${currentPhoneNumbers.second}")
                                }
                                context.startActivity(intent)
                            }
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showPhoneDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    // ── Delete Selected Messages Dialog ──
    if (showDeleteMessagesDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteMessagesDialog = false },
            icon = {
                Icon(
                    Icons.Default.DeleteSweep,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(32.dp)
                )
            },
            title = {
                Text(
                    "Delete selected messages?",
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Text(
                    "This will remove ${uiState.selectedMessageIds.size} selected message(s) from your device. This cannot be undone.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteMessagesDialog = false
                        chatViewModel.deleteSelectedMessages()
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
                OutlinedButton(onClick = { showDeleteMessagesDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Delete Entire Conversation Dialog ──
    if (showDeleteConversationDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteConversationDialog = false },
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
                    "Delete entire conversation?",
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Text(
                    "This will remove the entire conversation and all its messages from your device. This cannot be undone.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteConversationDialog = false
                        chatViewModel.deleteConversation()
                        onBack()
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
                OutlinedButton(onClick = { showDeleteConversationDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ─── Main Layout ──────────────────────────────────────────────────────────────
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    if (isDark) listOf(ChatBgDarkStart, ChatBgDarkEnd)
                    else listOf(ChatBgLightStart, ChatBgLightEnd)
                )
            )
    ) {
        // Subtle pattern overlay
        ChatBackgroundPattern(isDark = isDark)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .statusBarsPadding()
        ) {
            // ─── Premium Compact Header ───────────────────────────────────────────
            if (uiState.isMultiSelectMode) {
                // Multi-select top bar
                MultiSelectTopBar(
                    selectedCount = uiState.selectedMessageIds.size,
                    onClose = { chatViewModel.clearMessageSelection() },
                    onSelectAll = { chatViewModel.selectAllMessages() },
                    onDelete = {
                        if (uiState.selectedMessageIds.isNotEmpty()) {
                            showDeleteMessagesDialog = true
                        }
                    }
                )
            } else {
                ChatPremiumHeader(
                    chatInfo = uiState.chatInfo,
                    currentUserId = uiState.currentUserId,
                    onBack = onBack,
                    onCall = {
                        scope.launch {
                            when (val result = chatViewModel.sharePhone(requestId)) {
                                is Resource.Success -> {
                                    val data = result.data
                                    if (data.bothConfirmed && data.phones != null) {
                                        phoneNumbers = Pair(data.phones.creatorPhone, data.phones.requesterPhone)
                                        phoneNames = Pair(data.phones.creatorName, data.phones.requesterName)
                                        showPhoneDialog = true
                                    }
                                }
                                is Resource.Error -> { }
                                is Resource.Loading -> {}
                            }
                        }
                    },
                    onMenuClick = { showMenu -> },
                    isDark = isDark
                )

                // Ride info mini card
                uiState.chatInfo?.let { info ->
                    if (info.ride != null) {
                        RideInfoMiniBar(
                            rideFrom = info.ride.from,
                            rideTo = info.ride.to,
                            rideDate = info.ride.date,
                            rideTime = info.ride.time,
                            vehicleType = info.ride.vehicleType,
                            status = info.status ?: "PENDING",
                            isDark = isDark
                        )
                    }
                }
            }

            // ─── Messages Area ────────────────────────────────────────────────────
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (uiState.isLoading && uiState.messages.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(
                            color = OutgoingGradientStart
                        )
                    }
                } else if (uiState.messages.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.Chat,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = DateSeparatorText.copy(alpha = 0.4f)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                "No messages yet",
                                color = DateSeparatorText,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                "Start a conversation",
                                color = DateSeparatorText.copy(alpha = 0.6f),
                                fontSize = 13.sp
                            )
                        }
                    }
                } else {
                    // Group messages for date separators and consecutive grouping
                    val groupedMessages = remember(uiState.messages) {
                        groupMessagesWithDates(uiState.messages)
                    }

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 12.dp),
                        state = listState,
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                        contentPadding = PaddingValues(top = 8.dp, bottom = 8.dp)
                    ) {
                        items(groupedMessages) { item ->
                            when (item) {
                                is ChatListItem.DateSeparator -> {
                                    DateSeparatorItem(dateLabel = item.label)
                                }
                                is ChatListItem.MessageItem -> {
                                    val msg = item.message
                                    val isMe = msg.senderId == uiState.currentUserId
                                    val isSelected = uiState.selectedMessageIds.contains(msg.id)
                                    val showSenderInfo = item.showSenderInfo
                                    val senderProfilePic = msg.sender?.profilePic
                                    val currentUserProfilePic = uiState.currentUserProfilePic

                                    ModernMessageBubble(
                                        message = msg,
                                        isMe = isMe,
                                        isSelected = isSelected,
                                        isMultiSelectMode = uiState.isMultiSelectMode,
                                        showSenderInfo = showSenderInfo,
                                        senderName = msg.sender?.name ?: "Unknown",
                                        senderProfilePic = senderProfilePic,
                                        currentUserProfilePic = if (isMe) currentUserProfilePic else null,
                                        onClick = {
                                            if (uiState.isMultiSelectMode) {
                                                chatViewModel.toggleMessageSelection(msg.id)
                                            }
                                        },
                                        onLongClick = {
                                            if (!uiState.isMultiSelectMode) {
                                                chatViewModel.toggleMessageSelection(msg.id)
                                            }
                                        },
                                        isDark = isDark
                                    )
                                }
                            }
                        }

                        // Typing indicator placeholder
                        item {
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }

                // Loading indicator at top when refreshing
                if (uiState.isLoading && uiState.messages.isNotEmpty()) {
                    LinearProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter),
                        color = OutgoingGradientStart,
                        trackColor = Color.Transparent
                    )
                }
            }

            // ─── Floating Input Area ──────────────────────────────────────────────
            if (!uiState.isMultiSelectMode) {
                ModernChatInput(
                    text = inputText,
                    onTextChange = { inputText = it },
                    onSend = {
                        if (inputText.isNotBlank()) {
                            chatViewModel.sendMessage(inputText.trim())
                            inputText = ""
                            scope.launch {
                                listState.animateScrollToItem(uiState.messages.size)
                            }
                        }
                    },
                    isSending = uiState.isSending,
                    isDark = isDark
                )
            }
        }
    }
}

// ─── Chat Background Pattern ──────────────────────────────────────────────────────
@Composable
private fun ChatBackgroundPattern(isDark: Boolean) {
    Canvas(modifier = Modifier.fillMaxSize().alpha(0.03f)) {
        val patternColor = if (isDark) Color.White else Color(0xFF2563EB)
        val spacing = 120f
        var x = 0f
        while (x < size.width) {
            var y = 0f
            while (y < size.height) {
                drawCircle(
                    color = patternColor,
                    radius = 2f,
                    center = androidx.compose.ui.geometry.Offset(x, y)
                )
                y += spacing
            }
            x += spacing
        }
    }
}

// ─── Premium Chat Header ──────────────────────────────────────────────────────────
@Composable
private fun ChatPremiumHeader(
    chatInfo: com.ridesharing.app.data.models.ChatInfo?,
    currentUserId: String?,
    onBack: () -> Unit,
    onCall: () -> Unit,
    onMenuClick: (Boolean) -> Unit,
    isDark: Boolean
) {
    // Derive the other participant's info
    val otherParticipant = remember(chatInfo, currentUserId) {
        chatInfo?.participants?.find { it.id != currentUserId }
    }

    val displayName = otherParticipant?.name ?: "Chat"
    val profilePicUrl = otherParticipant?.profilePic
    val rideInfo = chatInfo?.ride

    var showMenu by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = if (isDark) HeaderBgDark.copy(alpha = 0.85f) else HeaderBgLight.copy(alpha = 0.85f),
        shadowElevation = 0.dp,
        tonalElevation = 0.dp
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = if (isDark) {
                            listOf(HeaderBgDark.copy(alpha = 0.5f), HeaderBgDark)
                        } else {
                            listOf(HeaderBgLight.copy(alpha = 0.5f), HeaderBgLight)
                        }
                    )
                )
        ) {
            // Glassmorphism overlay
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .background(
                        color = if (isDark) GlassBorderDark else GlassBorderLight,
                        shape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp)
                    )
                    .drawBehind {
                        // Subtle border
                        drawRoundRect(
                            color = if (isDark) Color.White.copy(alpha = 0.05f) else Color.Black.copy(alpha = 0.05f),
                            cornerRadius = androidx.compose.ui.geometry.CornerRadius(16.dp.toPx()),
                            style = Stroke(width = 0.5.dp.toPx())
                        )
                    }
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Back button
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }

                // Profile avatar
                Box(modifier = Modifier.size(48.dp)) {
                    PremiumUserAvatar(
                        name = displayName,
                        profilePicUrl = profilePicUrl,
                        modifier = Modifier.size(48.dp)
                    )
                    // Online indicator
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .align(Alignment.BottomEnd)
                            .offset(x = (-2).dp, y = (-2).dp)
                            .background(OnlineGreen, CircleShape)
                            .border(
                                width = 2.dp,
                                color = if (isDark) HeaderBgDark else HeaderBgLight,
                                shape = CircleShape
                            )
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Name and status
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = displayName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "Online",
                        fontSize = 12.sp,
                        color = OnlineGreen,
                        fontWeight = FontWeight.Medium
                    )
                }

                // Ride route subtitle
                if (rideInfo != null) {
                    Column(
                        modifier = Modifier.padding(end = 8.dp),
                        horizontalAlignment = Alignment.End
                    ) {
                        Text(
                            text = "${rideInfo.from} → ${rideInfo.to}",
                            fontSize = 10.sp,
                            color = DateSeparatorText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Call button
                IconButton(
                    onClick = onCall,
                    modifier = Modifier.size(44.dp)
                ) {
                    Icon(
                        Icons.Default.Phone,
                        contentDescription = "Call",
                        tint = OnlineGreen,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // More menu
                Box {
                    IconButton(
                        onClick = { showMenu = true },
                        modifier = Modifier.size(44.dp)
                    ) {
                        Icon(
                            Icons.Default.MoreVert,
                            contentDescription = "More options",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Search", fontSize = 14.sp) },
                            onClick = {
                                showMenu = false
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Search, "Search", modifier = Modifier.size(20.dp))
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Delete Chat", color = MaterialTheme.colorScheme.error, fontSize = 14.sp) },
                            onClick = {
                                showMenu = false
                                onMenuClick(true)
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.DeleteForever,
                                    "Delete",
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

// ─── Multi-Select Top Bar ─────────────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MultiSelectTopBar(
    selectedCount: Int,
    onClose: () -> Unit,
    onSelectAll: () -> Unit,
    onDelete: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 4.dp,
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, "Cancel selection")
            }
            Text(
                "$selectedCount selected",
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onSelectAll) {
                Icon(Icons.Default.SelectAll, "Select all")
            }
            IconButton(
                onClick = onDelete,
                enabled = selectedCount > 0
            ) {
                Icon(
                    Icons.Default.Delete,
                    "Delete selected",
                    tint = if (selectedCount > 0) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// ─── Ride Info Mini Bar ────────────────────────────────────────────────────────────
@Composable
private fun RideInfoMiniBar(
    rideFrom: String,
    rideTo: String,
    rideDate: String,
    rideTime: String,
    vehicleType: String,
    status: String,
    isDark: Boolean
) {
    val formattedTime = remember(rideDate, rideTime) {
        RideTimeUtils.formatRideTime(rideDate, rideTime)
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = if (isDark) IncomingBubbleDark.copy(alpha = 0.8f) else IncomingBubbleLight.copy(alpha = 0.8f),
        tonalElevation = 0.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.DirectionsCar,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = OutgoingGradientStart.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "$rideFrom → $rideTo",
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "$formattedTime • $vehicleType",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }
            StatusChip(status = status)
        }
    }
}

// ─── Date Separator ────────────────────────────────────────────────────────────────
@Composable
private fun DateSeparatorItem(dateLabel: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(0.5.dp)
                .background(DateSeparatorText.copy(alpha = 0.2f))
        )
        Text(
            text = dateLabel,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = DateSeparatorText,
            modifier = Modifier.padding(horizontal = 16.dp)
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .height(0.5.dp)
                .background(DateSeparatorText.copy(alpha = 0.2f))
        )
    }
}

// ─── Modern Message Bubble ─────────────────────────────────────────────────────────
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ModernMessageBubble(
    message: Message,
    isMe: Boolean,
    isSelected: Boolean,
    isMultiSelectMode: Boolean,
    showSenderInfo: Boolean,
    senderName: String,
    senderProfilePic: String?,
    currentUserProfilePic: String?,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    isDark: Boolean
) {
    val animatedScale by animateFloatAsState(
        targetValue = if (true) 1f else 0.95f,
        animationSpec = tween(250),
        label = "bubbleScale"
    )
    val animatedAlpha by animateFloatAsState(
        targetValue = if (true) 1f else 0f,
        animationSpec = tween(250),
        label = "bubbleAlpha"
    )

    val backgroundColor by animateColorAsState(
        targetValue = if (isSelected) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
        } else {
            Color.Transparent
        },
        label = "bg"
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(animatedAlpha)
            .scale(animatedScale)
            .background(backgroundColor, shape = RoundedCornerShape(8.dp))
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            )
            .padding(
                start = if (isMe) 64.dp else 0.dp,
                end = if (isMe) 0.dp else 64.dp,
                top = 2.dp,
                bottom = 2.dp
            ),
        contentAlignment = if (isMe) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Row(
            verticalAlignment = Alignment.Bottom,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Avatar column (incoming only, first message in group)
            if (!isMe && showSenderInfo) {
                Column(
                    modifier = Modifier.width(36.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Spacer(modifier = Modifier.height(20.dp))
                    PremiumUserAvatar(
                        name = senderName,
                        profilePicUrl = senderProfilePic,
                        modifier = Modifier.size(28.dp)
                    )
                }
            } else if (!isMe) {
                Spacer(modifier = Modifier.width(36.dp))
            }

            // Message content column
            Column(
                modifier = Modifier.weight(1f, fill = false),
                horizontalAlignment = if (isMe) Alignment.End else Alignment.Start
            ) {
                // Sender name (only for incoming, first in group)
                if (!isMe && showSenderInfo) {
                    Text(
                        text = senderName,
                        fontWeight = FontWeight.Medium,
                        fontSize = 11.sp,
                        color = OutgoingGradientStart,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(start = 12.dp, bottom = 2.dp)
                    )
                }

                // Bubble + selection checkbox
                Row(
                    verticalAlignment = Alignment.Bottom
                ) {
                    // Selection checkbox (multi-select mode)
                    if (isMultiSelectMode && !isMe) {
                        Checkbox(
                            checked = isSelected,
                            onCheckedChange = { onClick() },
                            modifier = Modifier.size(40.dp).padding(end = 4.dp)
                        )
                    }

                    // The bubble
                    Box(
                        modifier = Modifier.widthIn(max = 280.dp)
                    ) {
                        if (isMe) {
                            // Outgoing: Blue gradient bubble
                            Surface(
                                shape = RoundedCornerShape(
                                    topStart = 22.dp,
                                    topEnd = 22.dp,
                                    bottomStart = 22.dp,
                                    bottomEnd = 4.dp
                                ),
                                shadowElevation = 2.dp
                            ) {
                                Box(
                                    modifier = Modifier
                                        .background(
                                            brush = Brush.horizontalGradient(
                                                listOf(OutgoingGradientStart, OutgoingGradientEnd)
                                            ),
                                            shape = RoundedCornerShape(
                                                topStart = 22.dp,
                                                topEnd = 22.dp,
                                                bottomStart = 22.dp,
                                                bottomEnd = 4.dp
                                            )
                                        )
                                ) {
                                    Column {
                                        Text(
                                            text = message.text,
                                            color = Color.White,
                                            fontSize = 15.sp,
                                            lineHeight = 20.sp,
                                            modifier = Modifier.padding(
                                                start = 16.dp,
                                                end = 12.dp,
                                                top = 10.dp,
                                                bottom = 4.dp
                                            )
                                        )
                                        Row(
                                            modifier = Modifier
                                                .padding(start = 8.dp, end = 12.dp, bottom = 8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Spacer(modifier = Modifier.weight(1f))
                                            Text(
                                                text = formatBubbleTime(message.createdAt),
                                                fontSize = 10.sp,
                                                color = Color.White.copy(alpha = 0.7f)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            // Read receipt
                                            Icon(
                                                Icons.Default.DoneAll,
                                                contentDescription = "Read",
                                                modifier = Modifier.size(14.dp),
                                                tint = Color.White.copy(alpha = 0.7f)
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            // Incoming: White/Dark surface bubble
                            Surface(
                                shape = RoundedCornerShape(
                                    topStart = 4.dp,
                                    topEnd = 22.dp,
                                    bottomStart = 22.dp,
                                    bottomEnd = 22.dp
                                ),
                                color = if (isDark) IncomingBubbleDark else IncomingBubbleLight,
                                shadowElevation = 1.dp
                            ) {
                                Column {
                                    Text(
                                        text = message.text,
                                        color = if (isDark) Color.White else Color(0xFF1A1C1E),
                                        fontSize = 15.sp,
                                        lineHeight = 20.sp,
                                        modifier = Modifier.padding(
                                            start = 16.dp,
                                            end = 12.dp,
                                            top = 10.dp,
                                            bottom = 4.dp
                                        )
                                    )
                                    Row(
                                        modifier = Modifier
                                            .padding(start = 8.dp, end = 12.dp, bottom = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Spacer(modifier = Modifier.weight(1f))
                                        Text(
                                            text = formatBubbleTime(message.createdAt),
                                            fontSize = 10.sp,
                                            color = DateSeparatorText
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Selection checkbox (multi-select mode, outgoing)
                    if (isMultiSelectMode && isMe) {
                        Checkbox(
                            checked = isSelected,
                            onCheckedChange = { onClick() },
                            modifier = Modifier.size(40.dp).padding(start = 4.dp)
                        )
                    }

                    // Profile pic for outgoing (always)
                    if (isMe && currentUserProfilePic != null) {
                        Spacer(modifier = Modifier.width(6.dp))
                        PremiumUserAvatar(
                            name = senderName,
                            profilePicUrl = currentUserProfilePic,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }
    }
}

// ─── Premium User Avatar ───────────────────────────────────────────────────────────
@Composable
private fun PremiumUserAvatar(
    name: String,
    profilePicUrl: String? = null,
    modifier: Modifier = Modifier.size(40.dp)
) {
    val initial = name.firstOrNull()?.uppercase() ?: "?"
    val hasImage = !profilePicUrl.isNullOrBlank()
    val context = LocalContext.current

    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(
                brush = Brush.horizontalGradient(
                    colors = listOf(
                        OutgoingGradientStart.copy(alpha = 0.3f),
                        OutgoingGradientEnd.copy(alpha = 0.3f)
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        if (hasImage) {
            SubcomposeAsyncImage(
                model = ImageRequest.Builder(context)
                    .data(profilePicUrl)
                    .crossfade(300)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .size(Size.ORIGINAL)
                    .build(),
                contentDescription = "Profile photo",
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape),
                contentScale = ContentScale.Crop,
                loading = {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Transparent),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(
                                when {
                                    modifier == Modifier.size(48.dp) -> 20.dp
                                    modifier == Modifier.size(28.dp) -> 14.dp
                                    else -> 18.dp
                                }
                            ),
                            strokeWidth = 2.dp,
                            color = OutgoingGradientStart
                        )
                    }
                },
                error = {
                    Text(
                        text = initial,
                        fontWeight = FontWeight.Bold,
                        color = OutgoingGradientStart,
                        fontSize = if (modifier == Modifier.size(48.dp)) 20.sp
                        else if (modifier == Modifier.size(28.dp)) 12.sp
                        else 16.sp
                    )
                }
            )
        } else {
            Text(
                text = initial,
                fontWeight = FontWeight.Bold,
                color = OutgoingGradientStart,
                fontSize = if (modifier == Modifier.size(48.dp)) 20.sp
                else if (modifier == Modifier.size(28.dp)) 12.sp
                else 16.sp
            )
        }
    }
}

// ─── Modern Chat Input ─────────────────────────────────────────────────────────────
@Composable
private fun ModernChatInput(
    text: String,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    isSending: Boolean,
    isDark: Boolean
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .imePadding(),
        shadowElevation = 8.dp,
        tonalElevation = 0.dp,
        color = if (isDark) HeaderBgDark.copy(alpha = 0.95f) else HeaderBgLight.copy(alpha = 0.95f)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (isDark) HeaderBgDark else HeaderBgLight,
                    shape = RoundedCornerShape(topStart = 0.dp, topEnd = 0.dp)
                )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.Bottom
            ) {
                // Attach button
                IconButton(
                    onClick = { },
                    modifier = Modifier
                        .size(40.dp)
                        .padding(bottom = 4.dp)
                ) {
                    Icon(
                        Icons.Default.AttachFile,
                        contentDescription = "Attach",
                        tint = DateSeparatorText,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // Emoji button
                IconButton(
                    onClick = { },
                    modifier = Modifier
                        .size(40.dp)
                        .padding(bottom = 4.dp)
                ) {
                    Icon(
                        Icons.Default.EmojiEmotions,
                        contentDescription = "Emoji",
                        tint = DateSeparatorText,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // Text input field - rounded pill shape
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 44.dp, max = 120.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .background(
                            if (isDark) Color.White.copy(alpha = 0.08f)
                            else Color(0xFFF1F5F9)
                        )
                ) {
                    OutlinedTextField(
                        value = text,
                        onValueChange = { if (it.length <= 500) onTextChange(it) },
                        placeholder = {
                            Text(
                                "Type a message...",
                                color = DateSeparatorText,
                                fontSize = 14.sp
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 44.dp, max = 120.dp),
                        textStyle = LocalTextStyle.current.copy(
                            color = if (isDark) Color.White else Color(0xFF1A1C1E),
                            fontSize = 14.sp
                        ),
                        maxLines = 5,
                        shape = RoundedCornerShape(22.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent,
                            cursorColor = OutgoingGradientStart,
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent
                        ),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(
                            onSend = {
                                if (text.isNotBlank()) {
                                    onSend()
                                }
                            }
                        )
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                // Send button (blue gradient)
                if (text.isNotBlank()) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .padding(bottom = 4.dp)
                            .shadow(4.dp, CircleShape)
                            .background(
                                brush = Brush.horizontalGradient(
                                    listOf(OutgoingGradientStart, OutgoingGradientEnd)
                                ),
                                shape = CircleShape
                            )
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { onSend() },
                        contentAlignment = Alignment.Center
                    ) {
                        if (isSending) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Send",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                } else {
                    // Mic button
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .padding(bottom = 4.dp)
                            .background(
                                color = DateSeparatorText.copy(alpha = 0.15f),
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Mic,
                            contentDescription = "Voice",
                            tint = DateSeparatorText,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

// ─── Contact Info Card ─────────────────────────────────────────────────────────────
@Composable
private fun ContactInfoCard(
    name: String,
    phone: String,
    onCall: () -> Unit,
    onCopy: () -> Unit,
    onWhatsApp: () -> Unit,
    onSms: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PremiumUserAvatar(name = name, modifier = Modifier.size(40.dp))
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = name,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = phone,
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                IconButton(onClick = onCall, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Default.Phone, "Call", tint = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = onCopy, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Default.ContentCopy, "Copy", tint = MaterialTheme.colorScheme.secondary)
                }
                IconButton(onClick = onWhatsApp, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Default.Chat, "WhatsApp", tint = Color(0xFF25D366))
                }
                IconButton(onClick = onSms, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Default.Sms, "SMS", tint = MaterialTheme.colorScheme.tertiary)
                }
            }
        }
    }
}

// ─── Data Models for Grouped Messages ──────────────────────────────────────────────
private sealed class ChatListItem {
    data class DateSeparator(val key: String, val label: String) : ChatListItem()
    data class MessageItem(
        val key: String,
        val message: Message,
        val showSenderInfo: Boolean = false
    ) : ChatListItem()
}

private fun groupMessagesWithDates(messages: List<Message>): List<ChatListItem> {
    if (messages.isEmpty()) return emptyList()

    val result = mutableListOf<ChatListItem>()

    var lastDateStr: String? = null
    var lastSenderId: String? = null

    for ((index, message) in messages.withIndex()) {
        // Parse date from message
        val localDate = try {
            ChatTimeUtils.parseUtcToLocal(message.createdAt)?.toLocalDate()
        } catch (e: Exception) { null }

        val dateStr = localDate?.toString() ?: "unknown"

        // Add date separator if date changed
        if (dateStr != lastDateStr) {
            val label = when {
                localDate == null -> "Unknown"
                localDate == LocalDate.now(ZoneId.systemDefault()) -> "Today"
                localDate == LocalDate.now(ZoneId.systemDefault()).minusDays(1) -> "Yesterday"
                else -> localDate.format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
            }
            result.add(ChatListItem.DateSeparator(key = "date_$dateStr", label = label))
            lastDateStr = dateStr
            lastSenderId = null // Reset sender on date change
        }

        // Determine if we should show sender info
        val isSameSender = message.senderId == lastSenderId
        val showSender = !isSameSender || index == 0

        result.add(
            ChatListItem.MessageItem(
                key = "msg_${message.id}",
                message = message,
                showSenderInfo = showSender
            )
        )

        lastSenderId = message.senderId
    }

    return result
}

// ─── Format time for bubble display (short format) ─────────────────────────────────
private fun formatBubbleTime(isoDate: String): String {
    val localZoned = ChatTimeUtils.parseUtcToLocal(isoDate) ?: return isoDate.take(5)
    return localZoned.format(DateTimeFormatter.ofPattern("h:mm a", Locale.getDefault()))
}