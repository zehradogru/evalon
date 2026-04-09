import type { SignalModel, TimeFrame } from '@graph/shared-types';
import type { BacktestPortfolioCurve, BacktestRunResult, BacktestTrade } from './backtest/engine';
import { ColorType, CrosshairMode, createChart, type IChartApi, type Time } from 'lightweight-charts';
import { TICKERS, normalizeTicker } from './data/tickers';

type StageKey = 'trend' | 'setup' | 'trigger';
type TradeDirection = 'long' | 'short' | 'both';
type AutomationLevel = 'template' | 'indicator';
type RuleFamily = 'all' | 'price_action' | 'fibonacci' | 'pattern' | 'volume' | 'indicator';
type ResultTab = 'overview' | 'symbols' | 'trades' | 'liquidity' | 'notes';

interface ParamDef {
    key: string;
    label: string;
    defaultValue: number;
    min: number;
    max: number;
    step: number;
}

interface RuleTemplate {
    id: string;
    label: string;
    category: string;
    summary: string;
    stages: StageKey[];
    automation: AutomationLevel;
    params: ParamDef[];
}

interface SelectedRule {
    id: string;
    required: boolean;
    params: Record<string, number>;
}

interface StageConfig {
    key: StageKey;
    timeframe: TimeFrame;
    required: boolean;
    minOptionalMatches: number;
    rules: SelectedRule[];
}

interface BlueprintState {
    symbol: string;
    symbols: string[];
    activePresetId: string;
    testWindowDays: number;
    stageThreshold: number;
    direction: TradeDirection;
    portfolio: {
        initialCapital: number;
        positionSize: number;
        commissionPct: number;
    };
    risk: {
        stopPct: number;
        targetPct: number;
        maxBars: number;
    };
    stages: Record<StageKey, StageConfig>;
}

interface Preset {
    id: string;
    label: string;
    summary: string;
    build: (symbol: string, frames: Record<StageKey, TimeFrame>) => BlueprintState;
}

interface BacktestRunApiResponse {
    runId: string;
    result: BacktestRunResult;
    summary: {
        totalTrades: number;
        winRate: number;
        totalPnl: number;
        maxDrawdown: number;
    };
    eventsCount: number;
}

interface BacktestRunProgress {
    phase: string;
    progressPct: number;
    totalSymbols: number;
    processedSymbols: number;
    currentSymbol?: string | null;
    message: string;
}

interface BacktestStartApiResponse {
    runId: string;
    status: string;
    progress: BacktestRunProgress;
}

interface BacktestRunStatusApiResponse {
    runId: string;
    status: string;
    createdAt: number;
    startedAt?: number | null;
    finishedAt?: number | null;
    progress?: BacktestRunProgress;
    result?: BacktestRunResult;
    summary?: BacktestRunApiResponse['summary'];
    eventsCount: number;
    error?: string | null;
}

interface BacktestRunPortfolioCurveApiResponse {
    runId: string;
    status: string;
    createdAt: number;
    startedAt?: number | null;
    finishedAt?: number | null;
    progress?: BacktestRunProgress;
    summary?: BacktestRunApiResponse['summary'];
    curve?: BacktestPortfolioCurve;
    error?: string | null;
}

const STORAGE_KEY = 'graph.backtest.workspace.v1';
const SIGNAL_PREVIEW_KEY = 'graph.chart.signal-preview.v1';
const API_BASE = import.meta.env?.VITE_API_BASE || '/api/v1';
const RUN_STATUS_POLL_MS = 900;
const PORTFOLIO_CURVE_CHART_ID = 'bt-portfolio-curve-chart';
const TIMEFRAMES: TimeFrame[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w', '1M'];
const RESULT_DATE_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});
const RULE_FAMILY_TABS: Array<{ id: RuleFamily; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'price_action', label: 'Price Action' },
    { id: 'fibonacci', label: 'Fibonacci' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'volume', label: 'Volume' },
    { id: 'indicator', label: 'Indicator' },
];

const STAGE_META: Record<StageKey, { kicker: string; title: string; description: string }> = {
    trend: {
        kicker: 'Ust Periyot',
        title: 'Ana trendi sec',
        description: 'Dow mantigiyla buyuk yonu sec. Burada yonu belirlersin; alt hareketlerden daha onemli olan ana yapiyi netlestirirsin.',
    },
    setup: {
        kicker: 'Orta Periyot',
        title: 'Islem fikrini kur',
        description: 'Destek/direnc, kirilim, pullback, sikisma ve formasyonlari okuyup nereden isleme girmek istedigini kurarsin.',
    },
    trigger: {
        kicker: 'Alt Periyot',
        title: 'Tetigi hassaslastir',
        description: 'Mum yapisi, retest, hacim teyidi ve stop mesafesi ile girisi mikronize edersin. Yon secmek icin degil, girisi netlestirmek icin.',
    },
};

