# Koza

Sürdürülebilirlik görevine yeni başlayan çalışanı adım adım yönlendiren, veriyi kanıtıyla toplayan, hesabı denetlenebilir motorla yapan ve sonucu rapora bağlayan, her sektöre uyarlanabilir uygulama. **Hesabı motor yapar; yapay zekâ açıklar ve yönlendirir.**

Bu depo, MEXT "İş Dünyasında Sorumlu Üretim" çalışma grubunun forum çıktısını (ESG balık kılçığı, altı katmanlı sistem mimarisi, TR ETS eki) ürün şartnamesine ve çalışan bir iskelete bağlar. Önizleme grup incelemesi içindir; üretim değildir.

## Önizleme

- Yayın: GitHub Pages (`.github/workflows/pages.yml`), statik dışa aktarma. Adres depo ayarlarında "Pages" altında görünür.
- Önizlemede kayıtlar yalnız tarayıcıda saklanır; hesap motoru (Python) tarayıcıda Pyodide ile çalışır; tüm faktörler kurgusal test değerleridir. Ayrıntı ve sınırlar: `docs/inceleme-rehberi.md`.
- Nereden başlamalı: önizlemede **Belgeler → İnceleme rehberi**, sonra **Ana sayfa → Sonraki adım**.

## Depo düzeni

```
CLAUDE.md                  # 12 değiştirilemez kural, dilim sırası, komutlar
docs/
  spec/                    # Şartname v1.0 (§01–§34), v1.1 eki, v1.1 rehber
  forum/                   # Forum bulguları (TR/EN), sistem mimarisi ve karar akışı notu
  kaynak/                  # Özgün DOCX / Pages / ZIP dosyaları
  karar-kaydi.md           # K-01…K-17 açık kararlar
  gereklilik-izleme.{json,md}   # Gereklilik kimliği → durum → kanıt
  inceleme-rehberi.md      # Grup için 10 dakikalık inceleme yolu
  teslim-notu-dilim-0-1.md # Teslim notu: karşılanan kimlikler, test kanıtı, açık eksikler
  rol-matrisi.md  veri-modeli.md  gelistirici-is-akisi.md  api/openapi.yaml  img/
apps/web/                  # Arayüz (Next.js, TypeScript, statik dışa aktarma)
apps/api/                  # İş API'si (FastAPI): yetki, iş akışı, idempotency, denetim izi
packages/calc-engine/      # Deterministik hesap motoru koza_calc (saf Python, Decimal, I/O yok)
content/
  sector-profiles/         # SEK: şema + genel, agir-sanayi, gida-icecek (YAML, sürümlü, taslak)
  terms/  lessons/  sources/    # Sözlük, ders iskeletleri, kaynak kartları
db/migrations/             # PostgreSQL: tenant_id + RLS + append-only (up/down)
tests/golden/              # 32 kurgusal altın senaryo (T01–T04, T20 …)
tests/factors/             # Kurgusal test faktör kataloğu (yalnız test ve önizleme)
tests/isolation/           # Kurumlar arası erişim testleri (T14)
.claude/commands/          # /dilim ve /kontrol
```

## Çalıştırma

```bash
# Hesap motoru + API + izolasyon testleri
python3 -m venv .venv && . .venv/bin/activate
pip install -e packages/calc-engine -e "apps/api[dev]"
pytest packages/calc-engine/tests apps/api/tests tests/isolation -q

# Arayüz (geliştirme)
cd apps/web && npm install && npm run dev

# Statik dışa aktarma (GitHub Pages için NEXT_PUBLIC_BASE_PATH=/koza)
cd apps/web && npm run build   # → apps/web/out
```

## Durum (13 Ekim 2026)

| Dilim | Kapsam | Durum |
| --- | --- | --- |
| 0 | Depo iskeleti, karar kaydı, CI, tenant izolasyonu, denetim izi | Tamam (37 API/izolasyon testi; RLS PostgreSQL 15'te doğrulandı) |
| 1 | Kurum kurulumu → doğal gaz kaydı → hesap → inceleme → dönem → rapor | Çalışır (önizleme deposu); 109 motor testi; OCR/nesne deposu/DOCX yok |
| 2–8 | Elektrik, asistan, SEK/GÖS panosu, Kaizen, AKS, Kapsam 3, REG | Planlı; K-06/07/08/09 kararlarına bağlı olanlar işaretli |

Gereklilik bazında: `docs/gereklilik-izleme.md`. Bilinen eksikler: `docs/teslim-notu-dilim-0-1.md`.

## Geri bildirim

Konu açarken gereklilik kimliğini yazın (ör. `DAT-04`, `T07`, `K-06`); izleme matrisine doğrudan işlenir.

## Lisans ve içerik hakları

Standart metinleri kopyalanmaz; yalnız resmî bağlantı ve özgün kısa açıklama kullanılır (K-12). Test katsayıları kurgusaldır ve üretim kataloğuna giremez (kural 12).
