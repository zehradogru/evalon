"""
Checks 1-minute (BIST_PRICES) data coverage for two groups:
  Group A: the ~100 tickers known to have 1-min data
  Group B: all other tickers in BIST_AVAILABLE

For each ticker in both groups, we query:
  - earliest PRICE_DATETIME
  - latest  PRICE_DATETIME
  - total row count

DB connection uses the local wallet.
"""

import oracledb

DB_USER = "ADMIN"
DB_PASSWORD = "Ahmetberknurzehra07!"
DB_DSN = "evalondb_high"
WALLET_DIR = r"C:\Users\zehra\Masaüstü\evalonn\scrapers\news_scraper\oracle_wallet"

# ------------------------------------------------------------------
# Group A: tickers believed to have full 1-min history
# ------------------------------------------------------------------
GROUP_A = [
    "AEFES","AGHOL","AKBNK","AKSA","AKSEN","ALARK","ALTNY","ANSGR","ARCLK","ASELS",
    "ASTOR","BALSU","BIMAS","BRSAN","BRYAT","BSOKE","BTCIM","CANTE","CCOLA","CIMSA",
    "CWENE","DAPGM","DOAS","DOHOL","DSTKF","ECILC","EFOR","EGEEN","EKGYO","ENERY",
    "ENJSA","ENKAI","EREGL","EUPWR","FENER","FROTO","GARAN","GENIL","GESAN","GLRMK",
    "GRSEL","GRTHO","GSRAY","GUBRF","HALKB","HEKTS","ISCTR","ISMEN","IZENR","KCAER",
    "KCHOL","KLRHO","KONTR","KRDMD","KTLEV","KUYAS","MAGEN","MAVI","MGROS","MIATK",
    "MPARK","OBAMS","ODAS","OTKAR","OYAKC","PASEU","PATEK","PETKM","PGSUS","QUAGR",
    "RALYH","REEDR","SAHOL","SASA","SISE","SKBNK","SOKM","TABGD","TAVHL","TCELL",
    "THYAO","TKFEN","TOASO","TRALT","TRENJ","TRMET","TSKB","TSPOR","TTKOM","TTRAK",
    "TUKAS","TUPRS","TUREX","TURSG","ULKER","VAKBN","VESTL","YEOTK","YKBNK","ZOREN",
    "AKCNS","AKENR","AKFGY","ALGYO","ALFAS","AHGAZ","AGROT","ARDYZ","BAGFS",
    "BIZIM","CLEBI","DEVA","GWIND","ISGYO","KAREL","LOGO","NETAS","PETUN",
    "PNSUT","SELEC","TMSN","VESBE","ZEDUR","IZFAS",
]