const RULE_LIBRARY: RuleTemplate[] = [
    {
        id: 'hhhl',
        label: 'Yukselen dip + yukselen tepe',
        category: 'Structure',
        summary: 'Ust periyotta trendin yukari yone oturdugunu yapisal olarak teyit eder.',
        stages: ['trend'],
        automation: 'template',
        params: [{ key: 'lookback', label: 'Lookback bar', defaultValue: 20, min: 5, max: 200, step: 1 }],
    },
    {
        id: 'lhll',
        label: 'Alcalan tepe + alcalan dip',
        category: 'Structure',
        summary: 'Ust periyotta asagi yonlu yapinin devam ettigini teyit eder.',
        stages: ['trend'],
        automation: 'template',
        params: [{ key: 'lookback', label: 'Lookback bar', defaultValue: 20, min: 5, max: 200, step: 1 }],
    },
    {
        id: 'ema-stack',
        label: 'EMA stack',
        category: 'Trend Filter',
        summary: 'EMA 20 / 50 / 200 dizilimi ile trend rejimini filtreler.',
        stages: ['trend', 'setup'],
        automation: 'template',
        params: [{ key: 'fast', label: 'Fast EMA', defaultValue: 20, min: 2, max: 100, step: 1 }, { key: 'slow', label: 'Slow EMA', defaultValue: 50, min: 5, max: 200, step: 1 }],
    },
    {
        id: 'rsi-regime',
        label: 'RSI regime',
        category: 'Indicator',
        summary: 'RSI ile rejim filtresi kur. Otomasyon uyumlu kural olarak dusunuldu.',
        stages: ['trend', 'setup', 'trigger'],
        automation: 'indicator',
        params: [{ key: 'period', label: 'RSI period', defaultValue: 14, min: 2, max: 100, step: 1 }, { key: 'level', label: 'Regime level', defaultValue: 50, min: 1, max: 99, step: 1 }],
    },
    {
        id: 'breakout',
        label: 'Direnc kirilimi',
        category: 'Breakout',
        summary: 'Orta periyotta yatay veya egimli direnc bolgesinden cikisi isaretler.',
        stages: ['setup'],
        automation: 'template',
        params: [{ key: 'lookback', label: 'Level window', defaultValue: 30, min: 5, max: 250, step: 1 }, { key: 'buffer', label: 'Break %', defaultValue: 0.6, min: 0.1, max: 5, step: 0.1 }],
    },
    {
        id: 'pullback',
        label: 'EMA pullback',
        category: 'Pullback',
        summary: 'Ana trend yonunde geri cekilmeyi islem fikrine donusturur.',
        stages: ['setup'],
        automation: 'template',
        params: [{ key: 'ema', label: 'Target EMA', defaultValue: 20, min: 5, max: 100, step: 1 }, { key: 'tolerance', label: 'Tolerance %', defaultValue: 1, min: 0.1, max: 5, step: 0.1 }],
    },
    {
        id: 'compression',
        label: 'Sikisma / contraction',
        category: 'Pattern',
        summary: 'Volatilite daralmasi ve enerji birikimini setup asamasinda izler.',
        stages: ['setup'],
        automation: 'template',
        params: [{ key: 'bars', label: 'Bars', defaultValue: 12, min: 3, max: 80, step: 1 }, { key: 'rangePct', label: 'Range %', defaultValue: 2.5, min: 0.2, max: 12, step: 0.1 }],
    },
    {
        id: 'macd-cross',
        label: 'MACD cross',
        category: 'Indicator',
        summary: 'MACD ve signal crossover ile momentum tetigi kurar.',
        stages: ['setup', 'trigger'],
        automation: 'indicator',
        params: [{ key: 'fast', label: 'Fast', defaultValue: 12, min: 2, max: 80, step: 1 }, { key: 'slow', label: 'Slow', defaultValue: 26, min: 3, max: 120, step: 1 }, { key: 'signal', label: 'Signal', defaultValue: 9, min: 2, max: 60, step: 1 }],
    },
    {
        id: 'retest',
        label: 'Retest hold',
        category: 'Trigger',
        summary: 'Kirilan bolgenin retest ile korunup korunmadigini giris asamasinda netlestirir.',
        stages: ['trigger'],
        automation: 'template',
        params: [{ key: 'bars', label: 'Retest bars', defaultValue: 4, min: 1, max: 24, step: 1 }, { key: 'tolerance', label: 'Tolerance %', defaultValue: 0.5, min: 0.1, max: 4, step: 0.1 }],
    },
    {
        id: 'volume-confirm',
        label: 'Hacim teyidi',
        category: 'Volume',
        summary: 'Giris aninda hacim genislemesi ile sinyalin arkasinda katilim oldugunu dogrular.',
        stages: ['trigger'],
        automation: 'template',
        params: [{ key: 'factor', label: 'Volume factor', defaultValue: 1.6, min: 1, max: 5, step: 0.1 }, { key: 'lookback', label: 'Average bars', defaultValue: 20, min: 5, max: 120, step: 1 }],
    },
    {
        id: 'micro-breakout',
        label: 'Mikro kirilim',
        category: 'Trigger',
        summary: 'Alt periyotta lokal pivot ustunden temiz cikis ile girisi hassaslastirir.',
        stages: ['trigger'],
        automation: 'template',
        params: [{ key: 'bars', label: 'Pivot bars', defaultValue: 6, min: 2, max: 40, step: 1 }],
    },
    {
        id: 'reversal-candle',
        label: 'Tetik mum yapisi',
        category: 'Candle',
        summary: 'Bullish engulfing, pin bar veya guclu closing range gibi mikro tetik mantigini temsil eder.',
        stages: ['trigger'],
        automation: 'template',
        params: [{ key: 'bodyPct', label: 'Body %', defaultValue: 60, min: 20, max: 100, step: 1 }],
    },
    {
        id: 'ema-cross',
        label: 'EMA cross',
        category: 'Indicator',
        summary: 'Hizli ve yavas EMA kesişimi ile momentumun yone dondugu anlari tarar.',
        stages: ['setup', 'trigger'],
        automation: 'indicator',
        params: [{ key: 'fast', label: 'Fast EMA', defaultValue: 9, min: 2, max: 100, step: 1 }, { key: 'slow', label: 'Slow EMA', defaultValue: 21, min: 3, max: 200, step: 1 }],
    },
    {
        id: 'ma-ribbon',
        label: 'MA ribbon trend',
        category: 'Trend Filter',
        summary: 'EMA ribbon dizilimi ve egimi ile trendin saglikli sekilde surup surmedigini filtreler.',
        stages: ['trend', 'setup'],
        automation: 'indicator',
        params: [
            { key: 'fast', label: 'Fast EMA', defaultValue: 8, min: 2, max: 80, step: 1 },
            { key: 'mid', label: 'Mid EMA', defaultValue: 21, min: 3, max: 120, step: 1 },
            { key: 'slow', label: 'Slow EMA', defaultValue: 55, min: 5, max: 240, step: 1 },
        ],
    },
    {
        id: 'donchian-breakout',
        label: 'Donchian breakout',
        category: 'Breakout',
        summary: 'Son N barin en yuksek/en dusuk kanalinin disina cikisi izler; klasik trend takibi mantigi.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [{ key: 'lookback', label: 'Channel bars', defaultValue: 20, min: 5, max: 250, step: 1 }],
    },
    {
        id: 'bollinger-squeeze',
        label: 'Bollinger squeeze',
        category: 'Volatility',
        summary: 'Band genisligi daraldiginda enerji birikimini yakalar; kirilim kurallariyla birlikte kullanilir.',
        stages: ['setup', 'trigger'],
        automation: 'indicator',
        params: [
            { key: 'period', label: 'Period', defaultValue: 20, min: 5, max: 120, step: 1 },
            { key: 'deviation', label: 'Deviation', defaultValue: 2, min: 1, max: 4, step: 0.1 },
            { key: 'widthPct', label: 'Max width %', defaultValue: 6, min: 0.5, max: 20, step: 0.1 },
        ],
    },
    {
        id: 'vwap-reclaim',
        label: 'VWAP reclaim',
        category: 'Volume',
        summary: 'Ozellikle intraday tarafta fiyatin session VWAP ustune geri donup tutunmasini arar.',
        stages: ['setup', 'trigger'],
        automation: 'indicator',
        params: [],
    },
    {
        id: 'inside-breakout',
        label: 'Inside bar break',
        category: 'Pattern',
        summary: 'Mother bar araligindan cikis ile sikismadan ekspansiyona gecisi temsil eder.',
        stages: ['trigger'],
        automation: 'template',
        params: [],
    },
    {
        id: 'rsi-reclaim',
        label: 'RSI reclaim',
        category: 'Indicator',
        summary: 'RSI asiri bolgeden geri cikarken mean reversion veya momentum devam sinyali uretir.',
        stages: ['setup', 'trigger'],
        automation: 'indicator',
        params: [
            { key: 'period', label: 'RSI period', defaultValue: 14, min: 2, max: 100, step: 1 },
            { key: 'lower', label: 'Lower level', defaultValue: 30, min: 1, max: 49, step: 1 },
            { key: 'upper', label: 'Upper level', defaultValue: 70, min: 51, max: 99, step: 1 },
        ],
    },
    {
        id: 'stoch-rsi-cross',
        label: 'Stoch RSI cross',
        category: 'Indicator',
        summary: 'Stoch RSI kesişimi ile hizlanan momentum veya mean reversion tetigini arar.',
        stages: ['trigger'],
        automation: 'indicator',
        params: [
            { key: 'rsiPeriod', label: 'RSI period', defaultValue: 14, min: 2, max: 100, step: 1 },
            { key: 'stochPeriod', label: 'Stoch period', defaultValue: 14, min: 3, max: 100, step: 1 },
            { key: 'signal', label: 'Signal', defaultValue: 3, min: 2, max: 20, step: 1 },
            { key: 'oversold', label: 'Oversold', defaultValue: 20, min: 1, max: 49, step: 1 },
            { key: 'overbought', label: 'Overbought', defaultValue: 80, min: 51, max: 99, step: 1 },
        ],
    },
    {
        id: 'fib-bounce',
        label: 'Fib 38.2 / 61.8 bounce',
        category: 'Fibonacci',
        summary: 'Son swing icinde 38.2-61.8 geri cekilme bolgesinden gelen tepkiyi takip eder.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'lookback', label: 'Swing bars', defaultValue: 55, min: 20, max: 300, step: 1 },
            { key: 'upperLevel', label: 'Upper fib', defaultValue: 0.382, min: 0.2, max: 0.8, step: 0.001 },
            { key: 'lowerLevel', label: 'Lower fib', defaultValue: 0.618, min: 0.2, max: 0.9, step: 0.001 },
        ],
    },
    {
        id: 'fib-golden-pocket',
        label: 'Fib golden pocket',
        category: 'Fibonacci',
        summary: '0.618-0.65 golden pocket bolgesinden gelen trend yonlu donusu yakalamaya calisir.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'lookback', label: 'Swing bars', defaultValue: 55, min: 20, max: 300, step: 1 },
            { key: 'lowerLevel', label: 'Lower fib', defaultValue: 0.65, min: 0.5, max: 0.8, step: 0.001 },
            { key: 'upperLevel', label: 'Upper fib', defaultValue: 0.618, min: 0.4, max: 0.75, step: 0.001 },
        ],
    },
    {
        id: 'support-hold',
        label: 'Destekten donus',
        category: 'Support/Resistance',
        summary: 'Son destek alanina inip oradan guclu kapanisla donen fiyat davranisini tarar.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'lookback', label: 'Support bars', defaultValue: 30, min: 5, max: 250, step: 1 },
            { key: 'tolerance', label: 'Tolerance %', defaultValue: 0.8, min: 0.1, max: 5, step: 0.1 },
        ],
    },
    {
        id: 'sr-flip-retest',
        label: 'S/R flip retest',
        category: 'Support/Resistance',
        summary: 'Kirilan direncin destek gibi calisarak tekrar test edilmesini arar.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'lookback', label: 'Level bars', defaultValue: 25, min: 5, max: 200, step: 1 },
            { key: 'tolerance', label: 'Tolerance %', defaultValue: 0.6, min: 0.1, max: 4, step: 0.1 },
        ],
    },
    {
        id: 'ascending-triangle',
        label: 'Ascending triangle',
        category: 'Pattern',
        summary: 'Yatay direnc ve yukselen diplerden olusan klasik devam formasyonunu tarar.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'bars', label: 'Pattern bars', defaultValue: 24, min: 8, max: 120, step: 1 },
            { key: 'tolerance', label: 'High tolerance %', defaultValue: 0.8, min: 0.1, max: 5, step: 0.1 },
        ],
    },
    {
        id: 'double-bottom',
        label: 'Double bottom / top',
        category: 'Pattern',
        summary: 'Iki benzer dip veya tepe sonrasi neckline kirilimi ile donusu teyit etmeye calisir.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'bars', label: 'Pattern bars', defaultValue: 30, min: 10, max: 160, step: 1 },
            { key: 'tolerance', label: 'Low tolerance %', defaultValue: 1.2, min: 0.2, max: 6, step: 0.1 },
        ],
    },
    {
        id: 'bull-flag',
        label: 'Bull/Bear flag',
        category: 'Pattern',
        summary: 'Impulse hareketten sonra gelen duzeltme kanalinin kirilimini arar.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'impulseBars', label: 'Impulse bars', defaultValue: 8, min: 3, max: 40, step: 1 },
            { key: 'pullbackBars', label: 'Pullback bars', defaultValue: 6, min: 3, max: 30, step: 1 },
            { key: 'minMovePct', label: 'Impulse %', defaultValue: 4, min: 0.5, max: 20, step: 0.1 },
        ],
    },
    {
        id: 'rectangle-breakout',
        label: 'Rectangle breakout',
        category: 'Pattern',
        summary: 'Yatay band icinde baz olusturup sonrasinda band disina cikan hareketi temsil eder.',
        stages: ['setup', 'trigger'],
        automation: 'template',
        params: [
            { key: 'bars', label: 'Base bars', defaultValue: 20, min: 5, max: 120, step: 1 },
            { key: 'rangePct', label: 'Max range %', defaultValue: 4, min: 0.5, max: 20, step: 0.1 },
        ],
    },
    {
        id: 'trend-slope',
        label: 'Trend slope',
        category: 'Trend Filter',
        summary: 'Secilen lookback boyunca fiyatin net yone egimli akip akmadigini kontrol eder.',
        stages: ['trend', 'setup'],
        automation: 'template',
        params: [
            { key: 'lookback', label: 'Lookback bars', defaultValue: 30, min: 5, max: 200, step: 1 },
            { key: 'minMovePct', label: 'Min move %', defaultValue: 6, min: 0.5, max: 30, step: 0.1 },
        ],
    },
    {
        id: 'channel-trend',
        label: 'Price channel trend',
        category: 'Trend Filter',
        summary: 'Fiyatin kanal ust yari veya alt yari icinde islem gormesiyle trendi filtreler.',
        stages: ['trend', 'setup'],
        automation: 'template',
        params: [
            { key: 'lookback', label: 'Channel bars', defaultValue: 40, min: 10, max: 250, step: 1 },
        ],
    },
    {
        id: 'adx-dmi-trend',
        label: 'ADX + DMI trend',
        category: 'Trend Strength',
        summary: 'ADX gucu ve +DI/-DI yonu ile ana trendin hem guclu hem de yonlu olup olmadigini filtreler.',
        stages: ['trend', 'setup'],
        automation: 'indicator',
        params: [
            { key: 'period', label: 'ADX period', defaultValue: 14, min: 5, max: 100, step: 1 },
            { key: 'threshold', label: 'ADX min', defaultValue: 25, min: 5, max: 60, step: 0.5 },
            { key: 'spread', label: 'DI spread', defaultValue: 5, min: 0.5, max: 40, step: 0.5 },
        ],
    },
    {
        id: 'aroon-trend',
        label: 'Aroon trend',
        category: 'Trend Strength',
        summary: 'Son zirve ve diplerin ne kadar yeni olduguna bakarak trendin tazeligini ve yonunu olcer.',
        stages: ['trend'],
        automation: 'indicator',
        params: [
            { key: 'period', label: 'Aroon period', defaultValue: 25, min: 5, max: 150, step: 1 },
            { key: 'strongLevel', label: 'Strong level', defaultValue: 70, min: 50, max: 100, step: 1 },
            { key: 'weakLevel', label: 'Weak level', defaultValue: 30, min: 0, max: 50, step: 1 },
        ],
    },
    {
        id: 'ichimoku-cloud-trend',
        label: 'Ichimoku cloud trend',
        category: 'Trend Filter',
        summary: 'Fiyatin bulutun ustunde/altinda olmasi, cloud rengi ve Tenkan-Kijun iliskisi ile trend rejimini teyit eder.',
        stages: ['trend', 'setup'],
        automation: 'indicator',
        params: [
            { key: 'conversion', label: 'Tenkan', defaultValue: 9, min: 2, max: 60, step: 1 },
            { key: 'base', label: 'Kijun', defaultValue: 26, min: 3, max: 120, step: 1 },
            { key: 'spanB', label: 'Span B', defaultValue: 52, min: 5, max: 240, step: 1 },
            { key: 'displacement', label: 'Displacement', defaultValue: 26, min: 1, max: 120, step: 1 },
        ],
    },
    {
        id: 'vortex-trend',
        label: 'Vortex trend',
        category: 'Trend Strength',
        summary: 'VI+ ve VI- ayrisimi ile yone hakim olan hareketin gucunu izler.',
        stages: ['trend', 'setup'],
        automation: 'indicator',
        params: [
            { key: 'period', label: 'Vortex period', defaultValue: 14, min: 5, max: 100, step: 1 },
            { key: 'spread', label: 'VI spread', defaultValue: 0.08, min: 0.01, max: 1, step: 0.01 },
        ],
    },
    {
        id: 'supertrend-bias',
        label: 'SuperTrend bias',
        category: 'Trend Filter',
        summary: 'ATR tabanli SuperTrend cizgisinin ustu/alti ile ana yonu trend takip mantigiyla filtreler.',
        stages: ['trend', 'setup'],
        automation: 'indicator',
        params: [
            { key: 'period', label: 'ATR period', defaultValue: 14, min: 5, max: 100, step: 1 },
            { key: 'multiplier', label: 'Multiplier', defaultValue: 3, min: 1, max: 10, step: 0.1 },
        ],
    },
    {
        id: 'psar-trend',
        label: 'Parabolic SAR trend',
        category: 'Trend Filter',
        summary: 'Parabolic SAR noktalarinin fiyatin ustunde veya altinda kalmasi ile trend yonunu izler.',
        stages: ['trend', 'setup'],
        automation: 'indicator',
        params: [
            { key: 'step', label: 'AF step', defaultValue: 0.02, min: 0.001, max: 0.2, step: 0.001 },
            { key: 'maxStep', label: 'AF max', defaultValue: 0.2, min: 0.02, max: 1, step: 0.01 },
        ],
    },
    {
        id: 'macd-zero-bias',
        label: 'MACD zero-line bias',
        category: 'Trend Filter',
        summary: "MACD'nin sifir cizgisinin ustunde veya altinda kalmasi ile orta vadeli trend tarafini belirler.",
        stages: ['trend', 'setup'],
        automation: 'indicator',
        params: [
            { key: 'fast', label: 'Fast', defaultValue: 12, min: 2, max: 200, step: 1 },
            { key: 'slow', label: 'Slow', defaultValue: 26, min: 3, max: 300, step: 1 },
            { key: 'signal', label: 'Signal', defaultValue: 9, min: 2, max: 120, step: 1 },
        ],
    },
];

const TEMPLATE_BY_ID = new Map(RULE_LIBRARY.map((rule) => [rule.id, rule]));

