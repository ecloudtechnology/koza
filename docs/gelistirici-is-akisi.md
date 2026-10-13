# Geliştirici iş akışı

İki şema: (1) her geliştirme diliminin döngüsü, (2) uygulamanın çalışma anındaki akışı. Şemalar Mermaid ile yazılmıştır; GitHub, GitLab ve çoğu Markdown görüntüleyicide çizilir. Aynı şemaların görsel hâli `docs/img/` altındadır.

## 1. Geliştirme döngüsü (her dilim)

![Geliştirme döngüsü](img/gelistirme-dongusu.svg)

```mermaid
flowchart TD
    A["Gereklilik kimliklerini seç<br/>ör. DAT-01, T07"] --> B["Şartname + v1.1 ekini oku<br/>kabul koşullarını listele"]
    B --> C{"Hesap yöntemi, veri hakkı,<br/>hukuk veya sektör kuralı belirsiz mi?"}
    C -- evet --> D["Karar kaydına yaz<br/>ürün sahibine / uzmana sor"]
    D --> B
    C -- hayır --> E["Plan: veri modeli, göç,<br/>API, ekran durumları"]
    E --> F["Önce testler<br/>birim + altın set + izolasyon"]
    F --> G["En küçük çalışan değişiklik"]
    G --> H{"Testler ve /kontrol<br/>geçti mi?"}
    H -- hayır --> G
    H -- evet --> I["Teslim notu<br/>kimlikler, test kanıtı, eksikler"]
    I --> J{"Hesap veya standart<br/>değişti mi?"}
    J -- evet --> K["Alan uzmanı onayı"]
    J -- hayır --> L["Ürün sahibi incelemesi"]
    K --> L
    L --> M{"Onay?"}
    M -- hayır --> B
    M -- evet --> N["Birleştir ve sonraki dilim"]
```

## 2. Çalışma anı: kullanıcıdan rapora

![Sistem akışı](img/sistem-akisi.svg)

```mermaid
flowchart LR
    U["Yeni başlayan çalışan"] --> ONB["Kurum kurulumu<br/>NACE → sektör profili önerisi"]
    PROF[("Sektör profilleri<br/>sürümlü YAML")] -.öneri.-> ONB
    ONB --> TASK["Görev planı<br/>kaynak envanteri"]
    TASK --> DATA["Rehberli veri girişi<br/>belge / elle / içe aktarma"]
    AST["Asistan<br/>açıklar, sorar, kaynak gösterir"] -.yönlendirir.-> DATA
    SRC[("Kaynak izleme<br/>sürümlü kurallar")] -.dayanak.-> AST
    DATA --> ENG["Hesap motoru<br/>deterministik, sürümlü"]
    FAC[("Faktör kataloğu")] --> ENG
    ENG --> REV["Uzman incelemesi<br/>onay / geri gönder"]
    REV --> REP["Rapor paketi<br/>sabit manifest"]
    ENG --> KPI["Gösterge ve yoğunluk panosu"]
    KPI --> AKS["Sapma → görev → kök neden<br/>→ düzeltici faaliyet → etki"]
    KZN["Green Kaizen<br/>saha önerisi"] --> AKS
    AKS --> KPI
    ENG -.salt okunur.-> SCN["Senaryo defteri<br/>fiyat, tahsis"]
```

Kesik çizgiler veri veya öneri akışıdır; asistan ve senaryo defteri hesap sonucunu değiştiremez.
