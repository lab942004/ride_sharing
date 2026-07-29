package com.ridesharing.app.ui.splash

import android.util.Log
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ridesharing.app.R
import com.ridesharing.app.utils.AppLogger
import com.ridesharing.app.utils.NetworkUtils
import com.ridesharing.app.utils.TokenManager
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    tokenManager: TokenManager,
    networkUtils: NetworkUtils,
    onNavigateToLogin: () -> Unit,
    onNavigateToHome: () -> Unit
) {
    val tag = "AUTH_DEBUG"
    val infiniteTransition = rememberInfiniteTransition()
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000),
            repeatMode = RepeatMode.Reverse
        )
    )

    LaunchedEffect(Unit) {
        // Allow the splash to show briefly for a smooth UX
        delay(1500)

        // CRITICAL: Read token directly from persistent storage to ensure
        // we have the latest persisted state (survives process death)
        val accessToken = tokenManager.getAccessTokenSync()
        val isLoggedIn = accessToken != null

        AppLogger.d(tag, "SplashScreen: checking login state via getAccessTokenSync()")
        AppLogger.d(tag, "SplashScreen: accessToken=${accessToken != null}, isLoggedIn=$isLoggedIn")

        if (isLoggedIn) {
            AppLogger.d(tag, "SplashScreen: token found, navigating to Home")
            onNavigateToHome()
        } else {
            AppLogger.d(tag, "SplashScreen: no token found, navigating to Login")
            onNavigateToLogin()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Image(
                painter = painterResource(id = R.drawable.ride_sharing_logo),
                contentDescription = "Logo",
                modifier = Modifier.size(120.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "RideShare",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "NIT Kurukshetra",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(48.dp))

            CircularProgressIndicator(
                modifier = Modifier.alpha(alpha),
                color = MaterialTheme.colorScheme.primary,
                strokeWidth = 3.dp
            )
        }
    }
}
