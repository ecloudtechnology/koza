"""İçe aktarma (§11, §27 POST /v1/imports → 202 + job_id).

Dilim 1'de kuyruk yoktur: iş süreç içinde SENKRON işlenir ama iş semantiği korunur (job_id, durum, satır sonuçları).
- CSV (multipart `file`, `period_id` alanı) veya JSON (`{"period_id", "rows": [...]}`).
- `?preview=true`: hiçbir kayıt yaratılmaz; satır bazlı doğrulama sonucu döner.
- Satır hataları açıklamalı; hatalı satır işlenmez, diğerleri işlenir ("hangi satır işlendi" kesindir).
- Tekrar: aynı dosya (sha256) → aynı iş döner; aynı satır (row_hash) → ikinci kayıt yaratılmaz (duplicate).
- Geri alma: yalnız bu işin yarattığı ve hâlâ `draft` olan kayıtlar geri çekilir; onaylı/hesaplanmış kayıtlara dokunulmaz.
"""

from __future__ import annotations

import csv
import io
import re
import uuid
from typing import Any

from fastapi import APIRouter, Query, Request
from pydantic import ValidationError

from .. import workflow
from ..audit import record_event
from ..calc import canonical_json, sha256_hex
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..repo import ImportJob, Record, RecordVersion, utcnow_iso
from ..schemas import ActivityCreate, ImportRollbackRequest, ImportRows

router = APIRouter(prefix="/v1/imports", tags=["imports"])

MAX_ROWS = 5000
ALLOWED_COLUMNS = ("source_type", "fuel", "quantity", "quantity_state", "not_applicable_reason", "unit",
                   "heating_value_basis", "data_quality", "activity_start", "activity_end", "note", "source_id")
AMBIGUOUS_NUMBER = re.compile(r"^\d{1,3}(\.\d{3})+$")  # "1.234": binlik mi ondalık mı belirsiz (§11)


def _normalize_quantity(raw: str | None) -> tuple[str | None, str | None]:
    """Döner: (normalize miktar, hata). Virgül ondalık ayracı kabul edilir; "1.234" gibi belirsiz biçim reddedilir."""
    if raw is None:
        return None, None
    text = raw.strip().replace(" ", "")
    if not text:
        return None, None
    if AMBIGUOUS_NUMBER.match(text):
        return None, "Miktar belirsiz ('1.234' binlik mi ondalık mı?). Ondalık için virgül kullanın (1,234) ya da binlik ayracı kaldırın (1234)."
    if "," in text and "." in text:
        return None, "Miktar hem nokta hem virgül içeriyor; tek ayraç kullanın."
    return text.replace(",", "."), None


def _parse_csv(raw: bytes) -> list[dict[str, Any]]:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ApiError(422, "IMPORT_ENCODING", "Dosya UTF-8 değil; UTF-8 olarak kaydedip yeniden yükleyin.") from exc
    sample = text[:4096]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise ApiError(422, "IMPORT_EMPTY", "Dosyada başlık satırı yok.")
    rows = []
    for raw_row in reader:
        row = {(k or "").strip(): (v.strip() if isinstance(v, str) else v) for k, v in raw_row.items()}
        row.pop("", None)
        if all(v in (None, "") for v in row.values()):
            continue
        rows.append({k: (None if v == "" else v) for k, v in row.items()})
    return rows


def _validate_row(period_id: str, raw: dict[str, Any]) -> tuple[ActivityCreate | None, list[dict[str, str]]]:
    errors: list[dict[str, str]] = []
    data = dict(raw)
    unknown = sorted(k for k in data if k not in ALLOWED_COLUMNS)
    for k in unknown:
        errors.append({"field": k, "message": "Bilinmeyen sütun."})
        data.pop(k)
    if "quantity" in data and isinstance(data["quantity"], str):
        q, err = _normalize_quantity(data["quantity"])
        if err:
            errors.append({"field": "quantity", "message": err})
            data["quantity"] = None
        else:
            data["quantity"] = q
    if data.get("quantity_state") is None:
        data["quantity_state"] = "known" if data.get("quantity") is not None else "unknown"
    if data.get("data_quality") is None:
        data.pop("data_quality", None)
    try:
        model = ActivityCreate(period_id=period_id, **data)
    except ValidationError as exc:
        for e in exc.errors():
            loc = ".".join(str(p) for p in e.get("loc", [])) or "row"
            errors.append({"field": loc, "message": e.get("msg", "")})
        return None, errors
    except TypeError as exc:
        errors.append({"field": "row", "message": str(exc)})
        return None, errors
    return (model if not errors else None), errors


