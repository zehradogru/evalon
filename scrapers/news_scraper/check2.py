# -*- coding: utf-8 -*-
import oracledb, os
conn = oracledb.connect(
    user="ADMIN",
    password="Ahmetberknurzehra07!",
    dsn="evalondb_high",
    config_dir="oracle_wallet",
    wallet_location="oracle_wallet",
    wallet_password="Ahmetberknurzehra07!"
)
cur = conn.cursor()
print("=== TABLOLAR ===")
cur.execute("SELECT TABLE_NAME, NVL(NUM_ROWS,0) FROM USER_TABLES ORDER BY TABLE_NAME")
for row in cur.fetchall():
    print("  " + row[0] + ": ~" + str(row[1]))
print()
cur.execute("SELECT COUNT(*) FROM BIST_PRICES")
print("BIST_PRICES toplam: " + str(cur.fetchone()[0]))
print()
cur.execute(r"SELECT DISTINCT TICKER FROM BIST_PRICES WHERE TICKER LIKE '%\_C' ESCAPE '\' ORDER BY TICKER")
rows = cur.fetchall()
print("_C ile biten: " + str(len(rows)) + " ticker")
for (t,) in rows:
    cur2 = conn.cursor()
    cur2.execute("SELECT COUNT(*), MIN(PRICE_DATETIME), MAX(PRICE_DATETIME) FROM BIST_PRICES WHERE TICKER = :t", {"t":t})
    cnt, mn, mx = cur2.fetchone()
    print("  " + t + ": " + str(cnt) + " satir (" + str(mn) + " -> " + str(mx) + ")")
conn.close()
print("Bitti.")
