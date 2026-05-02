package com.evalon.shared

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Help
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Paid
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlin.math.sqrt

@Composable
@Suppress("FunctionName")
fun App(
    authUiState: AuthUiState = AuthUiState(),
    onEmailSignInClick: (String, String) -> Unit = { _, _ -> },
    onEmailSignUpClick: (String, String) -> Unit = { _, _ -> },
    onPasswordResetClick: (String) -> Unit = {},
    onGoogleSignInClick: () -> Unit = {},
    onAppleSignInClick: () -> Unit = {},
    supportsAppleSignIn: Boolean = false,
    onPickAvatarClick: () -> Unit = {},
    onSignOutClick: () -> Unit = {}
) {
    MaterialTheme(
        colorScheme = evalonColorScheme(),
        typography = evalonTypography()
    ) {
        val productApi = remember { ProductApiClient() }
        var productSnapshot by remember { mutableStateOf(ProductSnapshot()) }
        var userData by remember { mutableStateOf(FirestoreUserData()) }
        var userDataLoading by remember { mutableStateOf(false) }
        var userDataError by remember { mutableStateOf<String?>(null) }
        var userDataRefreshNonce by remember { mutableStateOf(0) }
        var demoMode by remember { mutableStateOf(false) }
        var actionMessage by remember { mutableStateOf<String?>(null) }
        val scope = rememberCoroutineScope()
        val canEnterProduct = authUiState.isSignedIn || demoMode
        val hasFirestoreIdentity = !authUiState.uid.isNullOrBlank() && !authUiState.idToken.isNullOrBlank()
        val firebaseGateway = remember(
            authUiState.uid,
            authUiState.idToken,
            authUiState.displayName,
            authUiState.email
        ) {
            FirebaseRestGateway(
                uid = authUiState.uid,
                idToken = authUiState.idToken,
                displayName = authUiState.displayName,
                email = authUiState.email
            )
        }

        fun Throwable.toFirestoreUserFacingMessage(): String {
            val raw = message.orEmpty()
            return when {
                raw.contains("NSURLErrorDomain Code=-1005", ignoreCase = true) ||
                    raw.contains("The network connection was lost", ignoreCase = true) ->
                    "Firestore baglantisi gecici olarak kesildi. Veriler arka planda yeniden denenecek."
                raw.contains("timed out", ignoreCase = true) ->
                    "Firestore istegi zaman asimina ugradi."
                raw.isBlank() ->
                    "Firestore verileri okunamadi."
                else ->
                    raw.lineSequence().firstOrNull { it.isNotBlank() }?.take(160)
                        ?: "Firestore verileri okunamadi."
            }
        }

        LaunchedEffect(Unit) {
            productSnapshot = productApi.loadSnapshot()
        }

        LaunchedEffect(firebaseGateway, userDataRefreshNonce, canEnterProduct) {
            if (!canEnterProduct) {
                userData = FirestoreUserData()
                userDataError = null
                userDataLoading = false
                return@LaunchedEffect
            }
            userDataLoading = true
            userDataError = null
            runCatching {
                firebaseGateway.loadUserData()
            }.onSuccess {
                userData = it
            }.onFailure {
                userDataError = it.toFirestoreUserFacingMessage()
            }
            userDataLoading = false
        }

        DisposableEffect(Unit) {
            onDispose { productApi.close() }
        }

        DisposableEffect(firebaseGateway) {
            onDispose { firebaseGateway.close() }
        }

        fun runFirestoreAction(
            successMessage: String,
            action: suspend FirebaseRestGateway.() -> Unit
        ) {
            if (!hasFirestoreIdentity) {
                actionMessage = "Bu islem icin Firebase oturumu ve ID token gerekli."
                return
            }
            scope.launch {
                actionMessage = "Islem gonderiliyor..."
                val result = runCatching {
                    firebaseGateway.action()
                }
                actionMessage = result.fold(
                    onSuccess = {
                        userDataRefreshNonce += 1
                        successMessage
                    },
                    onFailure = { error ->
                        error.toFirestoreUserFacingMessage()
                    }
                )
            }
        }

        fun runFirestoreSettingsAction(settings: FirestoreSettings) {
            runFirestoreAction("Ayarlar Firestore'a kaydedildi.") {
                saveSettings(settings)
            }
        }

        fun runProfileSaveAction(displayName: String?, email: String?) {
            runFirestoreAction("Profil Firestore'a kaydedildi.") {
                saveProfile(displayName, email)
            }
        }

        fun runCommunityPostAction(body: String, ticker: String) {
            if (body.isBlank()) {
                actionMessage = "Post metni bos olamaz."
                return
            }
            runFirestoreAction("Community post Firestore'a yazildi.") {
                createCommunityPost(body.trim(), ticker.trim().uppercase().ifBlank { null })
            }
        }

        fun runPaperOrderAction(symbol: String, side: String, quantity: Double, orderType: String) {
            if (symbol.isBlank() || quantity <= 0.0) {
                actionMessage = "Gecerli ticker ve miktar girilmeli."
                return
            }
            runFirestoreAction("Paper order Firestore'a yazildi.") {
                createPaperOrder(
                    symbol = symbol.trim().uppercase(),
                    side = side.trim().lowercase(),
                    quantity = quantity,
                    orderType = orderType.trim().lowercase().ifBlank { "market" }
                )
            }
        }

        Surface(
            modifier = Modifier.fillMaxSize(),
            color = EvalonColors.Ink
        ) {
            if (canEnterProduct) {
                EvalonProductShell(
                    authUiState = authUiState,
                    isDemoMode = demoMode && !authUiState.isSignedIn,
                    productSnapshot = productSnapshot,
                    userData = userData,
                    userDataLoading = userDataLoading,
                    userDataError = userDataError,
                    actionMessage = actionMessage,
                    onAddWatchlist = { symbol ->
                        runFirestoreAction("$symbol watchlist'e eklendi.") { addWatchlist(symbol) }
                    },
                    onRemoveWatchlist = { symbol ->
                        runFirestoreAction("$symbol watchlist'ten cikarildi.") { removeWatchlist(symbol) }
                    },
                    onCreateCommunityPost = { body, ticker ->
                        runCommunityPostAction(body, ticker)
                    },
                    onLikePost = { postId ->
                        runFirestoreAction("Post begenisi Firestore'a yazildi.") { likePost(postId) }
                    },
                    onSavePost = { postId ->
                        runFirestoreAction("Post kaydi Firestore'a yazildi.") { savePost(postId) }
                    },
                    onReportPost = { postId ->
                        runFirestoreAction("Post raporu Firestore'a yazildi.") { reportPost(postId, "mobile_report") }
                    },
                    onCommentPost = { postId, body ->
                        runFirestoreAction("Yorum Firestore'a yazildi.") { addComment(postId, body) }
                    },
                    onSubmitPaperOrder = { symbol, side, quantity, orderType ->
                        runPaperOrderAction(symbol, side, quantity, orderType)
                    },
                    onResetPaperPortfolio = {
                        runFirestoreAction("Paper portfolio sifirlandi.") { resetPaperPortfolio() }
                    },
                    onSaveAiAsset = {
                        runFirestoreAction("AI asset Firestore'a kaydedildi.") {
                            saveAiAsset("strategy", "Mobile momentum guard", "{\"source\":\"mobile\"}")
                        }
                    },
                    onSaveProfile = ::runProfileSaveAction,
                    onSaveSettings = ::runFirestoreSettingsAction,
                    onPickAvatar = onPickAvatarClick,
                    onGoogleSignInClick = onGoogleSignInClick,
                    onSignOutClick = {
                        demoMode = false
                        onSignOutClick()
                    }
                )
            } else {
                LandingScreen(
                    authUiState = authUiState,
                    onEmailSignInClick = onEmailSignInClick,
                    onEmailSignUpClick = onEmailSignUpClick,
                    onPasswordResetClick = onPasswordResetClick,
                    onGoogleSignInClick = onGoogleSignInClick,
                    onExploreClick = { demoMode = true },
                    supportsAppleSignIn = supportsAppleSignIn,
                    onAppleSignInClick = onAppleSignInClick
                )
            }
        }
    }
}

@Composable
private fun EvalonProductShell(
    authUiState: AuthUiState,
    isDemoMode: Boolean,
    productSnapshot: ProductSnapshot,
    userData: FirestoreUserData,
    userDataLoading: Boolean,
    userDataError: String?,
    actionMessage: String?,
    onAddWatchlist: (String) -> Unit,
    onRemoveWatchlist: (String) -> Unit,
    onCreateCommunityPost: (String, String) -> Unit,
    onLikePost: (String) -> Unit,
    onSavePost: (String) -> Unit,
    onReportPost: (String) -> Unit,
    onCommentPost: (String, String) -> Unit,
    onSubmitPaperOrder: (String, String, Double, String) -> Unit,
    onResetPaperPortfolio: () -> Unit,
    onSaveAiAsset: () -> Unit,
    onSaveProfile: (String?, String?) -> Unit,
    onSaveSettings: (FirestoreSettings) -> Unit,
    onPickAvatar: () -> Unit,
    onGoogleSignInClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(MainTab.Home) }
    var selectedTicker by remember { mutableStateOf<MarketInstrument?>(null) }
    var moreDestination by remember { mutableStateOf<FeatureDestination?>(null) }
    var tradeDestination by remember { mutableStateOf<TradeDestination?>(null) }
    var aiOpened by remember { mutableStateOf(false) }
    val marketItems = productSnapshot.toMarketInstruments()
    val news = productSnapshot.toNewsItems()

    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            EvalonBottomBar(
                selectedTab = selectedTab,
                onTabSelected = {
                    selectedTab = it
                    selectedTicker = null
                    moreDestination = null
                    tradeDestination = null
                    aiOpened = false
                }
            )
        },
        floatingActionButton = {
            if (!aiOpened && selectedTicker == null && moreDestination == null) {
                FloatingActionButton(
                    onClick = { aiOpened = true },
                    containerColor = EvalonColors.Blue,
                    contentColor = Color.White
                ) {
                    Icon(Icons.Filled.SmartToy, contentDescription = "Evalon AI")
                }
            }
        }
    ) { padding ->
        AppBackground {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                when {
                    aiOpened -> EvalonAiScreen(
                        userId = authUiState.uid ?: "demo",
                        savedAssets = userData.aiAssets,
                        onBack = { aiOpened = false },
                        onSaveAiAsset = onSaveAiAsset
                    )
                    selectedTicker != null -> TickerDetailScreen(
                        instrument = selectedTicker ?: marketItems.first(),
                        onBack = { selectedTicker = null },
                        onAddWatchlist = onAddWatchlist
                    )
                    tradeDestination != null -> TradeDestinationScreen(
                        destination = tradeDestination ?: TradeDestination.Paper,
                        onBack = { tradeDestination = null },
                        userData = userData,
                        onSubmitPaperOrder = onSubmitPaperOrder,
                        onResetPaperPortfolio = onResetPaperPortfolio
                    )
                    moreDestination != null -> FeatureDestinationScreen(
                        destination = moreDestination ?: FeatureDestination.Screener,
                        authUiState = authUiState,
                        isDemoMode = isDemoMode,
                        productSnapshot = productSnapshot,
                        userData = userData,
                        userDataLoading = userDataLoading,
                        userDataError = userDataError,
                        onBack = { moreDestination = null },
                        onSaveProfile = onSaveProfile,
                        onSaveSettings = onSaveSettings,
                        onRemoveWatchlist = onRemoveWatchlist,
                        onPickAvatar = onPickAvatar,
                        onGoogleSignInClick = onGoogleSignInClick,
                        onSignOutClick = onSignOutClick
                    )
                    selectedTab == MainTab.Home -> HomeScreen(
                        authUiState = authUiState,
                        isDemoMode = isDemoMode,
                        productSnapshot = productSnapshot,
                        marketItems = marketItems,
                        news = news,
                        onTickerClick = { selectedTicker = it },
                        onAiClick = { aiOpened = true },
                        onTradeClick = { tradeDestination = it },
                        onFeatureClick = { moreDestination = it }
                    )
                    selectedTab == MainTab.Markets -> MarketsScreen(
                        productSnapshot = productSnapshot,
                        marketItems = marketItems,
                        onTickerClick = { selectedTicker = it },
                        onFeatureClick = { moreDestination = it }
                    )
                    selectedTab == MainTab.Trade -> TradeScreen(
                        userData = userData,
                        onDestinationClick = { tradeDestination = it }
                    )
                    selectedTab == MainTab.Community -> CommunityScreen(
                        posts = userData.communityPosts,
                        onCreatePost = onCreateCommunityPost,
                        onLikePost = onLikePost,
                        onSavePost = onSavePost,
                        onReportPost = onReportPost,
                        onCommentPost = onCommentPost,
                        onTickerClick = { symbol ->
                            selectedTicker = marketItems.firstOrNull { it.symbol == symbol }
                        }
                    )
                    selectedTab == MainTab.More -> MoreScreen(
                        authUiState = authUiState,
                        isDemoMode = isDemoMode,
                        onDestinationClick = { moreDestination = it },
                        onAiClick = { aiOpened = true },
                        onGoogleSignInClick = onGoogleSignInClick,
                        onSignOutClick = onSignOutClick
                    )
                }

                actionMessage?.let { message ->
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(20.dp)
                    ) {
                        StateBanner(
                            title = "Uygulama durumu",
                            body = message,
                            tone = if (message.contains("gerekli") || message.contains("tamamlanamadi")) Tone.Warning else Tone.Success
                        )
                    }
                }

                if (userDataLoading) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(20.dp)
                    ) {
                        StateBanner("Firestore", "Kullanici verileri senkronize ediliyor.", Tone.Info)
                    }
                }

                userDataError?.let { error ->
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(20.dp)
                    ) {
                        StateBanner("Firestore okuma hatasi", error, Tone.Warning)
                    }
                }
            }
        }
    }
}

