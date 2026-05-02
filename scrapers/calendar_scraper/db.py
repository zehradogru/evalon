#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
db.py — Oracle veritabanı bağlantı ve CRUD işlemleri

BIST_CALENDAR tablosunu oluşturur (yoksa) ve etkinlikleri MERGE (upsert) ile yazar.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import oracledb

from config import DB_USER, DB_PASSWORD, DB_DSN, WALLET_DIR
from models import CalendarEvent


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def get_connection() -> Optional[oracledb.Connection]:
    """Oracle Autonomous DB bağlantısı kurar."""
    try:
        wallet_path = Path(WALLET_DIR)
        if wallet_path.exists():
            conn = oracledb.connect(
                user=DB_USER,
                password=DB_PASSWORD,
                dsn=DB_DSN,
                config_dir=str(wallet_path),
                wallet_location=str(wallet_path),
                wallet_password=DB_PASSWORD,
            )
            print(f"[db] Oracle bağlantısı kuruldu (wallet). Sürüm: {conn.version}")
            return conn

        # Wallet yoksa düz DSN ile dene
        conn = oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN)
        print(f"[db] Oracle bağlantısı kuruldu (direct). Sürüm: {conn.version}")
        return conn

    except Exception as exc:
        print(f"[db] Bağlantı hatası: {exc}")
        return None


# ---------------------------------------------------------------------------
# Table DDL
# ---------------------------------------------------------------------------

CREATE_TABLE_SQL = """
BEGIN
    EXECUTE IMMEDIATE '
        CREATE TABLE BIST_CALENDAR (
            ID           VARCHAR2(100)  PRIMARY KEY,
            TICKER       VARCHAR2(10)   NOT NULL,
            EVENT_DATE   DATE           NOT NULL,
            EVENT_TYPE   VARCHAR2(50)   NOT NULL,
            EVENT_TITLE  VARCHAR2(255)  NOT NULL,
            IMPORTANCE   NUMBER(1)      DEFAULT 2,
            SOURCE       VARCHAR2(100),
            EXTRA        VARCHAR2(1000),
            CREATED_AT   TIMESTAMP      DEFAULT SYSTIMESTAMP,
            UPDATED_AT   TIMESTAMP      DEFAULT SYSTIMESTAMP
        )
    ';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE = -955 THEN NULL;   -- ORA-00955: tablo zaten mevcut
        ELSE RAISE;
        END IF;
END;
"""

CREATE_INDEX_SQL = """
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST_CAL_DATE ON BIST_CALENDAR (EVENT_DATE)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
"""

CREATE_INDEX_TICKER_SQL = """
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST_CAL_TICKER ON BIST_CALENDAR (TICKER)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
"""

CREATE_INDEX_TYPE_SQL = """
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_BIST_CAL_TYPE ON BIST_CALENDAR (EVENT_TYPE)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
"""


def ensure_table(conn: oracledb.Connection) -> None:
    """BIST_CALENDAR tablosunu ve indekslerini oluşturur (yoksa)."""
    cursor = conn.cursor()
    try:
        cursor.execute(CREATE_TABLE_SQL)
        cursor.execute(CREATE_INDEX_SQL)
        cursor.execute(CREATE_INDEX_TICKER_SQL)
        cursor.execute(CREATE_INDEX_TYPE_SQL)
        conn.commit()
        print("[db] BIST_CALENDAR tablosu hazır.")
    except Exception as exc:
        print(f"[db] Tablo oluşturma hatası: {exc}")
    finally:
        cursor.close()


# ---------------------------------------------------------------------------
# Upsert (MERGE)
# ---------------------------------------------------------------------------

MERGE_SQL = """
MERGE INTO BIST_CALENDAR tgt
USING (SELECT :id AS ID FROM DUAL) src
ON (tgt.ID = src.ID)
WHEN MATCHED THEN
    UPDATE SET
        TICKER      = :ticker,
        EVENT_DATE  = :event_date,
        EVENT_TYPE  = :event_type,
        EVENT_TITLE = :event_title,
        IMPORTANCE  = :importance,
        SOURCE      = :source,
        EXTRA       = :extra,
        UPDATED_AT  = SYSTIMESTAMP
WHEN NOT MATCHED THEN
    INSERT (ID, TICKER, EVENT_DATE, EVENT_TYPE, EVENT_TITLE, IMPORTANCE, SOURCE, EXTRA, CREATED_AT, UPDATED_AT)
    VALUES (:id, :ticker, :event_date, :event_type, :event_title, :importance, :source, :extra, SYSTIMESTAMP, SYSTIMESTAMP)
"""


def upsert_events(conn: oracledb.Connection, events: List[CalendarEvent]) -> Tuple[int, int]:
    """
    Etkinlikleri MERGE ile yazar.
    Returns: (upserted_count, error_count)
    """
    cursor = conn.cursor()
    upserted = 0
    errors = 0

    try:
        for ev in events:
            try:
                row = ev.to_dict()
                cursor.execute(MERGE_SQL, {
                    "id":          row["id"],
                    "ticker":      row["ticker"],
                    "event_date":  row["event_date"],
                    "event_type":  row["event_type"],
                    "event_title": row["event_title"],
                    "importance":  row["importance"],
                    "source":      row["source"],
                    "extra":       row["extra"],
                })
                upserted += 1
            except Exception as exc:
                errors += 1
                print(f"[db] MERGE hatası ({ev.event_id}): {exc}")

        conn.commit()
    except Exception as exc:
        conn.rollback()
        print(f"[db] Toplu MERGE hatası: {exc}")
        raise
    finally:
        cursor.close()

    return upserted, errors


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

def fetch_events_between(
    conn: oracledb.Connection,
    start_date: datetime,
    end_date: datetime,
    event_type: Optional[str] = None,
) -> List[dict]:
    """Belirtilen tarih aralığındaki etkinlikleri çeker."""
    sql = """
        SELECT ID, TICKER, EVENT_DATE, EVENT_TYPE, EVENT_TITLE, IMPORTANCE, SOURCE, EXTRA
        FROM BIST_CALENDAR
        WHERE EVENT_DATE BETWEEN :start_date AND :end_date
    """
    params = {"start_date": start_date, "end_date": end_date}

    if event_type:
        sql += " AND EVENT_TYPE = :event_type"
        params["event_type"] = event_type.upper()

    sql += " ORDER BY EVENT_DATE ASC"

    cursor = conn.cursor()
    try:
        cursor.execute(sql, params)
        columns = [col[0].lower() for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return rows
    finally:
        cursor.close()


def count_events(conn: oracledb.Connection) -> int:
    """Toplam etkinlik sayısını döndürür."""
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM BIST_CALENDAR")
        return cursor.fetchone()[0]
    finally:
        cursor.close()
