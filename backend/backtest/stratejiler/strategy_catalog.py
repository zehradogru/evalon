from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List,  Union, Optional, Tuple


@dataclass(frozen=True)
class RuleSpec:
    id: str
    label: str
    family: str
    category: str
    stages: Tuple[str, ...]
    summary: str


@dataclass(frozen=True)
class PresetSpec:
    id: str
    label: str
    summary: str
    direction: str
    stage_threshold: int
    rule_ids: Tuple[str, ...]


RULE_LIBRARY: Tuple[RuleSpec, ...] = (
    RuleSpec("hhhl", "Yukselen dip + yukselen tepe", "price_action", "Structure", ("trend",), "Ust periyotta trendin yukari yone oturdugunu yapisal olarak teyit eder."),
    RuleSpec("lhll", "Alcalan tepe + alcalan dip", "price_action", "Structure", ("trend",), "Ust periyotta asagi yonlu yapinin devam ettigini teyit eder."),
    RuleSpec("ema-stack", "EMA stack", "indicator", "Trend Filter", ("trend", "setup"), "EMA 20 / 50 / 200 dizilimi ile trend rejimini filtreler."),
    RuleSpec("rsi-regime", "RSI regime", "indicator", "Indicator", ("trend", "setup", "trigger"), "RSI ile rejim filtresi kur."),
    RuleSpec("breakout", "Direnc kirilimi", "price_action", "Breakout", ("setup",), "Orta periyotta yatay veya egimli direnc bolgesinden cikisi isaretler."),
    RuleSpec("pullback", "EMA pullback", "price_action", "Pullback", ("setup",), "Ana trend yonunde geri cekilmeyi islem fikrine donusturur."),
    RuleSpec("compression", "Sikisma / contraction", "pattern", "Pattern", ("setup",), "Volatilite daralmasi ve enerji birikimini setup asamasinda izler."),
    RuleSpec("macd-cross", "MACD cross", "indicator", "Indicator", ("setup", "trigger"), "MACD ve signal crossover ile momentum tetigi kurar."),
    RuleSpec("retest", "Retest hold", "price_action", "Trigger", ("trigger",), "Kirilan bolgenin retest ile korunup korunmadigini giris asamasinda netlestirir."),
    RuleSpec("volume-confirm", "Hacim teyidi", "volume", "Volume", ("trigger",), "Giris aninda hacim genislemesi ile sinyalin arkasinda katilim oldugunu dogrular."),
    RuleSpec("micro-breakout", "Mikro kirilim", "price_action", "Trigger", ("trigger",), "Alt periyotta lokal pivot ustunden temiz cikis ile girisi hassaslastirir."),
    RuleSpec("reversal-candle", "Tetik mum yapisi", "price_action", "Candle", ("trigger",), "Mikro tetik mum mantigini temsil eder."),
    RuleSpec("ema-cross", "EMA cross", "indicator", "Indicator", ("setup", "trigger"), "Hizli ve yavas EMA kesisimi ile momentumun yone dondugu anlari tarar."),
    RuleSpec("ma-ribbon", "MA ribbon trend", "indicator", "Trend Filter", ("trend", "setup"), "EMA ribbon dizilimi ve egimi ile trendin saglikli sekilde surup surmedigini filtreler."),
    RuleSpec("donchian-breakout", "Donchian breakout", "price_action", "Breakout", ("setup", "trigger"), "Son N barin en yuksek/en dusuk kanalinin disina cikisi izler."),
    RuleSpec("bollinger-squeeze", "Bollinger squeeze", "indicator", "Volatility", ("setup", "trigger"), "Band genisligi daraldiginda enerji birikimini yakalar."),
    RuleSpec("vwap-reclaim", "VWAP reclaim", "volume", "Volume", ("setup", "trigger"), "Ozellikle intraday tarafta fiyatin session VWAP ustune geri donup tutunmasini arar."),
    RuleSpec("inside-breakout", "Inside bar break", "pattern", "Pattern", ("trigger",), "Mother bar araligindan cikis ile sikismadan ekspansiyona gecisi temsil eder."),
    RuleSpec("rsi-reclaim", "RSI reclaim", "indicator", "Indicator", ("setup", "trigger"), "RSI asiri bolgeden geri cikarken mean reversion veya momentum devam sinyali uretir."),
    RuleSpec("stoch-rsi-cross", "Stoch RSI cross", "indicator", "Indicator", ("trigger",), "Stoch RSI kesisimi ile hizlanan momentum veya mean reversion tetigini arar."),
    RuleSpec("fib-bounce", "Fib 38.2 / 61.8 bounce", "fibonacci", "Fibonacci", ("setup", "trigger"), "Son swing icinde 38.2-61.8 geri cekilme bolgesinden gelen tepkiyi takip eder."),
    RuleSpec("fib-golden-pocket", "Fib golden pocket", "fibonacci", "Fibonacci", ("setup", "trigger"), "0.618-0.65 golden pocket bolgesinden gelen trend yonlu donusu yakalamaya calisir."),
    RuleSpec("support-hold", "Destekten donus", "price_action", "Support/Resistance", ("setup", "trigger"), "Son destek alanina inip oradan guclu kapanisla donen fiyat davranisini tarar."),
    RuleSpec("sr-flip-retest", "S/R flip retest", "price_action", "Support/Resistance", ("setup", "trigger"), "Kirilan direncin destek gibi calisarak tekrar test edilmesini arar."),
    RuleSpec("ascending-triangle", "Ascending triangle", "pattern", "Pattern", ("setup", "trigger"), "Yatay direnc ve yukselen diplerden olusan klasik devam formasyonunu tarar."),
    RuleSpec("double-bottom", "Double bottom / top", "pattern", "Pattern", ("setup", "trigger"), "Iki benzer dip veya tepe sonrasi neckline kirilimi ile donusu teyit etmeye calisir."),
    RuleSpec("bull-flag", "Bull/Bear flag", "pattern", "Pattern", ("setup", "trigger"), "Impulse hareketten sonra gelen duzeltme kanalinin kirilimini arar."),
    RuleSpec("rectangle-breakout", "Rectangle breakout", "pattern", "Pattern", ("setup", "trigger"), "Yatay band icinde baz olusturup sonrasinda band disina cikan hareketi temsil eder."),
    RuleSpec("trend-slope", "Trend slope", "price_action", "Trend Filter", ("trend", "setup"), "Secilen lookback boyunca fiyatin net yone egimli akip akmadigini kontrol eder."),
    RuleSpec("channel-trend", "Price channel trend", "price_action", "Trend Filter", ("trend", "setup"), "Fiyatin kanal ust yari veya alt yari icinde islem gormesiyle trendi filtreler."),
    RuleSpec("adx-dmi-trend", "ADX + DMI trend", "indicator", "Trend Strength", ("trend", "setup"), "ADX gucu ve +DI/-DI yonu ile ana trendin hem guclu hem de yonlu olup olmadigini filtreler."),
    RuleSpec("aroon-trend", "Aroon trend", "indicator", "Trend Strength", ("trend",), "Son zirve ve diplerin ne kadar yeni olduguna bakarak trendin tazeligini ve yonunu olcer."),
    RuleSpec("ichimoku-cloud-trend", "Ichimoku cloud trend", "indicator", "Trend Filter", ("trend", "setup"), "Fiyatin bulutun ustunde/altinda olmasi, cloud rengi ve Tenkan-Kijun iliskisi ile trend rejimini teyit eder."),
    RuleSpec("vortex-trend", "Vortex trend", "indicator", "Trend Strength", ("trend", "setup"), "VI+ ve VI- ayrisimi ile yone hakim olan hareketin gucunu izler."),
    RuleSpec("supertrend-bias", "SuperTrend bias", "indicator", "Trend Filter", ("trend", "setup"), "ATR tabanli SuperTrend cizgisinin ustu/alti ile ana yonu trend takip mantigiyla filtreler."),
    RuleSpec("psar-trend", "Parabolic SAR trend", "indicator", "Trend Filter", ("trend", "setup"), "Parabolic SAR noktalarinin fiyatin ustunde veya altinda kalmasi ile trend yonunu izler."),
    RuleSpec("macd-zero-bias", "MACD zero-line bias", "indicator", "Trend Filter", ("trend", "setup"), "MACD'nin sifir cizgisinin ustunde veya altinda kalmasi ile orta vadeli trend tarafini belirler."),
)


