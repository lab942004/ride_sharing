package com.ridesharing.app.ui.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ridesharing.app.ui.components.AuthInputField
import com.ridesharing.app.ui.components.LoadingButton
import com.ridesharing.app.ui.viewmodel.AuthViewModel
import com.ridesharing.app.utils.Resource
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun RegisterStep1Screen(
    onNavigateToOtp: (String) -> Unit,
    onBack: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        Text(
            text = "Create Account",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Enter your college email to get started",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(48.dp))

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Full Name") },
            leadingIcon = { Icon(Icons.Default.Person, null) },
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("College Email") },
            leadingIcon = { Icon(Icons.Default.Email, null) },
            trailingIcon = {
                if (email.isNotEmpty()) {
                    val isValid = email.endsWith("@nitkkr.ac.in")
                    Icon(
                        if (isValid) Icons.Default.CheckCircle else Icons.Default.Cancel,
                        contentDescription = null,
                        tint = if (isValid) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    )
                }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth(),
            isError = email.isNotEmpty() && !email.endsWith("@nitkkr.ac.in"),
            supportingText = if (email.isNotEmpty() && !email.endsWith("@nitkkr.ac.in")) {
                { Text("Only @nitkkr.ac.in emails allowed", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            } else null
        )

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = { onNavigateToOtp("$name|$email") },
            enabled = name.isNotBlank() && email.endsWith("@nitkkr.ac.in"),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = MaterialTheme.shapes.medium
        ) {
            Text("Send OTP", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Already have an account? ",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clickable { onBack() }
        )
    }
}

@Composable
fun OtpVerificationScreen(
    email: String,
    authViewModel: AuthViewModel,
    onOtpVerified: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by authViewModel.uiState.collectAsStateWithLifecycle()
    var otp by remember { mutableStateOf("") }
    var resendEnabled by remember { mutableStateOf(false) }
    var countdown by remember { mutableStateOf(30) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        authViewModel.sendOtp(email)
    }

    LaunchedEffect(uiState.otpVerified) {
        if (uiState.otpVerified) {
            onOtpVerified()
        }
    }

    LaunchedEffect(countdown) {
        if (countdown > 0) {
            delay(1000)
            countdown--
        } else {
            resendEnabled = true
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        Icon(
            Icons.Default.MailLock,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Verify Email",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Enter the 6-digit OTP sent to\n$email",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 24.dp)
        )

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = otp,
            onValueChange = { if (it.length <= 6) { otp = it; authViewModel.clearError() } },
            label = { Text("OTP") },
            leadingIcon = { Icon(Icons.Default.Pin, null) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth(),
            isError = uiState.error != null,
            supportingText = uiState.error?.let {
                { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            }
        )

        Spacer(modifier = Modifier.height(24.dp))

        LoadingButton(
            text = "Verify OTP",
            isLoading = uiState.isLoading,
            enabled = otp.length == 6 && !uiState.isLoading,
            onClick = {
                authViewModel.verifyOtp(email, otp)
            }
        )

        Spacer(modifier = Modifier.height(16.dp))

        Row(
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Resend OTP in $countdown",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = " Resend",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = if (resendEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                modifier = Modifier.clickable(enabled = resendEnabled) {
                    authViewModel.sendOtp(email)
                    countdown = 30
                    resendEnabled = false
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompleteProfileScreen(
    email: String,
    authViewModel: AuthViewModel,
    onRegistrationComplete: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by authViewModel.uiState.collectAsStateWithLifecycle()
    var name by remember { mutableStateOf("") }
    var rollNo by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    LaunchedEffect(uiState.isLoggedIn) {
        if (uiState.isLoggedIn) {
            onRegistrationComplete()
        }
    }

    val isFormValid = name.isNotBlank() && rollNo.isNotBlank() &&
            phone.length == 10 && password.length >= 6

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = "Complete Profile",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Full Name") },
            leadingIcon = { Icon(Icons.Default.Person, null) },
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = rollNo,
            onValueChange = { rollNo = it },
            label = { Text("Roll Number") },
            leadingIcon = { Icon(Icons.Default.Badge, null) },
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = phone,
            onValueChange = { if (it.length <= 10) phone = it },
            label = { Text("Phone Number") },
            leadingIcon = { Icon(Icons.Default.Phone, null) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Default.Lock, null) },
            singleLine = true,
            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth(),
            isError = password.isNotEmpty() && password.length < 6,
            supportingText = if (password.isNotEmpty() && password.length < 6) {
                { Text("Min 6 characters", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            } else null
        )

        if (uiState.error != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Text(
                    text = uiState.error!!,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        LoadingButton(
            text = "Create Account",
            isLoading = uiState.isLoading,
            enabled = isFormValid && !uiState.isLoading,
            onClick = {
                authViewModel.register(
                    name = name.trim(), rollNo = rollNo.trim(),
                    email = email.trim(), phone = phone.trim(), password = password
                )
            }
        )
    }
}