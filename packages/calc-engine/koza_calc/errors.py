"""Hata kodları ve sade Türkçe mesajlar.

Her blok `{"code", "field", "message_tr"}` taşır; kullanıcıya
"neden hesaplanmadı" bu metinle gösterilir. Uyarılar `{"code", "message_tr"}`
taşır; hesabı durdurmaz, çoğu durumda `review_required` üretir.
"""

from __future__ import annotations

MESSAGES_TR: dict[str, str] = {
    # --- 0.1 ---
    "INVALID_NUMBER": "Sayı geçersiz: ondalık dize bekleniyor (örn. \"100\" veya \"0.4\").",
    "NEGATIVE_QUANTITY": "Miktar negatif olamaz; iade veya düzeltme ayrı işlem türüdür.",
    "UNIT_UNKNOWN": "Birim tanınmıyor; desteklenen birimler: MJ, GJ, kWh, MWh, kg, t, m3, Nm3, Sm3, L, m3_liquid, km, t.km, kg.km, p.km, unit, TRY, EUR, USD.",
    "UNIT_INCOMPATIBLE": "Birimler uyumsuz; bu dönüşüm desteklenmiyor (örn. enerji ile kütle).",
    "UNIT_CONDITIONS_UNKNOWN": "Hacmin referans sıcaklık ve basıncı bilinmiyor; m3 otomatik olarak Nm3/Sm3 sayılmaz.",
    "CALORIFIC_VALUE_REQUIRED": "Hacimden enerjiye geçiş için kaynaklı ısıl değer gerekli.",
    "BASIS_UNKNOWN": "Isıl değer esası (alt/üst) bilinmiyor; hesap için esas seçilmeli.",
    "BASIS_MISMATCH": "Isıl değer esası faktörle uyuşmuyor (HHV ≠ LHV); kaynaklı dönüşüm oranı verilmeden hesap yapılmaz.",
    "FACTOR_MISSING_SOURCE": "Faktörün kaynağı yok; kaynaksız katsayı ile hesap yapılmaz.",
    "FACTOR_UNIT_MISSING": "Faktörün pay veya payda birimi eksik.",
    "FACTOR_DUPLICATE_GAS": "Aynı gaz için birden fazla faktör verildi.",
    "FACTOR_MIX_CO2E_AND_GAS": "CO2e faktörü ile gaz bazlı faktör aynı hesapta birleştirilemez.",
    "GWP_MISSING": "Bu gaz için yöntemin GWP setinde veya faktörlerde değer yok.",
    "BOUNDARY_MIX": "Farklı sınırlara ait faktörler tek sonuçta toplanmaz; yanma ve üst aşama ayrı sonuçlardır.",
    "DIVISION_BY_ZERO": "Dönüşümde sıfıra bölme oluştu.",
    "UNSUPPORTED_SOURCE_TYPE": "Bu kaynak türü desteklenmiyor; desteklenen türler koza_calc.SUPPORTED matrisinde listelenir.",
    # Sözleşme tablosu dışında, yapısal istek hataları için tek genel kod.
    "INVALID_REQUEST": "İstek yapısı geçersiz; zorunlu alan eksik veya değeri tanınmıyor.",
    # --- 0.2 ---
    "REFRIGERANT_GAS_UNKNOWN": "Soğutucu gaz türü bilinmiyor; gaz belirlenmeden hesap bekler.",
    "EQUIPMENT_NOT_IN_INVENTORY": "Ekipman envanter dışında; Kapsam 1 ataması yapılmadan ilişki yeniden değerlendirilmeli.",
    "INSTRUMENT_EXCEEDS_CONSUMPTION": "Sözleşmesel araç miktarı tüketimi aşıyor; belge negatif emisyon yaratamaz.",
    "INSTRUMENT_DUPLICATE": "Aynı sözleşmesel araç kimliği birden fazla kez verildi; belge iki kez tahsis edilemez.",
    "CURRENCY_MISMATCH": "Para birimi uyuşmuyor; para birimleri birbirine dönüştürülmez.",
    "NA_REASON_REQUIRED": "Uygulanamaz kararı için gerekçe zorunlu; gerekçesiz kayıt uygulanamaz sayılmaz.",
    "DATA_MISSING": "Veri eksik; bilinmeyen değer sıfır ya da uygulanamaz sayılmaz.",
    "LCA_FACTOR_IN_CATEGORY": "Beşikten mezara faktör bu kategoride doğrudan kullanılmaz; bileşenlere ayrıştırılmalı.",
    "BOUNDARY_OVERLAP": "Faktör sınırları çakışıyor (beşikten kapıya ile üst aşama aynı aşamaları içerir); çift sayım.",
    "METHOD_NOT_ALLOWED": "Bu yöntem bu kaynak türü veya kategori için izin verilen listede değil (bkz. SUPPORTED).",
    "DEFAULT_SCENARIO_FORBIDDEN": "Kullanım senaryosu (ömür, yıllık kullanım) eksik; gizli varsayılan atanmaz.",
    "ALLOCATION_INVALID": "Tahsis geçersiz; pay 0–1 aralığında ve kaynaklı olmalı.",
    "PROCESS_ID_REQUIRED": "Proses kimliği zorunlu; proses belirtilmeden proses emisyonu hesaplanmaz.",
    "DENSITY_REQUIRED": "Yakıt kütle ↔ hacim dönüşümü için kaynaklı yoğunluk (kg/L) gerekli.",
}

