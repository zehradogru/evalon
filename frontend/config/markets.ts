/**
 * Market Configuration
 * Central source of truth for all market tickers
 * Last verified: 2026-04-05
 */

// ============================================================================
// BIST (Borsa Istanbul)
// ============================================================================

// All BIST tickers with data on 2026-03-17 (127 verified)
export const BIST_AVAILABLE = [
    'AEFES', 'AGHOL', 'AGROT', 'AHGAZ', 'AKBNK', 'AKCNS', 'AKENR', 'AKFGY', 'AKSA', 'AKSEN', 'ALARK', 'ALFAS',
    'ALGYO', 'ALTNY', 'ANSGR', 'ARCLK', 'ARDYZ', 'ASELS', 'ASTOR', 'BAGFS', 'BALSU', 'BIMAS', 'BIZIM', 'BRSAN',
    'BRYAT', 'BSOKE', 'BTCIM', 'CANTE', 'CCOLA', 'CIMSA', 'CLEBI', 'CWENE', 'DAPGM', 'DEVA', 'DOAS', 'DOHOL',
    'DSTKF', 'ECILC', 'EFOR', 'EGEEN', 'EKGYO', 'ENERY', 'ENJSA', 'ENKAI', 'ERCB', 'EREGL', 'EUPWR', 'FENER',
    'FROTO', 'GARAN', 'GENIL', 'GESAN', 'GLRMK', 'GRSEL', 'GRTHO', 'GSRAY', 'GUBRF', 'GWIND', 'HALKB', 'HEKTS',
    'ISCTR', 'ISGYO', 'ISMEN', 'IZENR', 'IZFAS', 'IZMDC', 'KAREL', 'KCAER', 'KCHOL', 'KLRHO', 'KONTR', 'KRDMD',
    'KTLEV', 'KUYAS', 'LOGO', 'MAGEN', 'MAVI', 'MGROS', 'MIATK', 'MPARK', 'NETAS', 'OBAMS', 'ODAS', 'OTKAR',
    'OYAKC', 'PASEU', 'PATEK', 'PETKM', 'PETUN', 'PGSUS', 'PNSUT', 'PRKME', 'QUAGR', 'RALYH', 'REEDR', 'SAHOL',
    'SASA', 'SELEC', 'SISE', 'SKBNK', 'SOKM', 'TABGD', 'TAVHL', 'TCELL', 'THYAO', 'TKFEN', 'TMSN', 'TOASO',
    'TRALT', 'TRENJ', 'TRMET', 'TSKB', 'TSPOR', 'TTKOM', 'TTRAK', 'TUKAS', 'TUPRS', 'TUREX', 'TURSG', 'ULKER',
    'VAKBN', 'VESBE', 'VESTL', 'YEOTK', 'YKBNK', 'ZEDUR', 'ZOREN'
] as const;

// Tickers NOT available in the API (for reference)
export const BIST_UNAVAILABLE = [
] as const;

// Popular BIST tickers for quick access (BIST 30 level)
export const BIST_POPULAR = [
    'THYAO', 'GARAN', 'ASELS', 'EREGL', 'AKBNK', 'FROTO', 'KCHOL', 'TUPRS',
    'SISE', 'TCELL', 'HALKB', 'VAKBN', 'BIMAS', 'TOASO', 'ENKAI', 'PGSUS',
    'TAVHL', 'PETKM', 'EKGYO', 'TTKOM', 'SASA', 'MAVI', 'ARCLK', 'ENJSA'
] as const;

// ============================================================================
// US Markets (NASDAQ/NYSE)
// ============================================================================

