# İnceleme rehberi — MEXT "İş Dünyasında Sorumlu Üretim" grubu için

Bu önizleme, grubun forum çıktısını (ESG balık kılçığı, altı katmanlı mimari, TR ETS eki) çalışan bir ürün iskeletine bağlar. Amaç; belgeleri, ilk uçtan uca akışı ve açık kararları birlikte incelemenizdir. Hiçbir ekran "bitti" izlenimi vermek için süslenmemiştir: çalışmayan buton, uydurma grafik ve gerçek olmayan katsayı yoktur.

## 1. Neye bakıyorsunuz

| Katman | Nerede | Durum |
| --- | --- | --- |
| Belgeler | Belgeler sekmesi: şartname v1.0 (§01–§34), v1.1 eki ve rehber, forum bulguları (TR/EN), mimari notu, karar kaydı, rol matrisi, veri modeli, API sözleşmesi | Tam metin; kaynak DOCX/Pages dosyaları depoda `docs/kaynak/` |
| Çalışan akış (Dilim 1) | Kurum kurulumu → Veri girişi → Kayıt (hesap) → İnceleme → Dönem kapanışı → Raporlar | Çalışır; kayıtlar yalnız sizin tarayıcınızda saklanır |
| Hesap motoru | Altın set sekmesi; kayıt sayfasında önizleme | Gerçek Python motoru tarayıcıda (Pyodide) çalışır; 32 kurgusal senaryo |
| Sunucu tarafı (Dilim 0) | Depoda `apps/api`, `db/migrations`, `tests/isolation` | Kod ve 37 test; önizlemede çalışmıyor (statik yayın) |
| Planlı sekmeler | 101, Protokoller, Gündem, Asistan, Ürün, Analiz | Ne yapacağı ve hangi dilimde geleceği yazılı; buton yok |

## 2. On dakikalık inceleme yolu

1. **Ana sayfa** → "Sonraki adım" sizi yönlendirir. Üst çubuktaki kullanıcı seçici rolü değiştirir (veri giren, uzman kontrolör, onaylayan, yönetici, izleyici).
2. **Kurum kurulumu** → kurum adı, NACE kodu (ör. `C24` ağır sanayi profili önerir; `C10` gıda; boş veya bilinmeyen → genel). Tesis ekleyin, dönem ekleyin, sınır sorusunda "bilmiyorum" deyip görevin nasıl açıldığını görün (ONB-02). Kaynak sorularında "yakıt yakan ekipman" için evet deyin.
3. **Veri girişi** → "Fatura / tüketim (doğal gaz)". Miktara `1.234` yazın: sistem ayracı sormalı (§11). Birimde "Bilmiyorum" seçerseniz kayıt taslak kalır ve görev açılır (T20). Bir dosya yükleyin; aynı dosyayı ikinci kayıtta tekrar yükleyin: mükerrer uyarısı (T07).
4. **Kayıt sayfası** → "Önizle" hesap motorunu çalıştırır. Deneyin: birim `m3` ve koşul yok → engel (T03); esas HHV → engel (T04); faktör seçiminde `TEST-NG-CO2E-NM3` + gaz faktörü birlikte → engel (T02). "Bu koşuyu kaydet" ile koşu kalıcı olur. İz kaydını açın: sonuçtan faktöre ve kaynağa.
5. **Kontrole gönder** → rolü "onaylayan" yapıp onaylayın. Aynı kullanıcı kendi kaydını onaylayamaz: veri giren rolünde deneyin, görev ayrılığı hatası alın (§04).
6. **Faktör kataloğu** → "uzman kontrolör" rolünde `TEST-NG-CO2@1.1` sürümünü etkinleştirin. Kayıt sayfasında eski sonuç korunur, yeni koşu önerilir (T13).
7. **Kayıt sayfası → Yeni sürümle düzelt** → onaylı kaydı değiştirin: önceki onay geçersizleşir (§21). İkinci bir sekmede aynı kaydı düzenleyip ilk sekmede kaydetmeye çalışın: sürüm çakışması, veri ezilmez (T18).
8. **Dönem kapanışı** → yönetici rolünde kilitleyin; sonra yeniden açma gerekçe + etki ister (T17).
9. **Raporlar** → rapor oluşturun, sonra "yeniden oluştur": aynı girdilerle aynı SHA-256 (T19). Manifesti indirin; eksikler listesi "hesaplanan envanter toplamı" etiketini açıklar.
10. **Altın set** → "tarayıcıda çalıştır": 32 senaryo aynı motorla koşar.

## 3. Sizden beklenen geri bildirim

- **Belgelerde:** şartname ve v1.1 eki forum bulgularını doğru karşılıyor mu? Eksik kalan eksen, rol veya ölçüt var mı? (`docs/spec/KOZA_v1.1_gereklilikler.md` §2 eşleme tablosu)
- **Karar kaydında:** K-01…K-16'daki açık kararlar için kim, ne zaman karar verecek? Özellikle K-02 (pilot profilleri), K-04/K-05 (hesap otoritesi ve faktör kaynakları), K-06/K-07 (ETS ve CBAM), K-09 (KVKK).
- **Akışta:** yeni başlayan bir çalışan kapsam terimini bilmeden ilk taslağı oluşturabiliyor mu? Hangi ekranda takıldınız? Hangi metin anlaşılmadı?
- **Sektör profillerinde:** `content/sector-profiles/*.yaml` içindeki sorular, paydalar ve öncelikler sektörünüz için doğru mu? Hangi profil eksik?
- **Yöntemde:** altın setteki senaryolar (T01–T04) alan uzmanınızın beklediği davranışı veriyor mu? İmzalanabilir mi, neyi değiştirmek gerekir?

Geri bildirimi depo konuları (GitHub Issues) veya grup kanalı üzerinden, ilgili gereklilik kimliğiyle (ör. `DAT-04`, `T07`, `K-06`) verirseniz izleme matrisine doğrudan işlenir.

## 4. Sınırlar (bilerek)

- Önizleme deposu tarayıcınızdır. Başka cihazda veya gizli pencerede veri görünmez; "Kurum ayarları → sıfırla" her şeyi siler.
- Tüm faktörler kurgusaldır (`tests/factors/test-catalog.json`). Gerçek faktör kataloğu yoktur; sonuçlar gerçek emisyon değildir.
- Sunucu yetkisi, PostgreSQL RLS ve API bu statik önizlemede çalışmaz; aynı kuralların sunucu uygulaması depodadır ve testleri geçer.
- OCR, Excel içe aktarma, DOCX/PDF rapor, asistan, Kapsam 2–3 yoktur ve planlı dilimleri yazılıdır.
- Hesap motoru yüklenemezse (ağ/CDN) hesap yapılmaz ve bunu söyler.

## 5. Depo ve yerel çalıştırma

```
git clone <depo>
cd koza/apps/web && npm install && npm run dev            # arayüz
python3 -m venv .venv && . .venv/bin/activate
pip install -e packages/calc-engine -e "apps/api[dev]"
pytest -q
```

Yapı: `GELISTIRME-KURALLARI.md` (kurallar), `docs/` (belgeler), `apps/web` (arayüz), `apps/api` (iş API'si), `packages/calc-engine` (hesap motoru), `content/` (profil, ders, terim, kaynak), `db/migrations`, `tests/`.
