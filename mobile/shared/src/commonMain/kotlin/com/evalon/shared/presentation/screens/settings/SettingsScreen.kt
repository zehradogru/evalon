package com.evalon.shared.presentation.screens.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.components.*
import com.evalon.shared.presentation.ui.theme.*

@Composable
fun SettingsScreen(
    component: SettingsComponent,
    viewModel: SettingsViewModel,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            EvalonTopBar(title = "Ayarlar", onBackClick = onBack)
        },
        containerColor = EvalonDarkBg
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            item { SectionHeader(title = "Genel") }

            item {
                SettingsToggleItem(
                    icon = Icons.Default.Notifications,
                    title = "Bildirimler",
                    subtitle = "Push bildirimleri al",
                    checked = state.notificationsEnabled,
                    onCheckedChange = { viewModel.toggleNotifications() }
                )
            }

            item {
                SettingsToggleItem(
                    icon = Icons.Default.Fingerprint,
                    title = "Biyometrik Giriş",
                    subtitle = "Parmak izi ile giriş",
                    checked = state.biometricEnabled,
                    onCheckedChange = { viewModel.toggleBiometric() }
                )
            }

            item { SectionHeader(title = "Tercihler") }

            item {
                SettingsInfoItem(
                    icon = Icons.Default.Language,
                    title = "Dil",
                    value = state.language
                )
            }

            item {
                SettingsInfoItem(
                    icon = Icons.Default.ShowChart,
                    title = "Varsayılan Borsa",
                    value = state.defaultExchange
                )
            }

            item { SectionHeader(title = "Hakkında") }

            item {
                SettingsInfoItem(
                    icon = Icons.Default.Info,
                    title = "Uygulama Sürümü",
                    value = state.appVersion
                )
            }

            item {
                SettingsNavItem(
                    icon = Icons.Default.Description,
                    title = "Gizlilik Politikası",
                    onClick = { }
                )
            }

            item {
                SettingsNavItem(
                    icon = Icons.Default.Gavel,
                    title = "Kullanım Koşulları",
                    onClick = { }
                )
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = { /* TODO: logout */ },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = EvalonRed.copy(alpha = 0.15f))
                ) {
                    Text("Çıkış Yap", color = EvalonRed, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun SettingsToggleItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = EvalonBlue, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = EvalonTextPrimary, fontWeight = FontWeight.Medium, fontSize = 15.sp)
            Text(subtitle, color = EvalonTextSecondary, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = EvalonTextPrimary,
                checkedTrackColor = EvalonBlue,
                uncheckedThumbColor = EvalonTextSecondary,
                uncheckedTrackColor = EvalonSurfaceVariant
            )
        )
    }
}

@Composable
private fun SettingsInfoItem(icon: ImageVector, title: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = EvalonBlue, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Text(title, color = EvalonTextPrimary, fontWeight = FontWeight.Medium, fontSize = 15.sp, modifier = Modifier.weight(1f))
        Text(value, color = EvalonTextSecondary, fontSize = 14.sp)
    }
}

@Composable
private fun SettingsNavItem(icon: ImageVector, title: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = EvalonBlue, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Text(title, color = EvalonTextPrimary, fontWeight = FontWeight.Medium, fontSize = 15.sp, modifier = Modifier.weight(1f))
        Icon(Icons.Default.ChevronRight, null, tint = EvalonTextSecondary, modifier = Modifier.size(20.dp))
    }
}