@Composable
private fun LandingScreen(
    authUiState: AuthUiState,
    onEmailSignInClick: (String, String) -> Unit,
    onEmailSignUpClick: (String, String) -> Unit,
    onPasswordResetClick: (String) -> Unit,
    onGoogleSignInClick: () -> Unit,
    onExploreClick: () -> Unit,
    supportsAppleSignIn: Boolean,
    onAppleSignInClick: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var createAccountMode by remember { mutableStateOf(false) }

    AppBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BrandLockup()
                    StatusPill("Sadece BIST", EvalonColors.Blue.copy(alpha = 0.16f), EvalonColors.Blue)
                }
            }

            item {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    padding = 24.dp
                ) {
                    Text(
                        text = "Evalon",
                        style = MaterialTheme.typography.displaySmall,
                        color = Color.White
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "AI destekli piyasa kokpiti, strateji laboratuvari ve sanal portfoy tek mobil deneyimde.",
                        style = MaterialTheme.typography.titleMedium,
                        color = EvalonColors.TextMuted
                    )
                    Spacer(Modifier.height(24.dp))
                    SparklineChart(
                        values = listOf(41f, 45f, 43f, 52f, 50f, 58f, 62f, 60f, 68f, 74f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(150.dp)
                    )
                    Spacer(Modifier.height(22.dp))
                    Text(
                        text = "Web hesabindaki email/sifre ile ayni Firebase Auth oturumunu kullan.",
                        color = EvalonColors.TextMuted,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Email") },
                        singleLine = true
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Sifre") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation()
                    )
                    Spacer(Modifier.height(12.dp))
                    if (authUiState.isLoading) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = EvalonColors.Blue,
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(12.dp))
                            Text("Oturum islemi suruyor", color = EvalonColors.TextMuted)
                        }
                    } else {
                        PrimaryButton(
                            text = if (createAccountMode) "Email ile hesap olustur" else "Email ile giris yap",
                            icon = Icons.Filled.Login,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                if (createAccountMode) {
                                    onEmailSignUpClick(email, password)
                                } else {
                                    onEmailSignInClick(email, password)
                                }
                            }
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = { createAccountMode = !createAccountMode }) {
                                Text(if (createAccountMode) "Zaten hesabim var" else "Yeni hesap olustur")
                            }
                            TextButton(onClick = { onPasswordResetClick(email) }) {
                                Text("Sifremi unuttum")
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            HorizontalDivider(modifier = Modifier.weight(1f), color = EvalonColors.CardStroke)
                            Text("  veya  ", color = EvalonColors.TextMuted, style = MaterialTheme.typography.labelSmall)
                            HorizontalDivider(modifier = Modifier.weight(1f), color = EvalonColors.CardStroke)
                        }
                        Spacer(Modifier.height(12.dp))
                        PrimaryButton(
                            text = "Google ile devam et",
                            icon = Icons.Filled.Login,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = onGoogleSignInClick
                        )
                        if (supportsAppleSignIn) {
                            Spacer(Modifier.height(10.dp))
                            OutlinedButton(
                                onClick = onAppleSignInClick,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                            ) {
                                Icon(Icons.Filled.Security, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Apple ile devam et")
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = onExploreClick,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                        ) {
                            Text("Uygulamayi kesfet")
                        }
                    }
                    authUiState.infoMessage?.let {
                        Spacer(Modifier.height(12.dp))
                        StateBanner(
                            title = "Oturum",
                            body = it,
                            tone = Tone.Success
                        )
                    }
                    authUiState.errorMessage?.let {
                        Spacer(Modifier.height(12.dp))
                        StateBanner(
                            title = "Oturum acilamadi",
                            body = it,
                            tone = Tone.Error
                        )
                    }
                }
            }

            item {
                SectionHeader("Web parity kapsamı", "Tum ana web route'lari mobil karsiliklariyla paketlendi")
            }

            items(landingFeatures) { feature ->
                FeaturePreviewRow(feature)
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MiniMetric("19+", "Mobil ekran", Modifier.weight(1f))
                    MiniMetric("5", "Ana tab", Modifier.weight(1f))
                    MiniMetric("48dp", "Touch hedef", Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(
    authUiState: AuthUiState,
    isDemoMode: Boolean,
    productSnapshot: ProductSnapshot,
    marketItems: List<MarketInstrument>,
    news: List<NewsItem>,
    onTickerClick: (MarketInstrument) -> Unit,
    onAiClick: () -> Unit,
    onTradeClick: (TradeDestination) -> Unit,
    onFeatureClick: (FeatureDestination) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            HomeTopBar(
                authUiState = authUiState,
                isDemoMode = isDemoMode,
                onAiClick = onAiClick
            )
        }

        if (productSnapshot.errorMessage != null) {
            item {
                StateBanner(
                    title = "Canli veri kismen kullanilamiyor",
                    body = productSnapshot.errorMessage,
                    tone = Tone.Warning
                )
            }
        }

        item {
            GlassCard(padding = 20.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(Modifier.weight(1f)) {
                        StatusPill("BIST acik", EvalonColors.Green.copy(alpha = 0.14f), EvalonColors.Green)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "Piyasa kokpiti",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White
                        )
                        Text(
                            "Watchlist, haber, AI icgoru ve sanal portfoy tek ekranda.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = EvalonColors.TextMuted
                        )
                    }
                    MiniMetric("+2.41%", "Gunluk P/L", Modifier.width(108.dp), positive = true)
                }
                Spacer(Modifier.height(18.dp))
                    SparklineChart(
                        values = listOf(48f, 44f, 46f, 53f, 58f, 55f, 61f, 68f, 66f, 73f, 78f),
                        modifier = Modifier
                        .fillMaxWidth()
                        .height(144.dp)
                )
            }
        }

        item {
            SectionHeader("Watchlist", "Canli fiyat yoksa stale veri acikca etiketlenir")
            if (marketItems.isEmpty()) {
                StateBanner("Market listesi bos", "Backend market listesi donmedigi icin sahte watchlist karti gosterilmiyor.", Tone.Warning)
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(marketItems.take(6)) { item ->
                        MarketCard(item, width = 184.dp, onClick = { onTickerClick(item) })
                    }
                }
            }
        }

        item {
            TwoColumnActions(
                leftTitle = "Evalon AI",
                leftBody = "Ticker, indikator ve strateji baglamiyla sohbet et.",
                leftIcon = Icons.Filled.SmartToy,
                leftClick = onAiClick,
                rightTitle = "Paper Trade",
                rightBody = "Emir gir, pozisyon izle, leaderboard'a cik.",
                rightIcon = Icons.Filled.AccountBalanceWallet,
                rightClick = { onTradeClick(TradeDestination.Paper) }
            )
        }

        item {
            SectionHeader("Hizli araclar", "Webdeki dashboard widget'lari mobil kartlara tasindi")
            ActionGrid(
                actions = listOf(
                    QuickAction("Screener", Icons.Filled.Search) { onFeatureClick(FeatureDestination.Screener) },
                    QuickAction("News", Icons.Filled.Newspaper) { onFeatureClick(FeatureDestination.News) },
                    QuickAction("Calendar", Icons.Filled.CalendarMonth) { onFeatureClick(FeatureDestination.Calendar) },
                    QuickAction("Movers", Icons.Filled.TrendingUp) { onFeatureClick(FeatureDestination.Movers) }
                )
            )
        }

        item {
            SectionHeader("Movers", "En cok yukselen ve dusenler")
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val movers = productSnapshot.toMovers(marketItems)
                if (movers.isEmpty()) {
                    StateBanner("Movers bos", "Canli degisim verisi olmadan sahte mover listesi gosterilmiyor.", Tone.Info)
                } else {
                    movers.forEach { MarketListRow(it, onClick = { onTickerClick(it) }) }
                }
            }
        }

        item {
            SectionHeader("Haber akis", "Sonsuz scroll yerine mobilde once en kritik haberler")
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (news.isEmpty()) {
                    StateBanner("Haber yok", "Backend /v1/news cevabi bos veya alinamadi.", Tone.Info)
                } else {
                    news.take(3).forEach { NewsRow(it) }
                }
            }
        }
    }
}

@Composable
private fun MarketsScreen(
    productSnapshot: ProductSnapshot,
    marketItems: List<MarketInstrument>,
    onTickerClick: (MarketInstrument) -> Unit,
    onFeatureClick: (FeatureDestination) -> Unit
) {
    var selectedMarket by remember { mutableStateOf("BIST") }
    var query by remember { mutableStateOf("") }
    val overviewCards = productSnapshot.overview?.cards.orEmpty()
    val filtered = remember(selectedMarket, query, marketItems) {
        marketItems.filter {
            (selectedMarket == "Tum" || it.market == selectedMarket) &&
                (query.isBlank() || it.symbol.contains(query, true) || it.name.contains(query, true))
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            PageTitle(
                title = "Markets",
                subtitle = "BIST listeleri; detay, grafik ve indikatorlere gecis."
            )
        }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Ticker veya sirket ara") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true
            )
        }
        item {
            SegmentRow(
                items = listOf("BIST", "Tum"),
                selected = selectedMarket,
                onSelected = { selectedMarket = it }
            )
        }
        if (overviewCards.isNotEmpty()) {
            items(overviewCards.chunked(2)) { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEach { card ->
                        OverviewTile(
                            title = card.label,
                            value = card.value?.let { formatOverviewValue(card.currency, it) } ?: "--",
                            change = card.changePct?.let(::signedPercent) ?: "stale",
                            positive = (card.changePct ?: 0.0) >= 0.0,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    if (row.size == 1) {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        } else {
            item {
                StateBanner(
                    title = "Market overview bekleniyor",
                    body = "Cloud backend /v1/market-overview endpoint'i donmedigi icin sahte endeks degeri gosterilmiyor.",
                    tone = Tone.Warning
                )
            }
        }
        item {
            TwoColumnActions(
                leftTitle = "Movers",
                leftBody = "Top gainers/losers sekmeleri.",
                leftIcon = Icons.Filled.TrendingUp,
                leftClick = { onFeatureClick(FeatureDestination.Movers) },
                rightTitle = "Screener",
                rightBody = "Teknik filtre ve preset taramalari.",
                rightIcon = Icons.Filled.Search,
                rightClick = { onFeatureClick(FeatureDestination.Screener) }
            )
        }
        items(filtered) { item ->
            MarketListRow(item, onClick = { onTickerClick(item) })
        }
        if (filtered.isEmpty()) {
            item {
                StateBanner(
                    title = "Sonuc yok",
                    body = "Canli market listesinde bu filtreye uyan sembol bulunamadi.",
                    tone = Tone.Info
                )
            }
        }
    }
}

@Composable
private fun TickerDetailScreen(
    instrument: MarketInstrument,
    onBack: () -> Unit,
    onAddWatchlist: (String) -> Unit
) {
    var chartOpen by remember { mutableStateOf(false) }
    val chartUrl = remember(instrument.symbol) {
        buildEvalonGraphUrl(
            symbol = instrument.symbol,
            timeframe = "1d",
            page = EvalonGraphPage.Chart
        )
    }

    if (chartOpen) {
        LandscapeChartScreen(
            title = "${instrument.symbol} Chart",
            subtitle = "Fullscreen chart",
            url = chartUrl,
            onBack = { chartOpen = false }
        )
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            DetailTopBar(title = instrument.symbol, subtitle = instrument.name, onBack = onBack)
        }
        item {
            GlassCard(padding = 20.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column {
                        Text(
                            instrument.price,
                            style = MaterialTheme.typography.displaySmall,
                            color = Color.White
                        )
                        Text(instrument.market, style = MaterialTheme.typography.bodyMedium, color = EvalonColors.TextMuted)
                    }
                    PriceChange(change = instrument.change, positive = instrument.positive)
                }
                Spacer(Modifier.height(18.dp))
                PlatformWebPage(
                    url = chartUrl,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(22.dp))
                )
                Spacer(Modifier.height(10.dp))
                StateBanner("Canli chart", "Hisse detayi artik graph-web Cloud Run uzerinden yukleniyor.", Tone.Info)
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PrimaryButton(
                        text = "Watchlist",
                        icon = Icons.Filled.Add,
                        modifier = Modifier.weight(1f),
                        onClick = { onAddWatchlist(instrument.symbol) }
                    )
                    OutlinedButton(
                        onClick = { chartOpen = true },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                    ) {
                        Icon(Icons.Filled.Visibility, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Fullscreen")
                    }
                }
            }
        }
        item {
            SectionHeader("Indicator panel", "Webdeki indikator bottom sheet mobil karta donustu")
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                IndicatorRow("RSI 14", "58.4", "Neutral", Tone.Info)
                IndicatorRow("MACD", "+0.41", "Bullish cross", Tone.Success)
                IndicatorRow("EMA 20/50", "Above", "Trend positive", Tone.Success)
                IndicatorRow("ATR", "2.7%", "Volatility rising", Tone.Warning)
            }
        }
        item {
            SectionHeader("Stats", "Piyasa detayi")
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MiniMetric("1.8M", "Hacim", Modifier.weight(1f))
                MiniMetric("13.2", "F/K", Modifier.weight(1f))
                MiniMetric("4.1%", "Beta", Modifier.weight(1f))
            }
        }
        item {
            StateBanner(
                title = "Chart WebView bridge",
                body = "/markets/[ticker]/chart mobilde iOS WKWebView ve Android WebView ile fullscreen acilacak sekilde ayrildi.",
                tone = Tone.Info
            )
        }
    }
}