# ------------------------------------------------------------------
# All BIST_AVAILABLE tickers from markets.ts (non-index/non-special)
# ------------------------------------------------------------------
ALL_BIST = [
    'A1CAP','A1YEN','ACSEL','ADEL','ADESE','ADGYO','AEFES','AFYON','AGESA','AGHOL',
    'AGROT','AGYO','AHGAZ','AHSGY','AKBNK','AKCNS','AKENR','AKFGY','AKFIS','AKFYE',
    'AKGRT','AKHAN','AKMGY','AKSA','AKSEN','AKSGY','AKSUE','AKYHO','ALARK','ALBRK',
    'ALCAR','ALCTL','ALFAS','ALGYO','ALKA','ALKIM','ALKLC','ALTNY','ALVES','ANELE',
    'ANGEN','ANHYT','ANSGR','ARASE','ARCLK','ARDYZ','ARENA','ARFYE','ARMGD','ARSAN',
    'ARTMS','ARZUM','ASELS','ASGYO','ASTOR','ASUZU','ATAGY','ATAKP','ATATP','ATEKS',
    'ATLAS','ATSYH','AVGYO','AVHOL','AVOD','AVPGY','AVTUR','AYCES','AYDEM','AYEN',
    'AYES','AYGAZ','AZTEK','BAGFS','BAHKM','BAKAB','BALAT','BALSU','BANVT','BARMA',
    'BASCM','BASGZ','BAYRK','BEGYO','BERA','BESLR','BESTE','BEYAZ','BFREN','BIENY',
    'BIGCH','BIGEN','BIGTK','BIMAS','BINBN','BINHO','BIOEN','BIZIM','BJKAS','BLCYT',
    'BLUME','BMSCH','BMSTL','BNTAS','BOBET','BORLS','BORSK','BOSSA','BRISA','BRKO',
    'BRKSN','BRKVY','BRLSM','BRMEN','BRSAN','BRYAT','BSOKE','BTCIM','BUCIM','BULGS',
    'BURCE','BURVA','BVSAN','BYDNR','CANTE','CASA','CATES','CCOLA','CELHA','CEMAS',
    'CEMTS','CEMZY','CEOEM','CGCAM','CIMSA','CLEBI','CMBTN','CMENT','CONSE','COSMO',
    'CRDFA','CRFSA','CUSAN','CVKMD','CWENE','DAGI','DAPGM','DARDL','DCTTR','DENGE',
    'DERHL','DERIM','DESA','DESPC','DEVA','DGATE','DGGYO','DGNMO','DITAS','DMRGD',
    'DMSAS','DNISI','DOAS','DOCO','DOFER','DOFRB','DOGUB','DOHOL','DOKTA','DSTKF',
    'DUNYH','DURDO','DURKN','DYOBY','DZGYO','EBEBK','ECILC','ECOGR','ECZYT','EDATA',
    'EDIP','EFOR','EGEEN','EGEGY','EGEPO','EGGUB','EGPRO','EGSER','EKGYO','EKIZ',
    'EKOS','EKSUN','ELITE','EMKEL','EMNIS','ENDAE','ENERY','ENJSA','ENKAI','ENSRI',
    'ENTRA','EPLAS','ERBOS','ERCB','EREGL','ERSU','ESCAR','ESCOM','ESEN','ETILR',
    'ETYAT','EUHOL','EUKYO','EUPWR','EUREN','EUYO','EYGYO','FADE','FENER','FLAP',
    'FMIZP','FONET','FORMT','FORTE','FRIGO','FRMPL','FROTO','FZLGY','GARAN','GARFA',
    'GATEG','GEDIK','GEDZA','GENIL','GENTS','GEREL','GESAN','GIPTA','GLBMD','GLCVY',
    'GLRMK','GLRYH','GLYHO','GMTAS','GOKNR','GOLTS','GOODY','GOZDE','GRNYO','GRSEL',
    'GRTHO','GSDDE','GSDHO','GSRAY','GUBRF','GUNDG','GWIND','GZNMI','HALKB','HATEK',
    'HATSN','HDFGS','HEDEF','HEKTS','HKTM','HLGYO','HOROZ','HRKET','HTTBT','HUBVC',
    'HUNER','HURGZ','ICBCT','ICUGS','IDGYO','IEYHO','IHAAS','IHEVA','IHGZT','IHLAS',
    'IHLGM','IHYAY','IMASM','INDES','INFO','INGRM','INTEK','INTEM','INVEO','INVES',
    'ISATR','ISBIR','ISBTR','ISCTR','ISDMR','ISFIN','ISGSY','ISGYO','ISIST','ISKPL',
    'ISKUR','ISMEN','ISSEN','ISYAT','IZENR','IZFAS','IZINV','IZMDC','JANTS','KAPLM',
    'KAREL','KARSN','KARTN','KATMR','KAYSE','KBORU','KCAER','KCHOL','KENT','KERVN',
    'KFEIN','KGYO','KIMMR','KLGYO','KLKIM','KLMSN','KLNMA','KLRHO','KLSER','KLSYN',
    'KLYPV','KMPUR','KNFRT','KOCMT','KONKA','KONTR','KONYA','KOPOL','KORDS','KOTON',
    'KRDMA','KRDMB','KRDMD','KRGYO','KRONT','KRPLS','KRSTL','KRTEK','KRVGD','KSTUR',
    'KTLEV','KTSKR','KUTPO','KUVVA','KUYAS','KZBGY','KZGYO','LIDER','LIDFA','LILAK',
    'LINK','LKMNH','LMKDC','LOGO','LRSHO','LUKSK','LYDHO','LYDYE','MAALT','MACKO',
    'MAGEN','MAKIM','MAKTK','MANAS','MARBL','MARKA','MARMR','MARTI','MAVI','MEDTR',
    'MEGAP','MEGMT','MEKAG','MEPET','MERCN','MERIT','MERKO','METRO','MEYSU','MGROS',
    'MHRGY','MIATK','MMCAS','MNDRS','MNDTR','MOBTL','MOGAN','MOPAS','MPARK','MRGYO',
    'MRSHL','MSGYO','MTRKS','MTRYO','MZHLD','NATEN','NETAS','NETCD','NIBAS','NTGAZ',
    'NTHOL','NUGYO','NUHCM','OBAMS','OBASE','ODAS','ODINE','OFSYM','ONCSM','ONRYT',
    'OPTGY','ORCAY','ORGE','ORMA','OSMEN','OSTIM','OTKAR','OTTO','OYAKC','OYAYO',
    'OYLUM','OYYAT','OZATD','OZGYO','OZKGY','OZRDN','OZSUB','OZYSR','PAGYO','PAHOL',
    'PAMEL','PAPIL','PARSN','PASEU','PATEK','PCILT','PEKGY','PENGD','PENTA','PETKM',
    'PETUN','PGSUS','PINSU','PKART','PKENT','PLTUR','PNLSN','PNSUT','POLHO','POLTK',
    'PRDGS','PRKAB','PRKME','PRZMA','PSDTC','PSGYO','QNBFK','QNBTR','QUAGR','RALYH',
    'RAYSG','REEDR','RGYAS','RNPOL','RODRG','RTALB','RUBNS','RUZYE','RYGYO','RYSAS',
    'SAFKR','SAHOL','SAMAT','SANEL','SANFM','SANKO','SARKY','SASA','SAYAS','SDTTR',
    'SEGMN','SEGYO','SEKFK','SEKUR','SELEC','SELVA','SERNT','SEYKM','SILVR','SISE',
    'SKBNK','SKTAS','SKYLP','SKYMD','SMART','SMRTG','SMRVA','SNGYO','SNICA','SNPAM',
    'SODSN','SOKE','SOKM','SONME','SRVGY','SUMAS','SUNTK','SURGY','SUWEN','TABGD',
    'TARKM','TATEN','TATGD','TAVHL','TBORG','TCELL','TCKRC','TDGYO','TEHOL','TEKTU',
    'TERA','TEZOL','TGSAS','THYAO','TKFEN','TKNSA','TLMAN','TMPOL','TMSN','TNZTP',
    'TOASO','TRALT','TRCAS','TRENJ','TRGYO','TRHOL','TRILC','TRMET','TSGYO','TSKB',
    'TSPOR','TTKOM','TTRAK','TUCLK','TUKAS','TUPRS','TUREX','TURGG','TURSG','UCAYM',
    'UFUK','ULAS','ULKER','ULUFA','ULUSE','ULUUN','UNLU','USAK','VAKBN','VAKFA',
    'VAKFN','VAKKO','VANGD','VBTYZ','VERTU','VERUS','VESBE','VESTL','VKFYO','VKGYO',
    'VKING','VRGYO','VSNMD','YAPRK','YATAS','YAYLA','YBTAS','YEOTK','YESIL','YGGYO',
    'YIGIT','YKBNK','YKSLN','YONGA','YUNSA','YYAPI','YYLGD','ZEDUR','ZERGY','ZGYO',
    'ZOREN','ZRGYO',
]

