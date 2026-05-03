#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import sys, os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

"""
main.py - BIST Takvim Kaziyicisi CLI Giris Noktasi
"""

import argparse
from datetime import datetime, timedelta

from config import BIST_TICKERS


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="BIST Takvim Kaziyicisi - varsayilan olarak genel BIST/makro takvimi toplar",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--sources",
        nargs="+",
        default=None,
        choices=["isyatirim", "kap", "macro_tr"],
        help="Sadece belirli kaynaklari kullan (varsayilan: macro_tr)",
    )
    parser.add_argument(
        "--tickers",
        nargs="+",
        default=None,
        help="Sadece belirli hisseler icin cek (orn: THYAO AKBNK)",
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Sadece dosyaya kaydet, Oracle'a yazma",
    )
    parser.add_argument(
        "--test-db",
        action="store_true",
        help="Sadece Oracle baglantisini test et",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="DB'deki onumuzdeki 30 gunluk etkinlikleri listele",
    )
    parser.add_argument(
        "--max-tickers",
        type=int,
        default=0,
        help="Test icin ticker sayisini sinirla (0 = sinirsiz)",
    )

    return parser


def main() -> None:
    args = build_parser().parse_args()

    print("=" * 70)
    print("  BIST FINANSAL TAKVIM KAZIYICISI")
    print(f"  Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # -- Test DB
    if args.test_db:
        from db import get_connection, ensure_table, count_events

        conn = get_connection()
        if conn:
            ensure_table(conn)
            total = count_events(conn)
            print(f"\n[OK] DB baglantisi basarili!")
            print(f"   Surum: {conn.version}")
            print(f"   BIST_CALENDAR'daki toplam etkinlik: {total}")
            conn.close()
        else:
            print("\n[HATA] DB baglantisi basarisiz!")
            sys.exit(1)
        return

    # -- Etkinlikleri listele
    if args.list:
        from db import get_connection, fetch_events_between

        conn = get_connection()
        if not conn:
            print("[HATA] DB baglantisi kurulamadi!")
            sys.exit(1)

        now = datetime.now()
        events = fetch_events_between(conn, now - timedelta(days=7), now + timedelta(days=30))
        conn.close()

        if not events:
            print("\nOnumuzdeki 30 gun icinde kayitli etkinlik yok.")
            return

        print(f"\nYaklasan etkinlikler ({len(events)} adet):")
        print("-" * 80)
        for ev in events:
            date = ev["event_date"]
            if isinstance(date, datetime):
                date = date.strftime("%Y-%m-%d")
            print(f"  {date}  {ev['ticker']:8s}  [{ev['event_type']:12s}]  {ev['event_title']}")
        return

    # -- Ana toplama islemi
    from collector import collect_all, save_to_files, save_to_oracle

    tickers = args.tickers
    if not tickers and args.max_tickers > 0:
        tickers = BIST_TICKERS[:args.max_tickers]

    events, stats = collect_all(tickers=tickers, sources=args.sources)

    if not events:
        print("\n[UYARI] Hic etkinlik toplanamadi!")
        print("   Olasi sebepler:")
        print("   - Kaynak sitelere erisim problemi")
        print("   - Secilen tickerlar icin veri yok")
        print("   - Kaynaklarin HTML yapisi degismis olabilir")
        sys.exit(0)

    # Dosyaya kaydet
    print("\n[main] Dosyaya kaydediliyor...")
    json_path, csv_path = save_to_files(events)

    # Istatistikler
    print(f"\n{'='*50}")
    print("  TOPLAMA ISTATISTIKLERI")
    print(f"{'='*50}")
    for key, val in stats.items():
        print(f"  {key:25s}: {val}")

    # Oracle'a yaz
    if not args.skip_db:
        print("\n[main] Oracle DB'ye yaziliyor...")
        upserted, errors = save_to_oracle(events)
        print(f"\n  Oracle sonuc: {upserted} basarili, {errors} hatali")
    else:
        print("\n[main] --skip-db aktif, DB yazilmadi.")

    print(f"\n{'='*70}")
    print(f"  Bitis: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
