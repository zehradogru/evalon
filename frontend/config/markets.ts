/**
 * Market Configuration
 * Central source of truth for all market tickers
 * Last verified: 2026-04-24
 */

// ============================================================================
// BIST (Borsa Istanbul)
// ============================================================================

// All BIST tickers with data on 2026-04-24 (verified)
export const BIST_AVAILABLE = [
    'ADET', 'HACIM', 'A1CAP', 'A1YEN', 'ACSEL', 'ADEL', 'ADESE', 'ADGYO', 'AEFES', 'AFYON', 'AGESA', 'AGHOL',
    'AGROT', 'AGYO', 'AHGAZ', 'AHSGY', 'AKBNK', 'AKCNS', 'AKENR', 'AKFGY', 'AKFIS', 'AKFYE', 'AKGRT', 'AKHAN',
    'AKMGY', 'AKSA', 'AKSEN', 'AKSGY', 'AKSUE', 'AKYHO', 'ALARK', 'ALBRK', 'ALCAR', 'ALCTL', 'ALFAS', 'ALGYO',
    'ALKA', 'ALKIM', 'ALKLC', 'ALTNY', 'ALVES', 'ANELE', 'ANGEN', 'ANHYT', 'ANSGR', 'APBDL', 'APLIB', 'APMDL',
    'APX30', 'ARASE', 'ARCLK', 'ARDYZ', 'ARENA', 'ARFYE', 'ARMGD', 'ARSAN', 'ARTMS', 'ARZUM', 'ASELS', 'ASGYO',
    'ASTOR', 'ASUZU', 'ATAGY', 'ATAKP', 'ATATP', 'ATEKS', 'ATLAS', 'ATSYH', 'AVGYO', 'AVHOL', 'AVOD', 'AVPGY',
    'AVTUR', 'AYCES', 'AYDEM', 'AYEN', 'AYES', 'AYGAZ', 'AZTEK', 'BAGFS', 'BAHKM', 'BAKAB', 'BALAT', 'BALSU',
    'BANVT', 'BARMA', 'BASCM', 'BASGZ', 'BAYRK', 'BEGYO', 'BERA', 'BESLR', 'BESTE', 'BEYAZ', 'BFREN', 'BIENY',
    'BIGCH', 'BIGEN', 'BIGTK', 'BIMAS', 'BINBN', 'BINHO', 'BIOEN', 'BIZIM', 'BJKAS', 'BLCYT', 'BLUME', 'BMSCH',
    'BMSTL', 'BNTAS', 'BOBET', 'BORLS', 'BORSK', 'BOSSA', 'BRISA', 'BRKO', 'BRKSN', 'BRKVY', 'BRLSM', 'BRMEN',
    'BRSAN', 'BRYAT', 'BSOKE', 'BTCIM', 'BUCIM', 'BULGS', 'BURCE', 'BURVA', 'BVSAN', 'BYDNR', 'CANTE', 'CASA',
    'CATES', 'CCOLA', 'CELHA', 'CEMAS', 'CEMTS', 'CEMZY', 'CEOEM', 'CGCAM', 'CIMSA', 'CLEBI', 'CMBTN', 'CMENT',
    'CONSE', 'COSMO', 'CRDFA', 'CRFSA', 'CUSAN', 'CVKMD', 'CWENE', 'DAGI', 'DAPGM', 'DARDL', 'DCTTR', 'DENGE',
    'DERHL', 'DERIM', 'DESA', 'DESPC', 'DEVA', 'DGATE', 'DGGYO', 'DGNMO', 'DITAS', 'DMRGD', 'DMSAS', 'DNISI',
    'DOAS', 'DOCO', 'DOFER', 'DOFRB', 'DOGUB', 'DOHOL', 'DOKTA', 'DSTKF', 'DUNYH', 'DURDO', 'DURKN', 'DYOBY',
    'DZGYO', 'EBEBK', 'ECILC', 'ECOGR', 'ECZYT', 'EDATA', 'EDIP', 'EFOR', 'EGEEN', 'EGEGY', 'EGEPO', 'EGGUB',
    'EGPRO', 'EGSER', 'EKGYO', 'EKIZ', 'EKOS', 'EKSUN', 'ELITE', 'EMKEL', 'EMNIS', 'ENDAE', 'ENERY', 'ENJSA',
    'ENKAI', 'ENSRI', 'ENTRA', 'EPLAS', 'ERBOS', 'ERCB', 'EREGL', 'ERSU', 'ESCAR', 'ESCOM', 'ESEN', 'ETILR',
    'ETYAT', 'EUHOL', 'EUKYO', 'EUPWR', 'EUREN', 'EUYO', 'EYGYO', 'FADE', 'FENER', 'FLAP', 'FMIZP', 'FONET',
    'FORMT', 'FORTE', 'FRIGO', 'FRMPL', 'FROTO', 'FZLGY', 'GARAN', 'GARFA', 'GATEG', 'GEDIK', 'GEDZA', 'GENIL',
    'GENTS', 'GEREL', 'GESAN', 'GIPTA', 'GLBMD', 'GLCVY', 'GLDTR', 'GLRMK', 'GLRYH', 'GLYHO', 'GMSTR', 'GMTAS',
    'GOKNR', 'GOLTS', 'GOODY', 'GOZDE', 'GRNYO', 'GRSEL', 'GRTHO', 'GSDDE', 'GSDHO', 'GSRAY', 'GUBRF', 'GUNDG',
    'GWIND', 'GZNMI', 'HALKB', 'HALKS', 'HATEK', 'HATSN', 'HDFGS', 'HEDEF', 'HEKTS', 'HKTM', 'HLGYO', 'HOROZ',
    'HRKET', 'HTTBT', 'HUBVC', 'HUNER', 'HURGZ', 'ICBCT', 'ICUGS', 'IDGYO', 'IEYHO', 'IHAAS', 'IHEVA', 'IHGZT',
    'IHLAS', 'IHLGM', 'IHYAY', 'IMASM', 'INDES', 'INFO', 'INGRM', 'INTEK', 'INTEM', 'INVEO', 'INVES', 'ISATR',
    'ISBIR', 'ISBTR', 'ISCTR', 'ISDMR', 'ISFIN', 'ISGLK', 'ISGSY', 'ISGYO', 'ISIST', 'ISKPL', 'ISKUR', 'ISMEN',
    'ISSEN', 'ISYAT', 'IZENR', 'IZFAS', 'IZINV', 'IZMDC', 'JANTS', 'KAPLM', 'KAREL', 'KARSN', 'KARTN', 'KATMR',
    'KAYSE', 'KBORU', 'KCAER', 'KCHOL', 'KENT', 'KERVN', 'KFEIN', 'KGYO', 'KIMMR', 'KLGYO', 'KLKIM', 'KLMSN',
    'KLNMA', 'KLRHO', 'KLSER', 'KLSYN', 'KLYPV', 'KMPUR', 'KNFRT', 'KOCMT', 'KONKA', 'KONTR', 'KONYA', 'KOPOL',
    'KORDS', 'KOTON', 'KRDMA', 'KRDMB', 'KRDMD', 'KRGYO', 'KRONT', 'KRPLS', 'KRSTL', 'KRTEK', 'KRVGD', 'KSTUR',
    'KTLEV', 'KTSKR', 'KUTPO', 'KUVVA', 'KUYAS', 'KZBGY', 'KZGYO', 'LIDER', 'LIDFA', 'LILAK', 'LINK', 'LKMNH',
    'LMKDC', 'LOGO', 'LRSHO', 'LUKSK', 'LYDHO', 'LYDYE', 'MAALT', 'MACKO', 'MAGEN', 'MAKIM', 'MAKTK', 'MANAS',
    'MARBL', 'MARKA', 'MARMR', 'MARTI', 'MAVI', 'MEDTR', 'MEGAP', 'MEGMT', 'MEKAG', 'MEPET', 'MERCN', 'MERIT',
    'MERKO', 'METRO', 'MEYSU', 'MGROS', 'MHRGY', 'MIATK', 'MMCAS', 'MNDRS', 'MNDTR', 'MOBTL', 'MOGAN', 'MOPAS',
    'MPARK', 'MRGYO', 'MRSHL', 'MSGYO', 'MTRKS', 'MTRYO', 'MZHLD', 'NATEN', 'NETAS', 'NETCD', 'NIBAS', 'NPTLR',
    'NTGAZ', 'NTHOL', 'NUGYO', 'NUHCM', 'OBAMS', 'OBASE', 'ODAS', 'ODINE', 'OFSYM', 'ONCSM', 'ONRYT', 'OPK30',
    'OPT25', 'OPTGY', 'OPTLR', 'OPX30', 'ORCAY', 'ORGE', 'ORMA', 'OSMEN', 'OSTIM', 'OTKAR', 'OTTO', 'OYAKC',
    'OYAYO', 'OYLUM', 'OYYAT', 'OZATD', 'OZGYO', 'OZKGY', 'OZRDN', 'OZSUB', 'OZYSR', 'PAGYO', 'PAHOL', 'PAMEL',
    'PAPIL', 'PARSN', 'PASEU', 'PATEK', 'PCILT', 'PEKGY', 'PENGD', 'PENTA', 'PETKM', 'PETUN', 'PGSUS', 'PINSU',
    'PKART', 'PKENT', 'PLTUR', 'PNLSN', 'PNSUT', 'POLHO', 'POLTK', 'PRDGS', 'PRKAB', 'PRKME', 'PRZMA', 'PSDTC',
    'PSGYO', 'QNBFK', 'QNBTR', 'QTEMZ', 'QUAGR', 'RALYH', 'RAYSG', 'REEDR', 'RGYAS', 'RNPOL', 'RODRG', 'RTALB',
    'RUBNS', 'RUZYE', 'RYGYO', 'RYSAS', 'SAFKR', 'SAHOL', 'SAMAT', 'SANEL', 'SANFM', 'SANKO', 'SARKY', 'SASA',
    'SAYAS', 'SDTTR', 'SEGMN', 'SEGYO', 'SEKFK', 'SEKUR', 'SELEC', 'SELVA', 'SERNT', 'SEYKM', 'SILVR', 'SISE',
    'SKBNK', 'SKTAS', 'SKYLP', 'SKYMD', 'SMART', 'SMRTG', 'SMRVA', 'SNGYO', 'SNICA', 'SNPAM', 'SODSN', 'SOKE',
    'SOKM', 'SONME', 'SRVGY', 'SUMAS', 'SUNTK', 'SURGY', 'SUWEN', 'TABGD', 'TARKM', 'TATEN', 'TATGD', 'TAVHL',
    'TBORG', 'TCELL', 'TCKRC', 'TDGYO', 'TEHOL', 'TEKTU', 'TERA', 'TEZOL', 'TGSAS', 'THYAO', 'TKFEN', 'TKNSA',
    'TLMAN', 'TMPOL', 'TMSN', 'TNZTP', 'TOASO', 'TRALT', 'TRCAS', 'TRENJ', 'TRGYO', 'TRHOL', 'TRILC', 'TRMET',
    'TSGYO', 'TSKB', 'TSPOR', 'TTKOM', 'TTRAK', 'TUCLK', 'TUKAS', 'TUPRS', 'TUREX', 'TURGG', 'TURSG', 'UCAYM',
    'UFUK', 'ULAS', 'ULKER', 'ULUFA', 'ULUSE', 'ULUUN', 'UNLU', 'USAK', 'USDTR', 'VAKBN', 'VAKFA', 'VAKFN',
    'VAKKO', 'VANGD', 'VBTYZ', 'VERTU', 'VERUS', 'VESBE', 'VESTL', 'VKFYO', 'VKGYO', 'VKING', 'VRGYO', 'VSNMD',
    'X030S', 'X100S', 'XBANA', 'XBANK', 'XBLSM', 'XELKT', 'XFINK', 'XGIDA', 'XGMYO', 'XHARZ', 'XHOLD', 'XILTM',
    'XINSA', 'XKAGT', 'XKMYA', 'XKOBI', 'XKURY', 'XMADN', 'XMANA', 'XMESY', 'XSADA', 'XSANK', 'XSANT', 'XSBAL',
    'XSBUR', 'XSDNZ', 'XSGRT', 'XSIST', 'XSIZM', 'XSKAY', 'XSKOC', 'XSKON', 'XSPOR', 'XSTKR', 'XTAST', 'XTCRT',
    'XTEKS', 'XTM25', 'XTMTU', 'XTRZM', 'XTUMY', 'XU030', 'XU050', 'XU100', 'XUHIZ', 'XULAS', 'XUMAL', 'XUSIN',
    'XUSRD', 'XUTEK', 'XUTUM', 'XYLDZ', 'XYORT', 'XYUZO', 'YAPRK', 'YATAS', 'YAYLA', 'YBTAS', 'YEOTK', 'YESIL',
    'YGGYO', 'YIGIT', 'YKBNK', 'YKSLN', 'YONGA', 'YUNSA', 'YYAPI', 'YYLGD', 'Z30EA', 'Z30KE', 'Z30KP', 'ZEDUR',
    'ZELOT', 'ZERGY', 'ZGOLD', 'ZGYO', 'ZOREN', 'ZPBDL', 'ZPLIB', 'ZPT10', 'ZPX30', 'ZRE20', 'ZRGYO', 'ZSR25',
    'ZTLRF', 'ZTLRK', 'ZTM25',
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
    XU100: 'BIST 100',
    XU030: 'BIST 30',
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