function makeRule(id: string, required: boolean, overrides: Record<string, number> = {}): SelectedRule {
    const template = TEMPLATE_BY_ID.get(id);
    if (!template) throw new Error(`Unknown rule template: ${id}`);
    const params = Object.fromEntries(template.params.map((param) => [param.key, param.defaultValue]));
    return {
        id,
        required,
        params: { ...params, ...overrides },
    };
}

function defaultPortfolio() {
    return {
        initialCapital: 100000,
        positionSize: 10000,
        commissionPct: 0.1,
    };
}

const PRESETS: Preset[] = [
    {
        id: 'starter-support',
        label: 'Starter Support',
        summary: 'Saatlik kaynakta en hizli sonuc veren baslangic seti: destekte tepki arar ve tek stage ile trade uretir.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'starter-support',
            testWindowDays: 365,
            stageThreshold: 1,
            direction: 'long',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 2, targetPct: 4, maxBars: 12 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [] },
                setup: { key: 'setup', timeframe: frames.setup, required: false, minOptionalMatches: 0, rules: [] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('support-hold', true, { lookback: 25, tolerance: 1 })] },
            },
        }),
    },
    {
        id: 'breakout-stack',
        label: 'Breakout Micro',
        summary: '4 saatlik kirilim ve 1 saatlik mikro teyit ile devam hareketlerini tarar.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'breakout-stack',
            testWindowDays: 365,
            stageThreshold: 2,
            direction: 'long',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.8, targetPct: 5, maxBars: 12 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [] },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('breakout', true, { lookback: 20, buffer: 0.2 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('micro-breakout', true, { bars: 4 })] },
            },
        }),
    },
    {
        id: 'support-reversal',
        label: 'Support Reversal',
        summary: '4 saatlik destekte tutunma ve 1 saatlik tetik mumu ile reaksiyon islemine odaklanir.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'support-reversal',
            testWindowDays: 365,
            stageThreshold: 2,
            direction: 'long',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.9, targetPct: 4.6, maxBars: 10 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [] },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('support-hold', true, { lookback: 25, tolerance: 1 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('reversal-candle', true, { bodyPct: 55 })] },
            },
        }),
    },
    {
        id: 'trend-breakout-lite',
        label: 'Trend Breakout Lite',
        summary: 'Gunluk trend egimini advisory tutup 4 saatlik kirilim ve 1 saatlik mikro teyidi birlestirir.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'trend-breakout-lite',
            testWindowDays: 365,
            stageThreshold: 2,
            direction: 'long',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 2, targetPct: 5, maxBars: 12 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [makeRule('trend-slope', true, { lookback: 20, minMovePct: 1.5 })] },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('breakout', true, { lookback: 20, buffer: 0.2 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('micro-breakout', true, { bars: 4 })] },
            },
        }),
    },
    {
        id: 'rsi-reclaim-reversion',
        label: 'RSI Reclaim',
        summary: '4 saatlik RSI geri kazanimini 1 saatlik tetik mumu ile birlestirir; her iki yone de trade arayabilir.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'rsi-reclaim-reversion',
            testWindowDays: 365,
            stageThreshold: 2,
            direction: 'both',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.5, targetPct: 3.8, maxBars: 10 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [] },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('rsi-reclaim', true, { period: 14, lower: 35, upper: 65 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('reversal-candle', true, { bodyPct: 55 })] },
            },
        }),
    },
    {
        id: 'fib-trend-pullback',
        label: 'Fib Reaction',
        summary: '4 saatlik golden pocket tepkisini 1 saatlik tetik mumu ile eslestirir; seyrek ama secici bir set.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'fib-trend-pullback',
            testWindowDays: 365,
            stageThreshold: 2,
            direction: 'long',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.9, targetPct: 5.2, maxBars: 12 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [] },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('fib-golden-pocket', true, { lookback: 34, upperLevel: 0.618, lowerLevel: 0.65 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('reversal-candle', true, { bodyPct: 55 })] },
            },
        }),
    },
    {
        id: 'sr-break-retest',
        label: 'S/R Break Retest',
        summary: '4 saatlik seviyenin kirilip tekrar test edilmesini ve 1 saatlik mikro teyidi arar.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'sr-break-retest',
            testWindowDays: 365,
            stageThreshold: 2,
            direction: 'both',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.7, targetPct: 4.4, maxBars: 11 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [] },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('sr-flip-retest', true, { lookback: 20, tolerance: 0.8 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('micro-breakout', true, { bars: 4 })] },
            },
        }),
    },
    {
        id: 'pattern-continuation',
        label: 'Rectangle + Inside',
        summary: '4 saatlik yatay bazin kirilimini 1 saatlik inside-bar acilimi ile tamamlar.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'pattern-continuation',
            testWindowDays: 365,
            stageThreshold: 2,
            direction: 'both',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.8, targetPct: 5, maxBars: 12 },
            stages: {
                trend: { key: 'trend', timeframe: frames.trend, required: false, minOptionalMatches: 0, rules: [] },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('rectangle-breakout', true, { bars: 16, rangePct: 5 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('inside-breakout', true)] },
            },
        }),
    },
    {
        id: 'trend-consensus',
        label: 'Trend Consensus',
        summary: "Trend stage'de ADX/DMI, Ichimoku ve EMA dizilimini birlestirip sadece guclu ana trendlerde kirilim arar.",
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'trend-consensus',
            testWindowDays: 365,
            stageThreshold: 3,
            direction: 'long',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.9, targetPct: 5.4, maxBars: 14 },
            stages: {
                trend: {
                    key: 'trend',
                    timeframe: frames.trend,
                    required: true,
                    minOptionalMatches: 0,
                    rules: [
                        makeRule('adx-dmi-trend', true, { period: 14, threshold: 22, spread: 4 }),
                        makeRule('ichimoku-cloud-trend', true),
                        makeRule('ema-stack', true, { fast: 20, slow: 50 }),
                    ],
                },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('breakout', true, { lookback: 20, buffer: 0.2 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('micro-breakout', true, { bars: 4 })] },
            },
        }),
    },
    {
        id: 'trend-pullback-pro',
        label: 'Trend Pullback Pro',
        summary: 'SuperTrend ve MACD bias ile ana trendi sabitler, orta periyotta pullback ve alt periyotta tetik mumu arar.',
        build: (symbol, frames) => ({
            symbol,
            symbols: [symbol],
            activePresetId: 'trend-pullback-pro',
            testWindowDays: 365,
            stageThreshold: 3,
            direction: 'both',
            portfolio: defaultPortfolio(),
            risk: { stopPct: 1.8, targetPct: 4.8, maxBars: 12 },
            stages: {
                trend: {
                    key: 'trend',
                    timeframe: frames.trend,
                    required: true,
                    minOptionalMatches: 0,
                    rules: [
                        makeRule('supertrend-bias', true, { period: 14, multiplier: 3 }),
                        makeRule('macd-zero-bias', true),
                    ],
                },
                setup: { key: 'setup', timeframe: frames.setup, required: true, minOptionalMatches: 0, rules: [makeRule('pullback', true, { ema: 20, tolerance: 1 })] },
                trigger: { key: 'trigger', timeframe: frames.trigger, required: true, minOptionalMatches: 0, rules: [makeRule('reversal-candle', true, { bodyPct: 55 })] },
            },
        }),
    },
];

const search = new URLSearchParams(window.location.search);
const symbolInput = document.getElementById('bt-symbol') as HTMLInputElement;
const symbolAddButton = document.getElementById('bt-symbol-add') as HTMLButtonElement;
const symbolSelectAllButton = document.getElementById('bt-symbol-select-all') as HTMLButtonElement;
const symbolClearButton = document.getElementById('bt-symbol-clear') as HTMLButtonElement;
const selectedSymbolsRoot = document.getElementById('bt-selected-symbols') as HTMLDivElement;
const symbolList = document.getElementById('bt-symbol-list') as HTMLDataListElement;
const heroText = document.getElementById('bt-hero-text') as HTMLParagraphElement;
const heroStats = document.getElementById('bt-hero-stats') as HTMLDivElement;
const stageDeck = document.getElementById('stage-deck') as HTMLDivElement;
const presetList = document.getElementById('preset-list') as HTMLDivElement;
const runbookList = document.getElementById('runbook-list') as HTMLDivElement;
const logicSummary = document.getElementById('logic-summary') as HTMLDivElement;
const statusBox = document.getElementById('bt-status') as HTMLDivElement;
const windowInput = document.getElementById('bt-window') as HTMLSelectElement;
const stageThresholdInput = document.getElementById('bt-stage-threshold') as HTMLSelectElement;
const directionInput = document.getElementById('bt-direction') as HTMLSelectElement;
const stopInput = document.getElementById('bt-stop') as HTMLInputElement;
const targetInput = document.getElementById('bt-target') as HTMLInputElement;
const maxBarsInput = document.getElementById('bt-max-bars') as HTMLInputElement;
const walletInput = document.getElementById('bt-wallet') as HTMLInputElement;
const positionSizeInput = document.getElementById('bt-position-size') as HTMLInputElement;
const commissionInput = document.getElementById('bt-commission') as HTMLInputElement;
const runButton = document.getElementById('bt-run') as HTMLButtonElement;
const openSignalChartButton = document.getElementById('bt-open-signal-chart') as HTMLButtonElement;
const resultsRoot = document.getElementById('bt-results') as HTMLDivElement;
const ruleModalRoot = document.getElementById('bt-rule-modal-root') as HTMLDivElement;
const saveButton = document.getElementById('bt-save') as HTMLButtonElement;
const copyButton = document.getElementById('bt-copy') as HTMLButtonElement;
const resetButton = document.getElementById('bt-reset') as HTMLButtonElement;
const openAnalysisButton = document.getElementById('bt-open-analysis') as HTMLButtonElement;

let state = buildInitialState();
let latestResult: BacktestRunResult | null = null;
let latestPortfolioCurve: BacktestPortfolioCurve | null = null;
let lastRunSignature: string | null = null;
let isRunning = false;
let currentRunId: string | null = null;
let currentRunStatus: BacktestRunStatusApiResponse | null = null;
let latestCompletedRunId: string | null = null;
let activeRunPollToken = 0;
let portfolioCurveChart: IChartApi | null = null;
let portfolioCurveResizeObserver: ResizeObserver | null = null;
let activeRuleModalStage: StageKey | null = null;
let activeResultTab: ResultTab = 'overview';
const expandedStages: Record<StageKey, boolean> = {
    trend: true,
    setup: false,
    trigger: false,
};
const pickerState: Record<StageKey, { query: string; family: RuleFamily }> = {
    trend: { query: '', family: 'all' },
    setup: { query: '', family: 'all' },
    trigger: { query: '', family: 'all' },
};

renderSymbolList();
render();

function buildInitialState(): BlueprintState {
    const saved = readSavedState();
    const symbol = normalizeTicker(search.get('symbol')) || saved?.symbol || 'THYAO';
    const querySymbols = normalizeSymbolsList((search.get('symbols') || '').split(','));
    const savedSymbols = normalizeSymbolsList(saved?.symbols || []);
    const symbols = querySymbols.length > 0 ? querySymbols : savedSymbols.length > 0 ? savedSymbols : [symbol];
    const frames = {
        trend: normalizeTimeframe(search.get('trendTf')) || saved?.stages.trend.timeframe || '1d',
        setup: normalizeTimeframe(search.get('setupTf')) || saved?.stages.setup.timeframe || '4h',
        trigger: normalizeTimeframe(search.get('triggerTf')) || saved?.stages.trigger.timeframe || '1h',
    };

    if (saved && saved.symbol === symbol) {
        const next = normalizeBlueprint(saved);
        next.symbol = symbol;
        const nextSymbols = normalizeSymbolsList(next.symbols);
        next.symbols = nextSymbols.length > 0 ? nextSymbols : symbols;
        next.stages.trend.timeframe = frames.trend;
        next.stages.setup.timeframe = frames.setup;
        next.stages.trigger.timeframe = frames.trigger;
        return next;
    }

    const preset = PRESETS[0];
    const next = normalizeBlueprint(preset.build(symbol, frames));
    next.symbols = symbols;
    next.symbol = next.symbols[0];
    return next;
}

function normalizeTimeframe(raw: string | null | undefined): TimeFrame | null {
    if (!raw) return null;
    return TIMEFRAMES.includes(raw as TimeFrame) ? raw as TimeFrame : null;
}

function normalizeSymbolsList(values: Array<string | null | undefined>): string[] {
    const normalized = values
        .map((value) => normalizeTicker(value || ''))
        .filter((value): value is string => Boolean(value));
    return Array.from(new Set(normalized));
}