def _process(repo, ctx, request: Request, *, period_id: str, rows: list[dict[str, Any]], filename: str | None,
             file_sha: str, mode: str) -> ImportJob:
    period = repo.get_period(ctx.tenant_id, period_id)
    if period is None:
        raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.", field_errors=[{"field": "period_id", "message": "Dönem bulunamadı."}])
    if mode == "apply":
        workflow.ensure_period_open(period)
    if len(rows) > MAX_ROWS:
        raise ApiError(422, "IMPORT_TOO_MANY_ROWS", f"En fazla {MAX_ROWS} satır; dosyayı bölün.")

    job = ImportJob(id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, period_id=period_id, filename=filename,
                    file_sha256=file_sha, mode=mode, status="preview" if mode == "preview" else "done",
                    summary={}, rows=[], created_by=ctx.user_id)
    if mode == "apply":
        repo.add_import_job(job)  # kayıtlar iş kimliğine bağlanır (FK)

    seen_hashes: dict[str, int] = {}
    results: list[dict[str, Any]] = []
    created_ids: list[str] = []
    for idx, raw in enumerate(rows, start=1):
        model, errors = _validate_row(period_id, raw)
        entry: dict[str, Any] = {"row_no": idx, "row_hash": None, "status": "error", "record_id": None, "errors": errors}
        if model is None:
            results.append(entry)
            continue
        payload = model.model_dump(mode="json")
        row_hash = sha256_hex(canonical_json(payload))
        entry["row_hash"] = row_hash
        if row_hash in seen_hashes:
            entry.update(status="duplicate", errors=[{"field": "row", "message": f"Satır {seen_hashes[row_hash]} ile aynı; ikinci kayıt yaratılmaz."}])
            results.append(entry)
            continue
        seen_hashes[row_hash] = idx
        existing = repo.find_record_by_row_hash(ctx.tenant_id, row_hash)
        if existing is not None:
            entry.update(status="duplicate", record_id=existing.id,
                         errors=[{"field": "row", "message": "Aynı satır daha önce içe aktarılmış; ikinci kayıt yaratılmaz."}])
            results.append(entry)
            continue
        if mode == "preview":
            entry.update(status="valid", errors=[])
            results.append(entry)
            continue
        record = Record(id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, period_id=period_id, source_id=model.source_id,
                        created_by=ctx.user_id, import_job_id=job.id, row_hash=row_hash)
        repo.add_record(record)
        repo.append_version(RecordVersion(
            tenant_id=ctx.tenant_id, record_id=record.id, version=1, data_version=1, state=workflow.DRAFT,
            source_type=model.source_type, fuel=model.fuel, quantity=model.quantity, quantity_state=model.quantity_state,
            not_applicable_reason=model.not_applicable_reason, unit=model.unit, heating_value_basis=model.heating_value_basis,
            data_quality=model.data_quality, activity_start=model.activity_start.isoformat(),
            activity_end=model.activity_end.isoformat(), note=model.note, author_id=ctx.user_id, transition="import",
            change_reason=f"İçe aktarma işi {job.id}, satır {idx}",
        ))
        created_ids.append(record.id)
        entry.update(status="created", record_id=record.id, errors=[])
        results.append(entry)

    counts = {"rows": len(results)}
    for status in ("created", "valid", "duplicate", "error"):
        counts[status] = sum(1 for r in results if r["status"] == status)
    job.rows = results
    job.summary = counts
    if mode == "apply":
        repo.update_import_job(job)
        record_event(repo, ctx, request, action="import.apply", object_type="import_job", object_id=job.id,
                     payload={"period_id": period_id, "file_sha256": file_sha, "filename": filename, "counts": counts,
                              "created_record_ids": created_ids})
    else:
        repo.add_import_job(job)
        record_event(repo, ctx, request, action="import.preview", object_type="import_job", object_id=job.id,
                     payload={"period_id": period_id, "file_sha256": file_sha, "counts": counts})
    return job


def serialize_job(job: ImportJob) -> dict[str, Any]:
    return {
        "job_id": job.id, "id": job.id, "status": job.status, "mode": job.mode, "period_id": job.period_id,
        "filename": job.filename, "file_sha256": job.file_sha256, "summary": job.summary, "rows": job.rows,
        "created_by": job.created_by, "created_at": job.created_at, "rolled_back_at": job.rolled_back_at,
        "rolled_back_by": job.rolled_back_by,
    }