WARNINGS_TR: dict[str, str] = {
    "BASIS_CONVERSION_APPLIED": "Isıl değer esası kullanıcı verdiği oranla dönüştürüldü; inceleme gerekli.",
    "DATA_QUALITY_ESTIMATED": "Veri niteliği tahmini; onay öncesi inceleme gerekli.",
    "REFRIGERANT_TOPUP_ASSUMPTION": "Eklenen soğutucu miktarı kaçak telafisi varsayımıyla emisyon sayıldı; inceleme gerekli.",
    "RECOVERED_NOT_EMISSION": "Geri kazanılan soğutucu negatif kütle hareketidir; envantere emisyon yazılmaz.",
    "RESIDUAL_MIX_UNAVAILABLE": "Artık karışım faktörü yok; kapsanmayan tüketim konum faktörüyle hesaplandı, inceleme gerekli.",
    "INSTRUMENT_NOT_ELIGIBLE": "Sözleşmesel araç koşulları sağlamıyor (itfa edilmemiş veya kalite ölçütü karşılanmamış); sayılmadı.",
    "UPSTREAM_MISSING": "Kapıdan kapıya faktör; üst aşamalar eksik, sonuç kısmi sınırlıdır.",
    "SPEND_BASED_ESTIMATE": "Harcama bazlı sonuç tahminidir; fiziksel veriyle değiştirilmesi önerilir.",
    "PARTIAL_BOUNDARY": "Sonuç kısmi sınırı kapsar; tam ürün ayak izi olarak adlandırılmaz.",
}

ALL_CODES = tuple(MESSAGES_TR)
ALL_WARNING_CODES = tuple(WARNINGS_TR)


def block(code: str, field: str | None = None, detail: str | None = None) -> dict:
    """Sözleşmedeki blok nesnesini üretir."""
    if code not in MESSAGES_TR:
        raise KeyError(f"bilinmeyen hata kodu: {code}")
    message = MESSAGES_TR[code]
    if detail:
        message = f"{message} ({detail})"
    return {"code": code, "field": field, "message_tr": message}


def warning(code: str, message_tr: str | None = None) -> dict:
    """Uyarı nesnesi; mesaj verilmezse tablodaki Türkçe metin kullanılır."""
    if message_tr is None:
        if code not in WARNINGS_TR:
            raise KeyError(f"bilinmeyen uyarı kodu: {code}")
        message_tr = WARNINGS_TR[code]
    return {"code": code, "message_tr": message_tr}


class CalcBlock(Exception):
    """Hesabı durduran, bloğa dönüşen hata."""

    def __init__(self, code: str, field: str | None = None, detail: str | None = None):
        super().__init__(code)
        self.code = code
        self.field = field
        self.detail = detail

    def to_block(self) -> dict:
        return block(self.code, self.field, self.detail)