function readSavedState(): BlueprintState | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as BlueprintState;
    } catch {
        return null;
    }
}

function persistState(): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage failures.
    }
}

function normalizeBlueprint(blueprint: BlueprintState): BlueprintState {
    const next: BlueprintState = JSON.parse(JSON.stringify(blueprint));
    const normalizedSymbols = normalizeSymbolsList(next.symbols);
    next.symbols = normalizedSymbols.length > 0 ? normalizedSymbols : [normalizeTicker(next.symbol) || 'THYAO'];
    next.symbol = normalizeTicker(next.symbol) || next.symbols[0] || 'THYAO';
    if (!next.symbols.includes(next.symbol)) {
        next.symbols.unshift(next.symbol);
    }
    next.testWindowDays = clampInteger(next.testWindowDays, 90, 1095, 365);
    next.stageThreshold = clampInteger(next.stageThreshold, 1, 3, 3);
    next.direction = next.direction === 'short' || next.direction === 'both' ? next.direction : 'long';
    next.portfolio = {
        initialCapital: clampNumber(next.portfolio?.initialCapital, 100000, 1000, 1_000_000_000),
        positionSize: clampNumber(next.portfolio?.positionSize, 10000, 100, 100_000_000),
        commissionPct: clampNumber(next.portfolio?.commissionPct, 0.1, 0, 10),
    };
    next.portfolio.positionSize = Math.min(next.portfolio.positionSize, next.portfolio.initialCapital);
    next.risk.stopPct = clampNumber(next.risk.stopPct, 2, 0.1, 25);
    next.risk.targetPct = clampNumber(next.risk.targetPct, 5, 0.1, 50);
    next.risk.maxBars = clampInteger(next.risk.maxBars, 12, 1, 500);

    (['trend', 'setup', 'trigger'] as StageKey[]).forEach((stageKey) => {
        const stage = next.stages[stageKey];
        stage.key = stageKey;
        stage.timeframe = normalizeTimeframe(stage.timeframe) || defaultFrames()[stageKey];
        stage.required = Boolean(stage.required);
        stage.rules = stage.rules
            .filter((rule) => TEMPLATE_BY_ID.has(rule.id))
            .map((rule) => normalizeRule(rule));
        normalizeStage(stage);
    });

    return next;
}

function normalizeRule(rule: SelectedRule): SelectedRule {
    const template = TEMPLATE_BY_ID.get(rule.id);
    if (!template) return rule;
    const params = { ...rule.params };
    template.params.forEach((param) => {
        params[param.key] = clampNumber(params[param.key], param.defaultValue, param.min, param.max);
    });
    return { ...rule, required: Boolean(rule.required), params };
}

function defaultFrames(triggerTf: TimeFrame = '1h'): Record<StageKey, TimeFrame> {
    const map: Record<TimeFrame, Record<StageKey, TimeFrame>> = {
        '1m': { trend: '1h', setup: '15m', trigger: '1m' },
        '3m': { trend: '4h', setup: '1h', trigger: '3m' },
        '5m': { trend: '4h', setup: '1h', trigger: '5m' },
        '15m': { trend: '1d', setup: '4h', trigger: '15m' },
        '30m': { trend: '1d', setup: '4h', trigger: '30m' },
        '1h': { trend: '1d', setup: '4h', trigger: '1h' },
        '2h': { trend: '1w', setup: '1d', trigger: '2h' },
        '4h': { trend: '1w', setup: '1d', trigger: '4h' },
        '6h': { trend: '1w', setup: '1d', trigger: '6h' },
        '12h': { trend: '1w', setup: '1d', trigger: '12h' },
        '1d': { trend: '1w', setup: '1d', trigger: '4h' },
        '3d': { trend: '1M', setup: '1w', trigger: '1d' },
        '1w': { trend: '1M', setup: '1w', trigger: '1d' },
        '1M': { trend: '1M', setup: '1w', trigger: '1d' },
    };
    return map[triggerTf];
}

function normalizeStage(stage: StageConfig): void {
    const optionalCount = stage.rules.filter((rule) => !rule.required).length;
    stage.minOptionalMatches = clampInteger(stage.minOptionalMatches, 0, optionalCount, optionalCount > 0 ? 1 : 0);
}

function renderSymbolList(): void {
    symbolList.innerHTML = '';
    TICKERS.forEach((ticker) => {
        const option = document.createElement('option');
        option.value = ticker;
        symbolList.appendChild(option);
    });
}

function renderSelectedSymbols(): void {
    selectedSymbolsRoot.innerHTML = state.symbols.length > 0
        ? `
          <div class="bt-selected-symbols-head">
            <strong>${state.symbols.length} hisse secili</strong>
            <span>${state.symbols.length === TICKERS.length ? 'Tum evren secili. Yana kaydirarak incele.' : 'Yana kaydirarak secili hisseleri incele.'}</span>
          </div>
          <div class="bt-selected-symbols-rail" aria-label="Secili hisseler">
            ${state.symbols.map((symbol) => `
              <div class="bt-selected-symbol" data-symbol-chip="${symbol}">
                <strong>${escapeHtml(symbol)}</strong>
                ${symbol === state.symbol ? '<span>ana</span>' : ''}
                <button type="button" data-action="remove-symbol" data-symbol="${symbol}">×</button>
              </div>
            `).join('')}
          </div>
        `
        : '<div class="bt-selected-symbol empty">Backtest icin en az bir hisse sec.</div>';
}

function render(): void {
    syncStageThresholdInput();
    symbolInput.value = '';
    windowInput.value = String(state.testWindowDays);
    stageThresholdInput.value = String(state.stageThreshold);
    directionInput.value = state.direction;
    stopInput.value = String(state.risk.stopPct);
    targetInput.value = String(state.risk.targetPct);
    maxBarsInput.value = String(state.risk.maxBars);
    walletInput.value = String(state.portfolio.initialCapital);
    positionSizeInput.value = String(state.portfolio.positionSize);
    commissionInput.value = String(state.portfolio.commissionPct);

    renderSelectedSymbols();
    renderHero();
    renderPresets();
    renderStageDeck();
    renderRuleModal();
    renderLogicSummary();
    renderRunbook();
    renderResults();
    persistState();
    syncUrl();
}

function renderHero(): void {
    const requiredStages = countRequiredStages();
    const activeStages = countActiveStages();
    const allRules = allSelectedRules();
    const affordableSlots = Math.max(0, Math.floor(state.portfolio.initialCapital / Math.max(1, state.portfolio.positionSize * (1 + state.portfolio.commissionPct / 100))));
    const presetLabel = PRESETS.find((item) => item.id === state.activePresetId)?.label || 'Custom blueprint';

    heroText.textContent = `${presetLabel} uzerinden ${state.symbols.length} hisseyi tek portfoy mantigiyla tarayacaksin. Nakit ortaktir; bosta para yoksa yeni sinyal gelse bile pozisyon acilmaz. Stage builder artik odakli: her periyot icin sadece secili kurallari gorursun, kutuphane drawer icinden yonetilir.`;

    heroStats.innerHTML = [
        renderHeroStat('Universe', `${state.symbols.length} hisse`, state.symbols.length === TICKERS.length ? 'Tum evren secili.' : `${state.symbols.slice(0, 4).join(', ')}${state.symbols.length > 4 ? '...' : ''}`),
        renderHeroStat('Blueprint gate', `${activeStages} aktif / ${state.stageThreshold} gerekli`, `${requiredStages} stage required isaretli. Toplam ${allRules.length} kural secili.`),
        renderHeroStat('Portfolio', `${formatMoney(state.portfolio.initialCapital)} TL`, `${formatMoney(state.portfolio.positionSize)} TL / islem · yaklasik ${affordableSlots} eszamanli slot.`),
        renderHeroStat('Risk frame', `${state.testWindowDays} gun`, `%${state.risk.stopPct.toFixed(1)} stop · %${state.risk.targetPct.toFixed(1)} target · komisyon %${state.portfolio.commissionPct.toFixed(3)}`),
    ].join('');
}

function renderHeroStat(label: string, value: string, copy: string): string {
    return `
      <article class="hero-stat">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <p>${escapeHtml(copy)}</p>
      </article>
    `;
}

function renderPresets(): void {
    presetList.innerHTML = PRESETS.map((preset) => `
      <button class="preset-button${preset.id === state.activePresetId ? ' active' : ''}" type="button" data-preset="${preset.id}">
        <strong>${escapeHtml(preset.label)}</strong>
        <span>${escapeHtml(preset.summary)}</span>
      </button>
    `).join('');
}

function renderStageDeck(): void {
    stageDeck.innerHTML = (['trend', 'setup', 'trigger'] as StageKey[]).map((stageKey) => renderStageCard(stageKey)).join('');
}

