package com.ridesharing.app.ui.rides

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ridesharing.app.ui.components.LoadingButton
import com.ridesharing.app.ui.components.StatusChip
import com.ridesharing.app.ui.components.UserAvatar
import com.ridesharing.app.ui.viewmodel.RideDetailViewModel
import com.ridesharing.app.ui.viewmodel.PhoneShareContactData
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.RideTimeUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RideDetailScreen(
    rideId: String,
    viewModel: RideDetailViewModel,
    onBack: () -> Unit,
    onChat: (String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val ride = uiState.ride
    
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showPhoneDialog by remember { mutableStateOf(uiState.phoneData != null) }
    
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    LaunchedEffect(rideId) {
        viewModel.loadRideDetails(rideId)
    }

    LaunchedEffect(uiState.phoneData) {
        if (uiState.phoneData != null) {
            showPhoneDialog = true
        }
    }

    val isExpired = remember(ride?.date, ride?.time) {
        ride?.let { RideTimeUtils.isRideExpired(it.date, it.time) } ?: false
    }

    val formattedDateTime = remember(ride?.date, ride?.time) {
        ride?.let { RideTimeUtils.formatRideDateTime(it.date, it.time) } ?: ""
    }

    val callPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted && uiState.phoneData != null) {
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:${uiState.phoneData!!.phone}")
            }
            context.startActivity(intent)
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Ride") },
            text = { Text("Are you sure you want to delete this ride?") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteDialog = false
                    viewModel.deleteRide(rideId, onBack)
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("Cancel") }
            }
        )
    }

    if (showPhoneDialog && uiState.phoneData != null) {
        PhoneContactDialog(
            data = uiState.phoneData!!,
            onDismiss = { showPhoneDialog = false },
            onCall = { phone ->
                val permission = Manifest.permission.CALL_PHONE
                if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
                    val intent = Intent(Intent.ACTION_CALL).apply { data = Uri.parse("tel:$phone") }
                    context.startActivity(intent)
                } else {
                    callPermissionLauncher.launch(permission)
                }
            },
            onCopy = { phone -> clipboardManager.setText(AnnotatedString(phone)) }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ride Details", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Back") }
                },
                actions = {
                    if (ride?.isOwner == true) {
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Default.Delete, "Delete Ride", tint = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            )
        }
    ) { padding ->
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (ride != null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                if (isExpired) {
                    ExpiredBanner()
                    Spacer(modifier = Modifier.height(16.dp))
                }

                RideRouteCard(ride, isExpired, formattedDateTime)
                Spacer(modifier = Modifier.height(16.dp))

                CreatorCard(ride)
                Spacer(modifier = Modifier.height(16.dp))

                ParticipantsCard(ride)
                
                if (uiState.error != null) {
                    ErrorMessage(uiState.error!!)
                }

                if (uiState.phoneShareMsg != null) {
                    InfoMessage(uiState.phoneShareMsg!!)
                }

                Spacer(modifier = Modifier.height(24.dp))

                ActionSection(
                    uiState = uiState,
                    isExpired = isExpired,
                    onSharePhone = { viewModel.sharePhone() },
                    onChat = { uiState.currentRequestId?.let { onChat(it) } },
                    onRequestJoin = { viewModel.requestJoinRide(rideId) }
                )
            }
        }
    }
}

@Composable
fun ExpiredBanner() {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Warning, null, tint = MaterialTheme.colorScheme.error)
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text("Ride Expired", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                Text("This ride is no longer available.", fontSize = 14.sp)
            }
        }
    }
}

@Composable
fun RideRouteCard(ride: com.ridesharing.app.data.models.Ride, isExpired: Boolean, formattedDateTime: String) {
    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isExpired) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f) else MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(ride.from, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Icon(Icons.Default.ArrowForward, null, modifier = Modifier.padding(horizontal = 8.dp), tint = MaterialTheme.colorScheme.primary)
                Text(ride.to, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Schedule, null, modifier = Modifier.size(16.dp), tint = if (isExpired) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                Text(" $formattedDateTime", fontSize = 14.sp, color = if (isExpired) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun CreatorCard(ride: com.ridesharing.app.data.models.Ride) {
    Card(shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text("Posted by", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                UserAvatar(name = ride.createdBy?.name ?: "U", profilePicUrl = ride.createdBy?.profilePic, modifier = Modifier.size(48.dp))
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(ride.createdBy?.name ?: "Unknown", fontWeight = FontWeight.SemiBold)
                    Text("Roll: ${ride.createdBy?.rollNo ?: ""}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun ParticipantsCard(ride: com.ridesharing.app.data.models.Ride) {
    if (ride.requests?.isNotEmpty() == true) {
        Card(shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Accepted Participants", fontWeight = FontWeight.SemiBold)
                ride.requests?.forEach { req ->
                    Row(modifier = Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        UserAvatar(name = req.requester?.name ?: "U", profilePicUrl = req.requester?.profilePic, modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(req.requester?.name ?: "", fontSize = 14.sp)
                        Spacer(modifier = Modifier.weight(1f))
                        StatusChip(status = req.status)
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun ActionSection(
    uiState: com.ridesharing.app.ui.viewmodel.RideDetailUiState,
    isExpired: Boolean,
    onSharePhone: () -> Unit,
    onChat: () -> Unit,
    onRequestJoin: () -> Unit
) {
    val status = uiState.requestStatus
    val ride = uiState.ride ?: return

    if (isExpired) {
        Button(onClick = {}, modifier = Modifier.fillMaxWidth(), enabled = false) {
            Text("Ride Expired")
        }
    } else if (status != null) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            StatusChip(status = status)
            if (status == "ACCEPTED") {
                OutlinedButton(onClick = onSharePhone, enabled = !uiState.isSharingPhone) {
                    if (uiState.isSharingPhone) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Default.ContactPhone, null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Share Contact")
                }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        if (status == "ACCEPTED" || status == "PENDING") {
            Button(onClick = onChat, modifier = Modifier.fillMaxWidth(), enabled = status == "ACCEPTED") {
                Icon(Icons.Default.Chat, null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (status == "ACCEPTED") "Chat" else "Awaiting Approval")
            }
        }
    } else if (ride.isOwner == false) {
        LoadingButton(
            text = if (ride.isFull) "Ride Full" else "Request to Join",
            isLoading = uiState.isRequesting,
            enabled = !ride.isFull,
            onClick = onRequestJoin
        )
    }
}

@Composable
fun PhoneContactDialog(data: PhoneShareContactData, onDismiss: () -> Unit, onCall: (String) -> Unit, onCopy: (String) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Contact Information") },
        text = {
            Column {
                Text(data.name, fontWeight = FontWeight.Bold)
                Text(data.phone, color = MaterialTheme.colorScheme.primary)
                Row(modifier = Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    IconButton(onClick = { onCall(data.phone) }) { Icon(Icons.Default.Phone, null) }
                    IconButton(onClick = { onCopy(data.phone) }) { Icon(Icons.Default.ContentCopy, null) }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } }
    )
}

@Composable
fun ErrorMessage(msg: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer), modifier = Modifier.fillMaxWidth()) {
        Text(msg, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(12.dp))
    }
}

@Composable
fun InfoMessage(msg: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), modifier = Modifier.fillMaxWidth()) {
        Text(msg, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.padding(12.dp))
    }
}
