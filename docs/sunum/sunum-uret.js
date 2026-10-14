// KOZA sunumu — pptxgenjs ile yapılandırılmış deste (tema, düzenler, bölümler, yer tutucular)
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const path = require("path");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");
const Fi = require("react-icons/fi");

const OUT = process.argv[2] || "KOZA-Sunum.pptx";

// ---------- Tema (uygulamanın paleti: taş zemin, mürekkep, derin deniz-yeşili, bakır) ----------
const THEME = {
  name: "Koza",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "16201C", // mürekkep
    lt1: "FFFFFF",
    dk2: "0D5F55", // deniz-yeşili (baskın)
    lt2: "F2F4F1", // taş zemin
    accent1: "0D5F55",
    accent2: "9A5B2B", // bakır (tek keskin vurgu)
    accent3: "5FAF9F", // açık yeşil
    accent4: "46514C", // ikincil metin
    accent5: "C9D8D3",
    accent6: "E0EFEA",
    hlink: "0D5F55",
    folHlink: "9A5B2B",
  },
};
const H = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "KOZA — Sürdürülebilirlik veri ve hesap platformu";
pres.author = "MEXT · İş Dünyasında Sorumlu Üretim grubu";
pres.lang = "tr-TR";
const C = pres.SchemeColor;

// ---------- Simgeler ----------
async function icon(name, hex, size = 256) {
  const Comp = Fi[name];
  if (!Comp) throw new Error("simge yok: " + name);
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + hex, size, strokeWidth: 1.75 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ---------- Düzenler ----------
const W = 13.33, M = 0.6;
pres.defineSlideMaster({
  title: "KAPAK",
  background: { color: H.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.2, w: W - 2 * M, h: 1.5, fontSize: 48, bold: true, color: H.lt1, align: "left", margin: 0 } } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 3.8, w: 9.5, h: 1.4, fontSize: 20, color: H.accent5, align: "left", margin: 0 } } },
  ],
});
pres.defineSlideMaster({
  title: "BOLUM",
  background: { color: H.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.2, w: W - 2 * M, h: 1.7, fontSize: 36, bold: true, color: H.lt1, align: "left", margin: 0, valign: "bottom" } } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.05, w: 10, h: 1.2, fontSize: 18, color: H.accent6, align: "left", margin: 0 } } },
  ],
});
pres.defineSlideMaster({
  title: "ICERIK",
  background: { color: H.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.45, w: W - 2 * M, h: 0.9, fontSize: 32, bold: true, color: H.dk1, align: "left", margin: 0 } } },
    { text: { text: "KOZA · MEXT İş Dünyasında Sorumlu Üretim", options: { x: M, y: 7.05, w: 7, h: 0.3, fontSize: 9, color: H.accent4, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.05, w: 0.6, h: 0.3, fontSize: 9, color: H.accent4, align: "right" },
});
pres.defineSlideMaster({
  title: "KAPANIS",
  background: { color: H.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 1.3, w: W - 2 * M, h: 1.1, fontSize: 40, bold: true, color: H.lt1, align: "left", margin: 0 } } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 2.5, w: 11, h: 2.6, fontSize: 18, color: H.accent5, align: "left", margin: 0 } } },
  ],
});