@Composable
private fun TradeScreen(
    userData: FirestoreUserData,
    onDestinationClick: (TradeDestination) -> Unit
) {
    val portfolio = userData.paperPortfolio
    val latestOrders = userData.paperOrders.take(3)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            PageTitle(
                title = "Trade",
                subtitle = "Paper portfolio, backtest, strategy workspace, leaderboard, time machine ve P/L calculator."
            )
        }
        item {
            GlassCard(padding = 20.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column {
                        Text("Virtual portfolio", style = MaterialTheme.typography.titleLarge, color = Color.White)
                        Text(
                            portfolio?.let { formatMoney(it.totalValue) } ?: "--",
                            style = MaterialTheme.typography.displaySmall,
                            color = Color.White
                        )
                        Text(
                            portfolio?.let { "Cash ${formatMoney(it.cash)}" } ?: "Portfoyu baslatmak icin emir gir veya resetle.",
                            color = if (portfolio == null) EvalonColors.TextMuted else EvalonColors.Green
                        )
                    }
                    StatusPill("Live sim", EvalonColors.Blue.copy(alpha = 0.16f), EvalonColors.Blue)
                }
                Spacer(Modifier.height(18.dp))
                if (portfolio != null) {
                    MiniMetric(formatMoney(portfolio.cash), "Cash", Modifier.fillMaxWidth(), positive = true)
                } else {
                    StateBanner("Paper portfolio", "Firestore'da portfoy bulunamadi; ilk emir veya reset yeni portfoy olusturur.", Tone.Info)
                }
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PrimaryButton("Emir gir", Icons.Filled.Add, Modifier.weight(1f)) {
                        onDestinationClick(TradeDestination.Paper)
                    }
                    OutlinedButton(
                        onClick = { onDestinationClick(TradeDestination.Leaderboard) },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                    ) {
                        Text("Leaderboard")
                    }
                }
            }
        }
        item {
            ActionGrid(
                actions = tradeDestinations.map {
                    QuickAction(it.title, it.icon) { onDestinationClick(it) }
                }
            )
        }
        item {
            SectionHeader("Acik pozisyonlar", "Order entry ve history web parity")
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (latestOrders.isEmpty()) {
                    StateBanner("Emir yok", "Firestore paper_orders bos. Emir girildiginde burada canli history gosterilir.", Tone.Info)
                } else {
                    latestOrders.forEach { order ->
                        PositionRow(
                            symbol = order.symbol,
                            size = "${order.quantity} ${order.side.uppercase()}",
                            pnl = order.status,
                            positive = !order.side.equals("sell", true)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TradeDestinationScreen(
    destination: TradeDestination,
    onBack: () -> Unit,
    userData: FirestoreUserData,
    onSubmitPaperOrder: (String, String, Double, String) -> Unit,
    onResetPaperPortfolio: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            DetailTopBar(title = destination.title, subtitle = destination.subtitle, onBack = onBack)
        }
        when (destination) {
            TradeDestination.Paper -> {
                item { PaperTradePanel(userData.paperPortfolio, onSubmitPaperOrder, onResetPaperPortfolio) }
                item { OrderHistoryPanel(userData.paperOrders) }
            }
            TradeDestination.Backtest -> {
                item { BacktestStudioPanel() }
            }
            TradeDestination.Strategy -> {
                item { StrategyWorkspacePanel() }
            }
            TradeDestination.Leaderboard -> {
                val rows = userData.paperLeaderboard.mapIndexed { index, entry ->
                    LeaderboardEntry(
                        rank = index + 1,
                        name = entry.displayName,
                        strategy = "${entry.totalTrades} trades / win ${signedPercent(entry.winRate)}",
                        returnPct = signedPercent(entry.totalPnLPercent)
                    )
                }
                if (rows.isEmpty()) {
                    item {
                        StateBanner(
                            title = "Leaderboard bos",
                            body = "Firestore paper_leaderboard koleksiyonunda kayit yok. Paper trade emri sonrasi kullanici entry'si yazilir.",
                            tone = Tone.Info
                        )
                    }
                } else {
                    items(rows) { LeaderboardRow(it) }
                }
            }
            TradeDestination.TimeMachine -> {
                item { TimeMachinePanel() }
            }
            TradeDestination.ProfitLoss -> {
                item { ProfitLossPanel() }
            }
        }
    }
}

@Composable
private fun CommunityScreen(
    posts: List<FirestoreCommunityPost>,
    onCreatePost: (String, String) -> Unit,
    onLikePost: (String) -> Unit,
    onSavePost: (String) -> Unit,
    onReportPost: (String) -> Unit,
    onCommentPost: (String, String) -> Unit,
    onTickerClick: (String) -> Unit
) {
    var filter by remember { mutableStateOf("Tum") }
    var draftBody by remember { mutableStateOf("") }
    var draftTicker by remember { mutableStateOf("THYAO") }
    val commentDrafts = remember { mutableStateMapOf<String, String>() }
    val renderedPosts = posts.toCommunityPosts()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            PageTitle(
                title = "Community",
                subtitle = "Feed, post detayi, yorum, gorsel yukleme, like/save/report ve sahip aksiyonlari."
            )
        }
        item {
            GlassCard(padding = 16.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar("EY")
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Piyasa fikrini paylas", color = Color.White, fontWeight = FontWeight.SemiBold)
                        Text("Ticker, gorsel ve strateji asset'i ekle", color = EvalonColors.TextMuted)
                    }
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = draftTicker,
                    onValueChange = { draftTicker = it.uppercase() },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Ticker") }
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = draftBody,
                    onValueChange = { draftBody = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    label = { Text("Post") }
                )
                Spacer(Modifier.height(12.dp))
                PrimaryButton(
                    text = "Post yayinla",
                    icon = Icons.Filled.Add,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        onCreatePost(draftBody, draftTicker)
                        draftBody = ""
                    }
                )
            }
        }
        item {
            SegmentRow(
                items = listOf("Tum", "BIST", "Kaydedilen"),
                selected = filter,
                onSelected = { filter = it }
            )
        }
        val filteredPosts = renderedPosts.filter {
            when (filter) {
                "Tum" -> true
                "Kaydedilen" -> it.saved
                else -> it.market == filter
            }
        }
        if (filteredPosts.isEmpty()) {
            item {
                StateBanner(
                    title = "Community feed bos",
                    body = "Web community koleksiyonunda bu filtreye uygun post yok.",
                    tone = Tone.Info
                )
            }
        }
        items(filteredPosts) { post ->
            CommunityPostCard(
                post = post,
                onTickerClick = onTickerClick,
                onLike = { onLikePost(post.id) },
                onSave = { onSavePost(post.id) },
                onCommentDraft = commentDrafts[post.id].orEmpty(),
                onCommentDraftChange = { commentDrafts[post.id] = it },
                onComment = {
                    val body = commentDrafts[post.id].orEmpty().trim()
                    if (body.isNotBlank()) {
                        onCommentPost(post.id, body)
                        commentDrafts[post.id] = ""
                    }
                },
                onReport = { onReportPost(post.id) }
            )
        }
    }
}

@Composable
private fun MoreScreen(
    authUiState: AuthUiState,
    isDemoMode: Boolean,
    onDestinationClick: (FeatureDestination) -> Unit,
    onAiClick: () -> Unit,
    onGoogleSignInClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            PageTitle(
                title = "More",
                subtitle = "Webdeki tum ek sayfalar, araclar, hesap ve legal akislar."
            )
        }
        item {
            AccountCard(
                authUiState = authUiState,
                isDemoMode = isDemoMode,
                onGoogleSignInClick = onGoogleSignInClick,
                onSignOutClick = onSignOutClick
            )
        }
        item {
            GlassCard(padding = 16.dp, onClick = onAiClick) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Filled.SmartToy, EvalonColors.Blue)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Evalon AI", color = Color.White, fontWeight = FontWeight.SemiBold)
                        Text("Chat sessions, tool context ve kayitli asset'ler.", color = EvalonColors.TextMuted)
                    }
                    Text("Ac", color = EvalonColors.Blue, fontWeight = FontWeight.Bold)
                }
            }
        }
        item { DestinationGroup("Trading lab", FeatureDestination.tradingTools, onDestinationClick) }
        item { DestinationGroup("Market workspace", FeatureDestination.marketTools, onDestinationClick) }
        item { DestinationGroup("Education & brokers", FeatureDestination.learning, onDestinationClick) }
        item { DestinationGroup("Account & legal", FeatureDestination.accountLegal, onDestinationClick) }
    }
}

@Composable
private fun FeatureDestinationScreen(
    destination: FeatureDestination,
    authUiState: AuthUiState,
    isDemoMode: Boolean,
    productSnapshot: ProductSnapshot,
    userData: FirestoreUserData,
    userDataLoading: Boolean,
    userDataError: String?,
    onBack: () -> Unit,
    onSaveProfile: (String?, String?) -> Unit,
    onSaveSettings: (FirestoreSettings) -> Unit,
    onRemoveWatchlist: (String) -> Unit,
    onPickAvatar: () -> Unit,
    onGoogleSignInClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    val marketItems = productSnapshot.toMarketInstruments()
    val news = productSnapshot.toNewsItems()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            DetailTopBar(title = destination.title, subtitle = destination.subtitle, onBack = onBack)
        }
        when (destination) {
            FeatureDestination.Screener -> {
                item { ScreenerPanel() }
            }
            FeatureDestination.Analysis -> item {
                StateBanner(
                    "Indicator Lab kaldirildi",
                    "Bu arac webden kaldirildigi icin mobil menuden de kaldirildi.",
                    Tone.Info
                )
            }
            FeatureDestination.Correlation -> item { CorrelationPanel() }
            FeatureDestination.Watchlist -> item {
                WatchlistPanel(
                    watchlistSymbols = userData.watchlistSymbols,
                    marketItems = marketItems,
                    loading = userDataLoading,
                    error = userDataError,
                    onRemove = onRemoveWatchlist
                )
            }
            FeatureDestination.News -> {
                if (news.isEmpty()) {
                    item { StateBanner("Haber yok", "Backend /v1/news cevabi bos veya alinamadi.", Tone.Info) }
                } else {
                    items(news) { NewsRow(it) }
                }
            }
            FeatureDestination.Calendar -> item { CalendarPanel() }
            FeatureDestination.Movers -> {
                val movers = productSnapshot.toMovers(marketItems)
                if (movers.isEmpty()) {
                    item { StateBanner("Movers bos", "Canli degisim verisi olmadan sahte mover listesi gosterilmiyor.", Tone.Info) }
                } else {
                    items(movers) { MarketListRow(it, onClick = {}) }
                }
            }
            FeatureDestination.Academy -> item { AcademyPanel() }
            FeatureDestination.Brokers -> item { BrokersPanel() }
            FeatureDestination.Pricing -> item { PricingPanel() }
            FeatureDestination.Profile -> item {
                ProfilePanel(
                    authUiState = authUiState,
                    isDemoMode = isDemoMode,
                    onSaveProfile = onSaveProfile,
                    onPickAvatar = onPickAvatar,
                    onGoogleSignInClick = onGoogleSignInClick,
                    onSignOutClick = onSignOutClick
                )
            }
            FeatureDestination.Settings -> item {
                SettingsPanel(
                    settings = userData.settings,
                    onSaveSettings = onSaveSettings
                )
            }
            FeatureDestination.Help -> item { HelpPanel() }
            FeatureDestination.Privacy -> item { LegalPanel("Privacy", privacyBullets) }
            FeatureDestination.Terms -> item { LegalPanel("Terms", termsBullets) }
        }
    }
}