GROUP_A_SET = set(GROUP_A)
GROUP_B = [t for t in ALL_BIST if t not in GROUP_A_SET]

print(f"Group A (1-min known): {len(GROUP_A)}")
print(f"Group B (others):      {len(GROUP_B)}")
print()

try:
    conn = oracledb.connect(
        user=DB_USER,
        password=DB_PASSWORD,
        dsn=DB_DSN,
        config_dir=WALLET_DIR,
        wallet_location=WALLET_DIR,
        wallet_password=DB_PASSWORD,
    )
    print("Connected to Oracle DB.\n")
    cur = conn.cursor()

    # ------------------------------------------------------------------
    # 1. What tables exist? (BIST_PRICES = 1-min, BIST_PRICES_1H = hourly)
    # ------------------------------------------------------------------
    cur.execute("""
        SELECT TABLE_NAME FROM USER_TABLES
        WHERE TABLE_NAME LIKE 'BIST%'
        ORDER BY TABLE_NAME
    """)
    tables = [r[0] for r in cur.fetchall()]
    print("Tables found:", tables)
    print()

    # ------------------------------------------------------------------
    # 2. Overall stats per table
    # ------------------------------------------------------------------
    price_tables = [t for t in tables if t in ('BIST_PRICES', 'BIST_PRICES_1H')]
    for tbl in price_tables:
        try:
            cur.execute("SELECT COUNT(*), COUNT(DISTINCT TICKER), MIN(PRICE_DATETIME), MAX(PRICE_DATETIME) FROM " + tbl)
            total, distinct_tickers, mn, mx = cur.fetchone()
            print(f"[{tbl}] rows={total:,}  distinct_tickers={distinct_tickers}  range={mn} -> {mx}")
        except Exception as e:
            print(f"[{tbl}] ERROR: {e}")
    print()

    # ------------------------------------------------------------------
    # 3. Per-ticker earliest date in BIST_PRICES (1-min table)
    # ------------------------------------------------------------------
    ONE_MIN_TABLE = "BIST_PRICES"
    print(f"=== Per-ticker earliest/latest in {ONE_MIN_TABLE} ===")

    cur.execute("SELECT TICKER, MIN(PRICE_DATETIME) AS earliest, MAX(PRICE_DATETIME) AS latest, COUNT(*) AS row_cnt FROM " + ONE_MIN_TABLE + " GROUP BY TICKER ORDER BY TICKER")
    results = cur.fetchall()
    db_1min = {r[0]: {"earliest": r[1], "latest": r[2], "rows": r[3]} for r in results}

    print(f"\nTotal tickers in {ONE_MIN_TABLE}: {len(db_1min)}\n")

    # Group A results
    print("--- GROUP A (expected 1-min tickers) ---")
    a_found = 0
    a_missing = []
    for t in sorted(GROUP_A):
        if t in db_1min:
            a_found += 1
            info = db_1min[t]
            print(f"  {t:10s}  earliest={info['earliest']}  latest={info['latest']}  rows={info['rows']:,}")
        else:
            a_missing.append(t)
    print(f"\n  Found: {a_found}/{len(GROUP_A)}")
    if a_missing:
        print(f"  MISSING from DB: {a_missing}")

    # Group B results
    print("\n--- GROUP B (other BIST_AVAILABLE tickers) ---")
    b_found = []
    b_missing = []
    for t in sorted(GROUP_B):
        if t in db_1min:
            b_found.append(t)
            info = db_1min[t]
            print(f"  {t:10s}  earliest={info['earliest']}  latest={info['latest']}  rows={info['rows']:,}")  # noqa
        else:
            b_missing.append(t)
    print(f"\n  Found in 1-min table: {len(b_found)}")
    print(f"  NOT in 1-min table:   {len(b_missing)}")
    if b_found:
        print(f"  Tickers with 1-min data (surprise!): {b_found}")

    # ------------------------------------------------------------------
    # 4. Repeat for 1H table
    # ------------------------------------------------------------------
    if "BIST_PRICES_1H" in tables:
        ONE_H_TABLE = "BIST_PRICES_1H"
        print(f"\n=== Per-ticker earliest/latest in {ONE_H_TABLE} ===")
        cur.execute("SELECT TICKER, MIN(PRICE_DATETIME) AS earliest, MAX(PRICE_DATETIME) AS latest, COUNT(*) AS row_cnt FROM " + ONE_H_TABLE + " GROUP BY TICKER ORDER BY TICKER")
        results_1h = cur.fetchall()
        db_1h = {r[0]: {"earliest": r[1], "latest": r[2], "rows": r[3]} for r in results_1h}
        print(f"Total tickers in {ONE_H_TABLE}: {len(db_1h)}\n")

        print("--- GROUP B tickers in 1H table ---")
        for t in sorted(GROUP_B):
            if t in db_1h:
                info = db_1h[t]
                print(f"  {t:10s}  earliest={info['earliest']}  latest={info['latest']}  rows={info['rows']:,}")

    cur.close()
    conn.close()
    print("\nDone.")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