// ---------- Yardımcılar ----------
const CHART_BASE = {
  chartColors: [H.dk2, H.accent2, H.accent3, H.accent4],
  catAxisLabelColor: H.accent4, valAxisLabelColor: H.accent4,
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleFontFace: "+mj-lt", legendFontFace: "+mn-lt",
  catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, dataLabelFontSize: 11, dataLabelColor: H.dk1,
  valGridLine: { color: H.accent5, size: 0.5 }, catGridLine: { style: "none" },
  showLegend: false, titleColor: H.dk1, titleFontSize: 13,
};
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: opts.fill ?? C.background2 }, line: { color: opts.line ?? H.accent5, width: 0.75 }, shadow: { type: "outer", color: H.dk1, blur: 6, offset: 1, angle: 90, opacity: 0.08 }, objectName: opts.name ?? "kart" });
}
async function iconCircle(slide, name, x, y, d = 0.55, bg = C.accent1, fg = "FFFFFF") {
  slide.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg }, objectName: "simge-daire" });
  slide.addImage({ data: await icon(name, fg), x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56, objectName: "simge-" + name });
}
function text(slide, t, o) {
  slide.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top", ...o });
}
function content(title, section) {
  const s = pres.addSlide({ masterName: "ICERIK", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}

(async () => {
  // ===== 1. Kapak =====
  pres.addSection({ title: "Giriş" });
  let s = pres.addSlide({ masterName: "KAPAK", sectionTitle: "Giriş" });
  s.addShape(pres.ShapeType.roundRect, { x: M, y: 1.2, w: 0.9, h: 0.9, rectRadius: 0.2, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "logo" });
  text(s, "K", { x: M, y: 1.2, w: 0.9, h: 0.9, fontSize: 40, bold: true, color: H.lt1, align: "center", valign: "middle", fontFace: "Cambria" });
  s.addText("KOZA", { placeholder: "title" });
  s.addText("Sürdürülebilirlik görevine yeni başlayan çalışanı rehberle yönlendiren, veriyi kanıtıyla toplayan, hesabı denetlenebilir motorla yapan ve sonucu rapora bağlayan platform", { placeholder: "body" });
  text(s, "MEXT Teknoloji Merkezi · GreenSync Young Professionals Forum · İş Dünyasında Sorumlu Üretim grubu", { x: M, y: 5.7, w: 10, h: 0.4, fontSize: 13, color: H.accent3 });
  text(s, "Ekip: Muhammet Polat, Enes Koç, Çağla Kumru, Elif Sarıkaş, Havva Dönmez, Mısra Toprak, Okan Yılmaz, Zeynep Esmer  ·  Mentor: Onur Dedeoğlu", { x: M, y: 6.15, w: 12, h: 0.6, fontSize: 12, color: H.accent5 });
  s.addNotes("Açılış (1 dk): Koza'yı tek cümleyle tanıtın: ürün bir hesap makinesi değil, yeni başlayan çalışanı ilk faturadan denetlenebilir rapora götüren rehberli bir çalışma zinciri. Forum grubunun çıktısından doğduğunu söyleyin.");

  // ===== 2. Gündem =====
  s = content("Bugün ne anlatacağız", "Giriş");
  const agenda = [
    ["FiAlertCircle", "Problem", "Forumda ortaya çıkan ana sorun ve kök nedenler"],
    ["FiTarget", "İki hedef", "Verimlilik ve çalışan memnuniyeti nasıl ölçülür"],
    ["FiCompass", "Fikir", "Koza'nın çalışma zinciri ve vazgeçilmez ilkeleri"],
    ["FiLayers", "Ürün", "Veri, hesap, kontrol, performans, uyum, öğrenme"],
    ["FiCheckCircle", "Kanıt", "Neyin çalıştığı, nasıl doğrulandığı"],
    ["FiMap", "Yol", "Yol haritası, açık kararlar ve sizden istediklerimiz"],
  ];
  for (let i = 0; i < agenda.length; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * 4.1, y = 1.7 + row * 2.5;
    card(s, x, y, 3.8, 2.1);
    await iconCircle(s, agenda[i][0], x + 0.3, y + 0.3);
    text(s, agenda[i][1], { x: x + 1.05, y: y + 0.32, w: 2.5, h: 0.5, fontSize: 20, bold: true });
    text(s, agenda[i][2], { x: x + 0.3, y: y + 1.05, w: 3.2, h: 0.9, fontSize: 14, color: C.accent4 });
  }
  s.addNotes("Gündem (30 sn): altı başlık; toplam 20 dakika, sonda soru-cevap.");

  // ===== 3. Problem =====
  pres.addSection({ title: "Problem ve hedef" });
  s = pres.addSlide({ masterName: "BOLUM", sectionTitle: "Problem ve hedef" });
  s.addText("Problem: işletmede sürdürülebilirlik odaklı bir sistem mimarisi yok", { placeholder: "title" });
  s.addText("Forum çalıştayındaki ESG balık kılçığının tek bir kök noktaya çıkması", { placeholder: "body" });
  s.addNotes("Bölüm geçişi (20 sn).");

  s = content("Kök nedenler beş eksende toplanıyor", "Problem ve hedef");
  s.addChart(pres.ChartType.bar, [{ name: "Kök neden sayısı", labels: ["Yönetişim", "Veri ve dijital altyapı", "Tedarik zinciri", "Sosyal", "Dış ekosistem"], values: [5, 4, 4, 3, 4] }], {
    ...CHART_BASE, x: M, y: 1.5, w: 6.6, h: 5.2, barDir: "bar", showValue: true, dataLabelPosition: "outEnd", showTitle: true, title: "Çalıştay panosundaki kök neden sayısı (eksen başına)", valAxisHidden: true, valAxisMaxVal: 7,
  });
  const causes = [
    ["Yönetişim", "Üst yönetim sahiplenmiyor; ekip, hedef ve sorumluluk belirsiz"],
    ["Veri", "Veri dağınık ve güvenilmez; yönetişim, raporlama ve analiz yok"],
    ["Tedarik", "Tedarikçiden veri gelmiyor; paylaşım endişesi, denetim mekanizması yok"],
    ["Sosyal", "Farkındalık düşük; operatöre fikri sorulmuyor; nitelikli personel az"],
    ["Dış ekosistem", "Regülasyon, finansman ve paydaş iş birliği boşlukları; artan maliyet"],
  ];
  for (let i = 0; i < causes.length; i++) {
    const y = 1.55 + i * 1.02;
    text(s, causes[i][0], { x: 7.6, y, w: 1.8, h: 0.9, fontSize: 14, bold: true, color: C.accent1 });
    text(s, causes[i][1], { x: 9.4, y, w: 3.3, h: 0.95, fontSize: 13, color: C.accent4 });
  }
  s.addNotes("Problem (2 dk): sayılar grubun kendi çalıştay panosundan (çözüm önerileri belgesi). Beş eksen Koza'nın modül sınırlarını belirledi; her eksen üründe bir karşılık buldu.");

  // ===== 5. İki hedef =====
  s = content("İki hedef, iki ölçüm ailesi", "Problem ve hedef");
  const goals = [
    ["FiTrendingUp", "Hedef 1 · Verimlilik", "Kaynak tüketimi, hurda ve süreç kayıplarını azaltmak", ["kWh / ton, m³ / ton gibi yoğunluklar (profil paydasıyla)", "Atık ve fire oranı", "Su yoğunluğu"]],
    ["FiUsers", "Hedef 2 · Çalışan memnuniyeti", "Katılım, yetkinlik, güvenlik ve çalışma deneyimini iyileştirmek", ["Öneri sayısı ve uygulanma oranı (birim düzeyinde)", "Bağlılık skoru (anonim, çeyreklik)", "Kişi başı eğitim saati"]],
  ];
  for (let i = 0; i < 2; i++) {
    const x = M + i * 6.2;
    card(s, x, 1.6, 5.9, 4.9, { fill: C.background1 });
    await iconCircle(s, goals[i][0], x + 0.4, 2.0, 0.7);
    text(s, goals[i][1], { x: x + 1.3, y: 2.05, w: 4.4, h: 0.6, fontSize: 22, bold: true });
    text(s, goals[i][2], { x: x + 0.4, y: 2.95, w: 5.1, h: 0.8, fontSize: 15, color: C.accent4 });
    s.addText(goals[i][3].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < 2, paraSpaceAfter: 6 } })), { isTextBox: true, x: x + 0.4, y: 3.9, w: 5.1, h: 2.3, fontSize: 14, color: C.text1, valign: "top" });
  }
  text(s, "Kural: üretim düşerken mutlak emisyon da düşmüşse “verimlilik arttı” denmez; fark ayrıştırması gösterilir. Hedef değerler pilot başlangıcındaki ölçümle belirlenir, önceden vaat edilmez.", { x: M, y: 6.6, w: 12.1, h: 0.45, fontSize: 12, italic: true, color: C.accent2 });
  s.addNotes("Hedefler (1.5 dk): forumun iki hedefi ürünün başarı ölçütü oldu. Her modül en az birine ölçülebilir katkı sağlar.");

  // ===== 6. Fikir =====
  pres.addSection({ title: "Fikir" });
  s = pres.addSlide({ masterName: "BOLUM", sectionTitle: "Fikir" });
  s.addText("Fikir: hesabı motor yapar, yapay zekâ açıklar ve yönlendirir", { placeholder: "title" });
  s.addText("Her modül tek bir zincire bağlanır: görev → veri → hesap → kontrol → rapor", { placeholder: "body" });

  s = content("Çalışma zinciri: beş adım, hepsi izlenebilir", "Fikir");
  const chain = [
    ["FiCompass", "Görev", "“Ne yapmak istiyorsun?” Sistem sonraki adımı gösterir; teknik terim dayatılmaz."],
    ["FiFileText", "Veri", "Fatura, miktar, birim, dönem, kanıt. Eksik bilgi sıfır sayılmaz; görev olur."],
    ["FiCpu", "Hesap", "Aynı girdi + faktör + yöntem = aynı sonuç. İz kaydı kaynağa kadar gider."],
    ["FiEye", "Kontrol", "Hesaplandı ≠ onaylandı. Veri giren ile onaylayan farklıdır."],
    ["FiPackage", "Rapor", "Her rapor sürümü veri ve faktör kimliklerini ve karmasını taşır."],
  ];
  for (let i = 0; i < chain.length; i++) {
    const x = M + i * 2.46;
    card(s, x, 1.7, 2.26, 3.6, { fill: i === 2 ? C.accent6 : C.background2 });
    await iconCircle(s, chain[i][0], x + 0.25, 1.95, 0.6, i === 2 ? C.accent2 : C.accent1);
    text(s, chain[i][1], { x: x + 0.25, y: 2.7, w: 1.8, h: 0.45, fontSize: 18, bold: true });
    text(s, chain[i][2], { x: x + 0.25, y: 3.2, w: 1.85, h: 2.0, fontSize: 12.5, color: C.accent4 });
    if (i < chain.length - 1) s.addShape(pres.ShapeType.rightArrow, { x: x + 2.27, y: 3.25, w: 0.2, h: 0.3, fill: { color: C.accent5 }, line: { color: C.accent5 }, objectName: "ok" });
  }
  card(s, M, 5.6, 12.1, 1.2, { fill: C.background1 });
  text(s, "Yapay zekânın yeri: anlar, sorar, kaynak gösterir, görev önerir. Sayı üretmez, onaylamaz, yayımlamaz, dışarı mesaj göndermez. Yanıt biçimi her yerde aynı: kısa açıklama → kaynak ve sürüm → kurum için koşul → belirsizlik → önerilen eylem.", { x: M + 0.3, y: 5.75, w: 11.5, h: 0.95, fontSize: 14 });
  s.addNotes("Fikir (2 dk): zinciri soldan sağa anlatın; vurgu hesap adımında — bu yüzden ürün bir sohbet botu değil. Yapay zekâ sınırlarını net söyleyin.");

  // ===== 8. Altı katman =====
  s = content("Grubun mimarisi ürünün omurgası oldu", "Fikir");
  const layers = [
    ["1", "Strateji ve sahiplik", "Hedef kartı, RACI, karar kapısı"],
    ["2", "Süreç mimarisi", "Üretim, yatırım, satın alma, İK, bakım kapıları"],
    ["3", "Veri yönetişimi", "Gösterge sözlüğü: tanım, sahip, birim, kalite"],
    ["4", "Entegrasyon", "ERP, MES, sayaç, tedarikçi → kontrollü giriş"],
    ["5", "Ortak ESG veri katmanı", "Enerji, su, emisyon, atık, İSG, çalışan, finans"],
    ["6", "Karar ve aksiyon motoru", "Sapma → görev → kök neden → düzeltme → etki"],
  ];
  for (let i = 0; i < layers.length; i++) {
    const y = 1.55 + i * 0.86;
    s.addShape(pres.ShapeType.roundRect, { x: M, y, w: 6.9, h: 0.72, rectRadius: 0.1, fill: { color: i === 5 ? C.accent2 : C.accent1 }, line: { color: C.background1 }, transparency: i === 5 ? 0 : 10 + i * 8, objectName: "katman" });
    text(s, layers[i][0], { x: M + 0.25, y: y + 0.12, w: 0.5, h: 0.5, fontSize: 20, bold: true, color: H.lt1 });
    text(s, layers[i][1], { x: M + 0.85, y: y + 0.1, w: 2.8, h: 0.5, fontSize: 15, bold: true, color: H.lt1, valign: "middle" });
    text(s, layers[i][2], { x: M + 3.6, y: y + 0.1, w: 3.2, h: 0.55, fontSize: 12, color: H.lt1, valign: "middle" });
  }
  card(s, 8.0, 1.55, 4.7, 5.1, { fill: C.background2 });
  text(s, "Koza bu altı katmanın kullanıcı yüzüdür", { x: 8.3, y: 1.8, w: 4.2, h: 0.8, fontSize: 20, bold: true });
  s.addText([
    { text: "İlk beş katman şartname v1.0'da vardı; altıncı katman (karar ve aksiyon motoru) v1.1 ile eklendi.", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "Karar akışı yedi adım: başlat → ön değerlendir → veriyi doğrula → seçenek üret → pilot uygula → sonucu ölç → ölçekleme kapısı.", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "Her iki hedef eşiği karşılamadan hiçbir aksiyon “tamamlandı” olamaz.", options: { bullet: true } },
  ], { isTextBox: true, x: 8.3, y: 2.7, w: 4.2, h: 3.8, fontSize: 14, color: C.text1, valign: "top" });
  s.addNotes("Mimari (1.5 dk): grubun altı katmanlı önerisi (sistem mimarisi notu) Koza'nın iç yapısına doğrudan oturdu. Bakır katman yeni eklenen aksiyon motorudur.");

  // ===== 9. İlkeler =====
  s = content("Vazgeçilmez ilkeler", "Fikir");
  const rules = [
    ["FiCpu", "Deterministik hesap", "Sayısal sonucu yalnız hesap motoru üretir; yapay zekâ çıktısı sayı olarak kaydedilmez."],
    ["FiHelpCircle", "Durumlar ayrıdır", "Bilinmiyor, ölçülmüş sıfır, uygulanamaz ve tahmini birbirinden farklıdır; eksik veriye sıfır atanmaz."],
    ["FiLock", "Kurum izolasyonu", "Veritabanı, dosya ve arama katmanında kurum ayrımı; istemciden gelen kimlik yetki kanıtı değildir."],
    ["FiShield", "Yetki sunucuda", "Arayüzde gizlemek yetkilendirme değildir; veri giren ile onaylayan farklıdır."],
    ["FiDatabase", "Sektör = veri", "Sektöre özgü gösterge, payda, soru ve öncelik sürümlü profil verisinden gelir; koda gömülmez."],
    ["FiXCircle", "Sahte tamamlama yok", "Çalışmayan buton, uydurma grafik, kanıtsız tasarruf yüzdesi yok; sonuç eksiğiyle gösterilir."],
  ];
  for (let i = 0; i < rules.length; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * 4.1, y = 1.6 + row * 2.6;
    card(s, x, y, 3.8, 2.3);
    await iconCircle(s, rules[i][0], x + 0.3, y + 0.3, 0.55, C.accent1);
    text(s, rules[i][1], { x: x + 1.0, y: y + 0.32, w: 2.6, h: 0.5, fontSize: 17, bold: true });
    text(s, rules[i][2], { x: x + 0.3, y: y + 1.0, w: 3.2, h: 1.2, fontSize: 13, color: C.accent4 });
  }
  s.addNotes("İlkeler (1.5 dk): on iki kuralın altısı; geri kalanı (geçmiş sessizce değişmez, senaryo envanteri değiştirmez, ürün toplamı kurumsal toplama girmez, kişisel sıralama yok, test katsayıları kurgusal) belgede.");

  // ===== 10. Ürün: nasıl çalışır =====
  pres.addSection({ title: "Ürün" });
  s = pres.addSlide({ masterName: "BOLUM", sectionTitle: "Ürün" });
  s.addText("Ürün: altı alan, tek zincir", { placeholder: "title" });
  s.addText("Veri · Kontrol ve rapor · Performans · Uyum ve dış ilişkiler · Öğren · Sistem", { placeholder: "body" });

  s = content("Bir kaydın yolculuğu: faturadan rapora", "Ürün");
  const steps = ["Kurulum", "Kayıt", "Hesap", "İnceleme", "Dönem", "Rapor"];
  const stepDesc = ["Kurum, NACE → profil önerisi, tesis, dönem, kaynaklar", "100 GJ doğal gaz, alt ısıl değer, fatura kanıtı (karma)", "Motor: CO₂, CH₄, N₂O ayrı; iz kaydı faktöre kadar", "Onaylayan ≠ veri giren; kanıtsız onay yok", "Uzlaştırma, kilit; yeniden açma gerekçe ister", "Sabit manifest + SHA-256; aynı girdi aynı karma"];
  for (let i = 0; i < steps.length; i++) {
    const x = M + i * 2.05;
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.55, y: 1.6, w: 0.7, h: 0.7, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "adim" });
    text(s, String(i + 1), { x: x + 0.55, y: 1.6, w: 0.7, h: 0.7, fontSize: 18, bold: true, color: H.lt1, align: "center", valign: "middle" });
    text(s, steps[i], { x, y: 2.4, w: 1.8, h: 0.4, fontSize: 15, bold: true, align: "center" });
    text(s, stepDesc[i], { x: x + 0.05, y: 2.8, w: 1.75, h: 1.2, fontSize: 11, color: C.accent4, align: "center" });
    if (i < 5) s.addShape(pres.ShapeType.line, { x: x + 1.3, y: 1.95, w: 0.7, h: 0, line: { color: H.accent5, width: 1.5 }, objectName: "cizgi" });
  }
  s.addChart(pres.ChartType.bar, [{ name: "kg CO₂e", labels: ["CO₂", "CH₄ (×28)", "N₂O (×265)"], values: [5000, 2.8, 26.5] }], {
    ...CHART_BASE, x: M, y: 4.15, w: 6.3, h: 2.75, barDir: "col", showValue: true, dataLabelPosition: "outEnd", showTitle: true, title: "Örnek koşu: 100 GJ doğal gaz — gaz başına katkı (kg CO₂e, kurgusal test faktörleri)", valAxisHidden: true, valAxisMaxVal: 6000, dataLabelFormatCode: "#,##0.0",
  });
  card(s, 7.2, 4.15, 5.5, 2.75, { fill: C.background2 });
  text(s, "Ekranda ne görünür", { x: 7.5, y: 4.3, w: 5, h: 0.4, fontSize: 16, bold: true });
  s.addText([
    { text: "Sayıdan önce dönem, birim, durum ve eksikler", options: { bullet: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: "Toplam 5,005 t CO₂e; kapsama: tam sera gazı (3 gaz)", options: { bullet: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: "Engeller açıkça: m³ koşulu yok, esas uyumsuz, CO₂e faktöre ikinci GWP", options: { bullet: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: "Her engelin kaynağı, nedeni, sonucu ve yapılacak iş yazılı", options: { bullet: true } },
  ], { isTextBox: true, x: 7.5, y: 4.75, w: 5, h: 2.1, fontSize: 13, color: C.text1, valign: "top" });
  s.addNotes("Yolculuk (2 dk): canlı demoda bu altı adımı gösterin. Grafikteki katsayılar kurgusal test değerleri; gerçek katalog uzman onayıyla yüklenir — bunu açıkça söyleyin.");

  // ===== 12. Kapsam genişliği =====
  s = content("Kapsam 1, 2 ve 3: her kategori için izinli yöntemler", "Ürün");
  s.addChart(pres.ChartType.bar, [{ name: "İzinli yöntem sayısı", labels: ["1 Mal ve hizmet", "2 Sermaye malı", "3 Yakıt/enerji üst aşama", "4 Yukarı taşıma", "5 Atık", "6 İş seyahati", "7 İşe gidiş geliş", "8 Kiralanan (kiracı)", "9 Aşağı taşıma", "10 Ürün işleme", "11 Ürün kullanımı", "12 Ömür sonu", "13 Kiraya verilen", "14 Franchise", "15 Yatırım"], values: [4, 4, 1, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1] }], {
    ...CHART_BASE, x: M, y: 1.5, w: 7.4, h: 5.3, barDir: "bar", showValue: true, dataLabelPosition: "outEnd", showTitle: true, title: "Kapsam 3 kategorileri — motorun yöntem matrisi (yöntem sayısı)", valAxisHidden: true, valAxisMaxVal: 5, catAxisLabelFontSize: 10,
  });
  const scopeCards = [
    ["FiZap", "Kapsam 1", "Sabit ve mobil yakma, proses, soğutucu. Yeni ekipman dolumu kaçak sayılmaz; birim ve ısıl değer esası uyuşmadan hesap yok."],
    ["FiBatteryCharging", "Kapsam 2", "Konum ve piyasa bazlı iki sonuç ayrı; menşe garantisi tüketimi aşamaz; kalan tüketim hesap dışı bırakılamaz."],
    ["FiBox", "Ürün çalışması", "Dört sade sınır sorusu; sonuç “ürün karbon ayak izi” ya da “kısmi”; kurumsal toplama girmez."],
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.5 + i * 1.8;
    card(s, 8.3, y, 4.4, 1.6);
    await iconCircle(s, scopeCards[i][0], 8.55, y + 0.25, 0.5);
    text(s, scopeCards[i][1], { x: 9.2, y: y + 0.25, w: 3.2, h: 0.4, fontSize: 16, bold: true });
    text(s, scopeCards[i][2], { x: 8.55, y: y + 0.75, w: 3.95, h: 0.85, fontSize: 11.5, color: C.accent4 });
  }
  s.addNotes("Kapsam (1.5 dk): on beş kategori hiçbir zaman silinmez; veri yoksa “bilinmiyor” kalır, sıfır olmaz. Yöntem matrisi motorda; matris dışı yöntem reddedilir.");

  // ===== 13. Sektör profilleri =====
  s = content("Sektör = veri: profil değişir, çekirdek değişmez", "Ürün");
  const rowsP = [
    ["Profil", "Yoğunluk paydası", "Öncelikli Kapsam 3", "Sektöre özgü gösterge", "Durum"],
    ["Ağır sanayi (metal, çimento, cam)", "ton ürün", "1, 3, 4", "Proses emisyonu, hurda oranı", "Taslak"],
    ["Gıda ve içecek", "ton ürün, m³ su", "1, 4, 5, 12", "Soğutucu kaçağı, gıda kaybı", "Taslak"],
    ["Genel profil", "çalışan, m²", "1, 6, 7, 5", "—", "Taslak"],
    ["Genel imalat", "adet / ton ürün", "1, 4, 11, 12", "Fire oranı, makine başı enerji", "Planlı"],
    ["Tekstil ve hazır giyim", "kg kumaş, adet", "1, 4, 5", "Su ve kimyasal tüketimi", "Planlı"],
    ["Lojistik ve taşımacılık", "ton-km", "1, 3, 4", "Filo yakıt verimi", "Planlı"],
    ["Perakende", "m² satış alanı", "1, 4, 9, 12", "Ambalaj, soğutma", "Planlı"],
    ["Hizmet, ofis, yazılım", "çalışan, m²", "1, 6, 7", "Veri merkezi / bulut tüketimi", "Planlı"],
  ];
  s.addTable(rowsP.map((r, ri) => r.map((c, ci) => ({ text: c, options: { bold: ri === 0, color: ri === 0 ? H.lt1 : (ci === 4 && c === "Taslak" ? H.accent2 : H.dk1), fill: { color: ri === 0 ? H.dk2 : (ri % 2 ? "FFFFFF" : H.lt2) }, fontSize: 12, fontFace: "Calibri" } }))), {
    x: M, y: 1.5, w: 12.1, colW: [3.2, 2.1, 1.9, 3.5, 1.4], border: { type: "solid", color: H.accent5, pt: 0.5 }, rowH: 0.42, margin: 0.06, objectName: "profil-tablosu",
  });
  text(s, "Profil yalnız önerir ve önceliklendirir; kategori silmez. Kurum kurulumunda NACE kodu profil önerir, kullanıcı onaylar; uygun profil yoksa genel profil. Profil sürümü değişince geçmiş hesaplar değişmez. Üç profil taslaktır; alan uzmanı onayı (karar K-02) bekliyor.", { x: M, y: 5.6, w: 12.1, h: 1.0, fontSize: 13, color: C.accent4 });
  s.addNotes("Sektör (1 dk): “sektör = veri, kod değil” kuralının somut hâli. Grup pilot profillerini seçecek.");

  // ===== 14. Performans ve katılım =====
  s = content("Performans ve katılım", "Ürün");
  const flow7 = ["Başlat", "Ön değerlendir", "Veriyi doğrula", "Seçenek üret", "Pilot uygula", "Sonucu ölç", "Karar"];
  for (let i = 0; i < flow7.length; i++) {
    const x = M + i * 1.75;
    s.addShape(pres.ShapeType.roundRect, { x, y: 1.6, w: 1.6, h: 0.75, rectRadius: 0.1, fill: { color: i === 6 ? C.accent2 : C.accent1 }, line: { color: C.background1 }, objectName: "akis" });
    text(s, `${i + 1}. ${flow7[i]}`, { x: x + 0.05, y: 1.6, w: 1.5, h: 0.75, fontSize: 12, bold: true, color: H.lt1, align: "center", valign: "middle" });
  }
  text(s, "Karar kapısı (AKS): tetikleyici (KPI sapması, yatırım, hat değişikliği, çalışan önerisi, mevzuat) → sekiz alanlı ön değerlendirme (bilinmeyen “bilinmiyor” kalır) → ekonomik, çevresel ve çalışan etkisi yan yana → pilot → baz dönemle ölçüm → iki hedef de eşiği karşılarsa standardize et, değilse kök neden ve yeniden tasarım.", { x: M, y: 2.5, w: 12.1, h: 0.95, fontSize: 12.5, color: C.accent4 });
  const perf = [
    ["FiBarChart2", "Analiz ve hedefler", "Gösterge sözlüğü (tanım, birim, sahip, kalite kuralı); yoğunluk yalnız payda ve dönem varsa; hedef kartı ve RACI; iki hedefin durumu."],
    ["FiMessageSquare", "Green Kaizen", "Saha çalışanı üç alanla öneri verir: ne gördüm, ne öneriyorum, hangi hat. Elçi değerlendirir; uygulanan öneri ölçülen etkisiyle geri döner."],
    ["FiUsers", "Birim düzeyi", "Öneriler ve katılım yalnız birim düzeyinde toplulaştırılır; kişi bazlı sıralama hiçbir ekranda yoktur (KVKK görüşü K-09)."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 4.1;
    card(s, x, 3.7, 3.8, 3.0);
    await iconCircle(s, perf[i][0], x + 0.3, 3.95, 0.55);
    text(s, perf[i][1], { x: x + 1.0, y: 3.98, w: 2.6, h: 0.5, fontSize: 16, bold: true });
    text(s, perf[i][2], { x: x + 0.3, y: 4.65, w: 3.2, h: 1.9, fontSize: 12.5, color: C.accent4 });
  }
  s.addNotes("Performans (1.5 dk): forumun 7 adımlı karar akışı ürünün aksiyon modülü oldu. Kaizen ile ikinci hedef doğrudan beslenir.");

  // ===== 15. Uyum ve dış ilişkiler =====
  s = content("Uyum ve dış ilişkiler: regülasyon, tedarikçi, senaryo", "Ürün");
  const uyum = [
    ["FiShield", "Regülasyon paketleri", "CBAM, ulusal ETS/MRV, TSRS, AB müşteri talepleri ayrı ve sürümlü paketler. Eşik, tarih ve benchmark koda yazılmaz; doğrulanmamış kural “inceleme gerekli” kalır. Resmî metin → değişiklik kartı → uzman onayı."],
    ["FiTruck", "Tedarikçi programı", "Harcama × yoğunlukla sıralama; ilk dalga kritik %20. Talebin ilk ekranında gizlilik ve “yalnız toplulaştırılmış kullanım” taahhüdü. Öz değerlendirme; yüksek riskte saha ziyareti; ceza yerine düzeltici plan. Dış gönderim yetkili onayı ister."],
    ["FiDollarSign", "Senaryo defteri", "Gölge karbon fiyatı, ücretsiz tahsis, açık/fazla ve alım-satım senaryoları ayrı defterde. Envanteri değiştiremez: rapor karması senaryo girilince aynı kalır. TR ETS eki (Enes Koç) burada karşılık buldu."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 4.1;
    card(s, x, 1.6, 3.8, 4.4);
    await iconCircle(s, uyum[i][0], x + 0.3, 1.9, 0.6, i === 2 ? C.accent2 : C.accent1);
    text(s, uyum[i][1], { x: x + 0.3, y: 2.65, w: 3.2, h: 0.5, fontSize: 18, bold: true });
    text(s, uyum[i][2], { x: x + 0.3, y: 3.2, w: 3.2, h: 2.7, fontSize: 12.5, color: C.accent4 });
  }
  text(s, "Açık kararlar: ulusal ETS ikincil mevzuatı (K-06), CBAM kanıt formatı (K-07), TSRS uygulanabilirliği (K-08), gölge karbon fiyatının sahibi (K-11) — resmî metin doğrulanana kadar paketler açılmaz.", { x: M, y: 6.25, w: 12.1, h: 0.6, fontSize: 12, italic: true, color: C.accent2 });
  s.addNotes("Uyum (1.5 dk): kural 6 — regülasyon koda gömülmez. Senaryo defterinin envanteri değiştirmediği testle kanıtlı.");

  // ===== 16. Öğrenme ve asistan =====
  s = content("Öğrenme ve asistan: iş başında rehber", "Ürün");
  s.addChart(pres.ChartType.bar, [{ name: "Adet", labels: ["Ders (101)", "Sözlük terimi", "Kaynak kartı", "Gündem maddesi", "Sektör profili", "Regülasyon paketi", "Hata kodu"], values: [10, 48, 16, 4, 3, 4, 70] }], {
    ...CHART_BASE, x: M, y: 1.5, w: 6.2, h: 4.6, barDir: "bar", showValue: true, dataLabelPosition: "outEnd", showTitle: true, title: "İçerik envanteri (hepsi veri olarak, kod değil)", valAxisHidden: true, valAxisMaxVal: 80,
  });
  const ogr = [
    ["FiBookOpen", "Rol bazlı dersler", "Yönetici, uzman ve saha için ayrı yollar; saha dersleri 3 dakika; her ders gerçek bir göreve bağlı; rozet veya sertifika yok."],
    ["FiMessageCircle", "Kaynaklı asistan", "Şartname, sözlük, kaynak kartları ve kurumun kendi verisinden yanıt kurar; sayı yalnız kayıtlı hesaptan. Kaynak yoksa “doğrulanmış kaynak bulamadım”."],
    ["FiFileText", "Belge güvenliği", "Yapıştırılan fatura metni veridir, komut değildir; içindeki talimat benzeri ifadeler görünür uyarıyla yok sayılır. On iki senaryoluk değerlendirme seti her sürümde koşar."],
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.5 + i * 1.65;
    card(s, 7.1, y, 5.6, 1.45);
    await iconCircle(s, ogr[i][0], 7.35, y + 0.2, 0.5);
    text(s, ogr[i][1], { x: 8.0, y: y + 0.2, w: 4.5, h: 0.4, fontSize: 15, bold: true });
    text(s, ogr[i][2], { x: 7.35, y: y + 0.65, w: 5.1, h: 0.8, fontSize: 11.5, color: C.accent4 });
  }
  text(s, "Tüm tanımlar özgün kısa açıklamalardır; standart metinleri kopyalanmaz (K-12). İçerik editör onayı bekliyor etiketiyle gösterilir.", { x: M, y: 6.35, w: 12, h: 0.45, fontSize: 12, italic: true, color: C.accent2 });
  s.addNotes("Öğrenme (1 dk): asistan LLM değil, kural tabanlı kaynaklı yanıt motoru — bunu açıkça söyleyin; bu bir eksiklik değil, §24'ün gereği.");

  // ===== 17. Kanıt =====
  pres.addSection({ title: "Kanıt" });
  s = pres.addSlide({ masterName: "BOLUM", sectionTitle: "Kanıt" });
  s.addText("Kanıt: neyin çalıştığını nasıl biliyoruz", { placeholder: "title" });
  s.addText("Testler, altın senaryolar, gereklilik izleme ve canlı önizleme", { placeholder: "body" });

  s = content("Her katman test edildi, her gereklilik izlendi", "Kanıt");
  s.addChart(pres.ChartType.bar, [{ name: "Test sayısı", labels: ["Hesap motoru", "İş API'si + izolasyon", "Arayüz modülleri"], values: [200, 125, 163] }], {
    ...CHART_BASE, x: M, y: 1.5, w: 5.2, h: 3.0, barDir: "col", showValue: true, dataLabelPosition: "outEnd", showTitle: true, title: "Otomatik testler (hepsi geçiyor)", valAxisHidden: true, valAxisMaxVal: 240,
  });
  s.addChart(pres.ChartType.doughnut, [{ name: "Gereklilik", labels: ["Uygulandı", "Uygulandı · grup kararı bekliyor"], values: [35, 4] }], {
    ...CHART_BASE, x: 6.0, y: 1.5, w: 3.4, h: 3.0, holeSize: 55, showTitle: true, title: "39 gereklilik satırı", showLegend: true, legendPos: "b", legendFontSize: 10, legendColor: H.accent4, showValue: true, dataLabelPosition: "ctr", dataLabelColor: "FFFFFF", chartColors: [H.dk2, H.accent2],
  });
  s.addChart(pres.ChartType.bar, [{ name: "Altın senaryo", labels: ["Kapsam 1 (T01–T04, T20)", "Kapsam 2 (T05–T06)", "Kapsam 3 (T08–T12)", "Soğutucu (T11)", "Ürün / toplama", "Diğer engeller"], values: [16, 7, 18, 7, 7, 22] }], {
    ...CHART_BASE, x: 9.6, y: 1.5, w: 3.15, h: 3.0, barDir: "bar", showValue: true, dataLabelPosition: "outEnd", showTitle: true, title: "77 altın senaryo (77/77 geçti)", valAxisHidden: true, valAxisMaxVal: 28, catAxisLabelFontSize: 8, dataLabelFontSize: 9,
  });
  const proofs = [
    ["FiGlobe", "Aynı motor tarayıcıda", "Python hesap motoru tarayıcıda da aynı kodla çalışır; 77 senaryo canlı sitede 38 saniyede koşuldu."],
    ["FiDatabase", "Gerçek veritabanı", "API testleri bellek içi depoda ve PostgreSQL'de (satır düzeyi güvenlik) ayrı ayrı koşar; başka kurumun kaydı 13 işlemde görünmez."],
    ["FiMonitor", "Gerçek arayüz akışı", "Kurulum → kayıt → hesap → inceleme → rapor zinciri headless tarayıcıda tıklanarak doğrulandı; 35 sayfa hatasız."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 4.1;
    card(s, x, 4.8, 3.8, 2.0);
    await iconCircle(s, proofs[i][0], x + 0.3, 5.05, 0.5);
    text(s, proofs[i][1], { x: x + 0.95, y: 5.05, w: 2.7, h: 0.45, fontSize: 14, bold: true });
    text(s, proofs[i][2], { x: x + 0.3, y: 5.55, w: 3.2, h: 1.2, fontSize: 11.5, color: C.accent4 });
  }
  s.addNotes("Kanıt (2 dk): sayılar depodaki CI'dan. Altın set uzman imzası bekliyor (§29): test katsayıları kurgusal; imza gelince gerçek katalogla aynı set koşar.");

  // ===== 19. Teknoloji =====
  s = content("Teknoloji: modüler monolit, deterministik çekirdek", "Kanıt");
  const tech = [
    ["Arayüz", "Next.js (TypeScript), statik dışa aktarma; sade ve ayrıntılı görünüm; erişilebilir formlar", C.accent1],
    ["İş API'si", "FastAPI; kurum bağlamı oturumdan; idempotency, sürüm/ETag, hız sınırı, denetim izi", C.accent1],
    ["Hesap motoru", "Saf Python, Decimal, I/O yok; aynı kod tarayıcıda (Pyodide) ve sunucuda", C.accent2],
    ["Veri", "PostgreSQL; satır düzeyi güvenlik; append-only sürüm tabloları; değer durumu kısıtı", C.accent1],
    ["Dosya ve kuyruk", "Nesne deposu, imzalı kısa ömürlü bağlantı, tarama kancası; uzun işler job_id döner", C.accent1],
    ["İçerik", "Profiller, dersler, terimler, kaynaklar, paketler YAML olarak sürümlü; kod dağıtımından ayrı", C.accent1],
  ];
  for (let i = 0; i < tech.length; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.15, y = 1.55 + row * 1.7;
    card(s, x, y, 5.95, 1.5, { fill: C.background1 });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.3, y: y + 0.45, w: 0.6, h: 0.6, fill: { color: tech[i][2] }, line: { color: tech[i][2] }, objectName: "nokta" });
    text(s, tech[i][0], { x: x + 1.1, y: y + 0.22, w: 4.6, h: 0.45, fontSize: 16, bold: true });
    text(s, tech[i][1], { x: x + 1.1, y: y + 0.7, w: 4.6, h: 0.75, fontSize: 12.5, color: C.accent4 });
  }
  text(s, "Önizleme (GitHub Pages) statiktir: kayıtlar tarayıcıda, motor tarayıcıda. Üretimde aynı kurallar API ve PostgreSQL üzerinde çalışır; adımlar “Üretime geçiş” belgesinde.", { x: M, y: 6.65, w: 12.1, h: 0.4, fontSize: 12, italic: true, color: C.accent2 });
  s.addNotes("Teknoloji (1 dk): hızlı geçin; teknik soru gelirse sözleşme belgelerine yönlendirin.");

  // ===== 20. Yol haritası =====
  pres.addSection({ title: "Yol ve kararlar" });
  s = content("Yol haritası: forum takvimi ile ürün kapıları birleşti", "Yol ve kararlar");
  const phases = [
    ["0–6 ay", "Doğru zincir", "Sponsor ve ekip, önemlilik analizi, gösterge sözlüğü, kritik tedarikçi listesi, farkındalık eğitimi, hızlı kazanım projeleri. Ürün: kurulum → doğal gaz → hesap → rapor, elektrik, profiller.", "Pilot kapısı: kurumlar arası erişim testi + yeni kullanıcının yardımsız ilk taslağı"],
    ["6–18 ay", "İki hedefi besleyen döngü", "Ölçüm altyapısı ve ESG veri tabanı, pano, tedarikçi portalı ve sözleşme maddeleri, operatör öneri sistemi, fon başvuruları. Ürün: Kaizen, öğrenme yolları, aksiyon motoru.", "Ara kontrol: pilot kapısından geçen kurumda iki hedefin ilk ölçümü"],
    ["18–36 ay", "Entegrasyon ve dış uyum", "Otomatik MES/ERP veri akışı, dış güvence, öngörü analizi, tedarikçi programının yaygınlaşması. Ürün: Kapsam 3 derinleşmesi, regülasyon paketleri, senaryo defteri.", "Ölçekleme kapısı: iki hedefin eşikleri + uzman onaylı altın set"],
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 4.1;
    s.addShape(pres.ShapeType.roundRect, { x, y: 1.55, w: 3.8, h: 0.7, rectRadius: 0.1, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "faz" });
    text(s, phases[i][0] + "  ·  " + phases[i][1], { x: x + 0.2, y: 1.55, w: 3.5, h: 0.7, fontSize: 15, bold: true, color: H.lt1, valign: "middle" });
    card(s, x, 2.4, 3.8, 3.1);
    text(s, phases[i][2], { x: x + 0.25, y: 2.6, w: 3.3, h: 2.8, fontSize: 13.5, color: C.accent4 });
    card(s, x, 5.65, 3.8, 1.15, { fill: i === 1 ? C.background1 : C.accent6 });
    text(s, phases[i][3], { x: x + 0.25, y: 5.75, w: 3.3, h: 1.0, fontSize: 11.5, bold: i !== 1, color: i === 1 ? C.accent4 : C.accent1 });
  }
  s.addNotes("Yol (1.5 dk): süreler pilot kapasitesine göre güncellenir, teslim taahhüdü değildir (§30). Kapılar geçilmeden sonraki faza geçilmez.");

  // ===== 21. Açık kararlar =====
  s = content("Grubun kesinleştireceği kararlar", "Yol ve kararlar");
  s.addChart(pres.ChartType.bar, [{ name: "Açık karar", labels: ["Alan uzmanı", "Raporlama uzmanı", "Ürün sahibi", "Hukuk / güvenlik", "İK / yönetim / içerik"], values: [3, 3, 2, 3, 3] }], {
    ...CHART_BASE, x: M, y: 1.5, w: 5.0, h: 4.6, barDir: "bar", showValue: true, dataLabelPosition: "outEnd", showTitle: true, title: "Karar kaydındaki 14 açık karar — kimin masasında", valAxisHidden: true, valAxisMaxVal: 4,
  });
  const decs = [
    ["K-02 / K-03", "Pilot sektör profilleri ve NACE düzeyi", "Alan uzmanı"],
    ["K-04 / K-05", "Hesap otoritesi ve gerçek faktör kataloğu (bugünkü katalog kurgusal)", "Alan uzmanı, lisans"],
    ["K-06 / K-07 / K-08", "Ulusal ETS/MRV, CBAM kanıt formatı, TSRS uygulanabilirliği", "Raporlama uzmanı"],
    ["K-09 / K-10", "Green Kaizen için KVKK görüşü; memnuniyet ölçüm yöntemi", "Hukuk, çalışan temsilcisi, İK"],
    ["K-11 / K-12 / K-13", "Gölge karbon fiyatının sahibi; içerik kullanım hakları; veri saklama", "Yönetim, hukuk, güvenlik"],
    ["K-14 / K-15", "Sektör dernekleri ve OSB iş birliği; fon haritası kaynakları", "Ürün sahibi, içerik sorumlusu"],
  ];
  for (let i = 0; i < decs.length; i++) {
    const y = 1.5 + i * 0.8;
    card(s, 5.9, y, 6.8, 0.7, { fill: C.background1 });
    text(s, decs[i][0], { x: 6.1, y: y + 0.12, w: 1.6, h: 0.5, fontSize: 12, bold: true, color: C.accent1 });
    text(s, decs[i][1], { x: 7.6, y: y + 0.08, w: 3.15, h: 0.6, fontSize: 11 });
    text(s, decs[i][2], { x: 10.85, y: y + 0.08, w: 1.75, h: 0.6, fontSize: 10, color: C.accent4 });
  }
  text(s, "Uygulama bu kararları beklemeden çalışır; karar girilince ilgili içerik “onaylı” olur.", { x: 5.9, y: 6.35, w: 6.8, h: 0.4, fontSize: 12, italic: true, color: C.accent2 });
  s.addNotes("Kararlar (2 dk): toplantının karar maddesi bu slayt. Her karar için sahip ve tarih isteyin.");

  // ===== 22. Kapanış =====
  s = pres.addSlide({ masterName: "KAPANIS", sectionTitle: "Yol ve kararlar" });
  s.addText("Sizden istediklerimiz", { placeholder: "title" });
  s.addText([
    { text: "Pilot için üç sektör profilinin alan uzmanı onayı (K-02) ve gerçek faktör kataloğu kaynağı (K-05)", options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } },
    { text: "Altın senaryoların uzman imzası: referans sonuç, yöntem kaynağı, tolerans", options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } },
    { text: "Regülasyon paketleri için resmî metin sahipleri (K-06, K-07, K-08)", options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } },
    { text: "Bir pilot kurum: yeni başlayan bir çalışanın yardımsız ilk taslağı — pilot kapısının ilk provası", options: { bullet: true } },
  ], { placeholder: "body" });
  card(s, M, 5.4, 12.1, 1.3, { fill: "1F2E29", line: "2C3F38" });
  text(s, "Canlı önizleme: ecloudtechnology.github.io/koza   ·   Depo: github.com/ecloudtechnology/koza   ·   Ekip çalışma dosyası: tüm belgeler tek dosyada", { x: M + 0.3, y: 5.55, w: 11.5, h: 0.5, fontSize: 14, color: H.accent3 });
  text(s, "Muhammet Polat · Enes Koç · Çağla Kumru · Elif Sarıkaş · Havva Dönmez · Mısra Toprak · Okan Yılmaz · Zeynep Esmer  —  Mentor: Onur Dedeoğlu", { x: M + 0.3, y: 6.1, w: 11.5, h: 0.45, fontSize: 12, color: H.accent5 });
  s.addNotes("Kapanış (1 dk): dört somut istek; soru-cevaba geçin.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("yazıldı:", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
