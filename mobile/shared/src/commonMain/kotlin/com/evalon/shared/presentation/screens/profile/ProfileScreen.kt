package com.evalon.shared.presentation.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.components.*
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun ProfileScreen(
    component: ProfileComponent,
    viewModel: ProfileViewModel,
    onSettingsClick: () -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(
                title = "Profil",
                onBackClick = onBack,
                actions = {
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, "Ayarlar", tint = EvalonTextPrimary)
                    }
                }
            )
        },
        containerColor = EvalonDarkBg
    ) { padding ->
        if (state.isLoading) {
            EvalonLoadingState(modifier = Modifier.padding(padding))
        } else {
            state.profile?.let { profile ->
                LazyColumn(
                    modifier = Modifier.padding(padding).fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 24.dp)
                ) {
                    // Avatar & name
                    item {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.linearGradient(
                                            listOf(EvalonBlue, EvalonBlueDark)
                                        )
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = profile.avatarInitials,
                                    color = EvalonTextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 28.sp
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(profile.fullName, color = EvalonTextPrimary, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                            Text("@${profile.username}", color = EvalonTextSecondary, fontSize = 14.sp)
                            Text("Üye: ${profile.memberSince}", color = EvalonTextSecondary, fontSize = 12.sp)
                        }
                    }

                    // Stats cards
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            StatCard("Portföy", profile.portfolioValue, EvalonGreen, Modifier.weight(1f))
                            StatCard("Kazanma", "${String.format("%.1f", profile.winRate)}%", EvalonBlue, Modifier.weight(1f))
                            StatCard("İşlem", "${profile.totalTrades}", EvalonOrange, Modifier.weight(1f))
                        }
                    }

                    item { Spacer(modifier = Modifier.height(16.dp)) }

                    // Info section
                    item {
                        EvalonCard(modifier = Modifier.padding(horizontal = 16.dp)) {
                            ProfileInfoRow(Icons.Default.Email, "E-posta", profile.email)
                            HorizontalDivider(color = EvalonSurfaceVariant.copy(alpha = 0.3f), modifier = Modifier.padding(vertical = 8.dp))
                            ProfileInfoRow(Icons.Default.Shield, "Risk Toleransı", profile.riskTolerance)
                            HorizontalDivider(color = EvalonSurfaceVariant.copy(alpha = 0.3f), modifier = Modifier.padding(vertical = 8.dp))
                            ProfileInfoRow(Icons.Default.School, "Deneyim", profile.experience)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, accentColor: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    EvalonCard(modifier = modifier) {
        Text(label, color = EvalonTextSecondary, fontSize = 11.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, color = accentColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    }
}

@Composable
private fun ProfileInfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = EvalonBlue, modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, color = EvalonTextSecondary, fontSize = 12.sp)
            Text(value, color = EvalonTextPrimary, fontWeight = FontWeight.Medium, fontSize = 14.sp)
        }
    }
}