function renderStageCard(stageKey: StageKey): string {
    const stage = state.stages[stageKey];
    normalizeStage(stage);
    const meta = STAGE_META[stageKey];
    const optionalCount = stage.rules.filter((rule) => !rule.required).length;
    const stageIsActive = stage.rules.length > 0;
    const requiredCount = stage.rules.filter((rule) => rule.required).length;
    const selectedLabels = stage.rules.slice(0, 3).map((rule) => templateForRule(rule)?.label || rule.id);
    const collapsedSummary = selectedLabels.length > 0
        ? `${selectedLabels.join(' · ')}${stage.rules.length > 3 ? ` +${stage.rules.length - 3}` : ''}`
        : 'Henuz kural secilmedi';
    const stageTone = stageIsActive ? (stage.required ? ' required' : ' advisory') : ' inactive';
    const availableCount = RULE_LIBRARY
        .filter((rule) => rule.stages.includes(stageKey) && !stage.rules.some((selected) => selected.id === rule.id))
        .length;

    return `
      <article class="stage-card${expandedStages[stageKey] ? ' open' : ''}${stageTone}" data-stage="${stageKey}">
        <button type="button" class="stage-shell-head" data-action="toggle-stage">
          <div class="stage-shell-main">
            <p class="stage-kicker">${escapeHtml(meta.kicker)}</p>
            <h3>${escapeHtml(meta.title)}</h3>
            <p>${escapeHtml(collapsedSummary)}</p>
          </div>
          <div class="stage-shell-meta">
            <span class="stage-pill tf">${escapeHtml(stage.timeframe)}</span>
            <span class="stage-pill">${stage.rules.length} kural</span>
            <span class="stage-pill">${requiredCount} required</span>
            <span class="stage-pill">${stage.required ? 'Required stage' : 'Advisory stage'}</span>
            <span class="stage-chevron">${expandedStages[stageKey] ? '−' : '+'}</span>
          </div>
        </button>

        <div class="stage-body">
          <p class="stage-body-copy">${escapeHtml(meta.description)}</p>
          <div class="stage-controls">
            <label class="mini-field">
              <span>Timeframe</span>
              <select data-action="timeframe">
                ${TIMEFRAMES.map((tf) => `<option value="${tf}"${tf === stage.timeframe ? ' selected' : ''}>${tf}</option>`).join('')}
              </select>
            </label>

            <label class="mini-field">
              <span>Stage modu</span>
              <select data-action="stage-required">
                <option value="true"${stage.required ? ' selected' : ''}>Required</option>
                <option value="false"${stage.required ? '' : ' selected'}>Advisory</option>
              </select>
            </label>

            <label class="mini-field">
              <span>Min optional teyit</span>
              <select data-action="min-optional">
                ${Array.from({ length: optionalCount + 1 }, (_, idx) => idx).map((count) => `<option value="${count}"${count === stage.minOptionalMatches ? ' selected' : ''}>${count}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="stage-builder-bar">
            <div class="stage-builder-copy">
              <strong>${stage.rules.length} secili kural</strong>
              <span>${availableCount} kural daha eklenebilir. Kutuphane drawer icinden yonetilir.</span>
            </div>
            <button type="button" class="stage-builder-button" data-action="open-rule-modal">Kural kutuphanesini ac</button>
          </div>

          <div class="rule-list compact">
            ${stage.rules.length > 0 ? stage.rules.map((rule) => renderRuleChip(stageKey, rule)).join('') : '<div class="rule-empty">Bu stage icin henuz kural secilmedi. Kural kutuphanesini acip filtreleyerek secim yapabilirsin.</div>'}
          </div>

          <div class="stage-foot">
            <div class="stage-foot-item">State: ${stageIsActive ? (stage.required ? 'active / required' : 'active / advisory') : 'inactive'}</div>
            <div class="stage-foot-item">Optional teyit: ${stage.minOptionalMatches}</div>
            <div class="stage-foot-item">${stageIsActive ? 'Builder hazir' : 'Kural eklenince aktif olur'}</div>
          </div>
        </div>
      </article>
    `;
}

function renderRuleLibrary(stageKey: StageKey, availableRules: RuleTemplate[]): string {
    const filter = pickerState[stageKey];
    const filteredRules = availableRules.filter((rule) => {
        const familyMatches = filter.family === 'all' || getRuleFamily(rule) === filter.family;
        const query = filter.query.trim().toLowerCase();
        const textMatches = query.length === 0
            || rule.label.toLowerCase().includes(query)
            || rule.summary.toLowerCase().includes(query)
            || rule.category.toLowerCase().includes(query);
        return familyMatches && textMatches;
    });

    const cards = filteredRules.length > 0
        ? filteredRules
            .sort((left, right) => left.label.localeCompare(right.label))
            .map((rule) => renderLibraryRuleCard(rule))
            .join('')
        : '<div class="rule-library-empty">Bu filtreyle eslesen kural yok. Aramayi temizle ya da farkli sekmeye gec.</div>';

    return `
      <section class="rule-library">
        <div class="rule-library-head">
          <div>
            <p class="bt-eyebrow">Rule Library</p>
            <h4>${availableRules.length} uygun kural</h4>
          </div>
          <label class="rule-search">
            <span>Ara</span>
            <input data-action="rule-search" type="search" value="${escapeHtml(filter.query)}" placeholder="fib, triangle, support, volume..." />
          </label>
        </div>
        <div class="rule-family-tabs">
          ${RULE_FAMILY_TABS.map((tab) => `
            <button
              type="button"
              class="rule-family-tab${tab.id === filter.family ? ' active' : ''}"
              data-action="rule-family"
              data-family="${tab.id}"
            >${escapeHtml(tab.label)}</button>
          `).join('')}
        </div>
        <div class="rule-catalog">
          ${cards}
        </div>
      </section>
    `;
}

function renderRuleModal(): void {
    if (!activeRuleModalStage) {
        ruleModalRoot.innerHTML = '';
        return;
    }

    const stageKey = activeRuleModalStage;
    const stage = state.stages[stageKey];
    const meta = STAGE_META[stageKey];
    const availableRules = RULE_LIBRARY
        .filter((rule) => rule.stages.includes(stageKey) && !stage.rules.some((selected) => selected.id === rule.id));

    ruleModalRoot.innerHTML = `
      <div class="rule-modal-backdrop" data-action="close-rule-modal">
        <section class="rule-modal-panel" data-stage="${stageKey}">
          <header class="rule-modal-head">
            <div>
              <p class="bt-eyebrow">${escapeHtml(meta.kicker)} Builder</p>
              <h3>${escapeHtml(meta.title)}</h3>
              <p>${escapeHtml(meta.description)}</p>
            </div>
            <button type="button" class="rule-modal-close" data-action="close-rule-modal">Kapat</button>
          </header>
          <div class="rule-modal-layout">
            <aside class="rule-modal-aside">
              <div class="rule-modal-stat">
                <span>Timeframe</span>
                <strong>${escapeHtml(stage.timeframe)}</strong>
              </div>
              <div class="rule-modal-stat">
                <span>Secili kural</span>
                <strong>${stage.rules.length}</strong>
              </div>
              <div class="rule-modal-stat">
                <span>Required</span>
                <strong>${stage.rules.filter((rule) => rule.required).length}</strong>
              </div>
              <div class="rule-modal-stat">
                <span>Optional teyit</span>
                <strong>${stage.minOptionalMatches}</strong>
              </div>
              <div class="rule-modal-selection">
                ${stage.rules.length > 0 ? stage.rules.map((rule) => `
                  <div class="rule-modal-selection-item">
                    <strong>${escapeHtml(templateForRule(rule)?.label || rule.id)}</strong>
                    <span>${rule.required ? 'Required' : 'Optional'}</span>
                  </div>
                `).join('') : '<div class="rule-modal-selection-empty">Bu stage icin henuz secim yok.</div>'}
              </div>
            </aside>
            <div class="rule-modal-main" data-stage="${stageKey}">
              ${renderRuleLibrary(stageKey, availableRules)}
            </div>
          </div>
        </section>
      </div>
    `;
}

function renderLibraryRuleCard(rule: RuleTemplate): string {
    return `
      <article class="rule-catalog-card" data-rule-card="${rule.id}">
        <div class="rule-catalog-copy">
          <strong>${escapeHtml(rule.label)}</strong>
          <p>${escapeHtml(rule.summary)}</p>
          <div class="rule-meta">
            <span class="rule-badge">${escapeHtml(rule.category)}</span>
            <span class="rule-badge">${escapeHtml(renderRuleFamilyLabel(getRuleFamily(rule)))}</span>
            <span class="rule-badge automation">${rule.automation === 'indicator' ? 'Indicator-ready' : 'Blueprint rule'}</span>
          </div>
        </div>
        <button type="button" class="rule-catalog-add" data-action="quick-add-rule" data-rule-id="${rule.id}">Ekle</button>
      </article>
    `;
}

function getRuleFamily(rule: RuleTemplate): RuleFamily {
    if (rule.category === 'Fibonacci') return 'fibonacci';
    if (rule.automation === 'indicator') return 'indicator';
    if (rule.category === 'Pattern' || rule.category === 'Candle') return 'pattern';
    if (rule.category === 'Volume') return 'volume';
    return 'price_action';
}

function renderRuleFamilyLabel(family: RuleFamily): string {
    switch (family) {
        case 'price_action':
            return 'Price Action';
        case 'fibonacci':
            return 'Fibonacci';
        case 'pattern':
            return 'Pattern';
        case 'volume':
            return 'Volume';
        case 'indicator':
            return 'Indicator';
        default:
            return 'All';
    }
}

function renderRuleChip(stageKey: StageKey, rule: SelectedRule): string {
    const template = templateForRule(rule);
    if (!template) return '';
    return `
      <details class="rule-chip" data-stage="${stageKey}" data-rule="${rule.id}">
        <summary class="rule-chip-head">
          <div>
            <h4>${escapeHtml(template.label)}</h4>
            <p>${escapeHtml(template.summary)}</p>
            <div class="rule-meta">
              <span class="rule-badge">${escapeHtml(template.category)}</span>
              <span class="rule-badge${rule.required ? ' required' : ''}">${rule.required ? 'Required' : 'Optional'}</span>
              <span class="rule-badge automation">${template.automation === 'indicator' ? 'Indicator-ready' : 'Blueprint rule'}</span>
            </div>
          </div>
          <span class="rule-open-indicator">Detay</span>
        </summary>

        <div class="rule-chip-body">
          <div class="rule-actions">
            <button type="button" data-action="toggle-required"${rule.required ? ' class="is-required"' : ''}>${rule.required ? 'Kesin sart' : 'Opsiyonel'}</button>
            <button type="button" data-action="remove-rule" class="is-remove">Kaldir</button>
          </div>

          <div class="rule-param-grid">
            ${template.params.map((param) => `
              <label>
                <span>${escapeHtml(param.label)}</span>
                <input
                  data-action="param"
                  data-param="${param.key}"
                  type="number"
                  min="${param.min}"
                  max="${param.max}"
                  step="${param.step}"
                  value="${rule.params[param.key]}"
                />
              </label>
            `).join('')}
          </div>
        </div>
      </details>
    `;
}

function renderLogicSummary(): void {
    const blocks = (['trend', 'setup', 'trigger'] as StageKey[]).map((stageKey) => {
        const stage = state.stages[stageKey];
        const required = stage.rules.filter((rule) => rule.required).map((rule) => templateForRule(rule)?.label || rule.id);
        const optional = stage.rules.filter((rule) => !rule.required).map((rule) => templateForRule(rule)?.label || rule.id);
        const requiredText = required.length > 0 ? required.join(', ') : 'Required kural yok';
        const optionalText = optional.length > 0 ? optional.join(', ') : 'Opsiyonel teyit yok';
        return `
          <div class="logic-block">
            <strong>${escapeHtml(STAGE_META[stageKey].kicker)} · ${escapeHtml(stage.timeframe)}</strong>
            <p>${escapeHtml(requiredText)} kesin. ${escapeHtml(optionalText)} arasindan en az ${stage.minOptionalMatches} teyit bekleniyor.</p>
          </div>
        `;
    });

    const requiredStageCount = countRequiredStages();
    const activeStageCount = countActiveStages();
    const gateText = `Global policy: en az ${state.stageThreshold} aktif stage gecmeli. ${requiredStageCount > 0 ? `${requiredStageCount} stage required olarak sabit.` : 'Aktif stageler advisory olabilir.'} Kural olmayan stage'ler devre disi kalir.`;
    const riskText = `Risk profili: ${state.direction} yonunde, %${state.risk.stopPct.toFixed(1)} stop, %${state.risk.targetPct.toFixed(1)} target, maksimum ${state.risk.maxBars} bar elde tutma. Portfoy: ${formatMoney(state.portfolio.initialCapital)} TL bakiye, ${formatMoney(state.portfolio.positionSize)} TL / islem, komisyon %${state.portfolio.commissionPct.toFixed(3)}.`;

    logicSummary.innerHTML = `${blocks.join('')}
      <div class="logic-block">
        <strong>Execution gate</strong>
        <p>${escapeHtml(gateText)} Aktif stage sayisi su an ${activeStageCount}. ${escapeHtml(riskText)}</p>
      </div>
    `;
}

function renderRunbook(): void {
    runbookList.innerHTML = (['trend', 'setup', 'trigger'] as StageKey[]).map((stageKey) => {
        const stage = state.stages[stageKey];
        const meta = STAGE_META[stageKey];
        return `
          <article class="runbook-item">
            <strong>${escapeHtml(meta.kicker)} · ${escapeHtml(stage.timeframe)}</strong>
            <p>${escapeHtml(meta.description)}</p>
            <span>${stage.rules.length} kural · ${stage.required ? 'required' : 'advisory'} stage</span>
          </article>
        `;
    }).join('');
}

function syncStageThresholdInput(): void {
    const activeCount = Math.max(1, countActiveStages());
    state.stageThreshold = clampInteger(state.stageThreshold, 1, activeCount, 1);
    stageThresholdInput.innerHTML = Array.from({ length: activeCount }, (_, index) => {
        const value = index + 1;
        return `<option value="${value}"${value === state.stageThreshold ? ' selected' : ''}>${value} stage</option>`;
    }).join('');
}

