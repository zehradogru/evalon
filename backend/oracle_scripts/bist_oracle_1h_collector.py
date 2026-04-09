#!/usr/bin/env python3
"""
BIST 1 Saatlik (1h) Geçmiş Veri Toplayıcı - Oracle Cloud Database
Geniş bir hisse senedi listesi için 730 günlük 1 saatlik verileri çeker ve DB'ye kaydeder.
"""

import yfinance as yf
import oracledb
import os
import time
from datetime import datetime, timedelta
import pandas as pd

# ==================== YAPILANDIRMA ====================

DB_USER = os.environ.get("ORACLE_DB_USER", "ADMIN")
DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD", "Ahmetberknurzehra07!")  # .env den alınabilir, şimdilik check_db_stats.py deki gibi
DB_DSN = os.environ.get("ORACLE_DB_DSN", "evalondb_high")
WALLET_DIR = os.environ.get("ORACLE_WALLET_DIR", "/Users/aliberkyesilduman/borsa-1/oracle_wallet")

# Kullanıcının Girdiği Liste
TICKERS_RAW = [
    'A1CAP.IS', 'A1YEN.IS', 'ACSEL.IS', 'ADEL.IS', 'ADESE.IS', 'ADGYO.IS', 'AEFES.IS', 'AFYON.IS', 'AGESA.IS', 'AGHOL.IS', 
    'AGROT.IS', 'AGYO.IS', 'AHGAZ.IS', 'AHSGY.IS', 'AKBNK.IS', 'AKCNS.IS', 'AKENR.IS', 'AKFGY.IS', 'AKFIS.IS', 'AKFYE.IS', 
    'AKGRT.IS', 'AKHAN.IS', 'AKMGY.IS', 'AKSA.IS', 'AKSEN.IS', 'AKSGY.IS', 'AKSUE.IS', 'AKYHO.IS', 'ALARK.IS', 'ALBRK.IS', 
    'ALCAR.IS', 'ALCTL.IS', 'ALFAS.IS', 'ALGYO.IS', 'ALKA.IS', 'ALKIM.IS', 'ALKLC.IS', 'ALTNY.IS', 'ALVES.IS', 'ANELE.IS', 
    'ANGEN.IS', 'ANHYT.IS', 'ANSGR.IS', 'ARASE.IS', 'ARCLK.IS', 'ARDYZ.IS', 'ARENA.IS', 'ARFYE.IS', 'ARMGD.IS', 'ARSAN.IS', 
    'ARTMS.IS', 'ARZUM.IS', 'ASELS.IS', 'ASGYO.IS', 'ASTOR.IS', 'ASUZU.IS', 'ATAGY.IS', 'ATAKP.IS', 'ATATP.IS', 'ATEKS.IS', 
    'ATLAS.IS', 'ATSYH.IS', 'AVGYO.IS', 'AVHOL.IS', 'AVOD.IS', 'AVPGY.IS', 'AVTUR.IS', 'AYCES.IS', 'AYDEM.IS', 'AYEN.IS', 
    'AYES.IS', 'AYGAZ.IS', 'AZTEK.IS', 'BAGFS.IS', 'BAHKM.IS', 'BAKAB.IS', 'BALAT.IS', 'BALSU.IS', 'BANVT.IS', 'BARMA.IS', 
    'BASCM.IS', 'BASGZ.IS', 'BAYRK.IS', 'BEGYO.IS', 'BERA.IS', 'BESLR.IS', 'BESTE.IS', 'BEYAZ.IS', 'BFREN.IS', 'BIENY.IS', 
    'BIGCH.IS', 'BIGEN.IS', 'BIGTK.IS', 'BIMAS.IS', 'BINBN.IS', 'BINHO.IS', 'BIOEN.IS', 'BIZIM.IS', 'BJKAS.IS', 'BLCYT.IS', 
    'BLUME.IS', 'BMSCH.IS', 'BMSTL.IS', 'BNTAS.IS', 'BOBET.IS', 'BORLS.IS', 'BORSK.IS', 'BOSSA.IS', 'BRISA.IS', 'BRKO.IS', 
    'BRKSN.IS', 'BRKVY.IS', 'BRLSM.IS', 'BRMEN.IS', 'BRSAN.IS', 'BRYAT.IS', 'BSOKE.IS', 'BTCIM.IS', 'BUCIM.IS', 'BULGS.IS', 
    'BURCE.IS', 'BURVA.IS', 'BVSAN.IS', 'BYDNR.IS', 'CANTE.IS', 'CASA.IS', 'CATES.IS', 'CCOLA.IS', 'CELHA.IS', 'CEMAS.IS', 
    'CEMTS.IS', 'CEMZY.IS', 'CEOEM.IS', 'CGCAM.IS', 'CIMSA.IS', 'CLEBI.IS', 'CMBTN.IS', 'CMENT.IS', 'CONSE.IS', 'COSMO.IS', 
    'CRDFA.IS', 'CRFSA.IS', 'CUSAN.IS', 'CVKMD.IS', 'CWENE.IS', 'DAGI.IS', 'DAPGM.IS', 'DARDL.IS', 'DCTTR.IS', 'DENGE.IS', 
    'DERHL.IS', 'DERIM.IS', 'DESA.IS', 'DESPC.IS', 'DEVA.IS', 'DGATE.IS', 'DGGYO.IS', 'DGNMO.IS', 'DITAS.IS', 'DMRGD.IS', 
    'DMSAS.IS', 'DNISI.IS', 'DOAS.IS', 'DOCO.IS', 'DOFER.IS', 'DOFRB.IS', 'DOGUB.IS', 'DOHOL.IS', 'DOKTA.IS', 'DSTKF.IS', 
    'DUNYH.IS', 'DURDO.IS', 'DURKN.IS', 'DYOBY.IS', 'DZGYO.IS', 'EBEBK.IS', 'ECILC.IS', 'ECOGR.IS', 'ECZYT.IS', 'EDATA.IS', 
    'EDIP.IS', 'EFOR.IS', 'EGEEN.IS', 'EGEGY.IS', 'EGEPO.IS', 'EGGUB.IS', 'EGPRO.IS', 'EGSER.IS', 'EKGYO.IS', 'EKIZ.IS', 
    'EKOS.IS', 'EKSUN.IS', 'ELITE.IS', 'EMKEL.IS', 'EMNIS.IS', 'ENDAE.IS', 'ENERY.IS', 'ENJSA.IS', 'ENKAI.IS', 'ENSRI.IS', 
    'ENTRA.IS', 'EPLAS.IS', 'ERBOS.IS', 'ERCB.IS', 'EREGL.IS', 'ERSU.IS', 'ESCAR.IS', 'ESCOM.IS', 'ESEN.IS', 'ETILR.IS', 
    'ETYAT.IS', 'EUHOL.IS', 'EUKYO.IS', 'EUPWR.IS', 'EUREN.IS', 'EUYO.IS', 'EYGYO.IS', 'FADE.IS', 'FENER.IS', 'FLAP.IS', 
    'FMIZP.IS', 'FONET.IS', 'FORMT.IS', 'FORTE.IS', 'FRIGO.IS', 'FRMPL.IS', 'FROTO.IS', 'FZLGY.IS', 'GARAN.IS', 'GARFA.IS', 
    'GATEG.IS', 'GEDIK.IS', 'GEDZA.IS', 'GENIL.IS', 'GENTS.IS', 'GEREL.IS', 'GESAN.IS', 'GIPTA.IS', 'GLBMD.IS', 'GLCVY.IS', 
    'GLRMK.IS', 'GLRYH.IS', 'GLYHO.IS', 'GMTAS.IS', 'GOKNR.IS', 'GOLTS.IS', 'GOODY.IS', 'GOZDE.IS', 'GRNYO.IS', 'GRSEL.IS', 
    'GRTHO.IS', 'GSDDE.IS', 'GSDHO.IS', 'GSRAY.IS', 'GUBRF.IS', 'GUNDG.IS', 'GWIND.IS', 'GZNMI.IS', 'HALKB.IS', 'HATEK.IS', 
    'HATSN.IS', 'HDFGS.IS', 'HEDEF.IS', 'HEKTS.IS', 'HKTM.IS', 'HLGYO.IS', 'HOROZ.IS', 'HRKET.IS', 'HTTBT.IS', 'HUBVC.IS', 
    'HUNER.IS', 'HURGZ.IS', 'ICBCT.IS', 'ICUGS.IS', 'IDGYO.IS', 'IEYHO.IS', 'IHAAS.IS', 'IHEVA.IS', 'IHGZT.IS', 'IHLAS.IS', 
    'IHLGM.IS', 'IHYAY.IS', 'IMASM.IS', 'INDES.IS', 'INFO.IS', 'INGRM.IS', 'INTEK.IS', 'INTEM.IS', 'INVEO.IS', 'INVES.IS', 
    'ISATR.IS', 'ISBIR.IS', 'ISBTR.IS', 'ISCTR.IS', 'ISDMR.IS', 'ISFIN.IS', 'ISGSY.IS', 'ISGYO.IS', 'ISIST.IS', 'ISKPL.IS', 
    'ISKUR.IS', 'ISMEN.IS', 'ISSEN.IS', 'ISYAT.IS', 'IZENR.IS', 'IZFAS.IS', 'IZINV.IS', 'IZMDC.IS', 'JANTS.IS', 'KAPLM.IS', 
    'KAREL.IS', 'KARSN.IS', 'KARTN.IS', 'KATMR.IS', 'KAYSE.IS', 'KBORU.IS', 'KCAER.IS', 'KCHOL.IS', 'KENT.IS', 'KERVN.IS', 
    'KFEIN.IS', 'KGYO.IS', 'KIMMR.IS', 'KLGYO.IS', 'KLKIM.IS', 'KLMSN.IS', 'KLNMA.IS', 'KLRHO.IS', 'KLSER.IS', 'KLSYN.IS', 
    'KLYPV.IS', 'KMPUR.IS', 'KNFRT.IS', 'KOCMT.IS', 'KONKA.IS', 'KONTR.IS', 'KONYA.IS', 'KOPOL.IS', 'KORDS.IS', 'KOTON.IS', 
    'KRDMA.IS', 'KRDMB.IS', 'KRDMD.IS', 'KRGYO.IS', 'KRONT.IS', 'KRPLS.IS', 'KRSTL.IS', 'KRTEK.IS', 'KRVGD.IS', 'KSTUR.IS', 
    'KTLEV.IS', 'KTSKR.IS', 'KUTPO.IS', 'KUVVA.IS', 'KUYAS.IS', 'KZBGY.IS', 'KZGYO.IS', 'LIDER.IS', 'LIDFA.IS', 'LILAK.IS', 
    'LINK.IS', 'LKMNH.IS', 'LMKDC.IS', 'LOGO.IS', 'LRSHO.IS', 'LUKSK.IS', 'LYDHO.IS', 'LYDYE.IS', 'MAALT.IS', 'MACKO.IS', 
    'MAGEN.IS', 'MAKIM.IS', 'MAKTK.IS', 'MANAS.IS', 'MARBL.IS', 'MARKA.IS', 'MARMR.IS', 'MARTI.IS', 'MAVI.IS', 'MEDTR.IS', 
    'MEGAP.IS', 'MEGMT.IS', 'MEKAG.IS', 'MEPET.IS', 'MERCN.IS', 'MERIT.IS', 'MERKO.IS', 'METRO.IS', 'MEYSU.IS', 'MGROS.IS', 
    'MHRGY.IS', 'MIATK.IS', 'MMCAS.IS', 'MNDRS.IS', 'MNDTR.IS', 'MOBTL.IS', 'MOGAN.IS', 'MOPAS.IS', 'MPARK.IS', 'MRGYO.IS', 
    'MRSHL.IS', 'MSGYO.IS', 'MTRKS.IS', 'MTRYO.IS', 'MZHLD.IS', 'NATEN.IS', 'NETAS.IS', 'NETCD.IS', 'NIBAS.IS', 'NTGAZ.IS', 
    'NTHOL.IS', 'NUGYO.IS', 'NUHCM.IS', 'OBAMS.IS', 'OBASE.IS', 'ODAS.IS', 'ODINE.IS', 'OFSYM.IS', 'ONCSM.IS', 'ONRYT.IS', 
    'OPTGY.IS', 'ORCAY.IS', 'ORGE.IS', 'ORMA.IS', 'OSMEN.IS', 'OSTIM.IS', 'OTKAR.IS', 'OTTO.IS', 'OYAKC.IS', 'OYAYO.IS', 
    'OYLUM.IS', 'OYYAT.IS', 'OZATD.IS', 'OZGYO.IS', 'OZKGY.IS', 'OZRDN.IS', 'OZSUB.IS', 'OZYSR.IS', 'PAGYO.IS', 'PAHOL.IS', 
    'PAMEL.IS', 'PAPIL.IS', 'PARSN.IS', 'PASEU.IS', 'PATEK.IS', 'PCILT.IS', 'PEKGY.IS', 'PENGD.IS', 'PENTA.IS', 'PETKM.IS', 
    'PETUN.IS', 'PGSUS.IS', 'PINSU.IS', 'PKART.IS', 'PKENT.IS', 'PLTUR.IS', 'PNLSN.IS', 'PNSUT.IS', 'POLHO.IS', 'POLTK.IS', 
    'PRDGS.IS', 'PRKAB.IS', 'PRKME.IS', 'PRZMA.IS', 'PSDTC.IS', 'PSGYO.IS', 'QNBFK.IS', 'QNBTR.IS', 'QUAGR.IS', 'RALYH.IS', 
    'RAYSG.IS', 'REEDR.IS', 'RGYAS.IS', 'RNPOL.IS', 'RODRG.IS', 'RTALB.IS', 'RUBNS.IS', 'RUZYE.IS', 'RYGYO.IS', 'RYSAS.IS', 
    'SAFKR.IS', 'SAHOL.IS', 'SAMAT.IS', 'SANEL.IS', 'SANFM.IS', 'SANKO.IS', 'SARKY.IS', 'SASA.IS', 'SAYAS.IS', 'SDTTR.IS', 
    'SEGMN.IS', 'SEGYO.IS', 'SEKFK.IS', 'SEKUR.IS', 'SELEC.IS', 'SELVA.IS', 'SERNT.IS', 'SEYKM.IS', 'SILVR.IS', 'SISE.IS', 
    'SKBNK.IS', 'SKTAS.IS', 'SKYLP.IS', 'SKYMD.IS', 'SMART.IS', 'SMRTG.IS', 'SMRVA.IS', 'SNGYO.IS', 'SNICA.IS', 'SNPAM.IS', 
    'SODSN.IS', 'SOKE.IS', 'SOKM.IS', 'SONME.IS', 'SRVGY.IS', 'SUMAS.IS', 'SUNTK.IS', 'SURGY.IS', 'SUWEN.IS', 'TABGD.IS', 
    'TARKM.IS', 'TATEN.IS', 'TATGD.IS', 'TAVHL.IS', 'TBORG.IS', 'TCELL.IS', 'TCKRC.IS', 'TDGYO.IS', 'TEHOL.IS', 'TEKTU.IS', 
    'TERA.IS', 'TEZOL.IS', 'TGSAS.IS', 'THYAO.IS', 'TKFEN.IS', 'TKNSA.IS', 'TLMAN.IS', 'TMPOL.IS', 'TMSN.IS', 'TNZTP.IS', 
    'TOASO.IS', 'TRALT.IS', 'TRCAS.IS', 'TRENJ.IS', 'TRGYO.IS', 'TRHOL.IS', 'TRILC.IS', 'TRMET.IS', 'TSGYO.IS', 'TSKB.IS', 
    'TSPOR.IS', 'TTKOM.IS', 'TTRAK.IS', 'TUCLK.IS', 'TUKAS.IS', 'TUPRS.IS', 'TUREX.IS', 'TURGG.IS', 'TURSG.IS', 'UCAYM.IS', 
    'UFUK.IS', 'ULAS.IS', 'ULKER.IS', 'ULUFA.IS', 'ULUSE.IS', 'ULUUN.IS', 'UNLU.IS', 'USAK.IS', 'VAKBN.IS', 'VAKFA.IS', 
    'VAKFN.IS', 'VAKKO.IS', 'VANGD.IS', 'VBTYZ.IS', 'VERTU.IS', 'VERUS.IS', 'VESBE.IS', 'VESTL.IS', 'VKFYO.IS', 'VKGYO.IS', 
    'VKING.IS', 'VRGYO.IS', 'VSNMD.IS', 'YAPRK.IS', 'YATAS.IS', 'YAYLA.IS', 'YBTAS.IS', 'YEOTK.IS', 'YESIL.IS', 'YGGYO.IS', 
    'YIGIT.IS', 'YKBNK.IS', 'YKSLN.IS', 'YONGA.IS', 'YUNSA.IS', 'YYAPI.IS', 'YYLGD.IS', 'ZEDUR.IS', 'ZERGY.IS', 'ZGYO.IS', 
    'ZOREN.IS', 'ZRGYO.IS'
]