@Composable
private fun EvalonAiScreen(
    userId: String,
    savedAssets: List<FirestoreAiAsset>,
    onBack: () -> Unit,
    onSaveAiAsset: () -> Unit
) {
    var prompt by remember { mutableStateOf("") }
    var sessionId by remember { mutableStateOf<String?>(null) }
    var messages by remember {
        mutableStateOf(
            listOf(
                AiChatMessage(
                    fromUser = false,
                    content = "Ticker, indikator, backtest veya rule set istegini yaz. Web AI endpointleriyle ayni oturum uzerinden calisirim."
                )
            )
        )
    }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val api = remember { ProductApiClient() }
    val scope = rememberCoroutineScope()
    val effectiveUserId = userId.ifBlank { "mobile_user" }

    fun submitMessage(raw: String) {
        val text = raw.trim()
        if (text.isBlank() || loading) return
        prompt = ""
        loading = true
        error = null
        messages = messages + AiChatMessage(fromUser = true, content = text)
        scope.launch {
            runCatching {
                val activeSession = sessionId ?: api.createAiSession(
                    userId = effectiveUserId,
                    title = "Mobile AI"
                ).also { sessionId = it }
                api.sendAiMessage(activeSession, text, effectiveUserId)
            }.onSuccess { reply ->
                sessionId = reply.sessionId
                val meta = buildString {
                    if (reply.toolResultsCount > 0) append("Tool: ${reply.toolResultsCount}. ")
                    if (reply.savedAssetsCount > 0) append("Saved assets: ${reply.savedAssetsCount}.")
                }.trim()
                messages = messages + AiChatMessage(
                    fromUser = false,
                    content = if (meta.isBlank()) reply.content else "${reply.content}\n\n$meta"
                )
            }.onFailure {
                error = it.toProductUserFacingMessage("AI mesaji gonderilemedi.")
            }
            loading = false
        }
    }

    DisposableEffect(Unit) {
        onDispose { api.close() }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            DetailTopBar(
                title = "Evalon AI",
                subtitle = "Chat sessions, tool context ve saved assets.",
                onBack = onBack
            )
        }
        item {
            GlassCard(padding = 16.dp) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MiniMetric(sessionId?.take(8) ?: "new", "Session", Modifier.weight(1f), positive = sessionId != null)
                    MiniMetric(savedAssets.size.toString(), "Saved assets", Modifier.weight(1f), positive = savedAssets.isNotEmpty())
                }
                Spacer(Modifier.height(12.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(
                        listOf(
                            "Suggest Strategy",
                            "Run Backtest",
                            "Indicator Analysis",
                            "Rule Set"
                        )
                    ) { chip ->
                        AssistChip(
                            onClick = { submitMessage(chip) },
                            label = { Text(chip) }
                        )
                    }
                }
            }
        }
        items(messages) { message ->
            AiMessageBubble(message)
        }
        if (loading) {
            item { StateBanner("Evalon AI", "Mesaj backend AI endpoint'ine gonderiliyor.", Tone.Info) }
        }
        error?.let {
            item { StateBanner("AI hatasi", it, Tone.Warning) }
        }
        item {
            GlassCard(padding = 16.dp) {
                OutlinedTextField(
                    value = prompt,
                    onValueChange = { prompt = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    label = { Text("Mesaj") }
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PrimaryButton(
                        text = if (loading) "Gonderiliyor" else "Gonder",
                        icon = Icons.Filled.AutoAwesome,
                        modifier = Modifier.weight(1f),
                        onClick = { submitMessage(prompt) }
                    )
                    OutlinedButton(
                        onClick = onSaveAiAsset,
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                    ) {
                        Text("Asset kaydet")
                    }
                }
            }
        }
    }
}

@Composable
private fun PaperTradePanel(
    portfolio: FirestorePaperPortfolio?,
    onSubmitPaperOrder: (String, String, Double, String) -> Unit,
    onResetPaperPortfolio: () -> Unit
) {
    var side by remember { mutableStateOf("Buy") }
    var symbol by remember { mutableStateOf("THYAO") }
    var quantity by remember { mutableStateOf("25") }
    var orderType by remember { mutableStateOf("Market") }

    GlassCard(padding = 18.dp) {
        Text("Order entry", style = MaterialTheme.typography.titleLarge, color = Color.White)
        portfolio?.let {
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MiniMetric(formatMoney(it.cash), "Cash", Modifier.weight(1f))
                MiniMetric(formatMoney(it.totalValue), "Total value", Modifier.weight(1f), positive = it.totalValue >= it.cash)
            }
        }
        Spacer(Modifier.height(12.dp))
        SegmentRow(listOf("Buy", "Sell"), side) { side = it }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = symbol,
                onValueChange = { symbol = it.uppercase() },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Ticker") }
            )
            OutlinedTextField(
                value = quantity,
                onValueChange = { quantity = it },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Qty") }
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = orderType,
                onValueChange = { orderType = it },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Type") }
            )
            InputShell("Risk", "2.0%", Modifier.weight(1f))
        }
        Spacer(Modifier.height(14.dp))
        PrimaryButton("Emri simule et", Icons.Filled.PlayArrow, Modifier.fillMaxWidth()) {
            onSubmitPaperOrder(symbol, side, quantity.toDoubleOrNull() ?: 0.0, orderType)
        }
        Spacer(Modifier.height(10.dp))
        OutlinedButton(
            onClick = onResetPaperPortfolio,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
        ) {
            Text("Portfoyu sifirla")
        }
    }
}

