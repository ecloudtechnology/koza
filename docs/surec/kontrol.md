# Değiştirilemez kural kontrol listesi
`git diff` (ya da belirtilen kapsam) üzerinde GELISTIRME-KURALLARI.md'deki 12 değiştirilemez kuralı tek tek kontrol et. Her kural için: **Geçti / İhlal / İlgisiz** ve ihlalse dosya:satır + önerilen düzeltme.

Özellikle ara:

- `packages/calc-engine` dışında sayısal emisyon hesabı; `float` ile para/emisyon hesabı.
- LLM çıktısının faktör, sayı veya sınıflandırma olarak kaydedilmesi.
- Eksik veri için `0` / varsayılan değer atanması; `NULL`, `not_applicable`, `estimated` ayrımının kaybı.
- `tenant_id` filtresi olmayan sorgu, nesne yolu veya arama çağrısı; istemciden gelen `tenant_id`'ye güvenme.
- Yalnız arayüzde yapılan yetki kontrolü.
- Sektör adına göre dallanma (`if sector`, `switch (sector)`), koda gömülü eşik/tarih/benchmark/fiyat.
- Senaryo verisinin envanter toplamına, ürün/CBAM sonucunun Kapsam 1–2 toplamına karışması.
- Onaylı kayıt, kilitli dönem veya rapor manifestinin yerinde güncellenmesi.
- Kalıcı kayıt olmadan başarı mesajı; çalışmayan buton; sahte veri.
- Kişi bazlı sıralama üreten sorgu veya ekran (Green Kaizen, öğrenme).
- `tests/` dışında test katsayısı.

Sonunda tek satır özet: ihlal sayısı ve birleştirmeye engel olup olmadığı.
