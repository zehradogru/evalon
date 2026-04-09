package com.evalon.shared.presentation.navigation

import com.arkivanov.decompose.ComponentContext
import com.arkivanov.decompose.router.stack.*
import com.arkivanov.decompose.value.Value
import com.evalon.shared.presentation.screens.analysis.AnalysisComponent
import com.evalon.shared.presentation.screens.analysis.AnalysisComponentImpl
import com.evalon.shared.presentation.screens.backtest.BacktestComponent
import com.evalon.shared.presentation.screens.backtest.BacktestComponentImpl
import com.evalon.shared.presentation.screens.companystocks.CompanyStocksComponent
import com.evalon.shared.presentation.screens.companystocks.CompanyStocksComponentImpl
import com.evalon.shared.presentation.screens.correlation.CorrelationComponent
import com.evalon.shared.presentation.screens.correlation.CorrelationComponentImpl
import com.evalon.shared.presentation.screens.dashboard.DashboardComponent
import com.evalon.shared.presentation.screens.dashboard.DashboardComponentImpl
import com.evalon.shared.presentation.screens.exchange.ExchangeComponent
import com.evalon.shared.presentation.screens.exchange.ExchangeComponentImpl
import com.evalon.shared.presentation.screens.llm.LLMComponent
import com.evalon.shared.presentation.screens.llm.LLMComponentImpl
import com.evalon.shared.presentation.screens.login.LoginComponent
import com.evalon.shared.presentation.screens.login.LoginComponentImpl
import com.evalon.shared.presentation.screens.profile.ProfileComponent
import com.evalon.shared.presentation.screens.profile.ProfileComponentImpl
import com.evalon.shared.presentation.screens.settings.SettingsComponent
import com.evalon.shared.presentation.screens.settings.SettingsComponentImpl
import com.evalon.shared.presentation.screens.splash.SplashComponent
import com.evalon.shared.presentation.screens.splash.SplashComponentImpl
import com.evalon.shared.presentation.screens.stockdetail.StockDetailComponent
import com.evalon.shared.presentation.screens.stockdetail.StockDetailComponentImpl
import com.evalon.shared.presentation.screens.strategy.StrategyComponent
import com.evalon.shared.presentation.screens.strategy.StrategyComponentImpl
import com.evalon.shared.presentation.screens.trending.TrendingComponent
import com.evalon.shared.presentation.screens.trending.TrendingComponentImpl
import com.evalon.shared.presentation.screens.watchlist.WatchlistComponent
import com.evalon.shared.presentation.screens.watchlist.WatchlistComponentImpl
import com.evalon.shared.presentation.screens.welcome.WelcomeComponentImpl
import com.evalon.shared.presentation.screens.menu.MenuComponent
import com.evalon.shared.presentation.screens.menu.MenuComponentImpl

interface NavComponent {
    val stack: Value<ChildStack<*, Child>>

    fun navigateToDashboard()
    fun navigateToWelcome(userName: String)
    fun navigateToAnalysis()
    fun navigateToBacktestResults()
    fun navigateToLLM()
    fun navigateToStrategy(strategyId: String? = null)
    fun navigateToCorrelation()
    fun navigateToCompanyStocks(companyId: String? = null)
    fun navigateToExchange(exchangeType: String)
    fun navigateToProfile()
    fun navigateToLogin()
    fun navigateToSettings()
    fun navigateToTrending()
    fun navigateToStockDetail(ticker: String)
    fun navigateToWatchlist()
    fun navigateToMenu()
    fun navigateBack()

    sealed class Child {
        data class Splash(val component: SplashComponent) : Child()
        data class Welcome(val component: WelcomeComponentImpl) : Child()
        data class Dashboard(val component: DashboardComponent) : Child()
        data class Analysis(val component: AnalysisComponent) : Child()
        data class BacktestResults(val component: BacktestComponent) : Child()
        data class LLMChat(val component: LLMComponent) : Child()
        data class Strategy(val component: StrategyComponent) : Child()
        data class Correlation(val component: CorrelationComponent) : Child()
        data class CompanyStocks(val component: CompanyStocksComponent) : Child()
        data class Exchange(val component: ExchangeComponent) : Child()
        data class Profile(val component: ProfileComponent) : Child()
        data class Login(val component: LoginComponent) : Child()
        data class Settings(val component: SettingsComponent) : Child()
        data class Trending(val component: TrendingComponent) : Child()
        data class StockDetail(val component: StockDetailComponent) : Child()
        data class Watchlist(val component: WatchlistComponent) : Child()
        data class Menu(val component: MenuComponent) : Child()
    }
}

class NavComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, NavComponent {

    private val navigation = StackNavigation<NavConfig>()

    override val stack: Value<ChildStack<*, NavComponent.Child>> =
        childStack(
            source = navigation,
            serializer = NavConfig.serializer(),
            initialConfiguration = NavConfig.Splash,
            handleBackButton = true,
            childFactory = ::child
        )

