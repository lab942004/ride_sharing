package com.ridesharing.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.RocketLaunch
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    data object Splash : Screen("splash")
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object OtpVerification : Screen("otp_verification/{email}") {
        fun createRoute(email: String) = "otp_verification/$email"
    }
    data object CompleteProfile : Screen("complete_profile/{email}") {
        fun createRoute(email: String) = "complete_profile/$email"
    }
    data object ForgotPassword : Screen("forgot_password")
    data object ResetPassword : Screen("reset_password/{email}") {
        fun createRoute(email: String) = "reset_password/$email"
    }

    // Main screens (with bottom nav)
    data object Home : Screen("home")
    data object Rides : Screen("rides")
    data object Requests : Screen("requests")
    data object ChatList : Screen("chat_list")
    data object Profile : Screen("profile")

    // Detail screens
    data object CreateRide : Screen("create_ride")
    data object MyRides : Screen("my_rides")
    data object RideDetail : Screen("ride_detail/{rideId}") {
        fun createRoute(rideId: String) = "ride_detail/$rideId"
    }
    data object ChatScreen : Screen("chat/{requestId}") {
        fun createRoute(requestId: String) = "chat/$requestId"
    }
    data object EditProfile : Screen("edit_profile")
    data object ChangePassword : Screen("change_password")
}

data class BottomNavItem(
    val label: String,
    val route: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val badgeCount: Int = 0
)

val bottomNavItems = listOf(
    BottomNavItem(
        label = "Home",
        route = Screen.Home.route,
        selectedIcon = Icons.Filled.Home,
        unselectedIcon = Icons.Outlined.Home
    ),
    BottomNavItem(
        label = "Rides",
        route = Screen.Rides.route,
        selectedIcon = Icons.Filled.RocketLaunch,
        unselectedIcon = Icons.Outlined.RocketLaunch
    ),
    BottomNavItem(
        label = "Requests",
        route = Screen.Requests.route,
        selectedIcon = Icons.AutoMirrored.Filled.Send,
        unselectedIcon = Icons.AutoMirrored.Outlined.Send
    ),
    BottomNavItem(
        label = "Chat",
        route = Screen.ChatList.route,
        selectedIcon = Icons.AutoMirrored.Filled.Chat,
        unselectedIcon = Icons.AutoMirrored.Outlined.Chat
    ),
    BottomNavItem(
        label = "Profile",
        route = Screen.Profile.route,
        selectedIcon = Icons.Filled.Person,
        unselectedIcon = Icons.Outlined.Person
    )
)