@router.post("", status_code=202, summary="İçe aktar (CSV multipart veya JSON satırlar) → 202 + job_id")
async def create_import(request: Request, repo: Repo, ctx: Ctx, preview: bool = Query(default=False)):
    """multipart/form-data: `file` (CSV, UTF-8, ayraç `,` veya `;`), `period_id`. JSON: `{"period_id","rows":[...]}`.
    Sütunlar: source_type, fuel, quantity, quantity_state, not_applicable_reason, unit, heating_value_basis, data_quality,
    activity_start, activity_end, note. Aynı dosya ikinci kez → aynı iş; aynı satır → `duplicate`."""
    workflow.require_roles(ctx, workflow.IMPORT_ROLES)
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        period_id = str(form.get("period_id") or "").strip()
        if upload is None or not hasattr(upload, "read"):
            raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.", field_errors=[{"field": "file", "message": "CSV dosyası gerekli."}])
        if not period_id:
            raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.", field_errors=[{"field": "period_id", "message": "Zorunlu."}])
        raw = await upload.read()
        if len(raw) > 10 * 1024 * 1024:
            raise ApiError(413, "PAYLOAD_TOO_LARGE", "CSV 10 MB sınırını aşıyor; dosyayı bölün.")
        filename = getattr(upload, "filename", None)
        rows = _parse_csv(raw)
        file_sha = sha256_hex(raw.decode("utf-8-sig", errors="replace"))
    else:
        try:
            body = ImportRows.model_validate(await request.json())
        except ValidationError as exc:
            raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.",
                           field_errors=[{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()])
        except ValueError:
            raise ApiError(422, "VALIDATION_ERROR", "Gövde JSON değil.", field_errors=[{"field": "body", "message": "JSON bekleniyor."}])
        period_id, rows, filename = body.period_id, body.rows, body.filename
        file_sha = sha256_hex(canonical_json({"period_id": period_id, "rows": rows}))
    if not rows:
        raise ApiError(422, "IMPORT_EMPTY", "İçe aktarılacak satır yok.")

    mode = "preview" if preview else "apply"
    if mode == "apply":
        previous = repo.find_import_job_by_sha(ctx.tenant_id, file_sha)
        if previous is not None:
            return ok(request, serialize_job(previous), status_code=202,
                      meta={"async": False, "idempotent_replay": True, "note": "Aynı dosya daha önce işlendi; ikinci kayıt yaratılmadı."})
    job = _process(repo, ctx, request, period_id=period_id, rows=rows, filename=filename, file_sha=file_sha, mode=mode)
    return ok(request, serialize_job(job), status_code=202, meta={"async": False, "note": "Dilim 1: iş süreç içinde senkron işlendi; kuyruk yok."})


@router.get("/{job_id}", summary="İçe aktarma işini oku")
def get_import(job_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    job = repo.get_import_job(ctx.tenant_id, job_id)
    if job is None:
        raise not_found("İçe aktarma işi")
    return ok(request, serialize_job(job))


@router.post("/{job_id}/rollback", summary="İçe aktarmayı geri al (yalnız taslak kayıtlar geri çekilir)")
def rollback_import(job_id: str, body: ImportRollbackRequest, request: Request, repo: Repo, ctx: Ctx):
    """İşin yarattığı kayıtlardan hâlâ `draft` olanlar geri çekilir (withdrawn); hesaplanmış/onaylı olanlar korunur ve
    `kept` listesinde döner. Sürüm satırları silinmez (kural 9). Kilitli dönemde 409."""
    workflow.require_roles(ctx, workflow.IMPORT_ROLLBACK_ROLES)
    job = repo.get_import_job(ctx.tenant_id, job_id)
    if job is None:
        raise not_found("İçe aktarma işi")
    if job.mode != "apply" or job.status != "done":
        raise ApiError(409, "IMPORT_NOT_ROLLBACKABLE", "Yalnız uygulanmış ve geri alınmamış iş geri alınabilir.",
                       details={"status": job.status, "mode": job.mode})
    period = repo.get_period(ctx.tenant_id, job.period_id)
    assert period is not None
    workflow.ensure_period_open(period)
    withdrawn, kept = [], []
    for row in job.rows:
        if row.get("status") != "created" or not row.get("record_id"):
            continue
        record = repo.get_record(ctx.tenant_id, row["record_id"])
        if record is None:
            continue
        if record.current.state == workflow.DRAFT:
            repo.withdraw_record(ctx.tenant_id, record.id, ctx.user_id, f"İçe aktarma geri alındı: {body.reason}")
            withdrawn.append(record.id)
        else:
            kept.append({"record_id": record.id, "state": record.current.state})
    job.status = "rolled_back"
    job.rolled_back_at = utcnow_iso()
    job.rolled_back_by = ctx.user_id
    job.summary = {**job.summary, "rollback": {"withdrawn": len(withdrawn), "kept": len(kept)}}
    repo.update_import_job(job)
    record_event(repo, ctx, request, action="import.rollback", object_type="import_job", object_id=job.id, reason=body.reason,
                 payload={"withdrawn": withdrawn, "kept": kept})
    return ok(request, {**serialize_job(job), "withdrawn": withdrawn, "kept": kept})