function renderResults(): void {
    destroyPortfolioCurveChart();
    runButton.disabled = isRunning;
    runButton.textContent = isRunning ? 'Calisiyor...' : 'Backtesti baslat';
    openSignalChartButton.disabled = isRunning || !latestResult || latestResult.trades.length === 0 || latestResult.context.symbols.length !== 1;

    if (isRunning) {
        const progress = currentRunStatus?.progress;
        const progressPct = Math.max(0, Math.min(100, Math.round(progress?.progressPct || 0)));
        const processedSymbols = Math.max(0, progress?.processedSymbols || 0);
        const totalSymbols = Math.max(processedSymbols, progress?.totalSymbols || state.symbols.length || 0);
        const currentSymbol = progress?.currentSymbol ? escapeHtml(progress.currentSymbol) : 'Hazirlaniyor';
        const phase = escapeHtml(formatRunPhase(progress?.phase));
        const message = escapeHtml(progress?.message || 'Backtest kosusu baslatiliyor...');
        const runIdLabel = currentRunId ? escapeHtml(currentRunId.slice(-8)) : 'Hazirlaniyor';
        resultsRoot.innerHTML = `
          <div class="results-banner running">
            <div class="results-running-head">
              <strong>${phase}</strong>
              <span>%${progressPct}</span>
            </div>
            <p>${message}</p>
            <div class="results-progress" aria-hidden="true">
              <span style="width:${progressPct}%"></span>
            </div>
            <div class="results-running-grid">
              <div class="results-running-stat">
                <span>Taranan</span>
                <strong>${processedSymbols} / ${totalSymbols}</strong>
              </div>
              <div class="results-running-stat">
                <span>Secili hisse</span>
                <strong>${state.symbols.length}</strong>
              </div>
              <div class="results-running-stat">
                <span>Aktif sembol</span>
                <strong>${currentSymbol}</strong>
              </div>
              <div class="results-running-stat">
                <span>Run ID</span>
                <strong>${runIdLabel}</strong>
              </div>
            </div>
          </div>
        `;
        return;
    }

    if (!latestResult) {
        resultsRoot.innerHTML = '<div class="results-empty">Kurallari sectikten sonra burada backtesti calistirip sonuc ozetini ve islemleri goreceksin.</div>';
        return;
    }

    const result = latestResult;
    const stale = lastRunSignature !== buildStateSignature(state);
    const summaryCards = [
        renderSummaryCard('Son bakiye', `${formatMoney(result.summary.finalBalance)} TL`, 'Komisyonlar dusulduktan sonraki portfoy bakiyesi.'),
        renderSummaryCard('Net sonuc', `${formatSignedMoney(result.summary.totalNetPnlAmount)} TL`, `${formatSignedPercent(result.summary.totalPnlPct)} toplam getiri.`, result.summary.totalNetPnlAmount),
        renderSummaryCard('Komisyon', `${formatMoney(result.summary.totalCommissionAmount)} TL`, 'Tum giris ve cikis komisyonlarinin toplami.'),
        renderSummaryCard('Toplam trade', String(result.summary.totalTrades), 'Yetersiz bakiye nedeniyle atlananlar buna dahil degil.'),
        renderSummaryCard('Atlanan trade', String(result.summary.skippedTrades), 'Bosta nakit yetmedigi icin acilmayan islemler.'),
        renderSummaryCard('Win rate', formatPercent(result.summary.winRate), 'Net olarak pozitif kapanan islemlerin orani.'),
        renderSummaryCard('Ort. trade', formatSignedPercent(result.summary.averagePnlPct), 'Trade basi ortalama fiyat getirisi.', result.summary.averagePnlPct),
        renderSummaryCard('Profit factor', String(result.summary.profitFactor.toFixed(2)), 'Net kar / net zarar.'),
        renderSummaryCard('Max DD', formatSignedPercent(result.summary.maxDrawdownPct), 'Kapali bakiye serisinden hesaplandi.', result.summary.maxDrawdownPct),
    ].join('');

    const stageCards = (['trend', 'setup', 'trigger'] as StageKey[]).map((stageKey) => {
        const stats = result.stageStats[stageKey];
        return `
          <article class="stage-stat-card">
            <span>${escapeHtml(STAGE_META[stageKey].kicker)} · ${escapeHtml(stats.timeframe)}</span>
            <strong>${escapeHtml(formatPercent(stats.passRate))}</strong>
            <p>${stats.passedBars} / ${stats.coreBars} bardan gecti. ${stats.requiredRuleCount} required, ${Math.max(0, stats.ruleCount - stats.requiredRuleCount)} optional kural secili.</p>
          </article>
        `;
    }).join('');

    const trades = result.trades.slice(-24).reverse();
    const tradesTable = trades.length > 0
        ? `
          <div class="trade-table-wrap">
            <table class="trade-table">
              <thead>
                <tr>
                  <th>Hisse</th>
                  <th>Yon</th>
                  <th>Giris</th>
                  <th>Cikis</th>
                  <th>Fiyat</th>
                  <th>Net TL</th>
                  <th>PnL</th>
                  <th>Komisyon</th>
                  <th>Bar</th>
                  <th>Neden</th>
                  <th>Stage snapshot</th>
                </tr>
              </thead>
              <tbody>
                ${trades.map((trade) => renderTradeRow(trade)).join('')}
              </tbody>
            </table>
          </div>
        `
        : '<p>Bu kosuda trade bulunamadi. Stage threshold fazla siki kalmis olabilir ya da portfoy bakiyesi islem basi tutari tasimiyor olabilir.</p>';

    const symbolStatsTable = result.symbolStats.length > 0
        ? `
          <div class="trade-table-wrap">
            <table class="trade-table">
              <thead>
                <tr>
                  <th>Hisse</th>
                  <th>Trade</th>
                  <th>Atlanan</th>
                  <th>Win rate</th>
                  <th>Net TL</th>
                  <th>Komisyon</th>
                </tr>
              </thead>
              <tbody>
                ${result.symbolStats.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.symbol)}</td>
                    <td>${item.totalTrades}</td>
                    <td>${item.skippedTrades}</td>
                    <td>${escapeHtml(formatPercent(item.winRate))}</td>
                    <td class="${item.netPnlAmount > 0 ? 'pnl-positive' : item.netPnlAmount < 0 ? 'pnl-negative' : ''}">${escapeHtml(formatSignedMoney(item.netPnlAmount))} TL</td>
                    <td>${escapeHtml(formatMoney(item.totalCommissionAmount))} TL</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
        : '<p>Sembol bazli dagilim yok.</p>';

    const skippedPreview = result.skippedTrades.slice(0, 12);
    const skippedTable = skippedPreview.length > 0
        ? `
          <div class="trade-table-wrap">
            <table class="trade-table">
              <thead>
                <tr>
                  <th>Hisse</th>
                  <th>Yon</th>
                  <th>Zaman</th>
                  <th>Gerekli nakit</th>
                  <th>Mevcut nakit</th>
                </tr>
              </thead>
              <tbody>
                ${skippedPreview.map((trade) => `
                  <tr>
                    <td>${escapeHtml(trade.symbol)}</td>
                    <td><span class="trade-pill ${trade.side}">${escapeHtml(trade.side)}</span></td>
                    <td>${escapeHtml(formatDate(trade.entryTime))}</td>
                    <td>${escapeHtml(formatMoney(trade.requiredCash))} TL</td>
                    <td>${escapeHtml(formatMoney(trade.availableCash))} TL</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
        : '<p>Nakit yetersizligi nedeniyle atlanan trade yok.</p>';

    const portfolioCurveCard = renderPortfolioCurveCard(latestPortfolioCurve || result.portfolioCurve || null);

    const resultTabs: Array<{ id: ResultTab; label: string }> = [
        { id: 'overview', label: 'Overview' },
        { id: 'symbols', label: 'Symbols' },
        { id: 'trades', label: 'Trades' },
        { id: 'liquidity', label: 'Liquidity' },
        { id: 'notes', label: 'Notes' },
    ];

    let activePanel = '';
    if (activeResultTab === 'overview') {
        activePanel = `
          <article class="result-card">
            <header>
              <div>
                <p class="bt-eyebrow">Coverage</p>
                <h4>Run kapsami</h4>
              </div>
            </header>
            <div class="result-meta">
              <span>${result.context.symbols.length} hisse</span>
              <span>${escapeHtml(formatDate(result.range.from))} -> ${escapeHtml(formatDate(result.range.to))}</span>
              <span>Trend ${result.dataPoints.trend} bar</span>
              <span>Setup ${result.dataPoints.setup} bar</span>
              <span>Trigger ${result.dataPoints.trigger} bar</span>
              <span>Maks eszamanli pozisyon ${result.summary.maxConcurrentPositions}</span>
            </div>
          </article>
          ${portfolioCurveCard}
          <article class="result-card">
            <header>
              <div>
                <p class="bt-eyebrow">Stage Diagnostics</p>
                <h4>Asama gecis oranlari</h4>
              </div>
            </header>
            <div class="stage-stat-grid">${stageCards}</div>
          </article>
        `;
    } else if (activeResultTab === 'symbols') {
        activePanel = `
          <article class="result-card">
            <header>
              <div>
                <p class="bt-eyebrow">Symbols</p>
                <h4>Hisse bazli dagilim</h4>
              </div>
            </header>
            ${symbolStatsTable}
          </article>
        `;
    } else if (activeResultTab === 'trades') {
        activePanel = `
          <article class="result-card">
            <header>
              <div>
                <p class="bt-eyebrow">Trades</p>
                <h4>Son islemler</h4>
              </div>
            </header>
            ${tradesTable}
          </article>
        `;
    } else if (activeResultTab === 'liquidity') {
        activePanel = `
          <article class="result-card">
            <header>
              <div>
                <p class="bt-eyebrow">Liquidity Gate</p>
                <h4>Yetersiz bakiye nedeniyle atlananlar</h4>
              </div>
            </header>
            ${skippedTable}
          </article>
        `;
    } else {
        activePanel = `
          <article class="result-card">
            <header>
              <div>
                <p class="bt-eyebrow">Engine Notes</p>
                <h4>Kosunun varsayimlari</h4>
              </div>
            </header>
            <div class="notes-list">
              ${result.notes.map((note) => `<div>${escapeHtml(note)}</div>`).join('')}
            </div>
          </article>
        `;
    }

    resultsRoot.innerHTML = `
      ${stale ? '<div class="results-banner stale">Blueprint son kostan sonra degisti. Gosterilen sonuc guncel secimle birebir eslesmiyor; tekrar calistir.</div>' : ''}
      <div class="summary-grid">${summaryCards}</div>
      <div class="results-tabs">
        ${resultTabs.map((tab) => `
          <button type="button" class="results-tab${tab.id === activeResultTab ? ' active' : ''}" data-action="result-tab" data-tab="${tab.id}">
            ${escapeHtml(tab.label)}
          </button>
        `).join('')}
      </div>
      ${activePanel}
    `;
    mountPortfolioCurveChart(activeResultTab === 'overview' ? (latestPortfolioCurve || result.portfolioCurve || null) : null);
}

function renderPortfolioCurveCard(curve: BacktestPortfolioCurve | null): string {
    if (!curve || curve.points.length === 0) {
        return `
          <article class="result-card">
            <header>
              <div>
                <p class="bt-eyebrow">Portfolio Curve</p>
                <h4>Portfoy bakiyesi grafigi</h4>
              </div>
            </header>
            <p>Bu kosu icin portfoy egri verisi henuz hazir degil.</p>
          </article>
        `;
    }

    const lastPoint = curve.points[curve.points.length - 1];

    return `
      <article class="result-card">
        <header>
          <div>
            <p class="bt-eyebrow">Portfolio Curve</p>
            <h4>Portfoy bakiyesi grafigi</h4>
          </div>
        </header>
        <div class="portfolio-curve-card">
          <div class="portfolio-curve-meta">
            ${renderCurveMetaStat('Mod', curve.mode === 'closed_balance' ? 'Kapali bakiye' : curve.mode)}
            ${renderCurveMetaStat('Baslangic', `${formatMoney(curve.initialBalance)} TL`)}
            ${renderCurveMetaStat('Zirve', `${formatMoney(curve.peakBalance)} TL`)}
            ${renderCurveMetaStat('Dip', `${formatMoney(curve.lowBalance)} TL`)}
            ${renderCurveMetaStat('Son', `${formatMoney(curve.finalBalance)} TL`)}
            ${renderCurveMetaStat('Max DD', formatSignedPercent(curve.maxDrawdownPct), curve.maxDrawdownPct)}
          </div>
          <div class="portfolio-curve-shell" aria-label="Portfoy bakiyesi grafigi">
            <div id="${PORTFOLIO_CURVE_CHART_ID}" class="portfolio-curve-host"></div>
          </div>
          <div class="portfolio-curve-footer">
            <span>Baslangic ${escapeHtml(formatDate(curve.points[0].time))}</span>
            <span>Son guncelleme ${escapeHtml(formatDate(lastPoint.time))}</span>
            <span>${curve.points.length} nokta</span>
          </div>
        </div>
      </article>
    `;
}

function renderCurveMetaStat(label: string, value: string, signedValue?: number): string {
    const tone = typeof signedValue === 'number'
        ? signedValue > 0 ? ' positive' : signedValue < 0 ? ' negative' : ''
        : '';
    return `
      <div class="portfolio-curve-stat${tone}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
}

function destroyPortfolioCurveChart(): void {
    portfolioCurveResizeObserver?.disconnect();
    portfolioCurveResizeObserver = null;
    if (portfolioCurveChart) {
        portfolioCurveChart.remove();
        portfolioCurveChart = null;
    }
}

function mountPortfolioCurveChart(curve: BacktestPortfolioCurve | null): void {
    if (!curve || curve.points.length === 0) return;

    const host = document.getElementById(PORTFOLIO_CURVE_CHART_ID) as HTMLDivElement | null;
    if (!host) return;

    const width = Math.max(320, Math.floor(host.clientWidth || host.getBoundingClientRect().width || 0));
    const height = 300;
    const chart = createChart(host, {
        width,
        height,
        layout: {
            background: { type: ColorType.Solid, color: '#07111d' },
            textColor: '#9aa8bc',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 12,
            attributionLogo: false,
        },
        grid: {
            vertLines: { color: '#1f293744' },
            horzLines: { color: '#1f293744' },
        },
        crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { labelBackgroundColor: '#0f766e' },
            horzLine: { labelBackgroundColor: '#0f766e' },
        },
        rightPriceScale: {
            borderVisible: false,
            scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
            borderVisible: false,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 4,
            minBarSpacing: 0.6,
        },
        handleScroll: { vertTouchDrag: false },
    } as any);

    const series = chart.addAreaSeries({
        lineColor: '#5eead4',
        topColor: 'rgba(45, 212, 191, 0.28)',
        bottomColor: 'rgba(45, 212, 191, 0.03)',
        lineWidth: 3,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
        },
    } as any);

    series.setData(curve.points.map((point) => ({
        time: point.time as Time,
        value: point.balance,
    })));

    const markers = buildPortfolioCurveMarkers(curve);
    if (markers.length > 0) {
        (series as any).setMarkers(markers);
    }

    chart.timeScale().fitContent();

    portfolioCurveChart = chart;
    portfolioCurveResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const nextWidth = Math.max(320, Math.floor(entry.contentRect.width));
            chart.applyOptions({ width: nextWidth, height });
            chart.timeScale().fitContent();
        }
    });
    portfolioCurveResizeObserver.observe(host);
}