@Composable
private fun OrderHistoryPanel(orders: List<FirestorePaperOrder>) {
    GlassCard(padding = 18.dp) {
        Text("Positions & history", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Spacer(Modifier.height(12.dp))
        if (orders.isEmpty()) {
            StateBanner("Emir yok", "Paper order gonderildiginde Firestore history burada listelenir.", Tone.Info)
        } else {
            orders.take(8).forEach { order ->
                val size = "${order.quantity} ${order.side.uppercase()} / ${order.orderType}"
                PositionRow(order.symbol, size, order.status, order.side.equals("buy", true))
            }
        }
    }
}

@Composable
private fun BacktestStudioPanel() {
    var result by remember { mutableStateOf<BacktestRunResult?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var runNonce by remember { mutableStateOf(0) }
    val api = remember { ProductApiClient() }

    LaunchedEffect(runNonce) {
        loading = true
        error = null
        runCatching { api.runBacktestNow() }
            .onSuccess { result = it }
            .onFailure { error = it.toProductUserFacingMessage("Backtest baslatilamadi.") }
        loading = false
    }

    DisposableEffect(Unit) {
        onDispose { api.close() }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GlassCard(padding = 18.dp) {
            Text("Backtest Studio", style = MaterialTheme.typography.titleLarge, color = Color.White)
            Text("Mobilde direkt /v1/backtests/run calisir ve sonucu burada gosterir.", color = EvalonColors.TextMuted)
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MiniMetric("THYAO", "Symbol", Modifier.weight(1f), positive = true)
                MiniMetric("180d", "Window", Modifier.weight(1f))
                MiniMetric("Long", "Mode", Modifier.weight(1f), positive = true)
            }
            Spacer(Modifier.height(14.dp))
            PrimaryButton("Backtest'i tekrar calistir", Icons.Filled.PlayArrow, Modifier.fillMaxWidth()) {
                if (!loading) runNonce += 1
            }
        }
        when {
            loading -> StateBanner("Backtest", "Backend /v1/backtests/run sonucu bekleniyor.", Tone.Info)
            error != null -> StateBanner("Backtest hatasi", error ?: "", Tone.Warning)
            result != null -> BacktestResultPanel(result)
        }
    }
}

@Composable
private fun BacktestResultPanel(result: BacktestRunResult?) {
    GlassCard(padding = 18.dp) {
        result?.let {
            StateBanner(
                title = "Run ${it.runId.take(14)}",
                body = "${it.status} / ${it.eventsCount} event. ${it.message}",
                tone = Tone.Success
            )
            Spacer(Modifier.height(14.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MiniMetric(result?.totalReturnPct?.let(::signedPercent) ?: "pending", "Return", Modifier.weight(1f), positive = (result?.totalReturnPct ?: 0.0) >= 0.0)
            MiniMetric(result?.maxDrawdownPct?.let(::signedPercent) ?: "pending", "Max DD", Modifier.weight(1f), positive = false)
            MiniMetric(result?.totalTrades?.toString() ?: "0", "Trades", Modifier.weight(1f))
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MiniMetric(result?.winRate?.let(::signedPercent) ?: "pending", "Win rate", Modifier.weight(1f), positive = (result?.winRate ?: 0.0) >= 0.0)
            MiniMetric(result?.finalBalance?.let(::formatMoney) ?: "pending", "Final", Modifier.weight(1f), positive = true)
            MiniMetric(result?.status ?: "ready", "Status", Modifier.weight(1f))
        }
        Spacer(Modifier.height(14.dp))
        if (!result?.equityCurve.isNullOrEmpty()) {
            SparklineChart(
                values = result?.equityCurve.orEmpty(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(124.dp)
            )
        } else {
            StateBanner("Equity curve", "Backend sonucu portfoy curve dondurmediyse sahte grafik gosterilmiyor.", Tone.Info)
        }
    }
}

@Composable
private fun StrategyWorkspacePanel() {
    var result by remember { mutableStateOf<BacktestRunResult?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { ProductApiClient() }

    DisposableEffect(Unit) {
        onDispose { api.close() }
    }

    GlassCard(padding = 18.dp) {
        Text("Strategy Workspace", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text("Editable JSON blueprint, AI saved assets ve 'open in backtest' akisi.", color = EvalonColors.TextMuted)
        Spacer(Modifier.height(14.dp))
        CodeBlock(
            """
            {
              "universe": "BIST30",
              "entry": "ema_20 crosses ema_50",
              "risk": { "atrStop": 2.2 }
            }
            """.trimIndent()
        )
        Spacer(Modifier.height(14.dp))
        PrimaryButton("Backtest'e ac", Icons.Filled.PlayArrow, Modifier.fillMaxWidth()) {
            if (loading) return@PrimaryButton
            loading = true
            error = null
            scope.launch {
                runCatching { api.runBacktestNow() }
                    .onSuccess { result = it }
                    .onFailure { error = it.toProductUserFacingMessage("Strategy backtest calismadi.") }
                loading = false
            }
        }
        Spacer(Modifier.height(12.dp))
        when {
            loading -> StateBanner("Strategy", "Blueprint backend'e gonderiliyor.", Tone.Info)
            error != null -> StateBanner("Strategy hatasi", error ?: "", Tone.Warning)
            result != null -> BacktestResultPanel(result)
        }
    }
}

@Composable
private fun TimeMachinePanel() {
    var symbol by remember { mutableStateOf("THYAO") }
    var capital by remember { mutableStateOf("10000") }
    var result by remember { mutableStateOf<PriceSeriesResult?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { ProductApiClient() }

    DisposableEffect(Unit) {
        onDispose { api.close() }
    }

    GlassCard(padding = 18.dp) {
        Text("Time Machine", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text("Gecmis tarihte sanal yatirim simulatoru.", color = EvalonColors.TextMuted)
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = symbol,
                onValueChange = { symbol = it.uppercase() },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Ticker") }
            )
            OutlinedTextField(
                value = capital,
                onValueChange = { capital = it.filter { char -> char.isDigit() || char == '.' } },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Capital") }
            )
        }
        Spacer(Modifier.height(14.dp))
        PrimaryButton("Simulasyonu calistir", Icons.Filled.PlayArrow, Modifier.fillMaxWidth()) {
            if (loading) return@PrimaryButton
            loading = true
            error = null
            scope.launch {
                runCatching { api.getPriceSeries(symbol.trim().ifBlank { "THYAO" }, limit = 240) }
                    .onSuccess { result = it }
                    .onFailure { error = it.toProductUserFacingMessage("Time machine fiyat verisi alinamadi.") }
                loading = false
            }
        }
        Spacer(Modifier.height(12.dp))
        when {
            loading -> StateBanner("Time Machine", "Fiyat serisi backend'den aliniyor.", Tone.Info)
            error != null -> StateBanner("Time Machine hatasi", error ?: "", Tone.Warning)
            result != null -> {
                val series = result ?: return@GlassCard
                val first = series.points.firstOrNull()?.close
                val last = series.points.lastOrNull()?.close
                val startCapital = capital.toDoubleOrNull() ?: 10_000.0
                val simulatedValue = if (first != null && last != null && first > 0.0) startCapital * (last / first) else startCapital
                SparklineChart(
                    values = series.points.map { it.close.toFloat() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(132.dp)
                )
                Spacer(Modifier.height(10.dp))
                MiniMetric(formatMoney(simulatedValue), "Simulated value", Modifier.fillMaxWidth(), positive = simulatedValue >= startCapital)
            }
            else -> StateBanner("Time Machine hazir", "Sonuc sadece backend fiyat serisiyle hesaplanir.", Tone.Info)
        }
    }
}

@Composable
private fun ProfitLossPanel() {
    var direction by remember { mutableStateOf("Long") }
    var entry by remember { mutableStateOf("112.40") }
    var exit by remember { mutableStateOf("124.10") }
    var size by remember { mutableStateOf("250") }
    val entryValue = entry.toDoubleOrNull() ?: 0.0
    val exitValue = exit.toDoubleOrNull() ?: 0.0
    val quantity = size.toDoubleOrNull() ?: 0.0
    val gross = if (direction == "Long") {
        (exitValue - entryValue) * quantity
    } else {
        (entryValue - exitValue) * quantity
    }

    GlassCard(padding = 18.dp) {
        Text("P/L Calculator", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Spacer(Modifier.height(12.dp))
        SegmentRow(listOf("Long", "Short"), direction) { direction = it }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = entry,
                onValueChange = { entry = it.filter { char -> char.isDigit() || char == '.' } },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Entry") }
            )
            OutlinedTextField(
                value = exit,
                onValueChange = { exit = it.filter { char -> char.isDigit() || char == '.' } },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Exit") }
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = size,
                onValueChange = { size = it.filter { char -> char.isDigit() || char == '.' } },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Size") }
            )
            MiniMetric(formatMoney(gross), "Net P/L", Modifier.weight(1f), positive = gross >= 0.0)
        }
    }
}

@Composable
private fun ScreenerPanel() {
    var result by remember { mutableStateOf<ScreenerScanResult?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var tickerInput by remember { mutableStateOf("THYAO, AKBNK, EREGL, ASELS, SISE, KCHOL") }
    val scope = rememberCoroutineScope()
    val api = remember { ProductApiClient() }

    DisposableEffect(Unit) {
        onDispose { api.close() }
    }

    GlassCard(padding = 18.dp) {
        Text("Screener", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text("Browse list, technical scan, quick chips, presets ve filtreler.", color = EvalonColors.TextMuted)
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = tickerInput,
            onValueChange = { tickerInput = it.uppercase() },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Ticker listesi") }
        )
        Spacer(Modifier.height(12.dp))
        SegmentRow(listOf("Browse", "Technical", "Presets"), "Technical", {})
        Spacer(Modifier.height(12.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(listOf("RSI < 35", "MACD bull", "Volume spike", "Above EMA50")) {
                AssistChip(onClick = {}, label = { Text(it) })
            }
        }
        Spacer(Modifier.height(14.dp))
        PrimaryButton("Taramayi calistir", Icons.Filled.Search, Modifier.fillMaxWidth()) {
            if (loading) return@PrimaryButton
            loading = true
            error = null
            scope.launch {
                val tickers = tickerInput.split(",", " ", ";").map { it.trim() }
                runCatching { api.runScreenerScan(tickers) }
                    .onSuccess { result = it }
                    .onFailure { error = it.toProductUserFacingMessage("Screener calistirilamadi.") }
                loading = false
            }
        }
        Spacer(Modifier.height(12.dp))
        when {
            loading -> StateBanner("Screener", "Teknik tarama backend'de calisiyor.", Tone.Info)
            error != null -> StateBanner("Screener hatasi", error ?: "", Tone.Warning)
            result != null -> {
                val scan = result ?: return@GlassCard
                StateBanner(
                    "Tarama tamamlandi",
                    "${scan.matched}/${scan.totalScanned} sonuc, ${scan.elapsedMs} ms.",
                    Tone.Success
                )
                Spacer(Modifier.height(12.dp))
                scan.rows.take(8).forEach { row ->
                    MarketListRow(
                        MarketInstrument(
                            symbol = row.ticker,
                            name = row.sector,
                            market = inferMarket(row.ticker),
                            price = formatPrice(row.ticker, row.close),
                            change = signedPercent(row.changePct),
                            positive = row.changePct >= 0.0,
                            chart = emptyList()
                        ),
                        onClick = {}
                    )
                    Spacer(Modifier.height(10.dp))
                }
            }
            else -> StateBanner("Screener hazir", "Tarama calistirildiginda sonuc sadece backend /v1/screener/scan cevabindan gosterilir.", Tone.Info)
        }
    }
}

@Composable
private fun AnalysisLabPanel() {
    var result by remember { mutableStateOf<IndicatorLabResult?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var ticker by remember { mutableStateOf("THYAO") }
    var timeframe by remember { mutableStateOf("1d") }
    var strategy by remember { mutableStateOf("rsi") }
    var period by remember { mutableStateOf("14") }
    val scope = rememberCoroutineScope()
    val api = remember { ProductApiClient() }

    DisposableEffect(Unit) {
        onDispose { api.close() }
    }

    GlassCard(padding = 18.dp) {
        Text("Indicator Lab", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text("Ticker, timeframe, indikator parametreleri ve chart values.", color = EvalonColors.TextMuted)
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = ticker,
                onValueChange = { ticker = it.uppercase() },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Ticker") }
            )
            OutlinedTextField(
                value = timeframe,
                onValueChange = { timeframe = it.lowercase() },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Timeframe") }
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = strategy,
                onValueChange = { strategy = it.lowercase() },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Indicator") }
            )
            OutlinedTextField(
                value = period,
                onValueChange = { period = it.filter(Char::isDigit).take(3) },
                modifier = Modifier.weight(1f),
                singleLine = true,
                label = { Text("Period") }
            )
        }
        Spacer(Modifier.height(14.dp))
        PrimaryButton("Indicator hesapla", Icons.Filled.PlayArrow, Modifier.fillMaxWidth()) {
            if (loading) return@PrimaryButton
            loading = true
            error = null
            scope.launch {
                runCatching {
                    api.loadIndicatorLab(
                        ticker = ticker.trim().ifBlank { "THYAO" },
                        timeframe = timeframe.trim().ifBlank { "1d" },
                        strategy = strategy.trim().ifBlank { "rsi" },
                        period = period.toIntOrNull() ?: 14
                    )
                }
                    .onSuccess { result = it }
                    .onFailure { error = it.toProductUserFacingMessage("Indicator hesabi basarisiz.") }
                loading = false
            }
        }
        Spacer(Modifier.height(14.dp))
        when {
            loading -> StateBanner("Indicator", "RSI serisi backend'de hesaplaniyor.", Tone.Info)
            error != null -> StateBanner("Indicator hatasi", error ?: "", Tone.Warning)
            result != null -> {
                val lab = result ?: return@GlassCard
                SparklineChart(
                    values = lab.values.map { it.value.toFloat() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(132.dp)
                )
                Spacer(Modifier.height(12.dp))
                StateBanner("${lab.ticker} ${lab.timeframe}", "${lab.strategy.uppercase()} sonucu canli endpoint'ten geldi.", Tone.Success)
                Spacer(Modifier.height(10.dp))
                lab.values.take(5).forEach { value ->
                    IndicatorRow(
                        name = value.name,
                        value = value.value.toString().take(8),
                        description = "${value.pointCount} nokta",
                        tone = if (value.value >= 50.0) Tone.Success else Tone.Info
                    )
                    Spacer(Modifier.height(10.dp))
                }
            }
            else -> StateBanner("Indicator hazir", "Hesaplama sonucu sadece backend /v1/indicators cevabindan gosterilir.", Tone.Info)
        }
    }
}

@Composable
private fun CorrelationPanel() {
    var symbolsText by remember { mutableStateOf("THYAO, AKBNK, EREGL, ASELS") }
    var matrix by remember { mutableStateOf<List<Pair<String, List<Double>>>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { ProductApiClient() }

    DisposableEffect(Unit) {
        onDispose { api.close() }
    }

    GlassCard(padding = 18.dp) {
        Text("Correlation Matrix", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text("Multi-ticker price fetch, return hesaplama ve korelasyon matrisi.", color = EvalonColors.TextMuted)
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = symbolsText,
            onValueChange = { symbolsText = it.uppercase() },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Tickers") }
        )
        Spacer(Modifier.height(12.dp))
        PrimaryButton("Korelasyonu hesapla", Icons.Filled.PlayArrow, Modifier.fillMaxWidth()) {
            if (loading) return@PrimaryButton
            val symbols = symbolsText.split(",", " ", ";")
                .map { it.trim().uppercase() }
                .filter { it.isNotBlank() }
                .distinct()
                .take(6)
            loading = true
            error = null
            scope.launch {
                runCatching {
                    val returnsBySymbol = symbols.associateWith { symbol ->
                        api.getPriceSeries(symbol, limit = 120).points
                            .map { it.close }
                            .toReturns()
                    }
                    symbols.map { row ->
                        row to symbols.map { col ->
                            if (row == col) 1.0 else correlation(returnsBySymbol[row].orEmpty(), returnsBySymbol[col].orEmpty())
                        }
                    }
                }
                    .onSuccess { matrix = it }
                    .onFailure { error = it.toProductUserFacingMessage("Korelasyon hesaplanamadi.") }
                loading = false
            }
        }
        Spacer(Modifier.height(12.dp))
        when {
            loading -> StateBanner("Correlation", "Fiyat serileri backend'den aliniyor.", Tone.Info)
            error != null -> StateBanner("Correlation hatasi", error ?: "", Tone.Warning)
            matrix.isEmpty() -> StateBanner("Correlation hazir", "Matris sadece canli fiyat serilerinden hesaplanir.", Tone.Info)
        }
        matrix.forEach { (row, values) ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(row, color = EvalonColors.TextMuted, modifier = Modifier.width(54.dp))
                values.forEach { value ->
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (value > 0.5) EvalonColors.Green.copy(alpha = 0.18f) else EvalonColors.Blue.copy(alpha = 0.14f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(value.toString(), color = Color.White, fontSize = 12.sp)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun WatchlistPanel(
    watchlistSymbols: List<String>,
    marketItems: List<MarketInstrument>,
    loading: Boolean,
    error: String?,
    onRemove: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        StateBanner("Protected watchlist", "Firestore users/{uid}/watchlist ile add/remove/search/live quote akisi.", Tone.Info)
        if (loading) {
            StateBanner("Senkronizasyon", "Watchlist Firestore'dan okunuyor.", Tone.Info)
        }
        error?.let {
            StateBanner("Watchlist okunamadi", it, Tone.Warning)
        }
        val source = watchlistSymbols
            .map { symbol ->
                marketItems.firstOrNull { it.symbol == symbol }
                    ?: MarketInstrument(symbol, symbol, inferMarket(symbol), "--", "stale", true, emptyList())
            }
        if (source.isEmpty()) {
            StateBanner("Watchlist bos", "Web hesabindaki watchlist Firestore users/{uid}.watchlist.tickers alanindan okunur.", Tone.Info)
        }
        source.forEach { item ->
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(item.symbol, color = Color.White, fontWeight = FontWeight.Bold)
                        Text(item.name, color = EvalonColors.TextMuted)
                    }
                    TextButton(onClick = { onRemove(item.symbol) }) {
                        Text("Kaldir")
                    }
                }
            }
        }
    }
}

@Composable
private fun CalendarPanel() {
    GlassCard(padding = 18.dp) {
        Text("Economic Calendar", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Spacer(Modifier.height(12.dp))
        calendarEvents.forEach {
            TimelineRow(it.first, it.second, it.third)
        }
    }
}

@Composable
private fun AcademyPanel() {
    GlassCard(padding = 18.dp) {
        Text("Academy", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text("Statik egitim terimleri, kategori arama ve detay dialogu.", color = EvalonColors.TextMuted)
        Spacer(Modifier.height(12.dp))
        listOf("Risk/Reward", "Moving Average", "Drawdown", "Position sizing").forEach {
            EducationRow(it)
        }
    }
}

@Composable
private fun BrokersPanel() {
    GlassCard(padding = 18.dp) {
        Text("Brokers", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text("Broker katalogu, filtre ve karsilastirma.", color = EvalonColors.TextMuted)
        Spacer(Modifier.height(12.dp))
        BrokerRow("Midas", "US + TR stocks", "Low commission")
        BrokerRow("Interactive Brokers", "Global markets", "Advanced")
        BrokerRow("Binance", "Crypto", "High liquidity")
    }
}

@Composable
private fun PricingPanel() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PricingCard("Starter", "Free", listOf("Watchlist", "News", "Basic screener"))
        PricingCard("Pro", "$14/mo", listOf("Evalon AI", "Backtest studio", "Advanced indicators"), highlighted = true)
        PricingCard("Desk", "$49/mo", listOf("Team workspaces", "Priority data", "Export"))
    }
}

@Composable
private fun ProfilePanel(
    authUiState: AuthUiState,
    isDemoMode: Boolean,
    onSaveProfile: (String?, String?) -> Unit,
    onPickAvatar: () -> Unit,
    onGoogleSignInClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    var displayName by remember(authUiState.displayName) { mutableStateOf(authUiState.displayName ?: "Evalon User") }
    var email by remember(authUiState.email) { mutableStateOf(authUiState.email ?: "demo@evalon.app") }

    GlassCard(padding = 18.dp) {
        AccountCard(
            authUiState = authUiState,
            isDemoMode = isDemoMode,
            onGoogleSignInClick = onGoogleSignInClick,
            onSignOutClick = onSignOutClick
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Display name") }
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Email") }
        )
        Spacer(Modifier.height(12.dp))
        StateBanner("Avatar upload", "Firebase Storage bridge ile iOS/Android image picker baglandi.", Tone.Info)
        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            onClick = onPickAvatar,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
        ) {
            Text("Avatar yukle")
        }
        Spacer(Modifier.height(10.dp))
        PrimaryButton("Profili kaydet", Icons.Filled.CheckCircle, Modifier.fillMaxWidth()) {
            onSaveProfile(displayName, email)
        }
    }
}

@Composable
private fun SettingsPanel(
    settings: FirestoreSettings,
    onSaveSettings: (FirestoreSettings) -> Unit
) {
    var pushNotifications by remember(settings.pushNotifications) { mutableStateOf(settings.pushNotifications) }
    var staleDataLabels by remember(settings.staleDataLabels) { mutableStateOf(settings.staleDataLabels) }
    var biometricUnlock by remember(settings.biometricUnlock) { mutableStateOf(settings.biometricUnlock) }
    var reduceMotion by remember(settings.reduceMotion) { mutableStateOf(settings.reduceMotion) }

    GlassCard(padding = 18.dp) {
        Text("Settings", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Spacer(Modifier.height(12.dp))
        SettingsRow("Push notifications", "Price alerts, backtest completion, community replies", pushNotifications) {
            pushNotifications = !pushNotifications
        }
        SettingsRow("Stale data labels", "Cached market data always visible", staleDataLabels) {
            staleDataLabels = !staleDataLabels
        }
        SettingsRow("Biometric unlock", "Secure storage preference", biometricUnlock) {
            biometricUnlock = !biometricUnlock
        }
        SettingsRow("Reduce motion", "Accessibility preference", reduceMotion) {
            reduceMotion = !reduceMotion
        }
        Spacer(Modifier.height(12.dp))
        PrimaryButton("Ayarlari kaydet", Icons.Filled.CheckCircle, Modifier.fillMaxWidth()) {
            onSaveSettings(
                FirestoreSettings(
                    pushNotifications = pushNotifications,
                    staleDataLabels = staleDataLabels,
                    biometricUnlock = biometricUnlock,
                    reduceMotion = reduceMotion
                )
            )
        }
    }
}

@Composable
private fun HelpPanel() {
    GlassCard(padding = 18.dp) {
        Text("Help", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Spacer(Modifier.height(12.dp))
        StateBanner("Support", "SSS, feedback ve support ticket akisi More > Help altinda.", Tone.Info)
        EducationRow("How to run a backtest")
        EducationRow("Understanding stale market data")
        EducationRow("Managing paper portfolio risk")
    }
}

@Composable
private fun LegalPanel(title: String, bullets: List<String>) {
    GlassCard(padding = 18.dp) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = Color.White)
        Spacer(Modifier.height(12.dp))
        bullets.forEach { bullet ->
            Row(
                modifier = Modifier.padding(vertical = 6.dp),
                verticalAlignment = Alignment.Top
            ) {
                Box(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(EvalonColors.Blue)
                )
                Spacer(Modifier.width(10.dp))
                Text(bullet, color = EvalonColors.TextMuted, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun LeaderboardRow(row: LeaderboardEntry) {
    GlassCard(padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("#${row.rank}", color = EvalonColors.Blue, fontWeight = FontWeight.Bold, modifier = Modifier.width(44.dp))
            Avatar(row.name.take(2).uppercase())
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(row.name, color = Color.White, fontWeight = FontWeight.SemiBold)
                Text(row.strategy, color = EvalonColors.TextMuted)
            }
            PriceChange(row.returnPct, true)
        }
    }
}

@Composable
private fun CommunityPostCard(
    post: CommunityPost,
    onTickerClick: (String) -> Unit,
    onLike: () -> Unit,
    onSave: () -> Unit,
    onCommentDraft: String,
    onCommentDraftChange: (String) -> Unit,
    onComment: () -> Unit,
    onReport: () -> Unit
) {
    GlassCard(padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(post.author.take(2).uppercase())
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(post.author, color = Color.White, fontWeight = FontWeight.SemiBold)
                Text(post.time, color = EvalonColors.TextMuted, fontSize = 12.sp)
            }
            StatusPill(post.ticker, EvalonColors.Blue.copy(alpha = 0.14f), EvalonColors.Blue, onClick = { onTickerClick(post.ticker) })
        }
        Spacer(Modifier.height(12.dp))
        Text(post.body, color = EvalonColors.TextPrimary, style = MaterialTheme.typography.bodyLarge)
        if (post.imageUrl != null) {
            Spacer(Modifier.height(10.dp))
            StateBanner("Gorsel eklendi", "Bu post web community tarafinda gorsel de iceriyor.", Tone.Info)
        }
        if (post.commentPreview.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            post.commentPreview.forEach { comment ->
                CommunityCommentPreview(comment)
                Spacer(Modifier.height(8.dp))
            }
        }
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = onCommentDraft,
            onValueChange = onCommentDraftChange,
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            label = { Text("Yorum ekle") }
        )
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SocialAction(Icons.Filled.Favorite, post.likes, post.liked, onLike)
            SocialAction(Icons.Filled.Chat, post.comments, onClick = onComment)
            SocialAction(Icons.Filled.Bookmark, post.savesLabel, post.saved, onSave)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onReport) { Text("Report") }
        }
    }
}

@Composable
private fun CommunityCommentPreview(comment: CommunityCommentPreviewModel) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(EvalonColors.SurfaceElevated)
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(comment.author, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Text(comment.time, color = EvalonColors.TextMuted, fontSize = 11.sp)
            }
            Text(comment.body, color = EvalonColors.TextMuted, fontSize = 13.sp)
        }
    }
}

@Composable
private fun AccountCard(
    authUiState: AuthUiState,
    isDemoMode: Boolean,
    onGoogleSignInClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    GlassCard(padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar((authUiState.displayName ?: "Demo").take(2).uppercase())
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    authUiState.displayName ?: if (isDemoMode) "Demo workspace" else "Misafir",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    authUiState.email ?: if (isDemoMode) "Sinirli demo modu" else "Oturum acilmadi",
                    color = EvalonColors.TextMuted
                )
            }
            if (authUiState.isSignedIn || isDemoMode) {
                IconButton(onClick = onSignOutClick) {
                    Icon(Icons.Filled.Logout, contentDescription = "Cikis", tint = EvalonColors.TextMuted)
                }
            } else {
                IconButton(onClick = onGoogleSignInClick) {
                    Icon(Icons.Filled.Login, contentDescription = "Giris", tint = EvalonColors.Blue)
                }
            }
        }
    }
}

@Composable
private fun HomeTopBar(
    authUiState: AuthUiState,
    isDemoMode: Boolean,
    onAiClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "Merhaba",
                color = EvalonColors.TextMuted,
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = authUiState.displayName ?: if (isDemoMode) "Demo Trader" else "Evalon Trader",
                color = Color.White,
                style = MaterialTheme.typography.headlineSmall
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            IconButton(
                onClick = onAiClick,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(EvalonColors.Blue.copy(alpha = 0.18f))
            ) {
                Icon(Icons.Filled.SmartToy, contentDescription = "Evalon AI", tint = EvalonColors.Blue)
            }
            Avatar((authUiState.displayName ?: "EY").take(2).uppercase())
        }
    }
}

@Composable
private fun EvalonBottomBar(
    selectedTab: MainTab,
    onTabSelected: (MainTab) -> Unit
) {
    NavigationBar(
        containerColor = EvalonColors.Surface.copy(alpha = 0.96f),
        tonalElevation = 0.dp
    ) {
        MainTab.entries.forEach { tab ->
            NavigationBarItem(
                selected = selectedTab == tab,
                onClick = { onTabSelected(tab) },
                icon = { Icon(tab.icon, contentDescription = tab.label) },
                label = {
                    Text(
                        tab.label,
                        maxLines = 1,
                        overflow = TextOverflow.Clip,
                        fontSize = 11.sp
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = Color.White,
                    selectedTextColor = Color.White,
                    indicatorColor = EvalonColors.Blue.copy(alpha = 0.24f),
                    unselectedIconColor = EvalonColors.TextMuted,
                    unselectedTextColor = EvalonColors.TextMuted
                )
            )
        }
    }
}

@Composable
private fun AppBackground(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    listOf(
                        EvalonColors.Ink,
                        Color(0xFF091A2E),
                        Color(0xFF06111F)
                    )
                )
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(260.dp)
                .background(
                    Brush.radialGradient(
                        colors = listOf(EvalonColors.Blue.copy(alpha = 0.28f), Color.Transparent),
                        center = Offset(240f, 40f),
                        radius = 520f
                    )
                )
        )
        Canvas(Modifier.fillMaxSize()) {
            val grid = 36.dp.toPx()
            var x = 0f
            while (x < size.width) {
                drawLine(EvalonColors.Grid, Offset(x, 0f), Offset(x, size.height), strokeWidth = 1f)
                x += grid
            }
            var y = 0f
            while (y < size.height) {
                drawLine(EvalonColors.Grid, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
                y += grid
            }
        }
        content()
    }
}