    private fun child(config: NavConfig, componentContext: ComponentContext): NavComponent.Child =
        when (config) {
            is NavConfig.Splash -> NavComponent.Child.Splash(
                SplashComponentImpl(componentContext) {
                    navigation.replaceCurrent(NavConfig.Dashboard)
                }
            )
            is NavConfig.Welcome -> NavComponent.Child.Welcome(
                WelcomeComponentImpl(componentContext, config.userName)
            )
            is NavConfig.Dashboard -> NavComponent.Child.Dashboard(
                DashboardComponentImpl(componentContext)
            )
            is NavConfig.Analysis -> NavComponent.Child.Analysis(
                AnalysisComponentImpl(componentContext)
            )
            is NavConfig.BacktestResults -> NavComponent.Child.BacktestResults(
                BacktestComponentImpl(componentContext)
            )
            is NavConfig.LLMChat -> NavComponent.Child.LLMChat(
                LLMComponentImpl(componentContext)
            )
            is NavConfig.Strategy -> NavComponent.Child.Strategy(
                StrategyComponentImpl(componentContext, config.strategyId)
            )
            is NavConfig.Correlation -> NavComponent.Child.Correlation(
                CorrelationComponentImpl(componentContext)
            )
            is NavConfig.CompanyStocks -> NavComponent.Child.CompanyStocks(
                CompanyStocksComponentImpl(componentContext, config.companyId)
            )
            is NavConfig.Exchange -> NavComponent.Child.Exchange(
                ExchangeComponentImpl(componentContext, config.exchangeType)
            )
            is NavConfig.Profile -> NavComponent.Child.Profile(
                ProfileComponentImpl(componentContext)
            )
            is NavConfig.Login -> NavComponent.Child.Login(
                LoginComponentImpl(componentContext) {
                    navigation.replaceCurrent(NavConfig.Dashboard)
                }
            )
            is NavConfig.Settings -> NavComponent.Child.Settings(
                SettingsComponentImpl(componentContext)
            )
            is NavConfig.Trending -> NavComponent.Child.Trending(
                TrendingComponentImpl(componentContext)
            )
            is NavConfig.StockDetail -> NavComponent.Child.StockDetail(
                StockDetailComponentImpl(componentContext, config.ticker)
            )
            is NavConfig.Watchlist -> NavComponent.Child.Watchlist(
                WatchlistComponentImpl(componentContext)
            )
            is NavConfig.Menu -> NavComponent.Child.Menu(
                MenuComponentImpl(componentContext)
            )
        }

    override fun navigateToDashboard() { navigation.replaceCurrent(NavConfig.Dashboard) }
    override fun navigateToWelcome(userName: String) { navigation.push(NavConfig.Welcome(userName)) }
    override fun navigateToAnalysis() { navigation.push(NavConfig.Analysis) }
    override fun navigateToBacktestResults() { navigation.push(NavConfig.BacktestResults) }
    override fun navigateToLLM() { navigation.push(NavConfig.LLMChat) }
    override fun navigateToStrategy(strategyId: String?) { navigation.push(NavConfig.Strategy(strategyId)) }
    override fun navigateToCorrelation() { navigation.push(NavConfig.Correlation) }
    override fun navigateToCompanyStocks(companyId: String?) { navigation.push(NavConfig.CompanyStocks(companyId)) }
    override fun navigateToExchange(exchangeType: String) { navigation.replaceCurrent(NavConfig.Exchange(exchangeType)) }
    override fun navigateToProfile() { navigation.replaceCurrent(NavConfig.Profile) }
    override fun navigateToLogin() { navigation.push(NavConfig.Login) }
    override fun navigateToSettings() { navigation.push(NavConfig.Settings) }
    override fun navigateToTrending() { navigation.push(NavConfig.Trending) }
    override fun navigateToStockDetail(ticker: String) { navigation.push(NavConfig.StockDetail(ticker)) }
    override fun navigateToWatchlist() { navigation.push(NavConfig.Watchlist) }
    override fun navigateToMenu() { navigation.replaceCurrent(NavConfig.Menu) }
    override fun navigateBack() { navigation.pop() }
}

@kotlinx.serialization.Serializable
sealed class NavConfig {
    @kotlinx.serialization.Serializable
    data object Splash : NavConfig()

    @kotlinx.serialization.Serializable
    data class Welcome(val userName: String) : NavConfig()

    @kotlinx.serialization.Serializable
    data object Dashboard : NavConfig()

    @kotlinx.serialization.Serializable
    data object Analysis : NavConfig()

    @kotlinx.serialization.Serializable
    data object BacktestResults : NavConfig()

    @kotlinx.serialization.Serializable
    data object LLMChat : NavConfig()

    @kotlinx.serialization.Serializable
    data class Strategy(val strategyId: String? = null) : NavConfig()

    @kotlinx.serialization.Serializable
    data object Correlation : NavConfig()

    @kotlinx.serialization.Serializable
    data class CompanyStocks(val companyId: String? = null) : NavConfig()

    @kotlinx.serialization.Serializable
    data class Exchange(val exchangeType: String) : NavConfig()

    @kotlinx.serialization.Serializable
    data object Profile : NavConfig()

    @kotlinx.serialization.Serializable
    data object Login : NavConfig()

    @kotlinx.serialization.Serializable
    data object Settings : NavConfig()

    @kotlinx.serialization.Serializable
    data object Trending : NavConfig()

    @kotlinx.serialization.Serializable
    data class StockDetail(val ticker: String) : NavConfig()

    @kotlinx.serialization.Serializable
    data object Watchlist : NavConfig()

    @kotlinx.serialization.Serializable
    data object Menu : NavConfig()
}
