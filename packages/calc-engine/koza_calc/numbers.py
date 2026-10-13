"""Ondalık sayı yardımcıları.

Tüm sayılar dize olarak girer, `decimal.Decimal` ile işlenir ve
üstel gösterim olmadan dize olarak çıkar. `float` hiçbir yerde kullanılmaz.
"""

from __future__ import annotations

import re
from decimal import (
    ROUND_HALF_EVEN,
    Context,
    Decimal,
    DivisionByZero,
    InvalidOperation,
    Overflow,
)

PRECISION = 34

#: Motorun tek hesap bağlamı: 34 basamak, banker yuvarlaması, geçersiz işlem
#: ve sıfıra bölme istisna üretir (sessiz NaN/Inf yok).
CONTEXT = Context(
    prec=PRECISION,
    rounding=ROUND_HALF_EVEN,
    traps=[InvalidOperation, DivisionByZero, Overflow],
)

_NUMBER_RE = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$")


class NumberError(ValueError):
    """Sayı dize değil ya da parse edilemiyor."""


def parse_decimal(value: object) -> Decimal:
    """Yalnız ondalık dizeyi kabul eder; int/float/bool reddedilir."""
    if isinstance(value, bool) or not isinstance(value, str):
        raise NumberError("sayı dize olmalı")
    if not _NUMBER_RE.match(value):
        raise NumberError("ondalık dize değil")
    result = Decimal(value)
    if not result.is_finite():
        raise NumberError("NaN/Inf kabul edilmez")
    return result


def format_decimal(value: Decimal) -> str:
    """Decimal'i üstel gösterimsiz, gereksiz sıfırsız düz dizeye çevirir.

    Örnek: 5E+3 -> "5000", 0.4000 -> "0.4", 1.23E-4 -> "0.000123".
    """
    if value == 0:
        return "0"
    normalized = value.normalize(CONTEXT)
    return format(normalized, "f")