# ==================== VERİTABANI FONKSİYONLARI ====================

def get_db_connection():
    try:
        connection = oracledb.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            config_dir=WALLET_DIR,
            wallet_location=WALLET_DIR,
            wallet_password=DB_PASSWORD
        )
        return connection
    except Exception as e:
        print(f"❌ Veritabanı bağlantı hatası: {e}")
        return None

def create_table_1h(connection):
    cursor = connection.cursor()
    create_table_sql = """
    BEGIN
        EXECUTE IMMEDIATE '
            CREATE TABLE BIST_PRICES_1H (
                ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                TICKER VARCHAR2(20) NOT NULL,
                PRICE_DATETIME_STR VARCHAR2(50) NOT NULL,
                PRICE_DATETIME TIMESTAMP NOT NULL,
                OPEN_PRICE NUMBER(18,6),
                HIGH_PRICE NUMBER(18,6),
                LOW_PRICE NUMBER(18,6),
                CLOSE_PRICE NUMBER(18,6),
                VOLUME NUMBER(20),
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT UK_BIST_PRICES_1H UNIQUE (TICKER, PRICE_DATETIME_STR)
            )
        ';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN NULL;
            ELSE RAISE;
            END IF;
    END;
    """
    
    idx_ticker = "BEGIN EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST1H_TICKER ON BIST_PRICES_1H(TICKER)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF; END;"
    idx_time = "BEGIN EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST1H_TIME ON BIST_PRICES_1H(PRICE_DATETIME)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF; END;"
    
    try:
        cursor.execute(create_table_sql)
        cursor.execute(idx_ticker)
        cursor.execute(idx_time)
        connection.commit()
    except Exception as e:
        print(f"⚠️ 1H Tablo oluşturma uyarısı: {e}")
    finally:
        cursor.close()

