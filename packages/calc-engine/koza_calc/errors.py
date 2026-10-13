"""Hata kodları ve sade Türkçe mesajlar.

Her blok `{"code", "field", "message_tr"}` taşır; kullanıcıya
"neden hesaplanmadı" bu metinle gösterilir.
"""

from __future__ import annotations

MESSAGES_TR: dict[str, str] = {
    "INVALID_NUMBER": "Sayı geçersiz: ondalık dize bekleniyor (örn. \"100\" veya \"0.4\").",
    "NEGATIVE_QUANTITY": "Miktar negatif olamaz; iade veya düzeltme ayrı işlem türüdür.",
    "UNIT_UNKNOWN": "Birim tanınmıyor; desteklenen birimler: MJ, GJ, kWh, MWh, kg, t, m3, Nm3, Sm3.",
    "UNIT_INCOMPATIBLE": "Birimler uyumsuz; bu dönüşüm desteklenmiyor (örn. enerji ile kütle).",
    "UNIT_CONDITIONS_UNKNOWN": "Hacmin referans sıcaklık ve basıncı bilinmiyor; m3 otomatik olarak Nm3/Sm3 sayılmaz.",
    "CALORIFIC_VALUE_REQUIRED": "Hacimden enerjiye geçiş için kaynaklı ısıl değer gerekli.",
    "BASIS_UNKNOWN": "Isıl değer esası (alt/üst) bilinmiyor; hesap için esas seçilmeli.",
    "BASIS_MISMATCH": "Isıl değer esası faktörle uyuşmuyor (HHV ≠ LHV); kaynaklı dönüşüm oranı verilmeden hesap yapılmaz.",
    "FACTOR_MISSING_SOURCE": "Faktörün kaynağı yok; kaynaksız katsayı ile hesap yapılmaz.",
    "FACTOR_UNIT_MISSING": "Faktörün pay veya payda birimi eksik.",
    "FACTOR_DUPLICATE_GAS": "Aynı gaz için birden fazla faktör verildi.",
    "FACTOR_MIX_CO2E_AND_GAS": "CO2e faktörü ile gaz bazlı faktör aynı hesapta birleştirilemez.",
    "GWP_MISSING": "Bu gaz için yöntemin GWP setinde değer yok.",
    "BOUNDARY_MIX": "Farklı sınırlara ait faktörler tek sonuçta toplanmaz; yanma ve üst aşama ayrı sonuçlardır.",
    "DIVISION_BY_ZERO": "Dönüşümde sıfıra bölme oluştu.",
    "UNSUPPORTED_SOURCE_TYPE": "Bu kaynak türü henüz desteklenmiyor; yalnız sabit yakma hesaplanır.",
    # Sözleşme tablosu dışında, yapısal istek hataları için tek genel kod.
    "INVALID_REQUEST": "İstek yapısı geçersiz; zorunlu alan eksik veya değeri tanınmıyor.",
}

ALL_CODES = tuple(MESSAGES_TR)


def block(code: str, field: str | None = None, detail: str | None = None) -> dict:
    """Sözleşmedeki blok nesnesini üretir."""
    if code not in MESSAGES_TR:
        raise KeyError(f"bilinmeyen hata kodu: {code}")
    message = MESSAGES_TR[code]
    if detail:
        message = f"{message} ({detail})"
    return {"code": code, "field": field, "message_tr": message}


def warning(code: str, message_tr: str) -> dict:
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
