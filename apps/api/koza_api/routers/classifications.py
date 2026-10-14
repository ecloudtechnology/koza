"""Sınıflandırma önerisi (§27 POST /v1/classifications/preview): kural tabanlı, deterministik, LLM yok (kural 1).

Kurallar `koza_api/data/classification_rules.json` içinde sürümlüdür; yanıt gerekçe, eksik sorular ve kural sürümü döner.
Hiçbir şey saklanmaz; öneri bağlayıcı değildir (uzman kontrolör inceler).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

from .. import workflow
from ..deps import Ctx, Repo
from ..envelope import ok
from ..schemas import ClassificationPreviewRequest

router = APIRouter(prefix="/v1/classifications", tags=["classifications"])

RULES_PATH = Path(__file__).resolve().parents[1] / "data" / "classification_rules.json"
CONTROL_REQUIRED = ("stationary_combustion", "mobile_combustion", "process", "refrigerant")
FUEL_RELEVANT = ("stationary_combustion", "mobile_combustion")


@lru_cache(maxsize=1)
def load_rules() -> dict[str, Any]:
    return json.loads(RULES_PATH.read_text(encoding="utf-8"))


def classify(body: ClassificationPreviewRequest) -> dict[str, Any]:
    rules = load_rules()
    questions = rules["questions"]
    missing: list[dict[str, str]] = []
    st, cr, hint = body.source_type, body.control_relation, body.scope3_hint
    if st in CONTROL_REQUIRED and (cr is None or cr == "unknown"):
        missing.append({"field": "control_relation", "question_tr": questions["control_relation"]})
    if st in FUEL_RELEVANT and not body.fuel:
        missing.append({"field": "fuel", "question_tr": questions["fuel"]})

    matched = None
    for rule in rules["rules"]:
        when = rule["when"]
        if st not in when["source_type"]:
            continue
        if "control_relation" in when and cr not in when["control_relation"]:
            continue
        matched = rule
        break

    if matched is None:
        known = sorted({s for r in rules["rules"] for s in r["when"]["source_type"]})
        return {
            "suggestion": None, "confidence": "none", "rule_id": None, "rules_version": rules["rules_version"],
            "rationale_tr": "Bu kaynak türü için tanımlı kural yok; kaynak türünü desteklenen listeden seçin veya uzman kontrolöre danışın.",
            "missing_questions": missing, "supported_source_types": known, "persisted": False, "binding": False,
        }

    category = matched.get("category")
    confidence = matched["confidence"]
    if category == "from_hint":
        category = rules["scope3_categories"].get(hint or "")
        if category is None:
            confidence = "needs_input"
    for field in matched.get("ask", []):
        if field == "scope3_hint" and category is None and not any(m["field"] == "scope3_hint" for m in missing):
            missing.append({"field": "scope3_hint", "question_tr": questions["scope3_hint"]})
    if missing and confidence == "rule" and any(m["field"] == "control_relation" for m in missing):
        confidence = "needs_input"
    return {
        "suggestion": {"scope": matched.get("scope"), "category": category, "context": matched.get("context", "corporate")},
        "confidence": confidence,
        "rule_id": matched["id"],
        "rules_version": rules["rules_version"],
        "rationale_tr": matched["rationale_tr"],
        "missing_questions": missing,
        "persisted": False,
        "binding": False,
    }


@router.post("/preview", summary="Kapsam/kategori önerisi (kural tabanlı; hiçbir şey saklanmaz)")
def preview(body: ClassificationPreviewRequest, request: Request, repo: Repo, ctx: Ctx):
    """Kaynak türü + yakıt + kontrol ilişkisinden deterministik öneri. Yanıt: gerekçe (`rationale_tr`),
    eksik sorular (`missing_questions`), kural kimliği ve sürümü. LLM kullanılmaz; sonuç bağlayıcı değildir."""
    workflow.require_roles(ctx, workflow.READ_ROLES)
    return ok(request, classify(body))