def insert_price_data(connection, ticker, df):
    if df.empty:
        return 0
    
    cursor = connection.cursor()
    inserted_count = 0
    
    insert_sql = """
        INSERT INTO BIST_PRICES_1H (TICKER, PRICE_DATETIME_STR, PRICE_DATETIME, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, VOLUME)
        VALUES (:ticker, :dt_str, TO_TIMESTAMP(:dt_ts, 'YYYY-MM-DD HH24:MI:SS'), :open, :high, :low, :close, :volume)
    """
    
    for idx, row in df.iterrows():
        dt_str = idx.strftime('%Y-%m-%d %H:%M:%S %z')
        dt_ts = idx.strftime('%Y-%m-%d %H:%M:%S')
        
        try:
            cursor.execute(insert_sql, {
                "ticker": ticker.replace(".IS", ""),
                "dt_str": dt_str,
                "dt_ts": dt_ts,
                "open": float(row['Open']) if pd.notna(row['Open']) else None,
                "high": float(row['High']) if pd.notna(row['High']) else None,
                "low": float(row['Low']) if pd.notna(row['Low']) else None,
                "close": float(row['Close']) if pd.notna(row['Close']) else None,
                "volume": int(row['Volume']) if pd.notna(row['Volume']) else 0
            })
            inserted_count += 1
        except Exception as e:
            if "ORA-00001" in str(e):
                continue
            else:
                print(f"❌ DB Insert Hatası ({ticker}): {e}")
                
    connection.commit()
    cursor.close()
    return inserted_count

