package com.ridesharing.app.ui.forgot

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ridesharing.app.ui.components.LoadingButton
import com.ridesharing.app.ui.viewmodel.AuthViewModel
import com.ridesharing.app.utils.Resource
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForgotPasswordScreen(
    authViewModel: AuthViewModel,
    onBack: () -> Unit,
    onPasswordReset: () -> Unit
) {
    val uiState by authViewModel.uiState.collectAsStateWithLifecycle()
    var step by remember { mutableStateOf(1) }
    var email by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var resendEnabled by remember { mutableStateOf(false) }
    var countdown by remember { mutableStateOf(30) }

    LaunchedEffect(countdown) {
        if (countdown > 0 && step == 2) {
            delay(1000)
            countdown--
            if (countdown == 0) resendEnabled = true
        }
    }

    LaunchedEffect(uiState.message) {
        if (uiState.message != null && step == 3) {
            delay(1500)
            onPasswordReset()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Reset Password", fontWeight = FontWeight.SemiBold) },
            navigationIcon = {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Back") }
            }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(32.dp))

            when (step) {
                1 -> {
                    Icon(Icons.Default.LockReset, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Enter your registered college email", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(32.dp))

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it; authViewModel.clearError() },
                        label = { Text("College Email") },
                        leadingIcon = { Icon(Icons.Default.Email, null) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (uiState.error != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                            Text(uiState.error!!, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(12.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    LoadingButton(
                        text = "Send OTP",
                        isLoading = uiState.isLoading,
                        enabled = email.isNotBlank() && email.contains("@"),
                        onClick = {
                            authViewModel.forgotPassword(email.trim())
                            step = 2
                            countdown = 30
                            resendEnabled = false
                        }
                    )
                }

                2 -> {
                    Icon(Icons.Default.Pin, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Enter OTP sent to $email", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(32.dp))

                    OutlinedTextField(
                        value = otp,
                        onValueChange = { if (it.length <= 6) { otp = it; authViewModel.clearError() } },
                        label = { Text("OTP") },
                        leadingIcon = { Icon(Icons.Default.Pin, null) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (uiState.error != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                            Text(uiState.error!!, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(12.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    LoadingButton(
                        text = "Verify OTP",
                        isLoading = uiState.isLoading,
                        enabled = otp.length == 6,
                        onClick = {
                            authViewModel.verifyOtp(email.trim(), otp)
                            step = 3
                        }
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(horizontalArrangement = Arrangement.Center) {
                        Text("Resend in $countdown", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            " Resend",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (resendEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier.clickable(enabled = resendEnabled) {
                                authViewModel.forgotPassword(email.trim())
                                countdown = 30
                                resendEnabled = false
                            }
                        )
                    }
                }

                3 -> {
                    Icon(Icons.Default.Lock, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Enter your new password", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(32.dp))

                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it; authViewModel.clearError() },
                        label = { Text("New Password") },
                        leadingIcon = { Icon(Icons.Default.Lock, null) },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth(),
                        isError = newPassword.isNotEmpty() && newPassword.length < 6,
                        supportingText = if (newPassword.isNotEmpty() && newPassword.length < 6) {
                            { Text("Min 6 characters") }
                        } else null
                    )

                    if (uiState.error != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                            Text(uiState.error!!, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(12.dp))
                        }
                    }
                    if (uiState.message != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                            Text(uiState.message!!, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.padding(12.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    LoadingButton(
                        text = "Reset Password",
                        isLoading = uiState.isLoading,
                        enabled = newPassword.length >= 6,
                        onClick = {
                            authViewModel.resetPassword(email.trim(), otp, newPassword)
                        }
                    )
                }
            }
        }
    }
}