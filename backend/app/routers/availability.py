from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.availability import AvailabilityResponse
from app.services.availability import calculate_availability


router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=AvailabilityResponse)
def get_availability(
    category: str = Query(..., description="skates | skis | snowboard"),
    size_value: int | None = Query(None, description="EU-размер для коньков и ботинок"),
    size_bucket: str | None = Query(None, description="S/M/L/XL для лыж и сноуборда"),
    boot_size_value: int | None = Query(None, description="EU-размер ботинок для лыж/сноуборда"),
    start_date: date | None = Query(None, description="По умолчанию — сегодня"),
    days: int = Query(7, ge=1, le=14),
    db: Session = Depends(get_db),
):
    # Свободные часы на n дней вперед (7)
    if category == "skates" and size_value is None:
        raise HTTPException(400, "Для коньков нужен size_value (EU-размер)")

    if category in ("skis", "snowboard"):
        if size_bucket is None:
            raise HTTPException(400, "Для лыж/сноуборда нужен size_bucket")
        if boot_size_value is None:
            raise HTTPException(400, "Для лыж/сноуборда нужен boot_size_value")

    try:
        return calculate_availability(
            db,
            category,
            size_value=size_value,
            size_bucket=size_bucket,
            boot_size_value=boot_size_value,
            start_date=start_date,
            days_count=days,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))