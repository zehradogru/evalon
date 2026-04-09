import json
from pathlib import Path

# User's provided JS array from attachment
bist_available = [
    'AEFES', 'AGHOL', 'AKBNK', 'AKSA', 'AKSEN', 'ALARK', 'ALTNY', 'ARCLK',
    'ASELS', 'ASTOR', 'BALSU', 'BIMAS', 'BRSAN', 'BRYAT', 'BSOKE', 'BTCIM',
    'CANTE', 'CCOLA', 'CWENE', 'DAPGM', 'DOAS', 'DOHOL', 'DSTKF', 'ECILC',
    'EFOR', 'EGEEN', 'EKGYO', 'ENERY', 'ENJSA', 'ENKAI', 'EREGL', 'EUPWR',
    'FENER', 'FROTO', 'GARAN', 'GENIL', 'GESAN', 'GLRMK', 'GRSEL', 'GRTHO',
    'GSRAY', 'GUBRF', 'HALKB', 'HEKTS', 'IZENR', 'KCAER', 'KCHOL', 'KLRHO',
    'KONTR', 'KRDMD', 'KTLEV', 'KUYAS', 'MAGEN', 'MAVI', 'MGROS', 'MIATK',
    'MPARK', 'OBAMS', 'ODAS', 'OTKAR', 'OYAKC', 'PASEU', 'PATEK', 'PETKM',
    'PGSUS', 'QUAGR', 'RALYH', 'REEDR', 'SASA', 'SISE', 'SKBNK', 'SOKM',
    'TABGD', 'TAVHL', 'TCELL', 'THYAO', 'TKFEN', 'TOASO', 'TRALT', 'TRENJ',
    'TRMET', 'TSKB', 'TSPOR', 'TTKOM', 'TTRAK', 'TUKAS', 'TUPRS', 'TUREX',
    'TURSG', 'ULKER', 'VAKBN', 'VESTL', 'YEOTK', 'YKBNK', 'ZOREN', 'AKCNS',
    'AKENR', 'AKFGY', 'ALGYO', 'ALFAS', 'AHGAZ', 'AGROT', 'ARDYZ', 'BAGFS',
    'BIZIM', 'CLEBI', 'DEVA', 'GWIND', 'KAREL', 'LOGO', 'NETAS', 'PETUN',
    'PNSUT', 'SELEC', 'TMSN', 'VESBE', 'ZEDUR', 'IZFAS'
]

# Write exclusively the provided clean string array into our JSON
data = {"tr": bist_available}
with open('bist_tickers.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Updated bist_tickers.json with {len(bist_available)} tickers from your TS file.")
