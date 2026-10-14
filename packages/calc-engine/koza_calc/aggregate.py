"""Toplama — `aggregate(request)` (K-17, §13, §16, §17; kural 2, 7, 8).

Onaylı/kilitli kayıt sonuçlarını kurumsal Kapsam 1/2/3 toplamına çevirir.
* Ürün sonuçları kurumsal toplama girmez; ayrı listelenir (kural 8).
* Kapsam 2'de politika tek yöntem seçer; diğeri `scope2_alternative_kg`
  olarak döner, toplanmaz (§13).
* `value_state` unknown / not_applicable olan kayıtlar toplanmaz, listelenir.
* Tahmini pay hem kayıt sayısı hem kg ağırlıklı verilir (§16).
Toplama tam ondalıktır; motor durumsuzdur.
"""

from __future__ import annotations

from decimal import Decimal, DivisionByZero, InvalidOperation, Overflow, localcontext

from .core import ENGINE_VERSION, Validator, inputs_hash, is_nonempty_str
from .numbers import CONTEXT, NumberError, format_decimal, parse_decimal
from .supported import SCOPE2_METHODS

CONTEXTS = ("corporate", "product")
ESTIMATE_WARNINGS = ("DATA_QUALITY_ESTIMATED", "SPEND_BASED_ESTIMATE")
PARTIAL_COVERAGES = ("co2_only", "partial_ghg", "partial_boundary")
LABEL_TR = "Hesaplanan envanter toplamı"


def aggregate(request: object) -> dict:
    with localcontext(CONTEXT):
        try:
            return _aggregate(request)
        except DivisionByZero:
            return _blocked(request, [{"code": "DIVISION_BY_ZERO", "field": None, "message_tr": "Toplamada sıfıra bölme."}])
        except (InvalidOperation, Overflow):
            return _blocked(request, [{"code": "INVALID_NUMBER", "field": None, "message_tr": "Toplamada geçersiz sayı."}])


def _blocked(request: object, blocks: list) -> dict:
    return {
        "engine_version": ENGINE_VERSION,
        "status": "blocked",
        "blocks": blocks,
        "corporate": None,
        "product": {},
        "biogenic_co2_kg": None,
        "not_applicable": [],
        "unknown": [],
        "included": [],
        "inputs_hash": inputs_hash(request),
    }


def _validate_entry(raw: object, i: int, v: Validator) -> dict | None:
    field = f"results[{i}]"
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", field, "kayıt nesnesi bekleniyor")
        return None
    e: dict = {
        "record_id": raw.get("record_id"),
        "context": raw.get("context"),
        "scope": raw.get("scope"),
        "category": raw.get("category"),
        "state": raw.get("state"),
        "result": raw.get("result"),
        "scope2_method_used": raw.get("scope2_method_used"),
        "data_quality": raw.get("data_quality"),
        "study_id": raw.get("study_id"),
    }
    if not is_nonempty_str(e["record_id"]):
        v.add("INVALID_REQUEST", field + ".record_id", "kayıt kimliği zorunlu")
    if e["context"] not in CONTEXTS:
        v.add("INVALID_REQUEST", field + ".context", "corporate veya product olmalı")
    if e["context"] == "corporate":
        if isinstance(e["scope"], bool) or e["scope"] not in (1, 2, 3):
            v.add("INVALID_REQUEST", field + ".scope", "kapsam 1, 2 veya 3 olmalı")
        if e["scope"] == 3 and (isinstance(e["category"], bool) or not isinstance(e["category"], int) or not 1 <= e["category"] <= 15):
            v.add("INVALID_REQUEST", field + ".category", "Kapsam 3 kaydında kategori 1–15 zorunlu")
    if not is_nonempty_str(e["state"]):
        v.add("INVALID_REQUEST", field + ".state", "kayıt durumu zorunlu")
    if not isinstance(e["result"], dict) or "status" not in e["result"]:
        v.add("INVALID_REQUEST", field + ".result", "calculate çıktısı bekleniyor")
    if e["scope2_method_used"] is not None and e["scope2_method_used"] not in SCOPE2_METHODS:
        v.add("INVALID_REQUEST", field + ".scope2_method_used", "location_based veya market_based olmalı")
    return e