@Composable
private fun BrandLockup() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Brush.linearGradient(listOf(EvalonColors.Blue, EvalonColors.Green))),
            contentAlignment = Alignment.Center
        ) {
            Text("E", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp)
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text("Evalon", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Text("Trading intelligence", color = EvalonColors.TextMuted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun PageTitle(title: String, subtitle: String) {
    Column {
        Text(title, style = MaterialTheme.typography.displaySmall, color = Color.White)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = EvalonColors.TextMuted)
    }
}

@Composable
private fun DetailTopBar(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(
            onClick = onBack,
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(EvalonColors.SurfaceElevated)
        ) {
            Icon(Icons.Filled.ArrowBack, contentDescription = "Geri", tint = Color.White)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, color = Color.White)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = EvalonColors.TextMuted)
        }
    }
}

@Composable
private fun EmbeddedGraphExperienceScreen(
    title: String,
    subtitle: String,
    url: String,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        DetailTopBar(title = title, subtitle = subtitle, onBack = onBack)
        Spacer(Modifier.height(16.dp))
        PlatformWebPage(
            url = url,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(24.dp))
                .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(24.dp))
        )
    }
}

@Composable
private fun LandscapeChartScreen(
    title: String,
    subtitle: String,
    url: String,
    onBack: () -> Unit
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(EvalonColors.Ink)
    ) {
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .width(maxHeight)
                .height(maxWidth)
                .graphicsLayer { rotationZ = 90f }
        ) {
            PlatformWebPage(url = url, modifier = Modifier.fillMaxSize())
        }
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(14.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(EvalonColors.Surface.copy(alpha = 0.92f))
                .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(20.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Column {
                Text(title, color = Color.White, fontWeight = FontWeight.Bold)
                Text(subtitle, color = EvalonColors.TextMuted, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun AiMessageBubble(message: AiChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.fromUser) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 340.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(
                    if (message.fromUser) EvalonColors.Blue.copy(alpha = 0.2f)
                    else EvalonColors.Surface
                )
                .border(
                    1.dp,
                    if (message.fromUser) EvalonColors.Blue.copy(alpha = 0.45f) else EvalonColors.CardStroke,
                    RoundedCornerShape(20.dp)
                )
                .padding(14.dp)
        ) {
            Text(
                if (message.fromUser) "Sen" else "Evalon AI",
                color = if (message.fromUser) EvalonColors.Blue else EvalonColors.Green,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
            Spacer(Modifier.height(6.dp))
            Text(message.content, color = Color.White)
        }
    }
}

@Composable
private fun SectionHeader(title: String, subtitle: String? = null) {
    Column {
        Text(title, style = MaterialTheme.typography.titleLarge, color = Color.White)
        subtitle?.let {
            Spacer(Modifier.height(3.dp))
            Text(it, style = MaterialTheme.typography.bodyMedium, color = EvalonColors.TextMuted)
        }
    }
}

@Composable
private fun GlassCard(
    modifier: Modifier = Modifier,
    padding: Dp = 16.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val clickableModifier = if (onClick != null) {
        modifier.clickable(onClick = onClick)
    } else {
        modifier
    }
    Card(
        modifier = clickableModifier
            .fillMaxWidth()
            .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(28.dp)),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = EvalonColors.Glass),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(Modifier.padding(padding)) {
            content()
        }
    }
}

