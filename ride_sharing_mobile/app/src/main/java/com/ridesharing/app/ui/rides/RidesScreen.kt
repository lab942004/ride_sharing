package com.ridesharing.app.ui.rides

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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.ridesharing.app.data.models.CreateRideRequest
import com.ridesharing.app.data.models.RideFilters
import com.ridesharing.app.ui.components.LoadingButton
import com.ridesharing.app.ui.components.LoadingShimmer
import com.ridesharing.app.ui.components.RideCard
import com.ridesharing.app.ui.components.RideSharingTopBar
import com.ridesharing.app.ui.components.StatusChip
import com.ridesharing.app.ui.viewmodel.RideViewModel
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.RideTimeUtils
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RidesScreen(
    rideViewModel: RideViewModel,
    onNavigateToCreateRide: () -> Unit,
    onNavigateToRideDetail: (String) -> Unit
) {
    val uiState by rideViewModel.uiState.collectAsStateWithLifecycle()
    var fromFilter by remember { mutableStateOf("") }
    var toFilter by remember { mutableStateOf("") }
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(Unit) {
        AppLogger.d("RIDES", "RidesScreen opened - loading rides")
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

    Column(modifier = Modifier.fillMaxSize()) {
        var dateFilter by remember { mutableStateOf("") }
        var vehicleTypeFilter by remember { mutableStateOf("") }
        val vehicleTypes = listOf("", "Car", "Bike", "Auto", "Bus", "Other")
        var expandedVehicleType by remember { mutableStateOf(false) }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = fromFilter,
                    onValueChange = { fromFilter = it },
                    placeholder = { Text("From") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
                OutlinedTextField(
                    value = toFilter,
                    onValueChange = { toFilter = it },
                    placeholder = { Text("To") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = dateFilter,
                    onValueChange = { dateFilter = it },
                    placeholder = { Text("Date") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
                ExposedDropdownMenuBox(
                    expanded = expandedVehicleType,
                    onExpandedChange = { expandedVehicleType = it },
                    modifier = Modifier.weight(1f)
                ) {
                    OutlinedTextField(
                        value = vehicleTypeFilter.ifEmpty { "Vehicle" },
                        onValueChange = {},
                        readOnly = true,
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedVehicleType) },
                        modifier = Modifier.menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expandedVehicleType,
                        onDismissRequest = { expandedVehicleType = false }
                    ) {
                        vehicleTypes.forEach { type ->
                            DropdownMenuItem(
                                text = { Text(type.ifEmpty { "All Vehicles" }) },
                                onClick = {
                                    vehicleTypeFilter = type
                                    expandedVehicleType = false
                                }
                            )
                        }
                    }
                }
                IconButton(onClick = {
                    rideViewModel.loadRides(
                        RideFilters(
                            from = fromFilter.ifBlank { null },
                            to = toFilter.ifBlank { null },
                            date = dateFilter.ifBlank { null },
                            vehicleType = vehicleTypeFilter.ifBlank { null }
                        )
                    )
                }) {
                    Icon(Icons.Default.Search, "Search")
                }
            }
        }

        if (uiState.isLoading) {
            LazyColumn(contentPadding = PaddingValues(16.dp)) {
                items(3) { LoadingShimmer() }
            }
        } else if (uiState.rides.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.SearchOff, null, modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No rides found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.rides, key = { it.id }) { ride ->
                    RideCard(
                        ride = ride,
                        onClick = { onNavigateToRideDetail(ride.id) }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateRideScreen(
    rideViewModel: RideViewModel,
    onBack: () -> Unit,
    onRideCreated: () -> Unit
) {
    var from by remember { mutableStateOf("") }
    var to by remember { mutableStateOf("") }
    var dateDisplay by remember { mutableStateOf("") }
    var timeDisplay by remember { mutableStateOf("") }
    var dateForApi by remember { mutableStateOf("") }
    var timeForApi by remember { mutableStateOf("") }
    var vehicleType by remember { mutableStateOf("Car") }
    var availableSeats by remember { mutableStateOf("1") }
    val vehicleTypes = listOf("Car", "Bike", "Auto", "Bus", "Other")
    val createState by rideViewModel.createRideState.collectAsStateWithLifecycle()

    // Validation errors
    var dateError by remember { mutableStateOf<String?>(null) }
    var timeError by remember { mutableStateOf<String?>(null) }
    var seatsError by remember { mutableStateOf<String?>(null) }

    // Date Picker State
    var showDatePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState(
        initialSelectedDateMillis = System.currentTimeMillis(),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean {
                return utcTimeMillis >= System.currentTimeMillis() - 86400000L
            }
        }
    )

    val context = LocalContext.current
    val is24HourFormat = remember(context) {
        android.text.format.DateFormat.is24HourFormat(context)
    }

    // Time Picker State
    var showTimePicker by remember { mutableStateOf(false) }
    val timePickerState = rememberTimePickerState(
        initialHour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY),
        initialMinute = Calendar.getInstance().get(Calendar.MINUTE),
        is24Hour = is24HourFormat
    )

    // Date Picker Dialog
    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        val cal = Calendar.getInstance().apply { timeInMillis = millis }
                        val year = cal.get(Calendar.YEAR)
                        val month = cal.get(Calendar.MONTH)
                        val day = cal.get(Calendar.DAY_OF_MONTH)
                        dateDisplay = String.format("%02d/%02d/%04d", day, month + 1, year)
                        dateForApi = String.format("%04d-%02d-%02d", year, month + 1, day)
                        dateError = null
                        // Clear time if date changed to today so user must re-select
                        if (dateForApi == SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())) {
                            timeDisplay = ""
                            timeForApi = ""
                        }
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // Time Picker Dialog
    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Select Time", fontWeight = FontWeight.SemiBold) },
            text = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    val hour = timePickerState.hour
                    val minute = timePickerState.minute

                    timeForApi = String.format("%02d:%02d", hour, minute)
                    timeDisplay = if (is24HourFormat) {
                        String.format("%02d:%02d", hour, minute)
                    } else {
                        val amPm = if (hour < 12) "AM" else "PM"
                        val displayHour = when {
                            hour == 0 -> 12
                            hour > 12 -> hour - 12
                            else -> hour
                        }
                        String.format("%02d:%02d %s", displayHour, minute, amPm)
                    }
                    timeError = null

                    // Validate future time if date is today
                    val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                    if (dateForApi == todayStr) {
                        val now = Calendar.getInstance()
                        val selectedCal = Calendar.getInstance().apply {
                            set(Calendar.HOUR_OF_DAY, hour)
                            set(Calendar.MINUTE, minute)
                            set(Calendar.SECOND, 0)
                        }
                        if (selectedCal.timeInMillis <= now.timeInMillis) {
                            timeError = "Please select a future time"
                        }
                    }
                    showTimePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            }
        )
    }

    LaunchedEffect(createState) {
        if (createState is com.ridesharing.app.utils.Resource.Success) {
            rideViewModel.clearCreateState()
            android.widget.Toast.makeText(context, "Ride created successfully!", android.widget.Toast.LENGTH_SHORT).show()
            onRideCreated()
        }
    }

    fun validate(): Boolean {
        var valid = true
        if (dateForApi.isBlank()) {
            dateError = "Please select a date"
            valid = false
        } else {
            dateError = null
        }
        if (timeForApi.isBlank()) {
            timeError = "Please select a time"
            valid = false
        } else {
            timeError = null
            val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            if (dateForApi == todayStr) {
                val parts = timeForApi.split(":")
                val now = Calendar.getInstance()
                val selectedHour = parts.getOrNull(0)?.toIntOrNull() ?: 0
                val selectedMinute = parts.getOrNull(1)?.toIntOrNull() ?: 0
                val selectedCal = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, selectedHour)
                    set(Calendar.MINUTE, selectedMinute)
                    set(Calendar.SECOND, 0)
                }
                if (selectedCal.timeInMillis <= now.timeInMillis) {
                    timeError = "Please select a future time"
                    valid = false
                }
            }
        }
        val seats = availableSeats.toIntOrNull() ?: 0
        if (seats <= 0 || seats > 10) {
            seatsError = "Please enter seats (1-10)"
            valid = false
        } else {
            seatsError = null
        }
        return valid
    }

    Column(modifier = Modifier.fillMaxSize()) {
        RideSharingTopBar(title = "Create Ride", onBack = onBack)

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // From Location
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        OutlinedTextField(
                            value = from,
                            onValueChange = { from = it },
                            label = { Text("From Location") },
                            placeholder = { Text("Enter pickup location") },
                            leadingIcon = { Icon(Icons.Default.LocationOn, null, tint = MaterialTheme.colorScheme.primary) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline
                            )
                        )
                    }
                }
            }

            // To Location
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        OutlinedTextField(
                            value = to,
                            onValueChange = { to = it },
                            label = { Text("To Location") },
                            placeholder = { Text("Enter destination") },
                            leadingIcon = { Icon(Icons.Default.MyLocation, null, tint = MaterialTheme.colorScheme.primary) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline
                            )
                        )
                    }
                }
            }

            // Date & Time
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Journey Details",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            // Date Field
                            Box(modifier = Modifier.weight(1f)) {
                                OutlinedTextField(
                                    value = dateDisplay,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Date") },
                                    placeholder = { Text("DD/MM/YYYY") },
                                    leadingIcon = { Icon(Icons.Default.CalendarToday, null, tint = MaterialTheme.colorScheme.primary) },
                                    isError = dateError != null,
                                    supportingText = dateError?.let { { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) } },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    enabled = false,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        disabledTextColor = MaterialTheme.colorScheme.onSurface,
                                        disabledBorderColor = if (dateError != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.outline,
                                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                        disabledLeadingIconColor = MaterialTheme.colorScheme.primary
                                    )
                                )
                                Box(
                                    modifier = Modifier
                                        .matchParentSize()
                                        .clickable { showDatePicker = true }
                                )
                            }

                            // Time Field
                            Box(modifier = Modifier.weight(1f)) {
                                OutlinedTextField(
                                    value = timeDisplay,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Time") },
                                    placeholder = { Text("--:--") },
                                    leadingIcon = { Icon(Icons.Default.Schedule, null, tint = MaterialTheme.colorScheme.primary) },
                                    isError = timeError != null,
                                    supportingText = timeError?.let { { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) } },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    enabled = false,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        disabledTextColor = MaterialTheme.colorScheme.onSurface,
                                        disabledBorderColor = if (timeError != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.outline,
                                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                        disabledLeadingIconColor = MaterialTheme.colorScheme.primary
                                    )
                                )
                                Box(
                                    modifier = Modifier
                                        .matchParentSize()
                                        .clickable { showTimePicker = true }
                                )
                            }
                        }
                    }
                }
            }

            // Seats & Vehicle Type
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Ride Details",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )

                        OutlinedTextField(
                            value = availableSeats,
                            onValueChange = {
                                if (it.isEmpty() || it.all { c -> c.isDigit() }) {
                                    availableSeats = it
                                    seatsError = null
                                }
                            },
                            label = { Text("Available Seats") },
                            placeholder = { Text("1-10") },
                            leadingIcon = { Icon(Icons.Default.People, null, tint = MaterialTheme.colorScheme.primary) },
                            isError = seatsError != null,
                            supportingText = seatsError?.let { { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) } },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline
                            )
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Text("Vehicle Type", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            vehicleTypes.forEach { type ->
                                FilterChip(
                                    selected = vehicleType == type,
                                    onClick = { vehicleType = type },
                                    label = { Text(type, fontSize = 13.sp) },
                                    leadingIcon = if (vehicleType == type) {
                                        { Icon(Icons.Default.Check, null, modifier = Modifier.size(16.dp)) }
                                    } else null
                                )
                            }
                        }
                    }
                }
            }

            // Error
            if (createState is com.ridesharing.app.utils.Resource.Error) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            (createState as com.ridesharing.app.utils.Resource.Error).message,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(12.dp),
                            fontSize = 14.sp
                        )
                    }
                }
            }

            // Submit Button
            item {
                Spacer(modifier = Modifier.height(8.dp))
                LoadingButton(
                    text = "Create Ride",
                    isLoading = createState is com.ridesharing.app.utils.Resource.Loading,
                    enabled = from.isNotBlank() && to.isNotBlank() && dateForApi.isNotBlank() &&
                            timeForApi.isNotBlank() && (availableSeats.toIntOrNull() ?: 0) in 1..10 &&
                            createState !is com.ridesharing.app.utils.Resource.Loading,
                    onClick = {
                        if (validate()) {
                            rideViewModel.createRide(
                                CreateRideRequest(from, to, dateForApi, timeForApi, vehicleType, availableSeats.toIntOrNull() ?: 1)
                            )
                        }
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyRidesScreen(
    rideViewModel: RideViewModel,
    onBack: () -> Unit,
    onRideDetail: (String) -> Unit
) {
    val uiState by rideViewModel.uiState.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(Unit) {
        rideViewModel.loadMyRides()
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

    Column(modifier = Modifier.fillMaxSize()) {
        RideSharingTopBar(title = "My Rides", onBack = onBack)
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (uiState.myRides.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No rides yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.myRides, key = { it.id }) { ride ->
                    val formattedTime = remember(ride.date, ride.time) {
                        RideTimeUtils.formatRideTime(ride.date, ride.time)
                    }
                    val timeLabel = remember(ride.date, ride.time) {
                        RideTimeUtils.getTimeLabel(ride.date, ride.time)
                    }
                    Card(
                        onClick = { onRideDetail(ride.id) },
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${ride.from} → ${ride.to}", fontWeight = FontWeight.SemiBold)
                                Text(formattedTime, fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("${ride.vehicleType} | ${ride.availableSeats} seats", fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            StatusChip(status = if (ride.isExpired || timeLabel == "Expired") "EXPIRED" else "ACTIVE")
                        }
                    }
                }
            }
        }
    }
}