function buildPortfolioCurveMarkers(curve: BacktestPortfolioCurve): Array<Record<string, unknown>> {
    const points = curve.points;
    if (points.length === 0) return [];

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const peakPoint = points.reduce((best, current) => current.balance > best.balance ? current : best, points[0]);
    const lowPoint = points.reduce((worst, current) => current.balance < worst.balance ? current : worst, points[0]);
    const markerMap = new Map<string, Record<string, unknown>>();

    const pushMarker = (point: typeof points[number], text: string, color: string, shape: string, position: string): void => {
        const key = `${point.time}:${text}`;
        if (markerMap.has(key)) return;
        markerMap.set(key, {
            time: point.time as Time,
            position,
            color,
            shape,
            text,
        });
    };

    pushMarker(firstPoint, 'Start', '#93c5fd', 'circle', 'belowBar');
    pushMarker(lastPoint, 'End', '#5eead4', 'circle', 'aboveBar');
    pushMarker(peakPoint, 'Peak', '#f59e0b', 'arrowDown', 'aboveBar');
    pushMarker(lowPoint, 'Low', '#f87171', 'arrowUp', 'belowBar');

    return [...markerMap.values()];
}

function renderSummaryCard(label: string, value: string, copy: string, signedValue?: number): string {
    const tone = typeof signedValue === 'number'
        ? signedValue > 0 ? ' positive' : signedValue < 0 ? ' negative' : ''
        : '';
    return `
      <article class="summary-stat${tone}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <p>${escapeHtml(copy)}</p>
      </article>
    `;
}

function renderTradeRow(trade: BacktestTrade): string {
    const stageSnapshot = (['trend', 'setup', 'trigger'] as StageKey[])
        .filter((stageKey) => trade.stages[stageKey].passed)
        .map((stageKey) => STAGE_META[stageKey].kicker)
        .join(', ') || 'Yok';

    const pnlClass = trade.netPnlAmount > 0 ? 'pnl-positive' : trade.netPnlAmount < 0 ? 'pnl-negative' : '';
    return `
      <tr>
        <td>${escapeHtml(trade.symbol)}</td>
        <td><span class="trade-pill ${trade.side}">${escapeHtml(trade.side)}</span></td>
        <td>${escapeHtml(formatDate(trade.entryTime))}</td>
        <td>${escapeHtml(formatDate(trade.exitTime))}</td>
        <td>${trade.entryPrice.toFixed(2)} -> ${trade.exitPrice.toFixed(2)}</td>
        <td class="${pnlClass}">${escapeHtml(formatSignedMoney(trade.netPnlAmount))} TL</td>
        <td class="${pnlClass}">${escapeHtml(formatSignedPercent(trade.pnlPct))}</td>
        <td>${escapeHtml(formatMoney(trade.entryCommissionAmount + trade.exitCommissionAmount))} TL</td>
        <td>${trade.barsHeld}</td>
        <td>${escapeHtml(renderExitReason(trade.exitReason))}</td>
        <td>${escapeHtml(stageSnapshot)}</td>
      </tr>
    `;
}

function renderExitReason(reason: BacktestTrade['exitReason']): string {
    switch (reason) {
        case 'target':
            return 'Target';
        case 'stop':
            return 'Stop';
        case 'timeout':
            return 'Timeout';
        default:
            return 'Veri sonu';
    }
}

function formatDate(unixSeconds: number): string {
    return RESULT_DATE_FORMATTER.format(new Date(unixSeconds * 1000));
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercent(value: number): string {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
}

function formatMoney(value: number): string {
    return value.toFixed(2);
}

function formatSignedMoney(value: number): string {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}`;
}

function buildStateSignature(nextState: BlueprintState): string {
    return JSON.stringify(nextState);
}

function buildSignalPreview(result: BacktestRunResult): {
    symbol: string;
    tf: TimeFrame;
    generatedAt: number;
    signals: SignalModel[];
} {
    const targetSymbol = result.context.symbols[0];
    return {
        symbol: targetSymbol,
        tf: result.context.timeframes[result.context.executionStage],
        generatedAt: result.context.generatedAt,
        signals: result.trades.filter((trade) => trade.symbol === targetSymbol).map((trade) => ({
            id: `preview_${trade.id}`,
            time: trade.entryTime,
            price: trade.entryPrice,
            side: trade.side === 'long' ? 'buy' : 'sell',
            label: trade.side === 'long' ? 'BUY signal' : 'SELL signal',
            confidence: Math.min(0.95, Math.max(0.55, trade.score / 200)),
            meta: {
                exitReason: trade.exitReason,
                pnlPct: trade.pnlPct,
                barsHeld: trade.barsHeld,
                stageScore: trade.score,
            },
        })),
    };
}

function countRequiredStages(): number {
    return (['trend', 'setup', 'trigger'] as StageKey[])
        .filter((stageKey) => state.stages[stageKey].required && state.stages[stageKey].rules.length > 0).length;
}

function countActiveStages(): number {
    return (['trend', 'setup', 'trigger'] as StageKey[])
        .filter((stageKey) => state.stages[stageKey].rules.length > 0).length;
}

function allSelectedRules(): SelectedRule[] {
    return (['trend', 'setup', 'trigger'] as StageKey[]).flatMap((stageKey) => state.stages[stageKey].rules);
}

function templateForRule(rule: SelectedRule): RuleTemplate | undefined {
    return TEMPLATE_BY_ID.get(rule.id);
}

function syncUrl(): void {
    const params = new URLSearchParams({
        symbol: state.symbol,
        trendTf: state.stages.trend.timeframe,
        setupTf: state.stages.setup.timeframe,
        triggerTf: state.stages.trigger.timeframe,
    });
    if (state.symbols.length > 1 && state.symbols.length <= 12) {
        params.set('symbols', state.symbols.join(','));
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function setStatus(message: string, kind: 'neutral' | 'ok' | 'err' = 'neutral'): void {
    statusBox.textContent = message;
    statusBox.classList.remove('ok', 'err');
    if (kind === 'ok') statusBox.classList.add('ok');
    if (kind === 'err') statusBox.classList.add('err');
}

function formatRunPhase(phase?: string | null): string {
    switch (phase) {
        case 'queued':
            return 'Kuyrukta';
        case 'loading_market_data':
            return 'Veri yukleniyor';
        case 'simulating_portfolio':
            return 'Portfoy simule ediliyor';
        case 'finalizing':
            return 'Sonuc toparlaniyor';
        case 'completed':
            return 'Tamamlandi';
        case 'failed':
            return 'Basarisiz';
        default:
            return 'Calisiyor';
    }
}

function describeRunningStatus(status: BacktestRunStatusApiResponse | null): string {
    const progress = status?.progress;
    if (!progress) {
        return 'Backtest calisiyor...';
    }
    const progressPct = Math.max(0, Math.min(100, Math.round(progress.progressPct || 0)));
    const totalSymbols = Math.max(progress.processedSymbols || 0, progress.totalSymbols || 0);
    const parts = [
        `${formatRunPhase(progress.phase)} %${progressPct}`,
        totalSymbols > 0 ? `${progress.processedSymbols} / ${totalSymbols} hisse` : null,
        progress.currentSymbol || null,
    ].filter((value): value is string => Boolean(value));
    return `${parts.join(' · ')}. ${progress.message}`;
}

function applyPreset(presetId: string): void {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const currentWindow = state.testWindowDays;
    const currentSymbols = [...state.symbols];
    const currentPortfolio = { ...state.portfolio };
    const frames = {
        trend: state.stages.trend.timeframe,
        setup: state.stages.setup.timeframe,
        trigger: state.stages.trigger.timeframe,
    };
    state = normalizeBlueprint(preset.build(state.symbol, frames));
    const normalizedCurrentSymbols = normalizeSymbolsList(currentSymbols);
    state.symbols = normalizedCurrentSymbols.length > 0 ? normalizedCurrentSymbols : [state.symbol];
    state.symbol = state.symbols[0];
    state.testWindowDays = clampInteger(currentWindow, 90, 1095, 365);
    state.portfolio = currentPortfolio;
    activeRuleModalStage = null;
    activeResultTab = 'overview';
    setStatus(`${preset.label} preset'i uygulandi.`, 'ok');
    render();
}

function stageFromElement(target: HTMLElement | null): StageKey | null {
    const stage = target?.closest<HTMLElement>('[data-stage]')?.dataset.stage;
    return stage === 'trend' || stage === 'setup' || stage === 'trigger' ? stage : null;
}

function ruleIdFromElement(target: HTMLElement | null): string | null {
    const ruleId = target?.closest<HTMLElement>('[data-rule]')?.dataset.rule;
    return ruleId || null;
}

presetList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-preset]');
    if (!button) return;
    const presetId = button.dataset.preset;
    if (!presetId) return;
    applyPreset(presetId);
});

stageDeck.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const stageKey = stageFromElement(target);
    if (!action || !stageKey) return;

    if (action === 'toggle-stage') {
        expandedStages[stageKey] = !expandedStages[stageKey];
        renderStageDeck();
        return;
    }

    if (action === 'open-rule-modal') {
        activeRuleModalStage = stageKey;
        renderRuleModal();
        return;
    }

    if (action === 'quick-add-rule') {
        const button = target.closest<HTMLElement>('[data-rule-id]');
        const template = TEMPLATE_BY_ID.get(button?.dataset.ruleId || '');
        if (!template) return;
        state.stages[stageKey].rules.push(makeRule(template.id, false));
        normalizeStage(state.stages[stageKey]);
        activeRuleModalStage = stageKey;
        setStatus(`${template.label} ${STAGE_META[stageKey].kicker.toLowerCase()} stage'ine eklendi.`, 'ok');
        render();
        return;
    }

    if (action === 'rule-family') {
        const family = target.closest<HTMLElement>('[data-family]')?.dataset.family as RuleFamily | undefined;
        if (!family) return;
        pickerState[stageKey].family = family;
        render();
        return;
    }

    if (action === 'toggle-required') {
        const ruleId = ruleIdFromElement(target);
        if (!ruleId) return;
        const rule = state.stages[stageKey].rules.find((item) => item.id === ruleId);
        if (!rule) return;
        rule.required = !rule.required;
        normalizeStage(state.stages[stageKey]);
        render();
        return;
    }

    if (action === 'remove-rule') {
        const ruleId = ruleIdFromElement(target);
        if (!ruleId) return;
        state.stages[stageKey].rules = state.stages[stageKey].rules.filter((item) => item.id !== ruleId);
        normalizeStage(state.stages[stageKey]);
        setStatus('Kural kaldirildi.', 'ok');
        render();
    }
});

function handleRulePickerInput(stageKey: StageKey, target: HTMLInputElement): void {
    const action = target.dataset.action;
    if (!action) return;

    if (action === 'rule-search') {
        pickerState[stageKey].query = target.value;
        renderRuleModal();
    }
}

stageDeck.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    const stageKey = stageFromElement(target);
    if (!stageKey) return;
    handleRulePickerInput(stageKey, target);
});

