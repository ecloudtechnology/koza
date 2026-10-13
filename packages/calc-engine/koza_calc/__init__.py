"""koza_calc — Koza deterministik hesap motoru (saf Python, Decimal)."""

from .engine import ENGINE_VERSION, calculate

__all__ = ["calculate", "ENGINE_VERSION"]
__version__ = ENGINE_VERSION
