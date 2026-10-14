"""Entegrasyonlar (§27): ERP/sayaç/seyahat/satın alma sistemleri önce staging alanına yazar.

- Webhook imzası doğrulanır (HMAC-SHA256 + zaman damgası; `koza_api.webhooks`).
- Aynı olay tekrar işlenmez: (source_system, external_id, event_id) tekildir; tekrar `duplicates` listesinde döner.
- Kaynak sistem kimliği, kayıt kimliği, çekilme zamanı ve eşleme sürümü tutulur; güncellik `/status` ile görünür.
- Çağıran, kurumun entegrasyon hizmet hesabıdır (Bearer + X-Tenant); kurum bağlamı imzadan değil üyelikten gelir.
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Query, Request
from pydantic import ValidationError

from .. import webhooks, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok, request_id_of
from ..errors import ApiError
from ..repo import StagingRow
from ..schemas import WebhookEvent

router = APIRouter(prefix="/v1/integrations", tags=["integrations"])


def _staging(r: StagingRow) -> dict:
    return {"id": r.id, "source_system": r.source_system, "external_id": r.external_id, "event_id": r.event_id,
            "pulled_at": r.pulled_at, "mapping_version": r.mapping_version, "payload": r.payload, "status": r.status,
            "received_at": r.received_at, "request_id": r.request_id}


@router.post("/{source_system}/events", status_code=202, summary="İmzalı webhook → staging (aynı olay tekrar işlenmez)")
async def receive_event(source_system: str, request: Request, repo: Repo, ctx: Ctx):
    """Başlıklar: `X-Koza-Timestamp` (Unix sn), `X-Koza-Signature: sha256=<HMAC(secret, "<ts>.<gövde>")>`.
    Gövde: {event_id, mapping_version, pulled_at?, rows: [{external_id, payload, pulled_at?}]}."""
    workflow.require_roles(ctx, workflow.INTEGRATION_ROLES)
    secret = request.app.state.webhook_secrets.get(source_system)
    if not secret:
        raise ApiError(503, "WEBHOOK_SECRET_MISSING", "Bu kaynak sistem için webhook sırrı tanımlı değil (KOZA_WEBHOOK_SECRETS).",
                       details={"source_system": source_system})
    raw = await request.body()
    valid, reason = webhooks.verify_signature(secret, request.headers.get("x-koza-timestamp", ""), raw,
                                             request.headers.get("x-koza-signature", ""))
    if not valid:
        raise ApiError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook imzası doğrulanamadı.", details={"reason": reason})
    try:
        event = WebhookEvent.model_validate(json.loads(raw.decode("utf-8")))
    except (ValueError, UnicodeDecodeError):
        raise ApiError(422, "VALIDATION_ERROR", "Gövde JSON değil.", field_errors=[{"field": "body", "message": "JSON bekleniyor."}])
    except ValidationError as exc:
        raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.",
                       field_errors=[{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()])
    accepted, duplicates = [], []
    for row in event.rows:
        pulled = row.pulled_at or event.pulled_at
        staged = StagingRow(id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, source_system=source_system,
                            external_id=row.external_id, event_id=event.event_id,
                            pulled_at=pulled.isoformat() if pulled else None, mapping_version=event.mapping_version,
                            payload=row.payload, request_id=request_id_of(request))
        if repo.add_staging_row(staged):
            accepted.append(row.external_id)
        else:
            duplicates.append(row.external_id)
    record_event(repo, ctx, request, action="integration.receive", object_type="integration_event", object_id=None,
                 payload={"source_system": source_system, "event_id": event.event_id, "mapping_version": event.mapping_version,
                          "accepted": len(accepted), "duplicates": len(duplicates)})
    return ok(request, {"source_system": source_system, "event_id": event.event_id, "accepted": accepted,
                        "duplicates": duplicates, "status": "staged"}, status_code=202,
              meta={"note": "Staging satırları eşleme/doğrulama sonrası kayda dönüşür; kurumsal envantere doğrudan yazılmaz."})


@router.get("/staging", summary="Staging satırları")
def list_staging(request: Request, repo: Repo, ctx: Ctx, source_system: str | None = Query(default=None)):
    workflow.require_roles(ctx, workflow.INTEGRATION_ROLES | workflow.AUDIT_ROLES)
    rows = repo.list_staging(ctx.tenant_id, source_system)
    return ok(request, [_staging(r) for r in rows], meta={"count": len(rows)})


@router.get("/status", summary="Entegrasyon güncellik durumu (kaynak sistem başına son alım)")
def status(request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    return ok(request, repo.integration_status(ctx.tenant_id))
