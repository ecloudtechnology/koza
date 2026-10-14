"""Koza iş API'si (Dilim 1).

Katmanlar:
- auth.py      : bearer token → Principal; X-Tenant + üyelik → TenantContext (kural 3, 4)
- repo.py      : depo protokolü; InMemoryRepo (tenant kapsamlı); repo_postgres.py: PostgresRepo (RLS)
- workflow.py  : §21 durum makinesi + rol kontrolleri
- routers/     : §27 uçları
- main.py      : uygulama fabrikası, zarf (envelope) ve hata modeli
"""

API_VERSION = "0.2.0"
