package com.evalon.shared.presentation.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.arkivanov.decompose.extensions.compose.stack.Children
import com.arkivanov.decompose.extensions.compose.stack.animation.fade
import com.arkivanov.decompose.extensions.compose.stack.animation.stackAnimation
import com.arkivanov.decompose.extensions.compose.subscribeAsState
import com.evalon.shared.di.koinViewModel
import com.evalon.shared.presentation.components.BottomNavTab
import com.evalon.shared.presentation.components.EvalonBottomNavBar
import com.evalon.shared.presentation.screens.analysis.AnalysisScreen
import com.evalon.shared.presentation.screens.analysis.AnalysisViewModel
import com.evalon.shared.presentation.screens.backtest.BacktestScreen
import com.evalon.shared.presentation.screens.backtest.BacktestViewModel
import com.evalon.shared.presentation.screens.companystocks.CompanyStocksScreen
import com.evalon.shared.presentation.screens.companystocks.CompanyStocksViewModel
import com.evalon.shared.presentation.screens.correlation.CorrelationScreen
import com.evalon.shared.presentation.screens.correlation.CorrelationViewModel
import com.evalon.shared.presentation.screens.dashboard.DashboardScreen
import com.evalon.shared.data.local.DatabaseHelper
import com.evalon.shared.di.CurrentSession
import com.evalon.shared.domain.repository.MarketListRepository
import com.evalon.shared.domain.usecase.GetStrategiesUseCase
import com.evalon.shared.domain.usecase.GetUserProfileUseCase
import com.evalon.shared.presentation.screens.exchange.ExchangeScreen
import com.evalon.shared.presentation.screens.exchange.ExchangeViewModel
import org.koin.compose.koinInject
import com.evalon.shared.presentation.screens.llm.LLMScreen
import com.evalon.shared.presentation.screens.llm.LLMViewModel
import com.evalon.shared.presentation.screens.login.LoginScreen
import com.evalon.shared.presentation.screens.login.LoginViewModel
import com.evalon.shared.presentation.screens.menu.MenuScreen
import com.evalon.shared.presentation.screens.profile.ProfileScreen
import com.evalon.shared.presentation.screens.profile.ProfileViewModel
import com.evalon.shared.presentation.screens.settings.SettingsScreen
import com.evalon.shared.presentation.screens.settings.SettingsViewModel
import com.evalon.shared.presentation.screens.splash.SplashScreen
import com.evalon.shared.presentation.screens.stockdetail.StockDetailScreen
import com.evalon.shared.presentation.screens.strategy.StrategyScreen
import com.evalon.shared.presentation.screens.strategy.StrategyViewModel
import com.evalon.shared.presentation.screens.trending.TrendingScreen
import com.evalon.shared.presentation.screens.trending.TrendingViewModel
import com.evalon.shared.presentation.screens.watchlist.WatchlistScreen
import com.evalon.shared.presentation.screens.watchlist.WatchlistViewModel
import com.evalon.shared.presentation.screens.welcome.WelcomeScreen
import com.evalon.shared.presentation.ui.theme.EvalonDarkBg
import com.evalon.shared.presentation.viewmodel.DashboardViewModel

