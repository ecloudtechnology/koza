# İnceleme rehberi — MEXT "İş Dünyasında Sorumlu Üretim" grubu için

Bu önizleme, grubun forum çıktısını (ESG balık kılçığı, altı katmanlı mimari, TR ETS eki) tam işlevli bir ürüne bağlar. Hiçbir ekran "bitmiş gibi" süslenmemiştir: çalışmayan buton, uydurma grafik ve gerçek olmayan katsayı yoktur; her sayı motordan, her karar yetkiden geçer.

## 1. Neye bakıyorsunuz

| Alan | Sekmeler |
| --- | --- |
| Başlangıç | Koza nedir? · Ekip |
| Veri ve hesap | Kurum kurulumu · Veri girişi (tüm kaynak türleri, OCR) · İçe aktarma (CSV/XLSX) · Emisyon envanteri (Kapsam 1/2/3, 15 kategori) · Ürün ve yaşam döngüsü · Faktör kataloğu |
| Kontrol ve rapor | Görevler · İnceleme kuyruğu · Dönem kapanışı (uzlaştırma, kilit, yeniden açma) · Raporlar (manifest, GRI/TSRS indeksi, JSON/CSV/DOCX/yazdır, yayım, güvence) |
| Performans ve katılım | Analiz ve hedefler (gösterge sözlüğü, yoğunluk, hedef kartı, RACI) · Karar kapısı ve aksiyon · Green Kaizen |
| Dış ilişkiler ve uyum | Tedarikçi programı · Regülasyon paketleri (CBAM, ulusal ETS/MRV, TSRS, AB tedarik) · Senaryo defteri · Gündem ve takvim |
| Öğrenme ve kaynak | Sürdürülebilirlik 101 (10 ders) · Protokoller ve standartlar · Sözlük (48 terim) · Asistan (kaynaklı, kural tabanlı) |
| Yönetim ve doğrulama | Kurum ayarları · Denetim izi · Proje durumu · Belgeler · Altın set · Hata sözlüğü |

## 2. Yirmi dakikalık inceleme yolu

1. **Koza nedir?** → problem, iki hedef, altı katman, ilkeler.
2. **Kurum kurulumu** → NACE `C24` ağır sanayi profilini önerir (`C10` gıda; boş → genel). Tesis, dönem, sınır ("bilmiyorum" → uzman görevi), kaynak envanteri (yakıt, elektrik, soğutucu, satın alma).
3. **Veri girişi** → doğal gaz faturası: miktara `1.234` yazın (ayraç sorulur), birimde "bilmiyorum" (taslak + görev, T20), dosya yükleyin ve aynı dosyayı tekrar yükleyin (mükerrer, T07). "Belgeden oku" ile bir fatura görüntüsünden alanları çıkarın; her alan tek tek onaylanır.
4. **Kayıt sayfası** → Önizle: `m³` + koşul yok → engel (T03); HHV → engel (T04); CO₂e + gaz faktörü birlikte → engel (T02). Engellerde "neden / ne yapmalı" sözlükten gelir. Koşuyu kaydedin; iz kaydı sonuçtan faktöre ve kaynağa gider.
5. **Elektrik kaydı** → konum ve piyasa bazlı iki sonuç ayrı; menşe garantisi tüketimi aşarsa engel (T06); toplamda kullanılan yöntemi seçin (T05).
6. **Soğutucu kaydı** → "yeni ekipman dolumu" emisyon sayılmaz (T11); "ekleme" inceleme ister.
7. **Kapsam 3** → kategori 1 ortalama veri ile kapıdan kapıya faktör: üst aşama eksik uyarısı (T08); kategori 11 ömür boyu: aynı satış grubu ikinci yıl tekrar eklenemez (T12); veri yoksa "bilinmiyor", sıfır değil (T10).
8. **Kontrole gönder → İnceleme** → onaylayan rolüyle onaylayın; aynı kullanıcı kendi kaydını onaylayamaz (§04). Onaylı kaydı değiştirin: onay geçersizleşir (§21).
9. **Faktör kataloğu** → uzman rolünde yeni sürümü etkinleştirin: eski sonuç korunur, yeni koşu önerilir (T13).
10. **Dönem kapanışı** → uzlaştırma listesi, kilit, yeniden açma (gerekçe + etki, T17).
11. **Raporlar** → paket oluşturun; toplamlar motorun `aggregate()` çıktısı; Kapsam 2 alternatif yöntem ayrı gösterilir, toplanmaz; ürün çalışması ayrı bölümde. Yeniden oluşturun: aynı karma (T19). CSV/DOCX/yazdır alın; yayım kilitli dönem ister.
12. **Analiz** → payda girilmeden yoğunluk hesaplanmaz; üretim düşerken "verimlilik arttı" denmez; hedef kartı ve RACI.
13. **Aksiyon** → sapma → ön değerlendirme ("bilinmiyor" varsayılan) → seçenekler → pilot → ölçüm → kapı; etki ölçülmeden kapanmaz.
14. **Green Kaizen** → 3 alanlı öneri; elçi değerlendirmesi; birim düzeyinde toplam, kişi sıralaması yok.
15. **Tedarikçi programı** → kritik %20; talep ilk ekranda gizlilik taahhüdü; dış gönderim yetkili onayı ister.
16. **Regülasyon paketleri** → doğrulanmamış kuralla paket açılmaz; kaynak sürümü → değişiklik kartı → uzman onayı akışı.
17. **Senaryo defteri** → gölge karbon fiyatı ve tahsis senaryoları envanteri değiştirmez (rapor karması aynı kalır).
18. **Asistan** → "CO₂e ne demek?", "Kaydım ne durumda?", "Raporlamak zorunda mıyım?" (hüküm vermez); fatura metni yapıştırıp sahte talimat ekleyin: veri olarak işlenir (T15). Değerlendirme setini çalıştırın.
19. **Altın set** → 77 senaryo aynı motorla tarayıcıda koşar.
20. **Hata sözlüğü** → her kodun kaynağı, nedeni, sonucu, eylemi.