stageDeck.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const action = target.dataset.action;
    const stageKey = stageFromElement(target);
    if (!action || !stageKey) return;

    if (action === 'timeframe') {
        state.stages[stageKey].timeframe = normalizeTimeframe(target.value) || state.stages[stageKey].timeframe;
        render();
        return;
    }

    if (action === 'stage-required') {
        state.stages[stageKey].required = target.value === 'true';
        render();
        return;
    }

    if (action === 'min-optional') {
        state.stages[stageKey].minOptionalMatches = clampInteger(Number(target.value), 0, state.stages[stageKey].rules.filter((rule) => !rule.required).length, 0);
        render();
        return;
    }

    if (action === 'param') {
        const ruleId = ruleIdFromElement(target);
        const paramKey = target.dataset.param;
        if (!ruleId || !paramKey) return;
        const rule = state.stages[stageKey].rules.find((item) => item.id === ruleId);
        const template = rule ? TEMPLATE_BY_ID.get(rule.id) : undefined;
        const param = template?.params.find((item) => item.key === paramKey);
        if (!rule || !param) return;
        rule.params[paramKey] = clampNumber(Number(target.value), param.defaultValue, param.min, param.max);
        persistState();
    }
});

ruleModalRoot.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;

    if (action === 'close-rule-modal') {
        activeRuleModalStage = null;
        renderRuleModal();
        return;
    }

    const stageKey = stageFromElement(target);
    if (!action || !stageKey) return;

    if (action === 'quick-add-rule') {
        const button = target.closest<HTMLElement>('[data-rule-id]');
        const template = TEMPLATE_BY_ID.get(button?.dataset.ruleId || '');
        if (!template) return;
        state.stages[stageKey].rules.push(makeRule(template.id, false));
        normalizeStage(state.stages[stageKey]);
        setStatus(`${template.label} ${STAGE_META[stageKey].kicker.toLowerCase()} stage'ine eklendi.`, 'ok');
        render();
        return;
    }

    if (action === 'rule-family') {
        const family = target.closest<HTMLElement>('[data-family]')?.dataset.family as RuleFamily | undefined;
        if (!family) return;
        pickerState[stageKey].family = family;
        renderRuleModal();
    }
});

ruleModalRoot.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    const stageKey = stageFromElement(target);
    if (!stageKey) return;
    handleRulePickerInput(stageKey, target);
});

resultsRoot.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action="result-tab"]');
    const tab = button?.dataset.tab as ResultTab | undefined;
    if (!tab) return;
    activeResultTab = tab;
    renderResults();
});

function addSymbolFromInput(): void {
    const normalized = normalizeTicker(symbolInput.value);
    if (!normalized) {
        setStatus('Gecerli bir hisse kodu gir.', 'err');
        return;
    }
    if (!state.symbols.includes(normalized)) {
        state.symbols.push(normalized);
    }
    state.symbol = state.symbols[0] || normalized;
    symbolInput.value = '';
    setStatus(`${normalized} portfoy sepetine eklendi.`, 'ok');
    render();
}

selectedSymbolsRoot.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="remove-symbol"]');
    const symbol = button?.dataset.symbol;
    if (!button || !symbol) return;
    state.symbols = state.symbols.filter((item) => item !== symbol);
    if (state.symbols.length === 0) {
        state.symbols = ['THYAO'];
    }
    state.symbol = state.symbols[0];
    setStatus(`${symbol} portfoy sepetinden cikartildi.`, 'ok');
    render();
});

symbolAddButton.addEventListener('click', addSymbolFromInput);
symbolInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addSymbolFromInput();
});
symbolInput.addEventListener('change', addSymbolFromInput);

symbolSelectAllButton.addEventListener('click', () => {
    state.symbols = [...TICKERS];
    state.symbol = state.symbols[0];
    setStatus('Tum hisseler portfoy sepetine eklendi. Bu kosu agir olabilir.', 'ok');
    render();
});

symbolClearButton.addEventListener('click', () => {
    state.symbols = [state.symbols[0] || state.symbol || 'THYAO'];
    state.symbol = state.symbols[0];
    setStatus('Sepet temizlendi; yalnizca ana sembol birakildi.', 'ok');
    render();
});

windowInput.addEventListener('change', () => {
    state.testWindowDays = clampInteger(Number(windowInput.value), 90, 1095, 365);
    render();
});

stageThresholdInput.addEventListener('change', () => {
    state.stageThreshold = clampInteger(Number(stageThresholdInput.value), 1, Math.max(1, countActiveStages()), 1);
    render();
});

directionInput.addEventListener('change', () => {
    const value = directionInput.value;
    state.direction = value === 'short' || value === 'both' ? value : 'long';
    persistState();
    render();
});

stopInput.addEventListener('change', () => {
    state.risk.stopPct = clampNumber(Number(stopInput.value), 2.2, 0.1, 25);
    render();
});

targetInput.addEventListener('change', () => {
    state.risk.targetPct = clampNumber(Number(targetInput.value), 6, 0.1, 50);
    render();
});

maxBarsInput.addEventListener('change', () => {
    state.risk.maxBars = clampInteger(Number(maxBarsInput.value), 18, 1, 500);
    render();
});

walletInput.addEventListener('change', () => {
    state.portfolio.initialCapital = clampNumber(Number(walletInput.value), 100000, 1000, 1_000_000_000);
    state.portfolio.positionSize = Math.min(state.portfolio.positionSize, state.portfolio.initialCapital);
    render();
});

positionSizeInput.addEventListener('change', () => {
    state.portfolio.positionSize = clampNumber(Number(positionSizeInput.value), 10000, 100, state.portfolio.initialCapital);
    render();
});

commissionInput.addEventListener('change', () => {
    state.portfolio.commissionPct = clampNumber(Number(commissionInput.value), 0.1, 0, 10);
    render();
});

runButton.addEventListener('click', async () => {
    const snapshot = normalizeBlueprint(JSON.parse(JSON.stringify(state)) as BlueprintState);
    activeRunPollToken += 1;
    const pollToken = activeRunPollToken;
    activeResultTab = 'overview';
    activeRuleModalStage = null;
    isRunning = true;
    currentRunId = null;
    currentRunStatus = null;
    latestPortfolioCurve = null;
    latestCompletedRunId = null;
    renderResults();
    setStatus('Backtest kuyruga aliniyor...', 'neutral');

    try {
        const startPayload = await startBlueprintBacktestApi(snapshot);
        currentRunId = startPayload.runId;
        currentRunStatus = {
            runId: startPayload.runId,
            status: startPayload.status,
            createdAt: Date.now(),
            progress: startPayload.progress,
            eventsCount: 0,
        };
        renderResults();
        setStatus(describeRunningStatus(currentRunStatus), 'neutral');

        const completedPayload = await waitForRunCompletion(startPayload.runId, pollToken);
        if (!completedPayload.result) {
            throw new Error(completedPayload.error || 'Backtest sonucu bos dondu.');
        }

        latestResult = completedPayload.result;
        latestCompletedRunId = startPayload.runId;
        latestPortfolioCurve = completedPayload.result.portfolioCurve || null;
        if (latestCompletedRunId) {
            try {
                latestPortfolioCurve = await fetchBacktestRunPortfolioCurve(latestCompletedRunId);
            } catch {
                latestPortfolioCurve = completedPayload.result.portfolioCurve || null;
            }
        }
        lastRunSignature = buildStateSignature(snapshot);
        currentRunStatus = completedPayload;
        const summaryMessage = completedPayload.result.summary.totalTrades > 0
            ? `${completedPayload.result.summary.totalTrades} trade bulundu. Son bakiye ${formatMoney(completedPayload.result.summary.finalBalance)} TL, net sonuc ${formatSignedMoney(completedPayload.result.summary.totalNetPnlAmount)} TL.`
            : 'Kosuda trade bulunamadi. Stage filtreleri fazla siki ya da portfoy bakiyesi yetersiz olabilir.';
        setStatus(`Backtest tamamlandi. ${summaryMessage}`, 'ok');
    } catch (err) {
        latestResult = null;
        latestPortfolioCurve = null;
        latestCompletedRunId = null;
        lastRunSignature = null;
        currentRunId = null;
        currentRunStatus = null;
        setStatus(`Backtest basarisiz: ${(err as Error).message}`, 'err');
    } finally {
        isRunning = false;
        renderResults();
    }
});

async function startBlueprintBacktestApi(snapshot: BlueprintState): Promise<BacktestStartApiResponse> {
    const response = await fetch(`${API_BASE}/backtests/start`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(snapshot),
    });

    const payload = await readBacktestApiResponse<BacktestStartApiResponse>(response);
    if (!payload || typeof payload !== 'object' || !('runId' in payload)) {
        throw new Error('Backtest start cevabi gecersiz.');
    }
    return payload;
}

async function fetchBacktestRunStatus(runId: string): Promise<BacktestRunStatusApiResponse> {
    const response = await fetch(`${API_BASE}/backtests/${encodeURIComponent(runId)}/status`);
    const payload = await readBacktestApiResponse<BacktestRunStatusApiResponse>(response);
    if (!payload || typeof payload !== 'object' || !('runId' in payload)) {
        throw new Error('Backtest status cevabi gecersiz.');
    }
    return payload;
}

async function fetchBacktestRunPortfolioCurve(runId: string): Promise<BacktestPortfolioCurve | null> {
    const response = await fetch(`${API_BASE}/backtests/${encodeURIComponent(runId)}/portfolio-curve`);
    const payload = await readBacktestApiResponse<BacktestRunPortfolioCurveApiResponse>(response);
    if (!payload || typeof payload !== 'object' || !('runId' in payload)) {
        throw new Error('Portfoy curve cevabi gecersiz.');
    }
    return payload.curve || null;
}

async function waitForRunCompletion(runId: string, pollToken: number): Promise<BacktestRunStatusApiResponse> {
    while (true) {
        const statusPayload = await fetchBacktestRunStatus(runId);
        if (pollToken !== activeRunPollToken) {
            throw new Error('Yeni bir backtest kosusu baslatildi.');
        }

        currentRunId = runId;
        currentRunStatus = statusPayload;
        renderResults();
        setStatus(describeRunningStatus(statusPayload), 'neutral');

        if (statusPayload.status === 'completed') {
            return statusPayload;
        }
        if (statusPayload.status === 'failed') {
            throw new Error(statusPayload.error || statusPayload.progress?.message || 'Backtest basarisiz.');
        }

        await delay(RUN_STATUS_POLL_MS);
    }
}

async function readBacktestApiResponse<T>(response: Response): Promise<T> {
    const rawText = await response.text();
    const payload = rawText ? safeJsonParse(rawText) as T | { detail?: string; message?: string } | null : null;
    if (!response.ok) {
        const errorPayload = payload as { detail?: string; message?: string } | null;
        const message = errorPayload && typeof errorPayload === 'object'
            ? String(errorPayload.detail || errorPayload.message || rawText || 'Backtest API hatasi')
            : rawText || 'Backtest API hatasi';
        throw new Error(message);
    }
    return payload as T;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function safeJsonParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

openSignalChartButton.addEventListener('click', () => {
    if (!latestResult || latestResult.trades.length === 0) {
        setStatus('Once backtest kosup trade uretmen gerekiyor.', 'err');
        return;
    }
    if (latestResult.context.symbols.length !== 1) {
        setStatus('Sinyal chart preview su an yalnizca tek sembol backtestlerde acilabilir.', 'err');
        return;
    }

    const preview = buildSignalPreview(latestResult);
    window.localStorage.setItem(SIGNAL_PREVIEW_KEY, JSON.stringify(preview));
    const params = new URLSearchParams({
        symbol: preview.symbol,
        tf: preview.tf,
        signalPreview: '1',
    });
    window.location.href = `/chart.html?${params.toString()}`;
});

saveButton.addEventListener('click', () => {
    persistState();
    setStatus('Blueprint kaydedildi. Bu kombinasyon geri acilabilir.', 'ok');
});

copyButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
        setStatus('Blueprint JSON panoya kopyalandi.', 'ok');
    } catch (err) {
        setStatus(`Kopyalama basarisiz: ${(err as Error).message}`, 'err');
    }
});

resetButton.addEventListener('click', () => {
    applyPreset(state.activePresetId);
});

openAnalysisButton.addEventListener('click', () => {
    const params = new URLSearchParams({
        symbol: state.symbols[0] || state.symbol,
        tf: state.stages.trigger.timeframe,
    });
    window.location.href = `/chart.html?${params.toString()}`;
});

function clampNumber(value: number, fallback: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
