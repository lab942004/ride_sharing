package com.ridesharing.app.ui.home

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.ridesharing.app.data.models.Ride
import com.ridesharing.app.ui.components.EmptyState
import com.ridesharing.app.ui.components.LoadingShimmer
import com.ridesharing.app.ui.components.StatusChip
import com.ridesharing.app.ui.components.UserAvatar
import com.ridesharing.app.ui.viewmodel.RideViewModel
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.RideTimeUtils
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    rideViewModel: RideViewModel = hiltViewModel(),
    onNavigateToCreateRide: () -> Unit,
    onNavigateToRideDetail: (String) -> Unit,
    onNavigateToMyRides: () -> Unit
) {
    val uiState by rideViewModel.uiState.collectAsStateWithLifecycle()
    var searchQuery by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(Unit) {
        AppLogger.d("HOME", "HomeScreen opened - loading rides")
        rideViewModel.loadRides()
    }

    // Lifecycle-aware auto-refresh (only when screen is visible)
    LaunchedEffect(Unit) {
        lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                delay(300_000L) // Refresh every 5 minutes
                rideViewModel.refreshExpiredRides()
            }
        }
    }

    val filteredRides = remember(uiState.rides, searchQuery) {
        if (searchQuery.isBlank()) uiState.rides
        else uiState.rides.filter {
            it.from.contains(searchQuery, ignoreCase = true) ||
            it.to.contains(searchQuery, ignoreCase = true)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("RideShare", fontWeight = FontWeight.Bold, fontSize = 22.sp)
                        Text("NIT Kurukshetra", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                actions = {
                    IconButton(onClick = onNavigateToMyRides) {
                        Icon(Icons.Default.DirectionsCar, "My Rides")
                    }
                    IconButton(onClick = onNavigateToCreateRide) {
                        Icon(Icons.Default.Add, "Create Ride")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Search Bar
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search destinations...") },
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Clear, "Clear")
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                )
            }

            // Quick Actions
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    QuickActionCard(
                        icon = Icons.Default.Add,
                        label = "Create Ride",
                        onClick = onNavigateToCreateRide,
                        modifier = Modifier.weight(1f)
                    )
                    QuickActionCard(
                        icon = Icons.Default.MyLocation,
                        label = "My Rides",
                        onClick = onNavigateToMyRides,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Available Rides",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            if (uiState.isLoading) {
                items(3) {
                    LoadingShimmer()
                }
            } else if (filteredRides.isEmpty()) {
                item {
                    EmptyState(
                        icon = {
                            Icon(Icons.Default.SearchOff, null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        },
                        title = "No rides available",
                        subtitle = if (searchQuery.isNotEmpty()) "No rides match your search"
                                   else "Be the first to create a ride!",
                        actionText = "Create Ride",
                        onAction = onNavigateToCreateRide
                    )
                }
            } else {
                items(filteredRides, key = { it.id }) { ride ->
                    RideCard(
                        ride = ride,
                        onClick = { onNavigateToRideDetail(ride.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun QuickActionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.height(80.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
            Spacer(modifier = Modifier.height(4.dp))
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
}

@Composable
fun RideCard(
    ride: Ride,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            UserAvatar(
                name = ride.createdBy?.name ?: "U",
                profilePicUrl = ride.createdBy?.profilePic
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(ride.from, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Icon(Icons.Default.ArrowForward, null, modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.primary)
                    Text(ride.to, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Spacer(modifier = Modifier.height(4.dp))
                val formattedTime = remember(ride.date, ride.time) {
                    RideTimeUtils.formatRideTime(ride.date, ride.time)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Schedule, null, modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.primary)
                    Text(" $formattedTime", fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Person, null, modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(" ${ride.createdBy?.name ?: "Unknown"}", fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            val timeLabel = remember(ride.date, ride.time) {
                RideTimeUtils.getTimeLabel(ride.date, ride.time)
            }
            Column(horizontalAlignment = Alignment.End) {
                StatusChip(status = timeLabel)
                Spacer(modifier = Modifier.height(4.dp))
                Text(if (ride.isFull) "FULL" else "${ride.availableSeats} seats",
                    fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}