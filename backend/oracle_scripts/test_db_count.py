import oracledb
try:
    conn = oracledb.connect(user="ADMIN", password="Ahmetberknurzehra07!", dsn="evalondb_high", config_dir="/Users/aliberkyesilduman/borsa-1/oracle_wallet", wallet_location="/Users/aliberkyesilduman/borsa-1/oracle_wallet", wallet_password="Ahmetberknurzehra07!")
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM BIST_PRICES_1H")
        print("TOTAL ROWS:", cur.fetchone()[0])
        cur.execute("SELECT TICKER, COUNT(*) FROM BIST_PRICES_1H GROUP BY TICKER")
        rows = cur.fetchall()
        print("TICKER COUNTS:", rows)
except Exception as e:
    print("DB ERROR:", e)
