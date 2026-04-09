import oracledb
conn = oracledb.connect(user="ADMIN", password="Ahmetberknurzehra07!", dsn="evalondb_high", config_dir="/Users/aliberkyesilduman/borsa-1/oracle_wallet", wallet_location="/Users/aliberkyesilduman/borsa-1/oracle_wallet", wallet_password="Ahmetberknurzehra07!")
with conn.cursor() as cur:
    cur.execute("SELECT TICKER, COUNT(*) FROM BIST_PRICES_1H GROUP BY TICKER ORDER BY COUNT(*) DESC")
    for row in cur.fetchall():
        print(row)