PRESET_LIBRARY: Tuple[PresetSpec, ...] = (
    PresetSpec("starter-support", "Starter Support", "Saatlik kaynakta hizli sonuc veren baslangic seti: destekte tepki arar ve tek stage ile trade uretir.", "long", 1, ("support-hold",)),
    PresetSpec("breakout-stack", "Breakout Micro", "4 saatlik kirilim ve 1 saatlik mikro teyit ile devam hareketlerini tarar.", "long", 2, ("breakout", "micro-breakout")),
    PresetSpec("support-reversal", "Support Reversal", "4 saatlik destekte tutunma ve 1 saatlik tetik mumu ile reaksiyon islemine odaklanir.", "long", 2, ("support-hold", "reversal-candle")),
    PresetSpec("trend-breakout-lite", "Trend Breakout Lite", "Gunluk trend egimini advisory tutup 4 saatlik kirilim ve 1 saatlik mikro teyidi birlestirir.", "long", 2, ("trend-slope", "breakout", "micro-breakout")),
    PresetSpec("rsi-reclaim-reversion", "RSI Reclaim", "4 saatlik RSI geri kazanimini 1 saatlik tetik mumu ile birlestirir; her iki yone de trade arayabilir.", "both", 2, ("rsi-reclaim", "reversal-candle")),
    PresetSpec("fib-trend-pullback", "Fib Reaction", "4 saatlik golden pocket tepkisini 1 saatlik tetik mumu ile eslestirir; seyrek ama secici bir set.", "long", 2, ("fib-golden-pocket", "reversal-candle")),
    PresetSpec("sr-break-retest", "S/R Break Retest", "4 saatlik seviyenin kirilip tekrar test edilmesini ve 1 saatlik mikro teyidi arar.", "both", 2, ("sr-flip-retest", "micro-breakout")),
    PresetSpec("pattern-continuation", "Rectangle + Inside", "4 saatlik yatay bazin kirilimini 1 saatlik inside-bar acilimi ile tamamlar.", "both", 2, ("rectangle-breakout", "inside-breakout")),
    PresetSpec("trend-consensus", "Trend Consensus", "Trend stage'de ADX/DMI, Ichimoku ve EMA dizilimini birlestirip sadece guclu ana trendlerde kirilim arar.", "long", 3, ("adx-dmi-trend", "ichimoku-cloud-trend", "ema-stack", "breakout", "micro-breakout")),
    PresetSpec("trend-pullback-pro", "Trend Pullback Pro", "SuperTrend ve MACD bias ile ana trendi sabitler, orta periyotta pullback ve alt periyotta tetik mumu arar.", "both", 3, ("supertrend-bias", "macd-zero-bias", "pullback", "reversal-candle")),
)