# ==================== VERİ ÇEKME FONKSİYONLARI ====================

def fetch_1h_historical_data(ticker):
    print(f"📊 {ticker} 1s verisi çekiliyor (730 gün)...")
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            stock = yf.Ticker(ticker)
            # 1h interval has a max history of 730 days. To avoid IPO bugs in yfinance, use explicit dates.
            end_date = datetime.now()
            start_date = end_date - timedelta(days=725)
            df = stock.history(start=start_date, end=end_date, interval="1h")
            
            if df.empty:
                print(f"⚠️ {ticker} 1s verisi boş veya bulunamadı!")
                return None
            return df
            
        except Exception as e:
            if "Rate limited" in str(e) or "Too Many Requests" in str(e):
                wait = (attempt + 1) * 15
                print(f"⏳ Rate limit: {wait} sn bekleniyor...")
                time.sleep(wait)
            else:
                print(f"❌ {ticker} çekim hatası: {e}")
                return None
    return None

def main():
    print("="*60)
    print("🏦 BIST Tarihsel 1-Saatlik Veri Toplayıcı")
    print(f"Hisse Sayısı: {len(TICKERS_RAW)}")
    
    conn = get_db_connection()
    if not conn:
        return
        
    print(f"✅ DB Bağlandı. (Sürüm: {conn.version})")
    create_table_1h(conn)
    
    total_records = 0
    successful = 0
    
    for i, ticker in enumerate(TICKERS_RAW, 1):
        # Format ticker: ensure valid Yahoo Finance IS extension
        clean_ticker = ticker if ticker.endswith(".IS") else f"{ticker}.IS"
        print(f"[{i}/{len(TICKERS_RAW)}] ", end="")
        
        df = fetch_1h_historical_data(clean_ticker)
        
        if df is not None and not df.empty:
            records = insert_price_data(conn, clean_ticker, df)
            print(f"✅ {clean_ticker}: Veritabanına {records} yeni kayıt eklendi.")
            total_records += records
            successful += 1
        else:
            print(f"⏭️  {clean_ticker} atlandı.")
            
        # Rate limit için kısa duraklama
        time.sleep(1)

    print("="*60)
    print(f"🎉 İşlem Tamamlandı. {total_records} toplam kayıt eklendi ({successful}/{len(TICKERS_RAW)} hisse başarılı).")
    conn.close()

if __name__ == "__main__":
    main()
