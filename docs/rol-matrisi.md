# Rol ve yetki matrisi

Kaynak: şartname §04 (roller), v1.1 §3 (yeni roller), CLAUDE.md kural 4 (yetki sunucuda). Sunucu tarafı uygulaması `apps/api/koza_api/workflow.py`; önizleme eşdeğeri `apps/web/src/lib/domain.ts` (`PERMISSIONS`). Arayüzde gizlemek yetkilendirme değildir.

## İşlem × rol

| İşlem | Kurum yöneticisi | Veri giren | Veri sorumlusu | Uzman kontrolör | Onaylayan | İzleyici / denetçi | Tedarikçi | İçerik editörü | Saha çalışanı (v1.1) | Elçi (v1.1) | Finans / karbon masası (v1.1) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kurulum, tesis, dönem, sınır | ✓ | ✓ (taslak) | | | | | | | | | |
| Üyelik ve rol yönetimi | ✓ | | | | | | | | | | |
| Taslak kayıt oluştur / düzelt (kendi alanı) | ✓ | ✓ | ✓ | | | | | | | | |
| Kanıt ekle | ✓ | ✓ | ✓ | | | | yalnız kendi talebi | | | | |
| Hesap önizle / koşu kaydet | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| Kontrole gönder | ✓ | ✓ | ✓ | | | | | | | | |
| İnceleme: düzeltme iste | | | | ✓ | ✓ | | | | | | |
| Onay ver | | | | | ✓ | | | | | | |
| Kendi girdiği kaydı onaylama | politika + gerekçe + süre ile istisna; raporda görünür | | | | | | | | | | |
| Faktör sürümü etkinleştir | | | | ✓ (alan uzmanı onayı) | | | | | | | |
| Dönemi kilitle / yeniden aç | ✓ (gerekçe + etki) | | | kilidi tek başına kaldırmaz | | | | | | | |
| Rapor sürümü oluştur | ✓ | | | | ✓ | | | | | | |
| Rapor yayımla (ayrı yetkili işlem) | ✓ | | | | ✓ | | | | | | |
| Denetim izi oku | ✓ | | | ✓ | ✓ | ✓ | | | | | |
| Dosya indir | ✓ | ✓ | ✓ | ✓ | ✓ | ayrıca sınırlandırılabilir | kendi ekleri | | | | |
| Ders / kaynak taslağı | | | | | | | | ✓ | | ✓ (öneri) | |
| Üretim hesap kuralı yayımla | yalnız yöntem sorumlusu + uzman onayı | | | | | | | ✗ | | | |
| Green Kaizen önerisi gir | | | | | | | | | ✓ | ön değerlendirme | |
| Senaryo defteri (karbon fiyatı, tahsis) | | | | | | | | | | | ✓ (envanter salt okunur) |
| Dış kişiye veri talebi gönder | ✓ (açık yetki) | | ✓ (açık yetki) | | | | | | | | |

## Kurallar

- Varsayılan: veri giren ile onaylayan farklıdır. Küçük ekip istisnası gerekçe, izin veren ve süre ile kaydedilir; raporda görünür.
- Yetki değişikliği açık oturumda da etkilidir; erişimi kaldırılan kullanıcı dosya bağlantısı ve açık oturumla devam edemez (§25).
- Tedarikçi daveti yalnız kendi talebine erişim verir; kurum envanterini ve diğer tedarikçileri göremez.
- Platform destek ekibinin müşteri verisine sürekli erişimi yoktur; süreli erişim müşteri yetkilisince açılır ve otomatik sona erer.
- Saha çalışanı envanter verisi yazamaz; kişisel sıralamada görünmez (kural 11).
- Asistanın araç çağrıları da bu matristen geçer; sohbet komutu yetki katmanını aşamaz (§24).

## Önizlemedeki durum

Önizlemede beş kullanıcı (yönetici, veri giren, uzman kontrolör, onaylayan, izleyici) üst çubuktan seçilir; her biri ayrı kimliktir, böylece görev ayrılığı denenebilir. Tedarikçi, veri sorumlusu, içerik editörü ve v1.1 rolleri henüz kullanıcı olarak yoktur. Kimlik doğrulama (OIDC/SSO, MFA) Dilim 0 kapsamında kod olarak dev-token düzeyindedir; üretim için açık eksiktir (bkz. teslim notu).