@Composable
private fun PrimaryButton(
    text: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(54.dp),
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(containerColor = EvalonColors.Blue, contentColor = Color.White)
    ) {
        Icon(icon, contentDescription = null)
        Spacer(Modifier.width(8.dp))
        Text(text, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SparklineChart(
    values: List<Float>,
    modifier: Modifier,
    positive: Boolean = true
) {
    val lineColor = if (positive) EvalonColors.Green else EvalonColors.Red
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(22.dp))
            .background(EvalonColors.SurfaceElevated)
            .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(22.dp))
    ) {
        Canvas(Modifier.fillMaxSize().padding(14.dp)) {
            if (values.size < 2) return@Canvas
            val min = values.minOrNull() ?: 0f
            val max = values.maxOrNull() ?: 1f
            val span = (max - min).takeIf { it != 0f } ?: 1f
            val step = size.width / (values.lastIndex.coerceAtLeast(1))
            val path = Path()
            values.forEachIndexed { index, value ->
                val x = index * step
                val y = size.height - ((value - min) / span) * size.height
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(
                path = path,
                color = lineColor,
                style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round)
            )
            values.lastOrNull()?.let { last ->
                val x = values.lastIndex * step
                val y = size.height - ((last - min) / span) * size.height
                drawCircle(lineColor.copy(alpha = 0.22f), 13.dp.toPx(), Offset(x, y))
                drawCircle(lineColor, 5.dp.toPx(), Offset(x, y))
            }
        }
    }
}

@Composable
private fun SegmentRow(items: List<String>, selected: String, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier
            .horizontalScroll(rememberScrollState())
            .clip(RoundedCornerShape(18.dp))
            .background(EvalonColors.SurfaceElevated)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        items.forEach { item ->
            FilterChip(
                selected = selected == item,
                onClick = { onSelected(item) },
                label = { Text(item) }
            )
        }
    }
}

