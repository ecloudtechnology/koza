---
description: Bir geliştirme dilimini Koza döngüsüne göre yürüt (ör. /dilim DAT-01 DAT-03 T07)
argument-hint: <gereklilik kimlikleri>
---

Hedef gereklilikler: $ARGUMENTS

CLAUDE.md'deki "Geliştirme döngüsü"nü sırayla uygula:

1. **Oku.** Her kimliğin geçtiği bölümü `docs/spec/KOZA_sartname_v1.0.md` ve `docs/spec/KOZA_v1.1_gereklilikler.md` içinde bul. İlgili "Kabul koşulu" paragraflarını ve `T` testlerini listele.
2. **Belirsizlik kontrolü.** Hesap yöntemi, veri hakkı, hukuki uygulanabilirlik veya sektöre özgü bir kural belirsizse `docs/karar-kaydi.md`'ye satır ekle, bana sor ve **dur**. Varsayım uydurma.
3. **Plan.** Kısa plan yaz: veri modeli/göç etkisi, API uçları, ekran durumları (§28), etkilenen değiştirilemez kurallar. Onayımı bekle.
4. **Önce testler.** Kabul koşullarını başarısız testler olarak yaz (birim, altın set, gerekiyorsa izolasyon). Test katsayıları kurgusal ve yalnız `tests/` altında.
5. **Uygula.** Testleri geçiren en küçük değişiklik. Sektöre özgü hiçbir şeyi koda gömme; profil verisinden oku.
6. **Doğrula.** Tüm test paketini çalıştır, ardından `/kontrol` adımlarını uygula.
7. **Teslim notu.** Şu başlıklarla bitir:
   - Karşılanan kimlikler
   - Değişen dosyalar ve göçler
   - Test kanıtı (komut + sonuç)
   - Desteklenen yöntemler / profiller
   - Açık eksikler ve karar kaydına eklenenler
   - Alan uzmanı onayı gerekiyor mu? (hesap/standart değiştiyse evet)
