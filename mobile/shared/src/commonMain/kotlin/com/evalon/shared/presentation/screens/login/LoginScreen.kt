package com.evalon.shared.presentation.screens.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun LoginScreen(
    component: LoginComponent,
    viewModel: LoginViewModel
) {
    val state by viewModel.uiState.collectAsState()
    var passwordVisible by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(EvalonDarkBg, EvalonBlack)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Logo / Title
            Text(
                text = "EVALON",
                color = EvalonBlue,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 36.sp,
                letterSpacing = 4.sp
            )
            Text(
                text = "Akıllı Yatırım Platformu",
                color = EvalonTextSecondary,
                fontSize = 14.sp
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Email field
            OutlinedTextField(
                value = state.email,
                onValueChange = viewModel::onEmailChange,
                label = { Text("E-posta") },
                leadingIcon = { Icon(Icons.Default.Email, null, tint = EvalonTextSecondary) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = EvalonBlue,
                    unfocusedBorderColor = EvalonSurfaceVariant,
                    focusedTextColor = EvalonTextPrimary,
                    unfocusedTextColor = EvalonTextPrimary,
                    cursorColor = EvalonBlue,
                    focusedLabelColor = EvalonBlue,
                    unfocusedLabelColor = EvalonTextSecondary
                )
            )

            // Password field
            OutlinedTextField(
                value = state.password,
                onValueChange = viewModel::onPasswordChange,
                label = { Text("Şifre") },
                leadingIcon = { Icon(Icons.Default.Lock, null, tint = EvalonTextSecondary) },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = null,
                            tint = EvalonTextSecondary
                        )
                    }
                },
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = EvalonBlue,
                    unfocusedBorderColor = EvalonSurfaceVariant,
                    focusedTextColor = EvalonTextPrimary,
                    unfocusedTextColor = EvalonTextPrimary,
                    cursorColor = EvalonBlue,
                    focusedLabelColor = EvalonBlue,
                    unfocusedLabelColor = EvalonTextSecondary
                )
            )

            // Error
            state.error?.let { error ->
                Text(
                    text = error,
                    color = EvalonRed,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Login button
            Button(
                onClick = { viewModel.login { component.onLoginSuccess() } },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !state.isLoading,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = EvalonBlue)
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        color = EvalonTextPrimary,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Giriş Yap", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            // Register hint
            TextButton(onClick = { /* TODO: register */ }) {
                Text(
                    text = "Hesabınız yok mu? Kayıt olun",
                    color = EvalonBlue,
                    fontSize = 14.sp
                )
            }
        }
    }
}