@Composable
private fun StatusPill(
    text: String,
    background: Color,
    foreground: Color,
    onClick: (() -> Unit)? = null
) {
    val modifier = if (onClick == null) Modifier else Modifier.clickable(onClick = onClick)
    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(background)
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Text(text, color = foreground, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun PriceChange(change: String, positive: Boolean) {
    StatusPill(
        text = change,
        background = if (positive) EvalonColors.Green.copy(alpha = 0.14f) else EvalonColors.Red.copy(alpha = 0.14f),
        foreground = if (positive) EvalonColors.Green else EvalonColors.Red
    )
}

@Composable
private fun MiniMetric(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    positive: Boolean? = null
) {
    val valueColor = when (positive) {
        true -> EvalonColors.Green
        false -> EvalonColors.Red
        null -> Color.White
    }
    Box(
        modifier = modifier
            .heightIn(min = 74.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(EvalonColors.SurfaceElevated)
            .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(20.dp))
            .padding(12.dp)
    ) {
        Column {
            Text(value, color = valueColor, fontWeight = FontWeight.Black, fontSize = 18.sp, fontFamily = FontFamily.Monospace)
            Spacer(Modifier.height(4.dp))
            Text(label, color = EvalonColors.TextMuted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun MarketCard(item: MarketInstrument, width: Dp, onClick: () -> Unit) {
    GlassCard(
        modifier = Modifier.width(width),
        padding = 14.dp,
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(Modifier.weight(1f)) {
                Text(item.symbol, color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text(item.name, color = EvalonColors.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            PriceChange(item.change, item.positive)
        }
        Spacer(Modifier.height(12.dp))
        Text(item.price, color = Color.White, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        SparklineChart(item.chart, Modifier.fillMaxWidth().height(62.dp), item.positive)
    }
}

@Composable
private fun MarketListRow(item: MarketInstrument, onClick: () -> Unit) {
    GlassCard(padding = 14.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBubble(Icons.Filled.ShowChart, if (item.positive) EvalonColors.Green else EvalonColors.Red)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.symbol, color = Color.White, fontWeight = FontWeight.Bold)
                Text(item.name, color = EvalonColors.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(item.price, color = Color.White, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                Text(item.change, color = if (item.positive) EvalonColors.Green else EvalonColors.Red)
            }
        }
    }
}

@Composable
private fun NewsRow(item: NewsItem) {
    GlassCard(padding = 14.dp) {
        Row(verticalAlignment = Alignment.Top) {
            IconBubble(Icons.Filled.Newspaper, EvalonColors.Blue)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.title, color = Color.White, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(5.dp))
                Text(item.summary, color = EvalonColors.TextMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusPill(item.source, EvalonColors.SurfaceElevated, EvalonColors.TextMuted)
                    StatusPill(item.time, EvalonColors.Blue.copy(alpha = 0.12f), EvalonColors.Blue)
                }
            }
        }
    }
}

@Composable
private fun ActionGrid(actions: List<QuickAction>) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        actions.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { action ->
                    QuickActionCard(action, Modifier.weight(1f))
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun QuickActionCard(action: QuickAction, modifier: Modifier) {
    GlassCard(
        modifier = modifier,
        padding = 14.dp,
        onClick = action.onClick
    ) {
        IconBubble(action.icon, EvalonColors.Blue)
        Spacer(Modifier.height(12.dp))
        Text(action.title, color = Color.White, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun TwoColumnActions(
    leftTitle: String,
    leftBody: String,
    leftIcon: ImageVector,
    leftClick: () -> Unit,
    rightTitle: String,
    rightBody: String,
    rightIcon: ImageVector,
    rightClick: () -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        ActionPanel(leftTitle, leftBody, leftIcon, leftClick, Modifier.weight(1f))
        ActionPanel(rightTitle, rightBody, rightIcon, rightClick, Modifier.weight(1f))
    }
}

@Composable
private fun ActionPanel(
    title: String,
    body: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier
) {
    GlassCard(
        modifier = modifier,
        padding = 14.dp,
        onClick = onClick
    ) {
        IconBubble(icon, EvalonColors.Blue)
        Spacer(Modifier.height(12.dp))
        Text(title, color = Color.White, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(body, color = EvalonColors.TextMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun DestinationGroup(
    title: String,
    destinations: List<FeatureDestination>,
    onDestinationClick: (FeatureDestination) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeader(title)
        destinations.forEach { destination ->
            GlassCard(padding = 14.dp, onClick = { onDestinationClick(destination) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(destination.icon, EvalonColors.Blue)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(destination.title, color = Color.White, fontWeight = FontWeight.SemiBold)
                        Text(destination.subtitle, color = EvalonColors.TextMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

@Composable
private fun IconBubble(icon: ImageVector, color: Color) {
    Box(
        modifier = Modifier
            .size(46.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(color.copy(alpha = 0.14f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = color)
    }
}

@Composable
private fun Avatar(text: String) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(EvalonColors.Blue, EvalonColors.Green))),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = Color.White, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun InputShell(label: String, value: String, modifier: Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .background(EvalonColors.SurfaceElevated)
            .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(18.dp))
            .padding(14.dp)
    ) {
        Text(label, color = EvalonColors.TextMuted, fontSize = 12.sp)
        Spacer(Modifier.height(4.dp))
        Text(value, color = Color.White, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StateBanner(title: String, body: String, tone: Tone) {
    val color = when (tone) {
        Tone.Success -> EvalonColors.Green
        Tone.Warning -> EvalonColors.Amber
        Tone.Error -> EvalonColors.Red
        Tone.Info -> EvalonColors.Blue
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(color.copy(alpha = 0.12f))
            .border(1.dp, color.copy(alpha = 0.28f), RoundedCornerShape(20.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = when (tone) {
                Tone.Success -> Icons.Filled.CheckCircle
                Tone.Warning -> Icons.Filled.Warning
                Tone.Error -> Icons.Filled.Error
                Tone.Info -> Icons.Filled.Analytics
            },
            contentDescription = null,
            tint = color
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(body, color = EvalonColors.TextMuted)
        }
    }
}

@Composable
private fun IndicatorRow(name: String, value: String, description: String, tone: Tone) {
    GlassCard(padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBubble(Icons.Filled.QueryStats, when (tone) {
                Tone.Success -> EvalonColors.Green
                Tone.Warning -> EvalonColors.Amber
                Tone.Error -> EvalonColors.Red
                Tone.Info -> EvalonColors.Blue
            })
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(name, color = Color.White, fontWeight = FontWeight.SemiBold)
                Text(description, color = EvalonColors.TextMuted)
            }
            Text(value, color = Color.White, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PositionRow(symbol: String, size: String, pnl: String, positive: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBubble(Icons.Filled.AccountBalanceWallet, if (positive) EvalonColors.Green else EvalonColors.Red)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(symbol, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(size, color = EvalonColors.TextMuted)
        }
        PriceChange(pnl, positive)
    }
}

@Composable
private fun TimelineRow(time: String, title: String, impact: String) {
    Row(
        modifier = Modifier.padding(vertical = 8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(time, color = EvalonColors.Blue, fontWeight = FontWeight.Bold, modifier = Modifier.width(64.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(impact, color = EvalonColors.TextMuted)
        }
    }
}

@Composable
private fun EducationRow(title: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBubble(Icons.Filled.School, EvalonColors.Blue)
        Spacer(Modifier.width(12.dp))
        Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text("Oku", color = EvalonColors.Blue)
    }
}

@Composable
private fun BrokerRow(name: String, markets: String, badge: String) {
    Row(
        modifier = Modifier.padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBubble(Icons.Filled.Business, EvalonColors.Blue)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(name, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(markets, color = EvalonColors.TextMuted)
        }
        StatusPill(badge, EvalonColors.SurfaceElevated, EvalonColors.TextMuted)
    }
}

@Composable
private fun PricingCard(title: String, price: String, features: List<String>, highlighted: Boolean = false) {
    GlassCard(padding = 18.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, style = MaterialTheme.typography.titleLarge)
                Text(price, color = if (highlighted) EvalonColors.Blue else EvalonColors.TextMuted, style = MaterialTheme.typography.headlineSmall)
            }
            if (highlighted) StatusPill("Best value", EvalonColors.Blue.copy(alpha = 0.16f), EvalonColors.Blue)
        }
        Spacer(Modifier.height(12.dp))
        features.forEach { feature ->
            Row(modifier = Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = EvalonColors.Green, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(feature, color = EvalonColors.TextMuted)
            }
        }
    }
}

@Composable
private fun SettingsRow(title: String, subtitle: String, enabled: Boolean, onClick: (() -> Unit)? = null) {
    val rowModifier = if (onClick == null) {
        Modifier
    } else {
        Modifier.clickable(onClick = onClick)
    }
    Row(
        modifier = rowModifier.padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = EvalonColors.TextMuted)
        }
        StatusPill(
            if (enabled) "On" else "Off",
            if (enabled) EvalonColors.Green.copy(alpha = 0.14f) else EvalonColors.SurfaceElevated,
            if (enabled) EvalonColors.Green else EvalonColors.TextMuted
        )
    }
}

@Composable
private fun ChatBubble(text: String, mine: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 320.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(if (mine) EvalonColors.Blue else EvalonColors.SurfaceElevated)
                .padding(14.dp)
        ) {
            Text(text, color = Color.White)
        }
    }
    Spacer(Modifier.height(10.dp))
}

@Composable
private fun CodeBlock(code: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFF050B14))
            .border(1.dp, EvalonColors.CardStroke, RoundedCornerShape(20.dp))
            .padding(16.dp)
    ) {
        Text(code, color = EvalonColors.TextPrimary, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
    }
}

@Composable
private fun OverviewTile(title: String, value: String, change: String, positive: Boolean, modifier: Modifier) {
    MiniMetric(value, "$title  $change", modifier, positive)
}

@Composable
private fun FeaturePreviewRow(feature: FeaturePreview) {
    GlassCard(padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBubble(feature.icon, EvalonColors.Blue)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(feature.title, color = Color.White, fontWeight = FontWeight.SemiBold)
                Text(feature.body, color = EvalonColors.TextMuted)
            }
        }
    }
}

@Composable
private fun SocialAction(icon: ImageVector, count: String, active: Boolean = false, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(CircleShape)
            .background(if (active) EvalonColors.Blue.copy(alpha = 0.18f) else EvalonColors.SurfaceElevated)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (active) EvalonColors.Blue else EvalonColors.TextMuted,
            modifier = Modifier.size(17.dp)
        )
        Spacer(Modifier.width(5.dp))
        Text(count, color = if (active) EvalonColors.Blue else EvalonColors.TextMuted, fontSize = 12.sp)
    }
}

private enum class MainTab(
    val label: String,
    val icon: ImageVector
) {
    Home("Home", Icons.Filled.Home),
    Markets("Markets", Icons.Filled.ShowChart),
    Trade("Trade", Icons.Filled.SwapHoriz),
    Community("Community", Icons.Filled.Forum),
    More("More", Icons.Filled.Menu)
}

private enum class TradeDestination(
    val title: String,
    val subtitle: String,
    val icon: ImageVector
) {
    Paper("Paper Portfolio", "Virtual portfolio, orders, positions and reset flow.", Icons.Filled.AccountBalanceWallet),
    Backtest("Backtest Studio", "Blueprint builder, presets, status, events and equity curve.", Icons.Filled.Analytics),
    Strategy("Strategy Workspace", "Editable JSON blueprint and AI saved strategy assets.", Icons.Filled.Timeline),
    Leaderboard("Leaderboard", "Firestore-backed paper trading leaderboard.", Icons.Filled.BarChart),
    TimeMachine("Time Machine", "Historical investment simulator.", Icons.Filled.CalendarMonth),
    ProfitLoss("P/L Calculator", "Local long/short profit and loss calculator.", Icons.Filled.Paid)
}

private val tradeDestinations = TradeDestination.entries.toList()

private enum class FeatureDestination(
    val title: String,
    val subtitle: String,
    val icon: ImageVector
) {
    Screener("Screener", "Technical scan, filters, quick chips and presets.", Icons.Filled.Search),
    Analysis("Indicator Lab", "Indicator catalog, params and chart values.", Icons.Filled.Science),
    Correlation("Correlation", "Multi-ticker returns and matrix.", Icons.Filled.QueryStats),
    Watchlist("Watchlist", "Protected user watchlist and live quotes.", Icons.Filled.Bookmark),
    News("News", "Infinite news feed, search and detail.", Icons.Filled.Newspaper),
    Calendar("Calendar", "Economic calendar and event impact.", Icons.Filled.CalendarMonth),
    Movers("Movers", "Top gainers and losers.", Icons.Filled.TrendingUp),
    Academy("Academy", "Education terms and categories.", Icons.Filled.School),
    Brokers("Brokers", "Broker catalog, filters and comparison.", Icons.Filled.Business),
    Pricing("Pricing", "Plans and billing toggle.", Icons.Filled.Paid),
    Profile("Profile", "Protected profile and avatar upload.", Icons.Filled.Person),
    Settings("Settings", "Preferences, notifications and account options.", Icons.Filled.Settings),
    Help("Help", "Support content and feedback.", Icons.Filled.Help),
    Privacy("Privacy", "Privacy policy.", Icons.Filled.Security),
    Terms("Terms", "Terms of service.", Icons.Filled.Gavel);

    companion object {
        val tradingTools = listOf(Screener, Correlation)
        val marketTools = listOf(Watchlist, News, Calendar, Movers)
        val learning = listOf(Academy, Brokers, Pricing)
        val accountLegal = listOf(Profile, Settings, Help, Privacy, Terms)
    }
}

private enum class Tone {
    Success,
    Warning,
    Error,
    Info
}

private data class MarketInstrument(
    val symbol: String,
    val name: String,
    val market: String,
    val price: String,
    val change: String,
    val positive: Boolean,
    val chart: List<Float>
)

private data class NewsItem(
    val title: String,
    val summary: String,
    val source: String,
    val time: String
)

private data class CommunityPost(
    val id: String,
    val author: String,
    val ticker: String,
    val tickers: List<String>,
    val market: String,
    val body: String,
    val time: String,
    val likes: String,
    val comments: String,
    val savesLabel: String,
    val liked: Boolean,
    val saved: Boolean,
    val imageUrl: String?,
    val commentPreview: List<CommunityCommentPreviewModel>
)

private data class CommunityCommentPreviewModel(
    val id: String,
    val author: String,
    val body: String,
    val time: String
)

private data class ChatLine(
    val text: String,
    val mine: Boolean
)

private data class LeaderboardEntry(
    val rank: Int,
    val name: String,
    val strategy: String,
    val returnPct: String
)

private data class QuickAction(
    val title: String,
    val icon: ImageVector,
    val onClick: () -> Unit
)

private data class AiChatMessage(
    val fromUser: Boolean,
    val content: String
)

private data class FeaturePreview(
    val title: String,
    val body: String,
    val icon: ImageVector
)

private fun ProductSnapshot.toMarketInstruments(): List<MarketInstrument> {
    val remoteItems = marketList?.items?.takeIf { it.isNotEmpty() } ?: marketList?.data.orEmpty()
    val mapped = remoteItems.mapNotNull { item ->
        val symbol = item.ticker.ifBlank { item.symbol }.trim().uppercase()
        if (symbol.isBlank()) return@mapNotNull null

        val changePct = item.changePct ?: item.changePercent
        val positive = changePct == null || changePct >= 0.0
        MarketInstrument(
            symbol = symbol,
            name = item.name.ifBlank { symbol },
            market = inferMarket(symbol),
            price = item.price?.let { formatPrice(symbol, it) } ?: "--",
            change = changePct?.let { signedPercent(it) } ?: "stale",
            positive = positive,
            chart = emptyList()
        )
    }

    return mapped
}

private fun ProductSnapshot.toNewsItems(): List<NewsItem> {
    val mapped = news?.items.orEmpty().map { item ->
        NewsItem(
            title = item.title,
            summary = item.summary ?: item.symbol?.let { "$it icin son piyasa haberi." } ?: "Detay haber akisi icin dis kaynak acilabilir.",
            source = item.news_source ?: item.author ?: "Evalon News",
            time = item.published_at?.take(10) ?: "Live"
        )
    }
    return mapped
}

private fun ProductSnapshot.toMovers(source: List<MarketInstrument> = toMarketInstruments()): List<MarketInstrument> {
    return source.sortedByDescending { parseChangeMagnitude(it.change) }.take(6)
}

private fun List<FirestoreCommunityPost>.toCommunityPosts(): List<CommunityPost> {
    return map {
        val primaryTicker = it.tickers.firstOrNull() ?: "THYAO"
        CommunityPost(
            id = it.id,
            author = it.authorName.takeIf { author -> author.isNotBlank() } ?: "Evalon Trader",
            ticker = primaryTicker,
            tickers = it.tickers,
            market = inferMarket(primaryTicker),
            body = it.body,
            time = it.createdAt.take(16).ifBlank { "Firestore" },
            likes = it.likeCount.toString(),
            comments = it.commentCount.toString(),
            savesLabel = if (it.viewerHasSaved) "Saved" else "Save",
            liked = it.viewerHasLiked,
            saved = it.viewerHasSaved,
            imageUrl = it.imageUrl,
            commentPreview = it.comments.map { comment ->
                CommunityCommentPreviewModel(
                    id = comment.id,
                    author = comment.authorName.ifBlank { "Trader" },
                    body = comment.body,
                    time = comment.createdAt.take(16).ifBlank { "yorum" }
                )
            }
        )
    }
}

private fun inferMarket(symbol: String): String = when {
    else -> "BIST"
}

private fun formatOverviewValue(currency: String, value: Double): String {
    val prefix = when (currency.uppercase()) {
        "USD" -> "$"
        "TRY", "TL" -> "₺"
        else -> ""
    }
    return prefix + value.toString().take(10)
}

private fun formatPrice(symbol: String, value: Double): String {
    val prefix = when (inferMarket(symbol)) {
        "BIST" -> "₺"
        else -> "₺"
    }
    return prefix + value.toString().take(10)
}

private fun signedPercent(value: Double): String {
    val prefix = if (value >= 0) "+" else ""
    return "$prefix${value.toString().take(5)}%"
}

private fun formatMoney(value: Double): String {
    return "$" + value.toString().take(10)
}

private fun parseChangeMagnitude(value: String): Double {
    return value.replace("+", "").replace("%", "").toDoubleOrNull()?.let {
        if (it < 0) -it else it
    } ?: 0.0
}

private fun List<Double>.toReturns(): List<Double> {
    if (size < 2) return emptyList()
    return zipWithNext().mapNotNull { (previous, current) ->
        if (previous == 0.0) null else (current - previous) / previous
    }
}

private fun correlation(left: List<Double>, right: List<Double>): Double {
    val count = minOf(left.size, right.size)
    if (count < 2) return 0.0
    val a = left.takeLast(count)
    val b = right.takeLast(count)
    val meanA = a.average()
    val meanB = b.average()
    var numerator = 0.0
    var denominatorA = 0.0
    var denominatorB = 0.0
    for (index in 0 until count) {
        val da = a[index] - meanA
        val db = b[index] - meanB
        numerator += da * db
        denominatorA += da * da
        denominatorB += db * db
    }
    val denominator = sqrt(denominatorA * denominatorB)
    if (denominator == 0.0) return 0.0
    return ((numerator / denominator) * 100.0).toInt() / 100.0
}

private val landingFeatures = listOf(
    FeaturePreview("Markets", "Overview, detail chart, movers ve fullscreen graph.", Icons.Filled.ShowChart),
    FeaturePreview("Trade Lab", "Paper trade, backtest, strategy, leaderboard ve P/L.", Icons.Filled.SwapHoriz),
    FeaturePreview("Community", "Feed, composer, comments, reports ve saves.", Icons.Filled.Forum),
    FeaturePreview("AI Assistant", "Context-aware sessions ve saved assets.", Icons.Filled.SmartToy)
)

private val calendarEvents = listOf(
    Triple("10:00", "TR Consumer Confidence", "Medium impact"),
    Triple("14:30", "US Durable Goods", "High impact"),
    Triple("17:00", "Fed speaker", "High impact"),
    Triple("18:30", "Oil inventories", "Medium impact")
)

private val privacyBullets = listOf(
    "Kisisel veriler auth, profil, watchlist ve community islevleri icin saklanir.",
    "Market cache kayitlari cihazda stale-first deneyim icin tutulur.",
    "AI oturumlari kullanici onayi ve hesap baglami ile senkronize edilir."
)

private val termsBullets = listOf(
    "Evalon yatirim tavsiyesi vermez; tum ekranlar karar destek amaclidir.",
    "Paper trade sonuclari gercek emir gerceklesmesi anlamina gelmez.",
    "Topluluk iceriklerinde kotuye kullanim raporlanabilir ve kaldirilabilir."
)

private object EvalonColors {
    val Ink = Color(0xFF06101D)
    val Surface = Color(0xFF0B1728)
    val SurfaceElevated = Color(0xFF12233A)
    val Glass = Color(0xC9142239)
    val CardStroke = Color(0x2EFFFFFF)
    val Grid = Color(0x08FFFFFF)
    val Blue = Color(0xFF2F7DFF)
    val Green = Color(0xFF25D695)
    val Red = Color(0xFFFF5D6C)
    val Amber = Color(0xFFFFB84D)
    val TextPrimary = Color(0xFFEAF2FF)
    val TextMuted = Color(0xFF94A7C4)
}

@Composable
private fun evalonColorScheme() = androidx.compose.material3.darkColorScheme(
    primary = EvalonColors.Blue,
    secondary = EvalonColors.Green,
    background = EvalonColors.Ink,
    surface = EvalonColors.Surface,
    surfaceVariant = EvalonColors.SurfaceElevated,
    onPrimary = Color.White,
    onSecondary = Color.Black,
    onBackground = EvalonColors.TextPrimary,
    onSurface = EvalonColors.TextPrimary,
    onSurfaceVariant = EvalonColors.TextMuted,
    error = EvalonColors.Red
)

@Composable
private fun evalonTypography() = MaterialTheme.typography.copy(
    displaySmall = MaterialTheme.typography.displaySmall.copy(
        fontWeight = FontWeight.Black,
        letterSpacing = (-0.8).sp
    ),
    headlineMedium = MaterialTheme.typography.headlineMedium.copy(
        fontWeight = FontWeight.Black,
        letterSpacing = (-0.5).sp
    ),
    headlineSmall = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
    titleLarge = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
    titleMedium = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
    bodyLarge = MaterialTheme.typography.bodyLarge.copy(lineHeight = 24.sp),
    bodyMedium = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp)
)
