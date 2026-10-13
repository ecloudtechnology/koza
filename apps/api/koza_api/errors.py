"""Hata modeli (§27): code, message (Türkçe), field_errors, retryable, request_id."""

from __future__ import annotations

from typing import Any


class ApiError(Exception):
    """Zarflı API hatası. `details` isteğe bağlı ek bilgidir (ör. current_version, reopen_path)."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        field_errors: list[dict[str, str]] | None = None,
        retryable: bool = False,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field_errors = field_errors or []
        self.retryable = retryable
        self.details = details or {}

    def to_body(self, request_id: str) -> dict[str, Any]:
        body: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "field_errors": self.field_errors,
            "retryable": self.retryable,
            "request_id": request_id,
        }
        if self.details:
            body["details"] = self.details
        return body


def not_found(object_name: str = "Kayıt") -> ApiError:
    """Yetkisiz veya yabancı nesne için de aynı 404 döner; varlık açıklanmaz (§27)."""
    return ApiError(404, "NOT_FOUND", f"{object_name} bulunamadı.")


def forbidden(message: str = "Bu işlem için yetkiniz yok.") -> ApiError:
    return ApiError(403, "FORBIDDEN", message)
