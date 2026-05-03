from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import os
import oracledb
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/calendar", tags=["Calendar"])

class CalendarEventResponse(BaseModel):
    id: int
    ticker: str
    event_date: str
    event_type: str
    event_title: str
    importance: int
    source: Optional[str] = None
    extra: Optional[str] = None

def _resolve_wallet_dir() -> str:
    """Resolve wallet dir: env var > local fallback."""
    wallet_dir = (os.environ.get("ORACLE_WALLET_DIR") or "").strip()
    if wallet_dir:
        return wallet_dir
    # Local dev fallback
    local = r"C:\Users\zehra\Masaüstü\evalonn\scrapers\news_scraper\oracle_wallet"
    if os.path.isdir(local):
        return local
    return ""

def get_db_connection():
    try:
        user = os.environ.get('ORACLE_DB_USER', 'ADMIN')
        password = os.environ.get('ORACLE_DB_PASSWORD', '')
        dsn = os.environ.get('ORACLE_DB_DSN', '')
        wallet_dir = _resolve_wallet_dir()

        kwargs = dict(user=user, password=password, dsn=dsn)
        if wallet_dir:
            kwargs.update(config_dir=wallet_dir, wallet_location=wallet_dir, wallet_password=password)
        
        return oracledb.connect(**kwargs)
    except Exception as e:
        logger.error(f"DB Connection error in calendar: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

@router.get("", response_model=List[CalendarEventResponse])
def get_calendar_events(
    ticker: Optional[str] = None,
    event_type: Optional[str] = Query(None, description="Filter by event type (e.g. MAKRO, TEMETTU)"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500)
):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = "SELECT ID, TICKER, TO_CHAR(EVENT_DATE, 'YYYY-MM-DD HH24:MI:SS'), EVENT_TYPE, EVENT_TITLE, IMPORTANCE, SOURCE, EXTRA FROM BIST_CALENDAR WHERE 1=1"
        params = []
        
        if ticker:
            query += " AND TICKER = :ticker"
            params.append(ticker)
            
        if event_type:
            query += " AND EVENT_TYPE = :event_type"
            params.append(event_type)
            
        if start_date:
            query += " AND EVENT_DATE >= TO_TIMESTAMP(:start_date, 'YYYY-MM-DD')"
            params.append(start_date)
            
        if end_date:
            query += " AND EVENT_DATE <= TO_TIMESTAMP(:end_date, 'YYYY-MM-DD')"
            params.append(end_date)
            
        query += " ORDER BY EVENT_DATE ASC FETCH FIRST :limit ROWS ONLY"
        params.append(limit)
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        events = []
        for r in rows:
            events.append(CalendarEventResponse(
                id=r[0],
                ticker=r[1],
                event_date=r[2],
                event_type=r[3],
                event_title=r[4],
                importance=r[5],
                source=r[6],
                extra=r[7]
            ))
            
        cur.close()
        conn.close()
        return events
        
    except Exception as e:
        logger.error(f"Error fetching calendar events: {e}")
        raise HTTPException(status_code=500, detail=str(e))