export const NASDAQ_TICKERS = [
    { ticker: 'NVDA', name: 'NVIDIA Corp.' },
    { ticker: 'AAPL', name: 'Apple Inc.' },
    { ticker: 'MSFT', name: 'Microsoft Corp.' },
    { ticker: 'TSLA', name: 'Tesla Inc.' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.' },
    { ticker: 'META', name: 'Meta Platforms Inc.' },
] as const;

// ============================================================================
// Crypto
// ============================================================================

export const CRYPTO_TICKERS = [
    { ticker: 'BTCUSDT_C', name: 'Bitcoin', symbol: 'BTC' },
    { ticker: 'ETHUSDT_C', name: 'Ethereum', symbol: 'ETH' },
    { ticker: 'SOLUSDT_C', name: 'Solana', symbol: 'SOL' },
    { ticker: 'BNBUSDT_C', name: 'Binance Coin', symbol: 'BNB' },
    { ticker: 'XRPUSDT_C', name: 'Ripple', symbol: 'XRP' },
    { ticker: 'LINKUSDT_C', name: 'Chainlink', symbol: 'LINK' },
] as const;

// ============================================================================
// Forex
// ============================================================================

export const FOREX_TICKERS = [
    { ticker: 'EURUSD', name: 'Euro / US Dollar', base: 'EUR', quote: 'USD' },
    { ticker: 'USDJPY', name: 'US Dollar / Yen', base: 'USD', quote: 'JPY' },
    { ticker: 'GBPUSD', name: 'British Pound / US Dollar', base: 'GBP', quote: 'USD' },
    { ticker: 'USDTRY', name: 'US Dollar / Turkish Lira', base: 'USD', quote: 'TRY' },
] as const;

// ============================================================================
// Ticker Names (Display names for UI)
// ============================================================================

export const TICKER_NAMES: Record<string, string> = {
    // BIST
    AEFES: 'Anadolu Efes',
    AGHOL: 'Anadolu Grubu Holding',
    AHGAZ: 'Ahlatçı Doğalgaz',
    AGROT: 'Agrotech Yüksek Teknoloji',
    AKCNS: 'Akçansa',
    AKBNK: 'Akbank',
    AKENR: 'Akenerji',
    AKFGY: 'Akfen GYO',
    AKSA: 'Aksa',
    AKSEN: 'Aksa Enerji',
    ALARK: 'Alarko Holding',
    ALFAS: 'Alfa Solar',
    ALGYO: 'Alarko GYO',
    ALTNY: 'Altınay Savunma',
    ARCLK: 'Arçelik',
    ARDYZ: 'ARD Grup Bilişim',
    ASELS: 'Aselsan',
    ASTOR: 'Astor Enerji',
    BAGFS: 'Bandırma Gübre Fabrikaları A.Ş',
    BALSU: 'Balsu Gıda',
    BIMAS: 'Bim Birleşik Mağazalar A.Ş',
    BIZIM: 'Bizim Toptan',
    BRSAN: 'Borusan Birleşik Boru Fab.',
    BRYAT: 'Borusan Yatırım',
    BSOKE: 'Batı Söke Çimento',
    BTCIM: 'Batıçim',
    CANTE: 'Çan2 Termik A.S',
    CCOLA: 'Coca-Cola İçecek A.Ş',
    CLEBI: 'Çelebi',
    CWENE: 'Cw Enerji',
    DAPGM: 'Dap Gayrimenkul',
    DEVA: 'Deva Holding',
    DOAS: 'Doğuş Otomotiv',
    DOHOL: 'Doğan Holding',
    DSTKF: 'Destek Finans Faktoring',
    ECILC: 'Eczacıbaşı İlaç',
    EFOR: 'Efor Yat. San.',
    EGEEN: 'Ege Endüstri',
    EKGYO: 'Emlak Konut GYO',
    ENERY: 'Enerya Enerji',
    ENJSA: 'Enerjisa Enerji',
    ENKAI: 'Enka İnşaat',
    ERCB: 'Erciyas Çelik Boru',
    EREGL: 'Ereğli Demir Çelik',
    EUPWR: 'Europower Enerji',
    FENER: 'Fenerbahce Futbol A.Ş.',
    FROTO: 'Ford Otosan',
    GARAN: 'Garanti Bankası',
    GENIL: 'Gen İlaç',
    GESAN: 'Girişim Elektrik',
    GLRMK: 'Gülermak Ağır Sanayi',
    GRSEL: 'Gürsel Taşımacılık',
    GRTHO: 'GrainTurk Tarım',
    GSRAY: 'Galatasaray Sportif A.Ş',
    GUBRF: 'Gübre Fabrikaları',
    GWIND: 'Galata Wind Enerji',
    HALKB: 'Halkbank',
    HEKTS: 'Hektaş',
    IZENR: 'İzdemir Enerji',
    IZFAS: 'İzmir Fırça',
    KAREL: 'Karel Elektronik',
    KCAER: 'Kocaer Çelik Sanayi',
    KCHOL: 'Koç Holding',
    KLRHO: 'Kiler Holding',
    KONTR: 'Kontrolmatik Teknoloji',
    KRDMD: 'Kardemir (D)',
    KTLEV: 'Katılımevim',
    KUYAS: 'Kuyas Yatırım AŞ',
    LOGO: 'Logo Yazılım',
    MAGEN: 'Margün Enerji',
    MAVI: 'Mavi Giyim Sanayi Tic.A.S',
    MGROS: 'Migros',
    MIATK: 'Mia Teknoloji',
    MPARK: 'MLP Sağlık Hizmetleri',
    NETAS: 'Netaş',
    OBAMS: 'Oba Makarnacılık',
    ODAS: 'Odaş Elektrik Üretim',
    OTKAR: 'Otokar',
    OYAKC: 'Oyak Çimento',
    PASEU: 'Pasifik Eurasia',
    PATEK: 'Pasifik Teknoloji',
    PETKM: 'Petkim',
    PETUN: 'Pınar Et ve Un',
    PGSUS: 'Pegasus Hava Taşımacılığı',
    PNSUT: 'Pınar Süt',
    QUAGR: 'QUA Granite',
    RALYH: 'Ral Yatırım Holding',
    REEDR: 'Reeder',
    SASA: 'Sasa Polyester Sanayi A.Ş.',
    SELEC: 'Selçuk Ecza Deposu',
    SISE: 'Şişecam',
    SKBNK: 'Şekerbank',
    SOKM: 'Şok Marketler',
    TABGD: 'Tab Gıda',
    TAVHL: 'TAV Holding',
    TCELL: 'Turkcell',
    THYAO: 'Türk Hava Yolları',
    TKFEN: 'Tekfen Holding',
    TMSN: 'Tümosan Motor ve Traktör',
    TOASO: 'Tofaş Fabrika',
    TRALT: 'Türk Altın',
    TRENJ: 'TR Doğal Enerji Kaynakları',
    TRMET: 'TR Anadolu Metal',
    TSKB: 'TSKB',
    TSPOR: 'Trabzonspor A.Ş',
    TTKOM: 'Türk Telekom',
    TTRAK: 'Türk Traktör',
    TUKAS: 'Tukaş',
    TUPRS: 'Tüpraş',
    TUREX: 'Tureks Tur.Taşımacılık',
    TURSG: 'Türkiye Sigorta',
    ULKER: 'Ülker Bisküvi',
    VAKBN: 'Vakıfbank',
    VESBE: 'Vestel Beyaz Esya',
    VESTL: 'Vestel Elektronik',
    YEOTK: 'YEO Teknoloji',
    YKBNK: 'Yapı Kredi Bankası',
    ZEDUR: 'Zedur Enerji',
    ZOREN: 'Zorlu Enerji',
    // Unavailable (for completeness)
    ANSGR: 'Anadolu Sigorta',
    CIMSA: 'Çimsa',
    ISCTR: 'İş Bankası (C)',
    ISMEN: 'İş Yatırım',
    SAHOL: 'Sabancı Holding',
    ISGYO: 'İş GYO',
    IZMDC: 'İzmir Demir Çelik',
    PRKME: 'Park Elek. Madencilik',
    // NASDAQ
    NVDA: 'NVIDIA Corp.',
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft Corp.',
    TSLA: 'Tesla Inc.',
    GOOGL: 'Alphabet Inc.',
    AMZN: 'Amazon.com Inc.',
    META: 'Meta Platforms Inc.',
    // Crypto
    BTCUSDT_C: 'Bitcoin',
    ETHUSDT_C: 'Ethereum',
    SOLUSDT_C: 'Solana',
    BNBUSDT_C: 'Binance Coin',
    XRPUSDT_C: 'Ripple',
    LINKUSDT_C: 'Chainlink',
};

// ============================================================================
// Legacy exports (for backward compatibility)
// ============================================================================

export const MARKET_TICKERS = {
    BIST: BIST_AVAILABLE,
    NASDAQ: NASDAQ_TICKERS,
    CRYPTO: CRYPTO_TICKERS,
    FOREX: FOREX_TICKERS,
};

// Aliases for backward compatibility
export const AVAILABLE_TICKERS = BIST_AVAILABLE;
export const UNAVAILABLE_TICKERS = BIST_UNAVAILABLE;
export const POPULAR_TICKERS = BIST_POPULAR;

// ============================================================================
// Types
// ============================================================================

export type BistTicker = typeof BIST_AVAILABLE[number];
export type NasdaqTicker = typeof NASDAQ_TICKERS[number]['ticker'];
export type CryptoTicker = typeof CRYPTO_TICKERS[number]['ticker'];
export type ForexTicker = typeof FOREX_TICKERS[number]['ticker'];
