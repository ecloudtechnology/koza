"""koza_calc — Koza deterministik hesap motoru (saf Python, Decimal)."""

from .aggregate import aggregate
from .engine import ENGINE_VERSION, calculate
from .supported import SUPPORTED

__all__ = ["calculate", "aggregate", "SUPPORTED", "ENGINE_VERSION"]
__version__ = ENGINE_VERSION
