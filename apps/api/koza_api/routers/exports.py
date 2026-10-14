"""CSV dışa aktarma (§25 formül enjeksiyonu önlenir; §27 API dışa aktarması UI ile aynı yetki/filtreyi uygular)."""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Query, Request
from fastapi.responses import Response

from .. import serializers, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..errors import not_found
from ..security import csv_safe

router = APIRouter(prefix="/v1/exports", tags=["exports"])

COLUMNS = ("record_id", "period_id", "state", "version", "data_version", "source_type", "fuel", "quantity", "quantity_state",
           "not_applicable_reason", "unit", "heating_value_basis", "data_quality", "activity_start", "activity_end", "note",
           "approved_run_id", "approved_total_co2e_kg", "coverage", "created_by", "updated_at")
NUMERIC = frozenset({"version", "data_version", "quantity", "approved_total_co2e_kg"})


@router.get("/activities.csv", summary="Faaliyet kayıtları CSV (UI ile aynı yetki ve filtre)")
def export_activities(request: Request, repo: Repo, ctx: Ctx, period_id: str | None = Query(default=None)):
    """Kural 2: miktar boş hücre (bilinmiyor) / "0" / `quantity_state` sütunu ile ayrılır; sayı asla float'a çevrilmez.
    Metin hücreleri `= + - @` ile başlıyorsa tek tırnakla etkisizleştirilir."""
    workflow.require_roles(ctx, workflow.EXPORT_ROLES)
    if period_id is not None and repo.get_period(ctx.tenant_id, period_id) is None:
        raise not_found("Dönem")
    records = sorted(repo.list_records(ctx.tenant_id, period_id), key=lambda r: (r.period_id, r.created_at, r.id))
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(COLUMNS)
    for rec in records:
        cur = rec.current
        run_id = serializers.approved_run_id(repo, rec)
        run = repo.get_run(ctx.tenant_id, run_id) if run_id else None
        row = {
            "record_id": rec.id, "period_id": rec.period_id, "state": cur.state, "version": cur.version,
            "data_version": cur.data_version, **cur.data(), "approved_run_id": run_id,
            "approved_total_co2e_kg": run.result.get("total_co2e_kg") if run else None,
            "coverage": run.result.get("coverage") if run else None, "created_by": rec.created_by, "updated_at": cur.created_at,
        }
        writer.writerow([("" if row[c] is None else str(row[c])) if c in NUMERIC else csv_safe(row[c]) for c in COLUMNS])
    record_event(repo, ctx, request, action="export.csv", object_type="export", object_id=None,
                 payload={"period_id": period_id, "rows": len(records), "format": "activities.csv"})
    body = "﻿" + buf.getvalue()  # BOM: Excel'de UTF-8 Türkçe karakterler için
    return Response(content=body.encode("utf-8"), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="faaliyet-kayitlari.csv"', "X-Row-Count": str(len(records))})