def _total(result: dict, field: str, v: Validator) -> Decimal | None:
    raw = result.get("total_co2e_kg")
    if raw is None:
        return None
    try:
        return parse_decimal(raw)
    except NumberError as exc:
        v.add("INVALID_NUMBER", field + ".total_co2e_kg", str(exc))
        return None


def _is_estimated(entry: dict, *results: dict) -> bool:
    if entry.get("data_quality") == "estimated":
        return True
    for r in results:
        for w in r.get("warnings") or []:
            if isinstance(w, dict) and w.get("code") in ESTIMATE_WARNINGS:
                return True
    return False


def _aggregate(request: object) -> dict:
    v = Validator()
    hash_value = inputs_hash(request)
    if not isinstance(request, dict):
        v.add("INVALID_REQUEST", None, "istek nesne değil")
        return _blocked(request, v.blocks)

    policy = request.get("policy")
    include_states: list = []
    scope2_method = None
    if not isinstance(policy, dict):
        v.add("INVALID_REQUEST", "policy", "toplama politikası zorunlu")
    else:
        include_states = policy.get("include_states")
        if not isinstance(include_states, list) or not include_states or not all(isinstance(s, str) for s in include_states):
            v.add("INVALID_REQUEST", "policy.include_states", "toplanacak kayıt durumları listesi zorunlu")
            include_states = []
        scope2_method = policy.get("scope2_method")
        if scope2_method is not None and scope2_method not in SCOPE2_METHODS:
            v.add("INVALID_REQUEST", "policy.scope2_method", "location_based veya market_based olmalı")

    raw_results = request.get("results")
    entries: list[dict] = []
    if not isinstance(raw_results, list):
        v.add("INVALID_REQUEST", "results", "sonuç listesi bekleniyor")
    else:
        for i, raw in enumerate(raw_results):
            e = _validate_entry(raw, i, v)
            if e is not None:
                entries.append(e)
    if any(e["context"] == "corporate" and e["scope"] == 2 for e in entries) and scope2_method is None:
        v.add("INVALID_REQUEST", "policy.scope2_method", "Kapsam 2 kaydı varken yöntem seçimi zorunlu")
    if v.blocks:
        return _blocked(request, v.blocks)

    scope1 = scope2 = scope3 = Decimal("0")
    scope2_alt = None
    scope2_alt_method = None
    by_category: dict[str, Decimal] = {}
    excluded: list[dict] = []
    not_applicable: list[str] = []
    unknown: list[str] = []
    included: list[str] = []
    coverage_notes: list[str] = []
    biogenic: Decimal | None = None
    estimated_count = 0
    estimated_kg = Decimal("0")
    products: dict[str, dict] = {}

    for i, e in enumerate(entries):
        rid = e["record_id"]
        field = f"results[{i}].result"
        result = e["result"]
        if e["state"] not in include_states:
            excluded.append({"record_id": rid, "reason": f"durum '{e['state']}' toplama politikası dışında"})
            continue
        # value_state bloke durumundan önce okunur: DATA_MISSING kaydı hem bloke hem unknown'dır (kural 2).
        value_state = result.get("value_state", "known")
        if value_state == "not_applicable":
            not_applicable.append(rid)
            continue
        if value_state == "unknown":
            unknown.append(rid)
            continue
        if result.get("status") == "blocked":
            excluded.append({"record_id": rid, "reason": "hesap bloke; sonuç yok"})
            continue

        bio = result.get("biogenic_co2_kg")
        if bio is not None:
            try:
                biogenic = (biogenic or Decimal("0")) + parse_decimal(bio)
            except NumberError as exc:
                v.add("INVALID_NUMBER", field + ".biogenic_co2_kg", str(exc))

        if e["context"] == "product":
            total = _total(result, field, v)
            if total is None:
                unknown.append(rid)
                continue
            study_id = None
            if isinstance(result.get("product"), dict):
                study_id = result["product"].get("study_id")
            study_id = study_id or e["study_id"] or rid
            bucket = products.setdefault(study_id, {"total": Decimal("0"), "claim_tr": result.get("claim_tr"), "record_ids": []})
            bucket["total"] += total
            bucket["record_ids"].append(rid)
            continue

        # --- kurumsal ---
        if e["scope"] == 2:
            sub_results = result.get("results")
            if isinstance(sub_results, dict):
                chosen = sub_results.get(scope2_method)
                if not isinstance(chosen, dict):
                    excluded.append({"record_id": rid, "reason": f"Kapsam 2 '{scope2_method}' sonucu yok"})
                    continue
                total = _total(chosen, f"{field}.results.{scope2_method}", v)
                if total is None:
                    unknown.append(rid)
                    continue
                for other_name in SCOPE2_METHODS:
                    other = sub_results.get(other_name)
                    if other_name != scope2_method and isinstance(other, dict):
                        alt = _total(other, f"{field}.results.{other_name}", v)
                        if alt is not None:
                            scope2_alt = (scope2_alt or Decimal("0")) + alt
                            scope2_alt_method = other_name
                est = _is_estimated(e, result, chosen)
                cov, claim = chosen.get("coverage"), chosen.get("claim_tr")
            else:
                if e["scope2_method_used"] != scope2_method:
                    excluded.append({"record_id": rid, "reason": f"Kapsam 2 yöntemi '{e['scope2_method_used']}' politikadan ({scope2_method}) farklı"})
                    continue
                total = _total(result, field, v)
                if total is None:
                    unknown.append(rid)
                    continue
                est = _is_estimated(e, result)
                cov, claim = result.get("coverage"), result.get("claim_tr")
            scope2 += total
        else:
            total = _total(result, field, v)
            if total is None:
                unknown.append(rid)
                continue
            est = _is_estimated(e, result)
            cov, claim = result.get("coverage"), result.get("claim_tr")
            if e["scope"] == 1:
                scope1 += total
            else:
                scope3 += total
                key = str(e["category"])
                by_category[key] = by_category.get(key, Decimal("0")) + total

        included.append(rid)
        if est:
            estimated_count += 1
            estimated_kg += total
        if cov in PARTIAL_COVERAGES and claim:
            coverage_notes.append(f"{rid}: {claim}")

    if v.blocks:
        return _blocked(request, v.blocks)

    total_kg = scope1 + scope2 + scope3
    share_count = (Decimal(estimated_count) / Decimal(len(included))) if included else Decimal("0")
    share_kg = (estimated_kg / total_kg) if total_kg != 0 else Decimal("0")

    corporate = {
        "scope1_kg": format_decimal(scope1),
        "scope2_kg": format_decimal(scope2),
        "scope2_method": scope2_method,
        "scope2_alternative_kg": format_decimal(scope2_alt) if scope2_alt is not None else None,
        "scope2_alternative_method": scope2_alt_method,
        "scope3_kg": format_decimal(scope3),
        "scope3_by_category": {k: format_decimal(by_category[k]) for k in sorted(by_category, key=int)},
        "total_kg": format_decimal(total_kg),
        "label_tr": LABEL_TR,
        "excluded": excluded,
        "coverage_notes_tr": coverage_notes,
        "estimated_share_by_count": format_decimal(share_count),
        "estimated_share_by_kg": format_decimal(share_kg),
        "included_count": len(included),
    }
    product_out = {
        sid: {"total_kg": format_decimal(b["total"]), "claim_tr": b["claim_tr"], "record_ids": b["record_ids"]}
        for sid, b in products.items()
    }
    return {
        "engine_version": ENGINE_VERSION,
        "status": "computed",
        "blocks": [],
        "corporate": corporate,
        "product": product_out,
        "biogenic_co2_kg": format_decimal(biogenic) if biogenic is not None else None,
        "not_applicable": not_applicable,
        "unknown": unknown,
        "included": included,
        "inputs_hash": hash_value,
    }
