"""Desteklenen kaynak türü × yöntem matrisi (§30: her sürümde yayımlanır).

Arayüz bu matrisi gösterir; matris dışı yöntem `METHOD_NOT_ALLOWED` ile bloke
olur, matris dışı kaynak türü `UNSUPPORTED_SOURCE_TYPE` ile reddedilir.
"""

from __future__ import annotations

SCOPE3_METHODS: dict[str, list[str]] = {
    "1": ["supplier_specific", "hybrid", "average_data", "spend_based"],
    "2": ["supplier_specific", "hybrid", "average_data", "spend_based"],
    "3": ["average_data"],
    "4": ["distance_based", "fuel_based", "spend_based"],
    "5": ["waste_type_specific", "average_data"],
    "6": ["distance_based", "spend_based"],
    "7": ["distance_based", "average_data"],
    "8": ["average_data"],
    "9": ["distance_based"],
    "10": ["average_data"],
    "11": ["lifetime_use"],
    "12": ["waste_type_specific"],
    "13": ["average_data"],
    "14": ["average_data"],
    "15": ["investment_specific"],
}

SCOPE2_METHODS: list[str] = ["location_based", "market_based"]

SUPPORTED: dict = {
    "stationary_combustion": ["activity_x_factor"],
    "mobile_combustion": ["fuel_based"],
    "process": ["activity_x_factor"],
    "refrigerant": ["mass_balance"],
    "purchased_electricity": list(SCOPE2_METHODS),
    "purchased_steam": list(SCOPE2_METHODS),
    "purchased_heat": list(SCOPE2_METHODS),
    "purchased_cooling": list(SCOPE2_METHODS),
    "scope3": {k: list(v) for k, v in SCOPE3_METHODS.items()},
    "product_process": ["activity_x_factor"],
}

SCOPE2_SOURCE_TYPES = ("purchased_electricity", "purchased_steam", "purchased_heat", "purchased_cooling")
SOURCE_TYPES = tuple(SUPPORTED)


def scope3_methods(category: int) -> list[str]:
    return list(SCOPE3_METHODS.get(str(category), []))