@Composable
fun NavContent(navComponent: NavComponent) {
    val stack by navComponent.stack.subscribeAsState()

    // Determine if current screen should show bottom nav
    val currentChild = stack.active.instance
    val showBottomNav = currentChild is NavComponent.Child.Dashboard ||
            currentChild is NavComponent.Child.Exchange ||
            currentChild is NavComponent.Child.Profile ||
            currentChild is NavComponent.Child.Menu

    // Determine selected tab
    val selectedTab = when (currentChild) {
        is NavComponent.Child.Dashboard -> BottomNavTab.HOME
        is NavComponent.Child.Exchange -> BottomNavTab.MARKETS
        is NavComponent.Child.Profile -> BottomNavTab.PROFILE
        is NavComponent.Child.Menu -> BottomNavTab.MENU
        else -> BottomNavTab.HOME
    }

    Scaffold(
        containerColor = EvalonDarkBg,
        bottomBar = {
            if (showBottomNav) {
                EvalonBottomNavBar(
                    selectedTab = selectedTab,
                    onTabSelected = { tab ->
                        when (tab) {
                            BottomNavTab.HOME -> navComponent.navigateToDashboard()
                            BottomNavTab.MARKETS -> navComponent.navigateToExchange("BIST")
                            BottomNavTab.PROFILE -> navComponent.navigateToProfile()
                            BottomNavTab.MENU -> navComponent.navigateToMenu()
                        }
                    }
                )
            }
        }
    ) { padding ->
        Children(
            stack = stack,
            animation = stackAnimation(fade()),
            modifier = if (showBottomNav) Modifier.padding(bottom = padding.calculateBottomPadding()) else Modifier
        ) { child ->
            when (val instance = child.instance) {
                is NavComponent.Child.Splash -> {
                    SplashScreen(component = instance.component)
                }
                is NavComponent.Child.Welcome -> {
                    WelcomeScreen(
                        userName = instance.component.userName,
                        onContinue = {
                            instance.component.onContinue()
                            navComponent.navigateToDashboard()
                        }
                    )
                }
                is NavComponent.Child.Dashboard -> {
                    val viewModel: DashboardViewModel = koinViewModel()
                    DashboardScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onStrategyClick = { navComponent.navigateToStrategy(it) },
                        onStockClick = { navComponent.navigateToStockDetail(it) }
                    )
                }
                is NavComponent.Child.Analysis -> {
                    val viewModel = AnalysisViewModel()
                    AnalysisScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.BacktestResults -> {
                    val viewModel = BacktestViewModel()
                    BacktestScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.LLMChat -> {
                    val viewModel = LLMViewModel()
                    LLMScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Strategy -> {
                    val viewModel = StrategyViewModel(
                        strategyId = instance.component.strategyId,
                        getStrategiesUseCase = koinInject(),
                        dbHelper = koinInject(),
                        currentSession = koinInject()
                    )
                    StrategyScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onBacktestClick = { navComponent.navigateToBacktestResults() },
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Correlation -> {
                    val viewModel = CorrelationViewModel()
                    CorrelationScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.CompanyStocks -> {
                    val viewModel = CompanyStocksViewModel(instance.component.companyId)
                    CompanyStocksScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onStockClick = { navComponent.navigateToStockDetail(it) },
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Exchange -> {
                    val marketListRepo = koinInject<MarketListRepository>()
                    val viewModel = ExchangeViewModel(instance.component.exchangeType, marketListRepo)
                    ExchangeScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onStockClick = { navComponent.navigateToStockDetail(it) },
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Profile -> {
                    val viewModel = ProfileViewModel(
                        getUserProfileUseCase = koinInject(),
                        currentSession = koinInject()
                    )
                    ProfileScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onSettingsClick = { navComponent.navigateToSettings() },
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Login -> {
                    val viewModel: LoginViewModel = koinViewModel()
                    LoginScreen(
                        component = instance.component,
                        viewModel = viewModel
                    )
                }
                is NavComponent.Child.Settings -> {
                    val viewModel = SettingsViewModel()
                    SettingsScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Trending -> {
                    val viewModel = TrendingViewModel(
                        marketListRepository = koinInject()
                    )
                    TrendingScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onStockClick = { navComponent.navigateToStockDetail(it) },
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.StockDetail -> {
                    StockDetailScreen(
                        component = instance.component,
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Watchlist -> {
                    val viewModel = WatchlistViewModel(
                        dbHelper = koinInject(),
                        marketListRepository = koinInject()
                    )
                    WatchlistScreen(
                        component = instance.component,
                        viewModel = viewModel,
                        onStockClick = { navComponent.navigateToStockDetail(it) },
                        onBack = { navComponent.navigateBack() }
                    )
                }
                is NavComponent.Child.Menu -> {
                    MenuScreen(
                        component = instance.component,
                        onTrendingClick = { navComponent.navigateToTrending() },
                        onStrategyClick = { navComponent.navigateToStrategy() },
                        onAnalysisClick = { navComponent.navigateToAnalysis() },
                        onCorrelationClick = { navComponent.navigateToCorrelation() },
                        onCompanyStocksClick = { navComponent.navigateToCompanyStocks() },
                        onBacktestClick = { navComponent.navigateToBacktestResults() },
                        onLLMClick = { navComponent.navigateToLLM() },
                        onWatchlistClick = { navComponent.navigateToWatchlist() },
                        onSettingsClick = { navComponent.navigateToSettings() }
                    )
                }
            }
        }
    }
}
