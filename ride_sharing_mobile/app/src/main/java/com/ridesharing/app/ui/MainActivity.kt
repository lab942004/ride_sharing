package com.ridesharing.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ridesharing.app.data.repository.ChatRepository
import com.ridesharing.app.data.repository.RequestRepository
import com.ridesharing.app.data.repository.RideRepository
import com.ridesharing.app.navigation.Screen
import com.ridesharing.app.services.socket.SocketManager
import com.ridesharing.app.ui.auth.*
import com.ridesharing.app.ui.chat.ChatDetailScreen
import com.ridesharing.app.ui.chat.ChatListScreen
import com.ridesharing.app.ui.components.RideSharingBottomBar
import com.ridesharing.app.ui.forgot.ForgotPasswordScreen
import com.ridesharing.app.ui.home.HomeScreen
import com.ridesharing.app.ui.profile.*
import com.ridesharing.app.ui.requests.RequestsScreen
import com.ridesharing.app.ui.rides.*
import com.ridesharing.app.ui.splash.SplashScreen
import com.ridesharing.app.ui.theme.RideSharingTheme
import com.ridesharing.app.ui.viewmodel.*
import com.ridesharing.app.utils.NetworkUtils
import com.ridesharing.app.utils.TokenManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var rideRepository: RideRepository
    @Inject lateinit var requestRepository: RequestRepository
    @Inject lateinit var chatRepository: ChatRepository
    @Inject lateinit var tokenManager: TokenManager
    @Inject lateinit var networkUtils: NetworkUtils
    @Inject lateinit var socketManager: SocketManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            RideSharingTheme(dynamicColor = true) {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route
                val snackbarHostState = remember { SnackbarHostState() }

                // Determine if bottom bar should be shown
                val bottomNavRoutes = listOf(
                    Screen.Home.route,
                    Screen.Rides.route,
                    Screen.Requests.route,
                    Screen.ChatList.route,
                    Screen.Profile.route
                )
                val showBottomBar = currentRoute in bottomNavRoutes

                Scaffold(
                    snackbarHost = { SnackbarHost(snackbarHostState) },
                    bottomBar = {
                        if (showBottomBar) {
                            RideSharingBottomBar(
                                currentRoute = currentRoute,
                                onItemClick = { route ->
                                    navController.navigate(route) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            )
                        }
                    }
                ) { padding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Splash.route,
                        modifier = Modifier.padding(padding)
                    ) {
                        // Splash
                        composable(Screen.Splash.route) {
                            SplashScreen(
                                tokenManager = tokenManager,
                                networkUtils = networkUtils,
                                onNavigateToLogin = {
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(Screen.Splash.route) { inclusive = true }
                                    }
                                },
                                onNavigateToHome = {
                                    navController.navigate(Screen.Home.route) {
                                        popUpTo(Screen.Splash.route) { inclusive = true }
                                    }
                                }
                            )
                        }

                        // Auth
                        composable(Screen.Login.route) {
                            val authViewModel: AuthViewModel = hiltViewModel()
                            LoginScreen(
                                authViewModel = authViewModel,
                                onNavigateToRegister = {
                                    navController.navigate(Screen.Register.route)
                                },
                                onNavigateToForgotPassword = {
                                    navController.navigate(Screen.ForgotPassword.route)
                                },
                                onLoginSuccess = {
                                    navController.navigate(Screen.Home.route) {
                                        popUpTo(Screen.Login.route) { inclusive = true }
                                    }
                                }
                            )
                        }

                        composable(Screen.Register.route) {
                            RegisterStep1Screen(
                                onNavigateToOtp = { data ->
                                    val parts = data.split("|")
                                    val email = parts.getOrElse(1) { data }
                                    navController.navigate(Screen.OtpVerification.createRoute(email))
                                },
                                onBack = { navController.popBackStack() }
                            )
                        }

                        composable(
                            Screen.OtpVerification.route,
                            arguments = listOf(navArgument("email") { type = NavType.StringType })
                        ) { backStackEntry ->
                            val email = backStackEntry.arguments?.getString("email") ?: ""
                            val authViewModel: AuthViewModel = hiltViewModel()
                            OtpVerificationScreen(
                                email = email,
                                authViewModel = authViewModel,
                                onOtpVerified = {
                                    navController.navigate(Screen.CompleteProfile.createRoute(email)) {
                                        popUpTo(Screen.Register.route) { inclusive = true }
                                    }
                                },
                                onBack = { navController.popBackStack() }
                            )
                        }

                        composable(
                            Screen.CompleteProfile.route,
                            arguments = listOf(navArgument("email") { type = NavType.StringType })
                        ) { backStackEntry ->
                            val email = backStackEntry.arguments?.getString("email") ?: ""
                            val authViewModel: AuthViewModel = hiltViewModel()
                            CompleteProfileScreen(
                                email = email,
                                authViewModel = authViewModel,
                                onRegistrationComplete = {
                                    navController.navigate(Screen.Home.route) {
                                        popUpTo(0) { inclusive = true }
                                    }
                                },
                                onBack = { navController.popBackStack() }
                            )
                        }

                        composable(Screen.ForgotPassword.route) {
                            val authViewModel: AuthViewModel = hiltViewModel()
                            ForgotPasswordScreen(
                                authViewModel = authViewModel,
                                onBack = { navController.popBackStack() },
                                onPasswordReset = {
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(Screen.ForgotPassword.route) { inclusive = true }
                                    }
                                }
                            )
                        }

                        // Home
                        composable(Screen.Home.route) {
                            HomeScreen(
                                onNavigateToCreateRide = {
                                    navController.navigate(Screen.CreateRide.route)
                                },
                                onNavigateToRideDetail = { rideId ->
                                    navController.navigate(Screen.RideDetail.createRoute(rideId))
                                },
                                onNavigateToMyRides = {
                                    navController.navigate(Screen.MyRides.route)
                                }
                            )
                        }

                        // Rides
                        composable(Screen.Rides.route) {
                            val rideViewModel: RideViewModel = hiltViewModel()
                            RidesScreen(
                                rideViewModel = rideViewModel,
                                onNavigateToCreateRide = {
                                    navController.navigate(Screen.CreateRide.route)
                                },
                                onNavigateToRideDetail = { rideId ->
                                    navController.navigate(Screen.RideDetail.createRoute(rideId))
                                }
                            )
                        }

                        composable(Screen.CreateRide.route) {
                            val rideViewModel: RideViewModel = hiltViewModel()
                            CreateRideScreen(
                                rideViewModel = rideViewModel,
                                onBack = { navController.popBackStack() },
                                onRideCreated = {
                                    navController.popBackStack()
                                }
                            )
                        }

                        composable(Screen.MyRides.route) {
                            val rideViewModel: RideViewModel = hiltViewModel()
                            MyRidesScreen(
                                rideViewModel = rideViewModel,
                                onBack = { navController.popBackStack() },
                                onRideDetail = { rideId ->
                                    navController.navigate(Screen.RideDetail.createRoute(rideId))
                                }
                            )
                        }

                        composable(
                            Screen.RideDetail.route,
                            arguments = listOf(navArgument("rideId") { type = NavType.StringType })
                        ) { backStackEntry ->
                            val rideId = backStackEntry.arguments?.getString("rideId") ?: ""
                            val rideDetailViewModel: RideDetailViewModel = hiltViewModel()
                            RideDetailScreen(
                                rideId = rideId,
                                viewModel = rideDetailViewModel,
                                onBack = { navController.popBackStack() },
                                onChat = { requestId ->
                                    navController.navigate(Screen.ChatScreen.createRoute(requestId))
                                }
                            )
                        }

                        // Requests
                        composable(Screen.Requests.route) {
                            val requestViewModel: RequestViewModel = hiltViewModel()
                            RequestsScreen(
                                requestViewModel = requestViewModel,
                                onNavigateToChat = { requestId ->
                                    navController.navigate(Screen.ChatScreen.createRoute(requestId))
                                }
                            )
                        }

                        // Chat list with Delete All Chats feature
                        composable(Screen.ChatList.route) {
                            val requestViewModel: RequestViewModel = hiltViewModel()
                            ChatListScreen(
                                requestViewModel = requestViewModel,
                                onNavigateToChat = { requestId ->
                                    navController.navigate(Screen.ChatScreen.createRoute(requestId))
                                }
                            )
                        }

                        composable(
                            Screen.ChatScreen.route,
                            arguments = listOf(navArgument("requestId") { type = NavType.StringType })
                        ) { backStackEntry ->
                            val requestId = backStackEntry.arguments?.getString("requestId") ?: ""
                            val chatViewModel: ChatViewModel = hiltViewModel()
                            ChatDetailScreen(
                                requestId = requestId,
                                chatViewModel = chatViewModel,
                                onBack = { navController.popBackStack() }
                            )
                        }

                        // Profile
                        composable(Screen.Profile.route) {
                            val profileViewModel: ProfileViewModel = hiltViewModel()
                            val authViewModel: AuthViewModel = hiltViewModel()
                            ProfileScreen(
                                profileViewModel = profileViewModel,
                                authViewModel = authViewModel,
                                onNavigateToEditProfile = {
                                    navController.navigate(Screen.EditProfile.route)
                                },
                                onNavigateToChangePassword = {
                                    navController.navigate(Screen.ChangePassword.route)
                                },
                                onLogout = {
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            )
                        }

                        composable(Screen.EditProfile.route) {
                            val profileViewModel: ProfileViewModel = hiltViewModel()
                            EditProfileScreen(
                                profileViewModel = profileViewModel,
                                onBack = { navController.popBackStack() },
                                onProfileUpdated = { navController.popBackStack() }
                            )
                        }

                        composable(Screen.ChangePassword.route) {
                            val profileViewModel: ProfileViewModel = hiltViewModel()
                            ChangePasswordScreen(
                                profileViewModel = profileViewModel,
                                onBack = { navController.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        socketManager.disconnect()
    }
}