from fastapi import APIRouter, HTTPException, Query
from typing import Any, List, Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


class CalendarEventResponse(BaseModel):
    id: str
    ticker: str
    event_date: str
    event_type: str
    event_title: str
    importance: int
    source: Optional[str] = None
    extra: Optional[str] = None

GENERAL_SOURCES = (
    "forexfactory",
    "tcmb",
    "tuik_fallback",
    "borsa_istanbul",
    "borsa_istanbul_fallback",
    "viop_calendar",
)


def _lob(v: Any) -> Optional[str]:
    """Oracle LOB objesini string'e çevirir, None'ı korur."""
    if v is None:
        return None
    return v.read() if hasattr(v, "read") else str(v)


def create_calendar_router(db_client: Any) -> APIRouter:
    router = APIRouter(prefix="/v1/calendar", tags=["Calendar"])

    @router.get("", response_model=List[CalendarEventResponse])
    def get_calendar_events(
        scope: str = Query("general", description="general | corporate | all"),
        ticker: Optional[str] = None,
        event_type: Optional[str] = Query(None, description="Filter by event type (e.g. MAKRO, TEMETTU)"),
        start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
        end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
        limit: int = Query(100, ge=1, le=500),
    ):
        try:
            conn = db_client._connect()
            try:
                with conn.cursor() as cur:
                    query = (
                        "SELECT ID, TICKER, TO_CHAR(EVENT_DATE, 'YYYY-MM-DD HH24:MI:SS'),"
                        " EVENT_TYPE, EVENT_TITLE, IMPORTANCE, SOURCE, EXTRA"
                        " FROM BIST_CALENDAR WHERE 1=1"
                    )
                    params: dict = {}

                    normalized_scope = scope.strip().lower()
                    if normalized_scope == "general":
                        placeholders = []
                        for index, source_name in enumerate(GENERAL_SOURCES):
                            bind_key = f"general_source_{index}"
                            placeholders.append(f":{bind_key}")
                            params[bind_key] = source_name
                        query += f" AND LOWER(SOURCE) IN ({', '.join(placeholders)})"
                    elif normalized_scope == "corporate":
                        placeholders = []
                        for index, source_name in enumerate(GENERAL_SOURCES):
                            bind_key = f"general_source_{index}"
                            placeholders.append(f":{bind_key}")
                            params[bind_key] = source_name
                        query += f" AND LOWER(SOURCE) NOT IN ({', '.join(placeholders)})"
                    elif normalized_scope != "all":
                        raise HTTPException(status_code=400, detail="Invalid scope parameter.")

                    if ticker:
                        query += " AND UPPER(TICKER) = :ticker"
                        params["ticker"] = ticker.strip().upper()

                    if event_type:
                        query += " AND UPPER(EVENT_TYPE) = :event_type"
                        params["event_type"] = event_type.strip().upper()

                    if start_date:
                        query += " AND EVENT_DATE >= TO_TIMESTAMP(:start_date, 'YYYY-MM-DD')"
                        params["start_date"] = start_date

                    if end_date:
                        query += " AND EVENT_DATE <= TO_TIMESTAMP(:end_date, 'YYYY-MM-DD')"
                        params["end_date"] = end_date

                    query += " ORDER BY EVENT_DATE ASC FETCH FIRST :limit ROWS ONLY"
                    params["limit"] = limit

                    cur.execute(query, params)
                    rows = cur.fetchall()
            finally:
                conn.close()

            events = []
            for r in rows:
                events.append(
                    CalendarEventResponse(
                        id=_lob(r[0]) or "",
                        ticker=_lob(r[1]) or "",
                        event_date=_lob(r[2]) or "",
                        event_type=_lob(r[3]) or "",
                        event_title=_lob(r[4]) or "",
                        importance=int(r[5]) if r[5] is not None else 0,
                        source=_lob(r[6]),
                        extra=_lob(r[7]),
                    )
                )
            return events

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching calendar events: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return router