## 3. Sizden beklenen geri bildirim

- Belgeler: şartname ve v1.1 eki forum bulgularını doğru karşılıyor mu? (`docs/spec/KOZA_v1.1_gereklilikler.md` §2)
- Karar kaydı: K-02…K-15 için kim, ne zaman? Özellikle profil onayı (K-02), hesap otoritesi ve faktör kataloğu (K-04/K-05), ETS/CBAM/TSRS resmî metinleri (K-06/K-07/K-08), KVKK (K-09).
- Akış: yeni başlayan bir çalışan kapsam terimini bilmeden ilk taslağı oluşturabiliyor mu? Nerede takıldınız, hangi metin anlaşılmadı?
- Sektör profilleri: `content/sector-profiles/*.yaml` sorular, paydalar, öncelikler doğru mu? Hangi profil eksik?
- Yöntem: altın setteki senaryolar alan uzmanının beklediği davranışı veriyor mu? İmzalanabilir mi?

Geri bildirimi depo konuları (GitHub Issues) veya grup kanalı üzerinden gereklilik kimliğiyle (ör. `DAT-04`, `T07`, `K-06`) verin; izleme matrisine doğrudan işlenir.

## 4. Önizlemenin doğası

- Kayıtlar bu tarayıcıda saklanır; başka cihazda görünmez; "Kurum ayarları → sıfırla" her şeyi siler.
- Tüm faktörler kurgusaldır; sonuçlar gerçek emisyon değildir. Gerçek katalog uzman onayıyla yüklenir.
- Hesap motoru, OCR, XLSX ve DOCX kütüphaneleri ağdan yüklenir; yüklenemezse ekran bunu söyler, sahte sonuç göstermez.
- Üretimde aynı kurallar sunucu ve PostgreSQL üzerinde çalışır (`docs/uretime-gecis.md`).

## 5. Depo ve yerel çalıştırma

```
git clone https://github.com/ecloudtechnology/koza
cd koza/apps/web && npm install && npm run dev            # arayüz
python3 -m venv .venv && . .venv/bin/activate
pip install -e packages/calc-engine -e "apps/api[dev]"
pytest -q                                                 # motor + API + izolasyon
```
