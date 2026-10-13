# Sürdürülebilirlik odaklı sistem mimarisi ve karar akışı

Hazırlayan: Havva Dönmez · Kaynak dosya: `docs/kaynak/Sistem-Mimarisi-Karar-Akisi-Notu.docx` (tek sayfalık şema; bu Markdown sadık bir aktarımdır).

**Ana problem:** Sürdürülebilirlik odaklı sistem mimarisi bulunmuyor.

| Hedef | Tanım |
| --- | --- |
| Hedef 1 · Verimlilik | Kaynak tüketimi, hurda ve süreç kayıplarını azaltmak |
| Hedef 2 · Çalışan memnuniyeti | Katılım, yetkinlik, güvenlik ve çalışma deneyimini iyileştirmek |

## Altı katman

1. **Strateji ve sahiplik** — Yönetim sponsoru → süreç sahipleri → ortak hedefler → bütçe ve yetki.
2. **Süreç mimarisi** — Üretim, yatırım, satın alma, İK ve bakım süreçlerinde sürdürülebilirlik karar kapıları.
3. **Veri yönetişimi** — KPI tanımı → veri sahibi → ölçüm standardı → kalite kuralı → erişim yetkisi.
4. **Entegrasyon katmanı** — ERP + MES + sayaç/IoT + çevre + İK + tedarikçi → API / kontrollü veri girişi.
5. **Ortak ESG veri katmanı** — Enerji • su • emisyon • atık • üretim • İSG • çalışan • finans • tedarikçi.
6. **Karar ve aksiyon motoru** — KPI sapması → görev → kök neden → düzeltici faaliyet → etki doğrulaması.

| Çıktı türü | İçerik |
| --- | --- |
| Operasyonel | Hat bazlı verimlilik projeleri, yatırım öncelikleri, kaynak optimizasyonu |
| İnsan odaklı | Green Kaizen, eğitim, iş yükü/ergonomi kontrolü, çalışan geri bildirimi |
| Kurumsal | Yönetim panosu, uyum veri seti, tedarikçi geliştirme, denetlenebilir kayıt |

## Sistemin işleyişi: karar akışı

Süreç sahipleri, veri akışı ve iyileştirme kararları tek bir işletim döngüsünde çalışır.

| Adım | Kapı | İçerik |
| --- | --- | --- |
| 1 Başlat | Yeni ihtiyaç veya performans sapması | Yeni yatırım, hat değişikliği, tüketim artışı, çalışan önerisi ya da mevzuat gereksinimi |
| 2 Ön değerlendir | Sürdürülebilirlik karar kapısı | Enerji, su, karbon, hurda, İSG, ergonomi, iş yükü ve maliyet etkilerini belirle |
| 3 Veriyi doğrula | Güvenilir kayıt | Veri sözleşmesi testleri: kaynak, birim, zaman, tutarlılık; uygunsuz kayıt → düzeltme kuyruğu |
| 4 Seçenek üret | Karşılaştırmalı karar | Alternatif proses / ekipman / çalışma yöntemi; ekonomik ve çevresel fayda ile çalışan etkisini birlikte karşılaştır |
| 5 Pilot uygula | Saha ve çalışan katılımı | Üretim, bakım, İK, İSG ve çalışan temsilcileriyle kontrollü deneme; eğitim ve geri bildirim |
| 6 Sonucu ölç | İki hedefi birlikte doğrula | Baz dönem ile kWh/ton, hurda, m³/ton, öneri uygulama oranı ve çalışan memnuniyet skorunu karşılaştır |
| 7 Karar | Ölçekleme kapısı | Her iki hedef eşiği karşılıyorsa standardize et ve yaygınlaştır; değilse kök neden ve yeniden tasarım |

## Yönetim modeli ve uygulama planı

| Mimari bileşen | Sorumlu birimler | Somut teslimat | Başarı ölçütü |
| --- | --- | --- | --- |
| Yönetişim ve strateji | Üst yönetim, sürdürülebilirlik, finans | Hedef kartı, RACI, yatırım onay kuralları | Hedef sahibi atanma oranı |
| Süreç mimarisi | Üretim, bakım, satın alma, İK | Karar kapıları ve süreç akışları | ESG değerlendirmesinden geçen değişiklik oranı |
| Veri ve entegrasyon | BT, enerji, çevre, kalite | Veri sözleşmeleri, entegrasyon, kontrol kayıtları | Otomatik veri ve geçerli veri oranı |
| Karar ve aksiyon | Üretim, bakım, İSG | Sapma uyarısı, görev, düzeltici faaliyet | Aksiyon kapanış süresi, tekrar eden sapmalar |
| Çalışan deneyimi | İK, İSG, üretim | Green Kaizen, eğitim ve etki kontrolü | Memnuniyet skoru, uygulanan öneri oranı |
| Tedarik ve dış paydaş | Satın alma, sürdürülebilirlik | Tedarikçi veri ve gelişim programı | Katılan kritik tedarikçi oranı |
| Güvence ve süreklilik | BT, iç kontrol, sürdürülebilirlik | Denetim izi, yedek süreç, veri mutabakatı | Veri kesintisi ve düzeltme süresi |

---

KOZA'daki karşılığı: katman 3 → GÖS, katman 4–5 → §11/§18/§20/§27, katman 6 → AKS (v1.1). Karar akışının 3. adımı (veri sözleşmesi testleri) GÖS-04; 6–7. adımlar AKS-04. Ayrıntı: `docs/spec/KOZA_v1.1_gereklilikler.md` §2.
