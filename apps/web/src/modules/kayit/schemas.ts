// Kayıt türü şemaları — VERİ olarak (kural 5: sektör kod değil veridir; burada da kategori kod dalı değil tablodur).
// Her kaynak türü / Kapsam 3 kategorisi için: alanlar (§12–§15 tabloları), birim seçenekleri, zorunluluk,
// "bilmiyorum" desteği, "neden bu kapsam?" yardımı, kanıt beklentisi, izinli yöntemler (CONTRACT-v0.2 SUPPORTED)
// ve kayıt sürümünden motor isteğinin nasıl kurulduğu (buildRequest). Sayı üretilmez; yalnız istek kurulur.

import { SCOPE3_CATEGORIES, SCOPE_OF_SOURCE, type ActivityRecordVersion, type CalcResult, type EmissionSource, type SourceType } from "@/lib/domain";
import type { TestFactor } from "@/lib/content";

export const DETAIL_SCHEMA_VERSION = "kayit.detail/0.2.0";

// ---------- Birimler (CONTRACT 0.1 §Birimler + 0.2 §2) ----------
export type UnitFamily = "energy" | "volume_gas" | "mass" | "volume_liquid" | "distance" | "mass_distance" | "passenger_distance" | "money" | "count";

export const UNIT_FAMILY: Record<string, UnitFamily> = {
  MJ: "energy", GJ: "energy", kWh: "energy", MWh: "energy",
  m3: "volume_gas", Nm3: "volume_gas", Sm3: "volume_gas",
  kg: "mass", t: "mass",
  L: "volume_liquid", m3_liquid: "volume_liquid",
  km: "distance", "t.km": "mass_distance", "kg.km": "mass_distance", "p.km": "passenger_distance",
  TRY: "money", EUR: "money", USD: "money",
  unit: "count",
};
export function unitFamily(unit: string | null | undefined): UnitFamily | null {
  if (!unit) return null;
  return UNIT_FAMILY[unit] ?? null;
}

export interface Option {
  value: string;
  label: string;
}
const U = {
  energy: [
    { value: "GJ", label: "GJ (gigajul) — faturada enerji" },
    { value: "MWh", label: "MWh — faturada enerji" },
    { value: "kWh", label: "kWh — faturada enerji" },
  ],
  gas: [
    { value: "Sm3", label: "Sm³ — standart metreküp (15 °C)" },
    { value: "Nm3", label: "Nm³ — normal metreküp (0 °C)" },
    { value: "m3", label: "m³ — koşulu belirtilmemiş hacim" },
  ],
  liquid: [
    { value: "L", label: "litre" },
    { value: "m3_liquid", label: "m³ (sıvı, 1000 L)" },
  ],
  mass: [
    { value: "kg", label: "kg" },
    { value: "t", label: "ton" },
  ],
  distance: [{ value: "km", label: "km" }],
  massDistance: [
    { value: "t.km", label: "ton·km" },
    { value: "kg.km", label: "kg·km" },
  ],
  pkm: [{ value: "p.km", label: "yolcu·km" }],
  money: [
    { value: "TRY", label: "TRY (₺)" },
    { value: "EUR", label: "EUR (€)" },
    { value: "USD", label: "USD ($)" },
  ],
  count: [{ value: "unit", label: "adet" }],
} satisfies Record<string, Option[]>;

// ---------- Alan tanımı ----------
export type FieldKind = "text" | "decimal" | "integer" | "year" | "date" | "select" | "boolean";
export interface FieldSpec {
  key: string; // detail içindeki nokta yolu: "refrigerant.gas", "scope3.spend.currency"
  label: string;
  kind: FieldKind;
  required: boolean;
  unknown_allowed: boolean; // "bilmiyorum" → null + görev
  help?: string;
  options?: Option[];
  group: string;
  show_if?: { key: string; in: string[] } | null;
  placeholder?: string;
}
const f = (key: string, label: string, kind: FieldKind, group: string, o: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind, group, required: false, unknown_allowed: false, show_if: null, ...o });

// Kapsam 3 yöntemleri (CONTRACT-v0.2 §9 SUPPORTED ile aynı; test bunu doğrular)
export const SCOPE3_METHODS: Record<number, string[]> = {
  1: ["supplier_specific", "hybrid", "average_data", "spend_based"],
  2: ["supplier_specific", "hybrid", "average_data", "spend_based"],
  3: ["average_data"],
  4: ["distance_based", "fuel_based", "spend_based"],
  5: ["waste_type_specific", "average_data"],
  6: ["distance_based", "spend_based"],
  7: ["distance_based", "average_data"],
  8: ["average_data"],
  9: ["distance_based"],
  10: ["average_data"],
  11: ["lifetime_use"],
  12: ["waste_type_specific"],
  13: ["average_data"],
  14: ["average_data"],
  15: ["investment_specific"],
};
export const SUPPORTED_METHODS: Record<string, string[] | Record<string, string[]>> = {
  stationary_combustion: ["activity_x_factor"],
  mobile_combustion: ["fuel_based"],
  process: ["activity_x_factor"],
  refrigerant: ["mass_balance"],
  purchased_electricity: ["location_based", "market_based"],
  purchased_steam: ["location_based", "market_based"],
  purchased_heat: ["location_based", "market_based"],
  purchased_cooling: ["location_based", "market_based"],
  scope3: Object.fromEntries(Object.entries(SCOPE3_METHODS).map(([k, v]) => [k, v])),
  product_process: ["activity_x_factor"],
};
export const METHOD_LABEL: Record<string, string> = {
  activity_x_factor: "Faaliyet miktarı × faktör",
  fuel_based: "Yakıt bazlı (litre/kg × faktör)",
  mass_balance: "Kütle dengesi (dolum/kaçak × GWP)",
  location_based: "Konum bazlı (şebeke ortalaması)",
  market_based: "Piyasa bazlı (sözleşmesel araçlar)",
  both: "Her ikisi (konum ve piyasa — ayrı sonuçlar)",
  supplier_specific: "Tedarikçiye özgü veri",
  hybrid: "Hibrit (tedarikçi + ortalama)",
  average_data: "Ortalama veri (fiziksel miktar × ortalama faktör)",
  spend_based: "Harcama bazlı (tutar × sektör faktörü — tahmini)",
  distance_based: "Mesafe bazlı",
  waste_type_specific: "Atık türüne özgü",
  lifetime_use: "Ömür boyu kullanım (satış yılı × ömür × yıllık kullanım)",
  investment_specific: "Yatırıma özgü",
};
export const MTH_STEPS: { id: string; label: string }[] = [
  { id: "MTH-01", label: "Uygulanabilir kategori ve minimum sınırı belirledim" },
  { id: "MTH-02", label: "Kullanılabilir birincil ve ikincil veriyi listeledim" },
  { id: "MTH-03", label: "Bu kategoride izin verilen yöntemleri değerlendirdim" },
  { id: "MTH-04", label: "Seçim gerekçesini ve alternatifleri kaydettim" },
  { id: "MTH-05", label: "Kalite kontrolü ve uzman onayı sonrası yöntem etkinleşir (onay akışı)" },
];
export const DQ_DIMS: { key: string; label: string; help: string }[] = [
  { key: "technology", label: "Teknoloji", help: "Faktör, kullanılan teknoloji/prosesle ne kadar örtüşüyor?" },
  { key: "geography", label: "Coğrafya", help: "Faktörün coğrafyası faaliyetin coğrafyasıyla örtüşüyor mu?" },
  { key: "time", label: "Zaman", help: "Faktörün yılı faaliyet yılına ne kadar yakın?" },
  { key: "completeness", label: "Tamlık", help: "Veri, faaliyetin tamamını kapsıyor mu (örneklem/eksik)?" },
  { key: "reliability", label: "Güvenilirlik", help: "Veri ölçülmüş mü, belgeli mi, tahmin mi?" },
];
export const DQ_SCALE: Option[] = [
  { value: "1", label: "1 — çok iyi" },
  { value: "2", label: "2 — iyi" },
  { value: "3", label: "3 — orta" },
  { value: "4", label: "4 — zayıf" },
  { value: "5", label: "5 — çok zayıf" },
];
export const REFRIGERANT_GASES: Option[] = [
  { value: "R-134a", label: "R-134a" },
  { value: "R-410A", label: "R-410A (karışım)" },
  { value: "R-32", label: "R-32" },
  { value: "R-404A", label: "R-404A (karışım)" },
  { value: "R-407C", label: "R-407C (karışım)" },
  { value: "R-22", label: "R-22" },
  { value: "other", label: "Başka (kodu yaz)" },
  { value: "unknown", label: "Bilmiyorum (hesap bekler)" },
];
export const CHARGE_TYPES: Option[] = [
  { value: "new_equipment_fill", label: "Yeni ekipman dolumu (sızıntı değil; emisyon sayılmaz)" },
  { value: "top_up", label: "Ekleme / kaçak telafisi (emisyon = eklenen × GWP, inceleme)" },
  { value: "leak_measured", label: "Kaçak ölçümü (ölçülen kayıp × GWP)" },
  { value: "recovered", label: "Geri kazanım (envantere emisyon yazılmaz)" },
  { value: "disposal", label: "Bertaraf / imha" },
];
export const INSTRUMENT_TYPES: Option[] = [
  { value: "guarantee_of_origin", label: "Menşe garantisi / yenilenebilir enerji sertifikası" },
  { value: "ppa", label: "Elektrik alım sözleşmesi (PPA)" },
  { value: "supplier_specific", label: "Tedarikçiye özgü ürün/faktör" },
  { value: "residual_mix", label: "Artık karışım" },
];
export const FUELS: Record<string, Option[]> = {
  stationary_combustion: [
    { value: "natural_gas", label: "Doğal gaz" },
    { value: "diesel", label: "Motorin (jeneratör)" },
    { value: "lpg", label: "LPG" },
    { value: "coal", label: "Kömür" },
    { value: "fuel_oil", label: "Fuel oil" },
    { value: "biomass", label: "Biyokütle (biyojenik CO₂ ayrı tutulur)" },
  ],
  mobile_combustion: [
    { value: "diesel", label: "Motorin" },
    { value: "gasoline", label: "Benzin" },
    { value: "lpg", label: "LPG" },
    { value: "natural_gas", label: "CNG / doğal gaz" },
  ],
};

export type SchemaKey = Exclude<SourceType, "scope3" | "purchased_goods" | "other"> | `scope3:${number}`;

export interface RecordSchema {
  key: SchemaKey;
  title: string;
  scope: 0 | 1 | 2 | 3;
  category: number | null;
  source_types: SourceType[]; // kaynak envanterinde hangi türler bu şemayla kaydedilir
  engine_source_type: string; // activity.source_type
  why_scope: string; // "Neden bu kapsam?"
  units: Option[];
  quantity_label: string;
  evidence: string[]; // beklenen kanıtlar
  methods: string[]; // CONTRACT-v0.2 SUPPORTED
  fields: FieldSpec[];
  controls: string[]; // §12–§15 "başlıca kontrol"
  requirement_ids: string[];
  owner_hint: string | null;
}

// Kapsam 3 kategori tabloları (§14, §15): toplanacak veri → alanlar; başlıca kontrol → uyarı metni
interface Cat {
  n: number;
  why: string;
  units: Option[];
  quantity_label: string;
  evidence: string[];
  fields: FieldSpec[];
  controls: string[];
}
const txt = (key: string, label: string, help?: string, required = false) => f(`scope3.data.${key}`, label, "text", "Kategori verisi", { help, required, unknown_allowed: required });
const dec = (key: string, label: string, help?: string) => f(`scope3.data.${key}`, label, "decimal", "Kategori verisi", { help, unknown_allowed: true });
const CATS: Cat[] = [
  { n: 1, why: "Kurumun satın aldığı mal ve hizmetlerin üretimi tedarikçide olur; dolaylı, üst aşama (Kapsam 3 kat. 1).", units: [...U.mass, ...U.count, ...U.money], quantity_label: "Miktar (kütle/adet) veya tutar", evidence: ["Satın alma faturası / sipariş", "Tedarikçi ürün faktörü (sınır ve yıl ile)"], fields: [txt("item", "Malzeme / hizmet", "Ne satın alındı? Ürün faktörü bu kaleme bağlanır.", true), txt("supplier", "Tedarikçi"), txt("factor_boundary_note", "Ürün faktörü sınırı (tedarikçi beyanı)", "Beşikten kapıya mı, kapıdan kapıya mı? Kapıdan kapıya ise üst aşama eksik kalır (T08).")], controls: ["Üst aşama sınırı: kapıdan kapıya faktör tam ürün ayak izi değildir (T08).", "Harcama ve miktar aynı alımı iki kez saymamalı; aynı işlem için tek yöntem."] },
  { n: 2, why: "Makine, yapı ve ekipman alımı üretim aşamasında emisyon doğurur; alım yılında tamamı sayılır (amortismanla yayılmaz).", units: [...U.mass, ...U.count, ...U.money], quantity_label: "Miktar veya tutar", evidence: ["Yatırım faturası", "Üretici ürün verisi"], fields: [txt("asset", "Makine / yapı / ekipman", undefined, true), txt("purchase_class", "Satın alma sınıfı", "Sermaye malı mı, işletme gideri mi? Kategori 1 ile çift sayım incelenir."), txt("production_data", "Üretim verisi (varsa)")], controls: ["Emisyon muhasebe amortismanıyla yıllara yayılmaz.", "Hem kategori 1 hem 2'ye atanan kayıt inceleme gerektirir (§14)."] },
  { n: 3, why: "Kapsam 1–2'de yakılan yakıt ve tüketilen elektriğin üretim/iletim üst aşamaları ve şebeke kayıpları.", units: [...U.energy, ...U.gas, ...U.liquid, ...U.mass], quantity_label: "Bağlı Kapsam 1–2 faaliyet miktarı", evidence: ["İlgili Kapsam 1–2 kaydı", "Üst aşama / kayıp faktörü kaynağı"], fields: [txt("linked_record_id", "Bağlı Kapsam 1–2 kaydı (kimlik)", "Hangi yakıt/elektrik kaydının üst aşaması?"), txt("fuel", "Yakıt / enerji türü", undefined, true)], controls: ["Yanma/üretim ve kayıplar mükerrer sayılmaz; yanma sonucu ile üst aşama ayrı sonuçlardır (§12)."] },
  { n: 4, why: "Kurumun satın aldığı gelen taşıma ve dağıtım hizmeti (hizmet ilişkisine göre sınıflanır).", units: [...U.massDistance, ...U.distance, ...U.liquid, ...U.money], quantity_label: "Ton·km, mesafe, yakıt veya tutar", evidence: ["Sevkiyat irsaliyesi / nakliye faturası", "Taşıyıcı raporu"], fields: [txt("buyer", "Hizmeti satın alan", "Hizmeti kurum satın aldıysa kat. 4; müşteri satın aldıysa kat. 9.", true), txt("shipment", "Sevkiyat tanımı"), dec("mass_t", "Kütle (t)"), dec("distance_km", "Mesafe (km)"), txt("vehicle", "Araç / mod"), txt("warehouse", "Depo (varsa)")], controls: ["Gelen/giden etiketi yerine hizmet ilişkisine göre sınıflandırılır (kat. 4 ↔ 9)."] },
  { n: 5, why: "Operasyonlardan çıkan atığın üçüncü tarafta işlenmesi (satılan ürün ömür sonu değil).", units: [...U.mass], quantity_label: "Atık kütlesi", evidence: ["Atık beyan formu / taşıma belgesi", "İşletmeci faturası"], fields: [txt("waste_type", "Atık türü", undefined, true), txt("treatment", "İşleme yolu (düzenli depolama, yakma, geri dönüşüm…)", "'Geri dönüşüm' seçimi sonucu otomatik negatif yapmaz (§14).", true), txt("operator", "İşletmeci")], controls: ["Oluşan atık ile satılan ürün ömür sonu (kat. 12) ayrılır.", "Geri dönüşüm otomatik negatif sonuç üretmez."] },
  { n: 6, why: "Çalışanların iş amaçlı seyahati üçüncü taraf araçlarla (şirket araçları Kapsam 1'dir).", units: [...U.pkm, ...U.distance, ...U.money], quantity_label: "Yolcu·km, mesafe veya tutar", evidence: ["Bilet / seyahat acentesi raporu", "Konaklama faturası (ayrı)"], fields: [txt("mode", "Ulaşım (uçak, tren, otobüs, kiralık araç)", undefined, true), txt("route", "Rota"), txt("class", "Sınıf (ekonomi/business)"), dec("passengers", "Yolcu sayısı"), txt("lodging_note", "Konaklama (ayrı kayıt)")], controls: ["Şirket araçları Kapsam 1 ile tekrar sayılmaz."] },
  { n: 7, why: "Çalışanların ev-iş yolculuğu; genelde anket/örneklemle tahmin edilir.", units: [...U.pkm, ...U.distance], quantity_label: "Yolcu·km veya mesafe", evidence: ["Anket özeti (örneklem, yanıt oranı)", "İK çalışan sayısı"], fields: [txt("mode", "Ulaşım", undefined, true), dec("working_days", "Çalışma günü"), dec("occupancy", "Doluluk (kişi/araç)"), txt("sample", "Örneklem (kapsanan nüfus, ağırlık)", "Anket yanıtı vermeyen çalışan otomatik sıfır kabul edilmez (§14).")], controls: ["Anketin kapsadığı nüfus, ağırlık ve varsayımlar kaydedilir.", "Yanıt vermeyen çalışan otomatik sıfır değildir."] },
  { n: 8, why: "Kiracı olunan varlıkların enerjisi, seçilen sınırda Kapsam 1–2'ye girmiyorsa kat. 8.", units: [...U.energy], quantity_label: "Enerji", evidence: ["Kira sözleşmesi", "Enerji faturası / paylaşım tablosu"], fields: [txt("asset", "Kiralanan varlık", undefined, true), dec("share", "Pay (oran)"), txt("boundary_note", "Seçilen sınırda Kapsam 1–2'ye dahil mi?")], controls: ["Seçilen sınırda Kapsam 1–2'ye dahil olup olmadığı kontrol edilir."] },
  { n: 9, why: "Satış sonrası, müşterinin veya üçüncü tarafın ödediği taşıma/depolama.", units: [...U.massDistance, ...U.distance], quantity_label: "Ton·km veya mesafe", evidence: ["Sevkiyat kaydı", "Müşteri/taşıyıcı verisi"], fields: [txt("service_relation", "Hizmet ilişkisi (kim ödüyor?)", "Kurum ödüyorsa kat. 4'tür.", true), dec("mass_t", "Kütle (t)"), dec("distance_km", "Mesafe (km)"), txt("warehouse", "Depo")], controls: ["Kategori 4 ile sınır; şirketçe satın alınan hizmetin doğru yeri."] },
  { n: 10, why: "Satılan ara ürünün müşteride işlenmesi.", units: [...U.mass, ...U.count], quantity_label: "Ara ürün miktarı", evidence: ["Satış kaydı", "Müşteri proses senaryosu"], fields: [txt("intermediate_product", "Ara ürün", undefined, true), txt("customer_process", "Müşteri prosesi"), txt("energy_scenario", "Enerji / işleme senaryosu")], controls: ["Nihai ürün ile ara ürün ayrımı."] },
  { n: 11, why: "Dönemde satılan ürünlerin ömür boyu kullanımı; satış yılında toplam olarak sayılır, her yıl tekrar eklenmez (T12).", units: [...U.count], quantity_label: "Satış adedi", evidence: ["Satış raporu", "Kullanım senaryosu (ömür, yıllık tüketim, coğrafya) kaynağı"], fields: [txt("product", "Ürün / satış grubu adı", undefined, true), txt("geography", "Kullanım coğrafyası"), txt("usage_pattern", "Kullanım sıklığı")], controls: ["Satış yılı ve gerçekleşme yılları ayrı tutulur; senaryo sürümlenir (§15).", "Aynı satış grubu sonraki yıl yeniden envantere eklenmez (T12)."] },
  { n: 12, why: "Satılan ürün ve ambalajının ömür sonu işlenmesi (operasyon atığı değil).", units: [...U.mass], quantity_label: "Ürün/ambalaj kütlesi", evidence: ["Ürün ve ambalaj kütle listesi", "Ömür sonu senaryo kaynağı"], fields: [txt("material", "Malzeme", undefined, true), txt("country", "Ülke"), txt("scenario", "İşleme senaryosu (oranlar)", "Senaryo oranlarının toplamı uygun olmalı (§15).")], controls: ["Operasyon atıklarıyla ayrım; senaryo oranlarının toplamı."] },
  { n: 13, why: "Kiraya verilen varlıkların kiracıdaki kullanımı/enerjisi (Kapsam 1–2 ile çakışma kontrolü).", units: [...U.energy], quantity_label: "Enerji", evidence: ["Kira sözleşmesi", "Kiracı enerji verisi"], fields: [txt("asset", "Kiraya verilen varlık", undefined, true), dec("attribution_share", "Atıf payı (oran)")], controls: ["Kapsam 1–2 ile çakışma; atıf payı."] },
  { n: 14, why: "Franchise işletmelerinin Kapsam 1–2 emisyonları.", units: [...U.energy, ...U.liquid], quantity_label: "Enerji / yakıt", evidence: ["Franchise sözleşmesi", "İşletme enerji verisi"], fields: [txt("operation", "İşletme", undefined, true), txt("boundary_relation", "Sınır ilişkisi")], controls: ["Franchise dışındaki ticari ilişki yanlış sınıflanmamalı; franchise vermeyen kurumda gerekçeli 'uygulanamaz'."] },
  { n: 15, why: "Yatırımların (özkaynak, borç, proje finansmanı) atfedilen emisyonları; varlık sınıfına özgü yöntem.", units: [...U.money], quantity_label: "Finansal payda / yatırım tutarı", evidence: ["Yatırım listesi", "Karşı taraf emisyon verisi ve pay/payda tanımı"], fields: [txt("investment_class", "Yatırım sınıfı (özkaynak/borç/proje)", "Aynı formülle genellenmez; alan uzmanı belirler (§15).", true), txt("counterparty", "Karşı taraf"), dec("attribution_share", "Atıf payı (oran)"), txt("data_year", "Veri yılı")], controls: ["Aynı yatırım konsolidasyon ve kat. 15 altında tekrar sayılmaz.", "Varlık sınıfına özgü yöntem ve konsolidasyon."] },
];

const scope3Common = (n: number): FieldSpec[] => [
  f("scope3.applicability", "Uygulanabilirlik", "select", "Kategori ve yöntem", {
    required: true,
    options: [
      { value: "applicable", label: "Uygulanabilir" },
      { value: "not_applicable", label: "Uygulanamaz (gerekçe zorunlu)" },
      { value: "unknown", label: "Bilinmiyor (veri eksik ≠ uygulanamaz)" },
    ],
    help: "Veri eksikliği uygulanamazlık değildir; eksik veri 'bilinmiyor' kalır ve sıfır atanmaz (T10).",
  }),
  f("scope3.not_applicable_reason", "Uygulanamaz gerekçesi", "text", "Kategori ve yöntem", { show_if: { key: "scope3.applicability", in: ["not_applicable"] }, required: true }),
  f("scope3.method", "Yöntem", "select", "Kategori ve yöntem", { required: true, options: SCOPE3_METHODS[n].map((m) => ({ value: m, label: METHOD_LABEL[m] ?? m })), help: "Yalnız bu kategori için motorun desteklediği yöntemler listelenir (§30 matrisi)." }),
  f("scope3.method_rationale", "Yöntem seçim gerekçesi ve alternatifler (MTH-04)", "text", "Kategori ve yöntem"),
  f("scope3.spend.currency", "Para birimi", "select", "Harcama bazlı", { show_if: { key: "scope3.method", in: ["spend_based"] }, required: true, options: U.money }),
  f("scope3.spend.date", "Harcama tarihi", "date", "Harcama bazlı", { show_if: { key: "scope3.method", in: ["spend_based"] }, required: true }),
  f("scope3.spend.tax_treatment", "Vergilerin ele alınışı", "select", "Harcama bazlı", { show_if: { key: "scope3.method", in: ["spend_based"] }, required: true, options: [{ value: "excl_vat", label: "KDV hariç" }, { value: "incl_vat", label: "KDV dahil" }] }),
  f("scope3.spend.sector_class", "Sektör sınıfı (ör. NACE C24)", "text", "Harcama bazlı", { show_if: { key: "scope3.method", in: ["spend_based"] }, required: true }),
  f("scope3.spend.price_year", "Faktör fiyat yılı", "year", "Harcama bazlı", { show_if: { key: "scope3.method", in: ["spend_based"] }, required: true }),
  f("scope3.spend.deflator.value", "Deflatör / kur yaklaşımı (oran)", "decimal", "Harcama bazlı", { show_if: { key: "scope3.method", in: ["spend_based"] }, help: "Kur değişimi fiziksel azalma gibi yorumlanmaz (§16)." }),
  f("scope3.spend.deflator.source_ref", "Deflatör kaynağı", "text", "Harcama bazlı", { show_if: { key: "scope3.method", in: ["spend_based"] } }),
  ...(n === 11
    ? [
        f("scope3.sold_products.sale_year", "Satış yılı", "year", "Ömür boyu kullanım (kat. 11)", { required: true }),
        f("scope3.sold_products.lifetime_years", "Ömür (yıl)", "decimal", "Ömür boyu kullanım (kat. 11)", { required: true, unknown_allowed: true, help: "Gizli varsayılan atanmaz; bilinmiyorsa hesap bekler (DEFAULT_SCENARIO_FORBIDDEN)." }),
        f("scope3.sold_products.annual_use_kwh", "Yıllık kullanım (kWh/adet)", "decimal", "Ömür boyu kullanım (kat. 11)", { required: true, unknown_allowed: true }),
        f("scope3.sold_products.units_sold", "Satış adedi", "integer", "Ömür boyu kullanım (kat. 11)", { required: true }),
        f("scope3.sold_products.group_id", "Satış grubu kimliği", "text", "Ömür boyu kullanım (kat. 11)", { required: true, help: "Aynı grup kimliği sonraki yıl yeniden ömür boyu toplam olarak eklenemez (T12).", placeholder: "ör. grp-2026-A" }),
      ]
    : []),
  ...DQ_DIMS.map((d) => f(`scope3.data_quality_dims.${d.key}`, `Veri kalitesi — ${d.label}`, "select", "Veri kalitesi (1–5, ayrı boyutlar)", { options: DQ_SCALE, help: d.help })),
];

function scope3Schema(c: Cat): RecordSchema {
  const cat = SCOPE3_CATEGORIES.find((x) => x.n === c.n)!;
  return {
    key: `scope3:${c.n}`,
    title: `Kapsam 3 · ${c.n} ${cat.tr}`,
    scope: 3,
    category: c.n,
    source_types: ["scope3", "purchased_goods"],
    engine_source_type: "scope3",
    why_scope: c.why,
    units: c.units,
    quantity_label: c.quantity_label,
    evidence: c.evidence,
    methods: SCOPE3_METHODS[c.n],
    fields: [...scope3Common(c.n), ...c.fields],
    controls: c.controls,
    requirement_ids: c.n <= 8 ? ["§14", "T08", "T09", "T10"] : ["§15", "T10", "T12"],
    owner_hint: cat.owner_hint,
  };
}

const combustionFields = (st: "stationary_combustion" | "mobile_combustion"): FieldSpec[] => [
  f("fuel", "Yakıt", "select", "Yakıt", { required: true, unknown_allowed: true, options: FUELS[st] }),
  f("heating_value_basis", "Isıl değer esası", "select", "Enerji esası", { unknown_allowed: true, options: [{ value: "LHV", label: "Alt ısıl değer (LHV / net)" }, { value: "HHV", label: "Üst ısıl değer (HHV / brüt)" }], help: "Faturadaki enerji hangi esasla? Faktörle uyuşmazsa hesap onaya gidemez (T04)." }),
  f("density.value", "Yoğunluk (kg/L)", "decimal", "Dönüşüm", { help: "Kütle↔hacim dönüşümü yalnız yoğunluk kaynağıyla verilirse yapılır (DENSITY_REQUIRED)." }),
  f("density.source_ref", "Yoğunluk kaynağı", "text", "Dönüşüm"),
];

export const SCHEMAS: RecordSchema[] = [
  {
    key: "stationary_combustion",
    title: "Sabit yakma (kazan, fırın, jeneratör)",
    scope: 1,
    category: null,
    source_types: ["stationary_combustion"],
    engine_source_type: "stationary_combustion",
    why_scope: "Yakıt kurumun kontrolündeki ekipmanda yakılıyor; doğrudan emisyon (Kapsam 1, §12).",
    units: [...U.energy, ...U.gas, ...U.liquid, ...U.mass],
    quantity_label: "Miktar (faturadaki tüketim)",
    evidence: ["Yakıt faturası (dönem, miktar, birim, ısıl değer)", "Sayaç okuması (fatura ile toplanmaz — §12)"],
    methods: ["activity_x_factor"],
    fields: [
      ...combustionFields("stationary_combustion"),
      f("stock.mode", "Veri kaynağı: fatura mı sayaç mı?", "select", "Stok / sayaç", { options: [{ value: "invoice", label: "Fatura (alım)" }, { value: "meter", label: "Sayaç (tüketim)" }, { value: "stock_balance", label: "Stok dengesi (açılış + alım − kapanış)" }], help: "Yakıt alımı ile tüketimi stok değişimi nedeniyle farklı olabilir; aynı ekipmanda sayaç ve fatura toplanmaz (§12)." }),
      f("stock.opening", "Açılış stoku", "decimal", "Stok / sayaç", { show_if: { key: "stock.mode", in: ["stock_balance"] } }),
      f("stock.closing", "Kapanış stoku", "decimal", "Stok / sayaç", { show_if: { key: "stock.mode", in: ["stock_balance"] } }),
      f("biogenic", "Biyojenik yakıt mı?", "boolean", "Stok / sayaç", { help: "Biyojenik CO₂ ayrı tutulur; diğer sera gazları hesapta kalır (§12)." }),
    ],
    controls: ["m³, Sm³, Nm³ referans koşulu olmadan eşitlenmez (T03).", "Alt/üst ısıl değer esası ayrı alandır (T04).", "Faturada enerji varsa çift dönüşüm yapılmaz."],
    requirement_ids: ["§12", "T01", "T02", "T03", "T04", "T07", "T20"],
    owner_hint: "Teknik / enerji",
  },
  {
    key: "mobile_combustion",
    title: "Araç ve mobil ekipman",
    scope: 1,
    category: null,
    source_types: ["mobile_combustion"],
    engine_source_type: "mobile_combustion",
    why_scope: "Kurumun sahip olduğu veya kontrol ettiği araçlarda yakılan yakıt doğrudan emisyondur (Kapsam 1). Üçüncü taraf taşıma Kapsam 3'tür.",
    units: [...U.liquid, ...U.mass, ...U.energy],
    quantity_label: "Yakıt miktarı",
    evidence: ["Yakıt fişi / filo kartı raporu", "Araç listesi (kontrol ilişkisi)"],
    methods: ["fuel_based"],
    fields: [
      ...combustionFields("mobile_combustion"),
      f("vehicle_class", "Araç sınıfı", "text", "Araç", { placeholder: "ör. hafif ticari, forklift", help: "Bilgi amaçlı; faktör yakıt bazlıdır." }),
      f("control", "Kontrol ilişkisi", "select", "Araç", { required: true, options: [{ value: "owned", label: "Kurumun aracı" }, { value: "leased", label: "Kiralık (operasyonel kontrol kurumda)" }, { value: "third_party", label: "Üçüncü taraf (Kapsam 3'e yönlendirilir)" }] }),
      f("distance_km", "Mesafe (km, varsa)", "decimal", "Araç", { help: "Yakıt miktarı yoksa mesafe + araç özellikleri ile tahmin ayrı yöntemdir." }),
    ],
    controls: ["Üçüncü taraf araçlar Kapsam 1 sayılmaz (kat. 4/6/9).", "Litre ↔ kg dönüşümü yoğunluk kaynağı ister."],
    requirement_ids: ["§12"],
    owner_hint: "Filo / idari işler",
  },
  {
    key: "process",
    title: "Proses emisyonu",
    scope: 1,
    category: null,
    source_types: ["process"],
    engine_source_type: "process",
    why_scope: "Kimyasal/fiziksel dönüşümden (ör. klinker, kireç) kaynaklanan doğrudan emisyon; yakıt yakma değildir (Kapsam 1).",
    units: [...U.mass],
    quantity_label: "Üretim / hammadde miktarı",
    evidence: ["Üretim raporu", "Reaksiyon/bileşim verisi veya ölçüm raporu"],
    methods: ["activity_x_factor"],
    fields: [f("process_id", "Proses", "text", "Proses", { required: true, unknown_allowed: true, placeholder: "ör. klinker-uretimi", help: "Proses tanımlanmadan faktör eşleşmez (PROCESS_ID_REQUIRED)." }), f("product_or_feedstock", "Ürün / hammadde", "text", "Proses"), f("measurement.device", "Doğrudan ölçüm cihazı (varsa)", "text", "Ölçüm", { help: "Doğrudan ölçümde cihaz, kalibrasyon ve kapsama bilgisi tutulur (§12)." }), f("measurement.calibration", "Kalibrasyon bilgisi", "text", "Ölçüm")],
    controls: ["Reaksiyon, bileşim, kütle dengesi veya ölçüm yönteme bağlı veridir."],
    requirement_ids: ["§12"],
    owner_hint: "Üretim / proses",
  },
  {
    key: "refrigerant",
    title: "Soğutucu gaz (kaçak emisyon)",
    scope: 1,
    category: null,
    source_types: ["refrigerant"],
    engine_source_type: "refrigerant",
    why_scope: "Kurumun ekipmanından sızan soğutucu gaz doğrudan emisyondur (Kapsam 1 kaçak). Yeni dolum sızıntı değildir; ekleme kaçak telafisi varsayımıyla sayılır (§12).",
    units: [...U.mass],
    quantity_label: "Gaz miktarı",
    evidence: ["Servis / bakım formu (dolum, geri kazanım)", "Ekipman etiketi (gaz türü, şarj)"],
    methods: ["mass_balance"],
    fields: [
      f("refrigerant.gas", "Gaz türü", "select", "Soğutucu", { required: true, options: REFRIGERANT_GASES, help: "Gaz türü bilinmeyen kayıt hesap bekler; karışım için GWP tanımı gerekir (§12 kabul koşulu)." }),
      f("refrigerant.gas_other", "Gaz kodu", "text", "Soğutucu", { show_if: { key: "refrigerant.gas", in: ["other"] }, required: true, placeholder: "ör. R-507A" }),
      f("refrigerant.charge_type", "İşlem türü", "select", "Soğutucu", { required: true, options: CHARGE_TYPES }),
      f("refrigerant.equipment_in_inventory", "Ekipman kaynak envanterinde mi?", "boolean", "Soğutucu", { required: true, help: "Envanter dışındaysa Kapsam 1 ataması yapılmadan ilişki yeniden değerlendirilir (EQUIPMENT_NOT_IN_INVENTORY)." }),
      f("refrigerant.equipment", "Ekipman adı / etiketi", "text", "Soğutucu"),
      f("refrigerant.stock_kg", "Ekipman şarjı (kg, bilgi)", "decimal", "Soğutucu"),
    ],
    controls: ["Yeni dolum ≠ sızıntı (T11).", "Geri kazanım envantere emisyon yazmaz.", "Gaz türü 'bilmiyorum' → hesap bekler."],
    requirement_ids: ["§12", "T11"],
    owner_hint: "Teknik / bakım",
  },
  ...(["purchased_electricity", "purchased_steam", "purchased_heat", "purchased_cooling"] as const).map(
    (st): RecordSchema => ({
      key: st,
      title: st === "purchased_electricity" ? "Satın alınan elektrik" : st === "purchased_steam" ? "Satın alınan buhar" : st === "purchased_heat" ? "Satın alınan ısı" : "Satın alınan soğutma",
      scope: 2,
      category: null,
      source_types: [st],
      engine_source_type: st,
      why_scope: "Enerji dışarıda üretilip satın alınıyor; emisyon üreticide oluşur, tüketen kurum Kapsam 2'de raporlar (§13). Konum ve piyasa bazlı sonuçlar aynı tüketimin iki görünümüdür; toplanmaz.",
      units: [...U.energy, ...(st === "purchased_electricity" ? [] : [{ value: "GJ", label: "GJ" }])].filter((u, i, a) => a.findIndex((x) => x.value === u.value) === i),
      quantity_label: "Tüketim (faturadaki enerji)",
      evidence: ["Enerji faturası (dönem, kWh/MWh)", "Sözleşmesel araç belgesi (menşe garantisi, PPA) — itfa/iptal kanıtı"],
      methods: ["location_based", "market_based"],
      fields: [
        f("scope2.method", "Hesap görünümü", "select", "Kapsam 2", { required: true, options: [{ value: "location_based", label: METHOD_LABEL.location_based }, { value: "market_based", label: METHOD_LABEL.market_based }, { value: "both", label: METHOD_LABEL.both }], help: "İki sonuç ayrı gösterilir; kurumsal toplamda hangisinin kullanıldığı kayıtta ve manifestte yazılır." }),
        f("scope2.grid_region", "Şebeke bölgesi", "text", "Kapsam 2", { required: true, unknown_allowed: true, placeholder: "TR", help: "Tesisin ülke/şebeke bölgesi konum bazlı faktörü belirler." }),
        f("scope2.self_generation_mwh", "Öz üretim (MWh)", "decimal", "Öz tüketim / satış", { help: "Şirket içi yakıtlı üretim yeniden Kapsam 2'ye eklenmez (§13)." }),
        f("scope2.sold_to_grid_mwh", "Şebekeye satış (MWh)", "decimal", "Öz tüketim / satış", { help: "Satılan enerji brüt emisyondan otomatik düşülmez; yalnız izde görünür." }),
        f("scope2_method_used", "Kurumsal toplamda kullanılacak yöntem", "select", "Kapsam 2", { options: [{ value: "location_based", label: "Konum bazlı" }, { value: "market_based", label: "Piyasa bazlı" }], help: "Rapor manifestinde ve toplamada bu seçim yazılır; iki sonuç toplanmaz. Kayıt sayfasında da değiştirilebilir (yeni sürüm)." }),
        f("scope2.ghgp_version", "Kullanılan GHG Protocol Kapsam 2 rehberi sürümü", "text", "Kapsam 2", { placeholder: "ör. Scope 2 Guidance 2015", help: "Taslak güncelleme üretim kuralı olarak etkinleştirilmez (§13)." }),
      ],
      controls: ["Belge miktarı tüketimi aşamaz (INSTRUMENT_EXCEEDS_CONSUMPTION); motor engeller, arayüz önceden hesaplamaz.", "'Yenilenebilir satın aldım' tek başına sıfır emisyon üretmez; itfa ve kalite koşulları doğrulanır.", "Kalan tüketim hesap dışı bırakılamaz (T06)."],
      requirement_ids: ["§13", "T05", "T06"],
      owner_hint: "Enerji / teknik",
    })
  ),
  {
    key: "product_process",
    title: "Ürün çalışması süreci",
    scope: 0,
    category: null,
    source_types: ["product_process"],
    engine_source_type: "product_process",
    why_scope: "Ürün çalışması kurumsal envanterin yanında ayrı hesap bağlamıdır; sonucu kurumsal toplama eklenmez (§17, kural 8).",
    units: [...U.mass, ...U.energy, ...U.count],
    quantity_label: "Süreç girdisi miktarı",
    evidence: ["Ürün reçetesi / üretim rotası", "Tahsis temeli kaynağı"],
    methods: ["activity_x_factor"],
    fields: [
      f("product.study_id", "Ürün çalışması kimliği", "text", "Ürün çalışması", { required: true }),
      f("product.boundary", "Teknik sınır", "select", "Ürün çalışması", { required: true, options: [{ value: "gate_to_gate", label: "Kapıdan kapıya (yalnız belirli işlemler)" }, { value: "cradle_to_gate", label: "Beşikten kapıya (ham maddeden tesis çıkışına)" }, { value: "cradle_to_grave", label: "Beşikten mezara (kullanım ve ömür sonu dahil)" }, { value: "custom", label: "Özel kısmi sınır (gerekçeli)" }] }),
      f("product.reference_flow.quantity", "Referans akış miktarı", "decimal", "Ürün çalışması", { required: true }),
      f("product.reference_flow.unit", "Referans akış birimi", "select", "Ürün çalışması", { required: true, options: [...U.mass, ...U.count] }),
      f("product.functional_unit", "Fonksiyonel birim (gerekiyorsa)", "text", "Ürün çalışması"),
      f("product.allocation.basis", "Tahsis temeli", "select", "Tahsis", { options: [{ value: "none", label: "Yok" }, { value: "mass", label: "Kütle" }, { value: "energy", label: "Enerji" }, { value: "economic", label: "Ekonomik" }] }),
      f("product.allocation.share", "Tahsis payı (0–1)", "decimal", "Tahsis", { show_if: { key: "product.allocation.basis", in: ["mass", "energy", "economic"] }, required: true }),
      f("product.allocation.source_ref", "Tahsis kaynağı", "text", "Tahsis", { show_if: { key: "product.allocation.basis", in: ["mass", "energy", "economic"] }, required: true }),
    ],
    controls: ["Yalnız karbon hesaplanır: 'ürün karbon ayak izi' / 'kısmi ürün karbon ayak izi'; LCA/EPD iddiası yok.", "Sonuç kurumsal toplama girmez."],
    requirement_ids: ["§17", "REG-03"],
    owner_hint: "Ar-Ge / ürün",
  },
  ...CATS.map(scope3Schema),
];

export const SCHEMA_BY_KEY: Record<string, RecordSchema> = Object.fromEntries(SCHEMAS.map((s) => [s.key, s]));
export function schemaOf(key: string): RecordSchema | undefined {
  return SCHEMA_BY_KEY[key];
}
/** Kaynak ve kayıt ayrıntısından şema: Kapsam 3 kaynağı kategori bilgisini detail.scope3.category'de taşır. */
export function schemaForVersion(source: EmissionSource, detail: Record<string, unknown> | null): RecordSchema | undefined {
  const d = detail ?? {};
  const explicit = typeof d.schema_key === "string" ? SCHEMA_BY_KEY[d.schema_key] : undefined;
  if (explicit) return explicit;
  if (source.source_type === "scope3" || source.source_type === "purchased_goods") {
    const cat = Number(getPath(d, "scope3.category") ?? (source.source_type === "purchased_goods" ? 1 : NaN));
    return SCHEMA_BY_KEY[`scope3:${cat}`];
  }
  return SCHEMA_BY_KEY[source.source_type];
}

// ---------- "Ne kaydetmek istiyorsun?" seçenekleri (§11) ----------
export interface EntryKind {
  id: string;
  label: string;
  description: string;
  schemas: SchemaKey[];
  link: { href: string; label: string } | null;
}
export const ENTRY_KINDS: EntryKind[] = [
  { id: "invoice", label: "Fatura / tüketim", description: "Doğal gaz, yakıt, elektrik, buhar/ısı/soğutma faturası veya sayaç tüketimi.", schemas: ["stationary_combustion", "mobile_combustion", "purchased_electricity", "purchased_steam", "purchased_heat", "purchased_cooling"], link: null },
  { id: "goods", label: "Malzeme / hizmet", description: "Satın alınan mal ve hizmetler (kat. 1) veya sermaye malları (kat. 2).", schemas: ["scope3:1", "scope3:2"], link: null },
  { id: "shipment", label: "Sevkiyat", description: "Gelen taşıma (kat. 4) veya satış sonrası taşıma (kat. 9).", schemas: ["scope3:4", "scope3:9"], link: null },
  { id: "waste", label: "Atık", description: "Operasyon atıkları (kat. 5) veya satılan ürün ömür sonu (kat. 12).", schemas: ["scope3:5", "scope3:12"], link: null },
  { id: "travel", label: "Seyahat", description: "İş seyahatleri (kat. 6).", schemas: ["scope3:6"], link: null },
  { id: "commute", label: "İşe gidiş geliş", description: "Çalışan ulaşımı (kat. 7).", schemas: ["scope3:7"], link: null },
  { id: "refrigerant", label: "Soğutucu", description: "Klima / soğutma ekipmanı gaz dolumu, kaçak, geri kazanım (Kapsam 1 kaçak).", schemas: ["refrigerant"], link: null },
  { id: "process", label: "Proses", description: "Kimyasal/fiziksel dönüşüm emisyonu (Kapsam 1).", schemas: ["process"], link: null },
  { id: "product", label: "Ürün", description: "Ürün çalışması ayrı hesap bağlamıdır; ürün sayfasında kurulur.", schemas: ["product_process"], link: { href: "/urun/", label: "Ürün ve yaşam döngüsü sayfası" } },
  { id: "other", label: "Çalışan / diğer", description: "Kiralanan varlıklar (8), satılan ürün işleme (10), kullanım (11), kiraya verilen (13), franchise (14), yatırım (15). Karbon dışı veri analiz sayfasındadır.", schemas: ["scope3:8", "scope3:10", "scope3:11", "scope3:13", "scope3:14", "scope3:15", "scope3:3"], link: { href: "/analiz/", label: "Karbon dışı veri (analiz sayfası)" } },
];

// ---------- Detail yardımcıları ----------
export function getPath(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) {
    const next = cur[p];
    if (!next || typeof next !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}
export function fieldVisible(spec: FieldSpec, detail: Record<string, unknown>): boolean {
  if (!spec.show_if) return true;
  const v = getPath(detail, spec.show_if.key);
  return spec.show_if.in.includes(String(v ?? ""));
}
function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/** Şemaya göre zorunlu alan kontrolü. unknown_fields: kullanıcının "bilmiyorum" dediği alanlar (null kalır, görev açılır). */
export function validateDetail(schema: RecordSchema, detail: Record<string, unknown>, unknown_fields: string[] = []): { missing: FieldSpec[]; unknown: FieldSpec[] } {
  const missing: FieldSpec[] = [];
  const unknown: FieldSpec[] = [];
  for (const spec of schema.fields) {
    if (!fieldVisible(spec, detail)) continue;
    const v = getPath(detail, spec.key);
    if (unknown_fields.includes(spec.key)) {
      if (spec.unknown_allowed) unknown.push(spec);
      else missing.push(spec);
      continue;
    }
    if (spec.required && isEmpty(v)) missing.push(spec);
  }
  return { missing, unknown };
}

// ---------- Motor isteği (CONTRACT 0.1 + 0.2) ----------
export interface CatalogFactor extends TestFactor {
  // Katalog 0.2 genişletmesi (isteğe bağlı alanlar): kaynak türü, Kapsam 3 kategorisi, Kapsam 2 rolü
  source_type?: string;
  category?: number | null;
  role?: "location" | "market_residual" | string | null;
}
export interface EngineFactor {
  id: string;
  version: string;
  value: string;
  numerator_unit: string;
  gas: string;
  denominator_unit: string;
  basis: string | null;
  reference_conditions: { temperature_c: string; pressure_kpa: string } | null;
  boundary: string;
  gwp_set_id: string | null;
  source_ref: string;
  license: string;
  valid_from: string;
  valid_to: string | null;
  role?: string;
}
// Motor 0.2 (uygulanan biçim): tür-özel bloklar activity İÇİNDE (activity.scope2 / scope3 / refrigerant / product).
export interface EngineRequest {
  activity: Record<string, unknown> & { scope2?: Record<string, unknown>; scope3?: Record<string, unknown>; refrigerant?: Record<string, unknown>; product?: Record<string, unknown> };
  factors: EngineFactor[];
  method: { id: string; version: string; gwp_set: Record<string, string> };
}
export interface Instrument {
  id: string;
  type: string;
  mwh: string;
  generation_period: { start: string; end: string };
  retired: boolean;
  quality_criteria_met: boolean;
  beneficiary: string;
  supplier?: string;
  generation_site?: string;
  serial?: string;
  factor_value?: string; // araç faktörü (kg CO2e/MWh), çoğunlukla "0"
  factor_source_ref?: string;
}

export function toEngineFactor(fc: CatalogFactor, role?: string): EngineFactor {
  const out: EngineFactor = {
    id: fc.id,
    version: fc.version,
    value: fc.value,
    numerator_unit: fc.numerator_unit,
    gas: fc.gas,
    denominator_unit: fc.denominator_unit,
    basis: fc.basis,
    reference_conditions: fc.reference_conditions,
    boundary: fc.boundary,
    gwp_set_id: fc.gwp_set_id,
    source_ref: fc.source_ref,
    license: fc.license,
    valid_from: fc.valid_from,
    valid_to: fc.valid_to,
  };
  const r = role ?? fc.role ?? undefined;
  if (r) out.role = r;
  return out;
}

const str = (v: unknown): string | null => (isEmpty(v) ? null : String(v));

/** Kayıt sürümü + kaynak + seçili faktörler → CONTRACT-v0.2 isteği. Sayı üretmez; yalnız alanları taşır. */
export function buildRequest(input: { record_id: string; version: ActivityRecordVersion; source: EmissionSource; factors: CatalogFactor[]; method: { id: string; version: string; gwp_set: Record<string, string> } }): EngineRequest {
  const { version: v, source } = input;
  const d = v.detail ?? {};
  const schema = schemaForVersion(source, v.detail);
  const source_type = schema?.engine_source_type ?? source.source_type;
  const activity: Record<string, unknown> = {
    id: input.record_id,
    version: v.version,
    source_type,
    fuel: str(getPath(d, "fuel")) ?? source.fuel,
    quantity: v.quantity_state === "known" ? v.quantity : null,
    unit: v.unit ?? "bilinmiyor",
    heating_value_basis: v.heating_value_basis,
    reference_conditions: v.reference_conditions,
    calorific_value: v.calorific_value,
    basis_conversion: v.basis_conversion,
    data_quality: v.data_quality,
    period: { start: v.period_start, end: v.period_end },
  };
  const density = getPath(d, "density") as { value?: unknown; source_ref?: unknown } | undefined;
  if (density && !isEmpty(density.value)) activity.density = { value: String(density.value), unit: "kg/L", source_ref: str(density.source_ref) ?? "" };
  if (source_type === "mobile_combustion") activity.vehicle_class = str(getPath(d, "vehicle_class"));
  if (source_type === "process") activity.process_id = str(getPath(d, "process_id"));

  const req: EngineRequest = { activity, factors: input.factors.map((fc) => toEngineFactor(fc)), method: input.method };

  if (source_type === "refrigerant") {
    const gas = str(getPath(d, "refrigerant.gas"));
    activity.refrigerant = {
      gas: gas === "other" ? (str(getPath(d, "refrigerant.gas_other")) ?? "unknown") : (gas ?? "unknown"),
      charge_type: str(getPath(d, "refrigerant.charge_type")) ?? "top_up",
      equipment_in_inventory: getPath(d, "refrigerant.equipment_in_inventory") === true,
    };
  }
  if (schema?.scope === 2) {
    const location = input.factors.find((fc) => fc.role === "location");
    const residual = input.factors.find((fc) => fc.role === "market_residual");
    const instruments = (getPath(d, "scope2.instruments") as Instrument[] | undefined) ?? [];
    activity.scope2 = {
      method: str(getPath(d, "scope2.method")) ?? "location_based",
      grid_region: str(getPath(d, "scope2.grid_region")),
      instruments: instruments.map((i) => ({
        id: i.id,
        type: i.type,
        mwh: i.mwh,
        generation_period: i.generation_period,
        retired: i.retired,
        quality_criteria_met: i.quality_criteria_met,
        beneficiary: i.beneficiary,
        factor: {
          id: `${i.id}-factor`,
          version: "1",
          value: i.factor_value && i.factor_value !== "" ? i.factor_value : "0",
          numerator_unit: "kg",
          gas: "CO2e",
          denominator_unit: location?.denominator_unit ?? "kWh",
          basis: null,
          reference_conditions: null,
          boundary: location?.boundary ?? "combustion",
          gwp_set_id: null,
          source_ref: i.factor_source_ref || `${i.type} ${i.id}${i.serial ? ` seri ${i.serial}` : ""}`,
          license: "user-provided",
          valid_from: i.generation_period.start,
          valid_to: i.generation_period.end,
        },
      })),
      residual_mix_factor: residual ? toEngineFactor(residual, "market_residual") : null,
      self_generation_mwh: str(getPath(d, "scope2.self_generation_mwh")) ?? "0",
      sold_to_grid_mwh: str(getPath(d, "scope2.sold_to_grid_mwh")) ?? "0",
    };
    // factors[]: yalnız konum rolü (artık karışım activity.scope2.residual_mix_factor içinde; T06 altın örneği)
    req.factors = input.factors.filter((fc) => fc.role === "location").map((fc) => toEngineFactor(fc));
  }
  if (schema?.scope === 3) {
    const dq = getPath(d, "scope3.data_quality_dims") as Record<string, unknown> | undefined;
    const dqOut = dq && Object.values(dq).some((x) => !isEmpty(x)) ? Object.fromEntries(DQ_DIMS.map((k) => [k.key, str(dq[k.key])])) : null;
    const method = str(getPath(d, "scope3.method"));
    const spend = getPath(d, "scope3.spend") as Record<string, unknown> | undefined;
    const spendOut =
      method === "spend_based" && spend
        ? {
            currency: str(spend.currency) ?? v.unit,
            date: str(spend.date),
            tax_treatment: str(spend.tax_treatment),
            sector_class: str(spend.sector_class),
            price_year: str(spend.price_year),
            deflator: !isEmpty(getPath(spend, "deflator.value")) ? { value: String(getPath(spend, "deflator.value")), source_ref: str(getPath(spend, "deflator.source_ref")) ?? "" } : null,
          }
        : null;
    const sp = getPath(d, "scope3.sold_products") as Record<string, unknown> | undefined;
    const spOut = schema.category === 11 && sp ? { sale_year: str(sp.sale_year), lifetime_years: str(sp.lifetime_years), annual_use_kwh: str(sp.annual_use_kwh), units_sold: str(sp.units_sold) ?? (v.quantity_state === "known" ? v.quantity : null), group_id: str(sp.group_id) } : null;
    activity.scope3 = {
      category: schema.category,
      method,
      applicability: str(getPath(d, "scope3.applicability")) ?? (v.quantity_state === "unknown" ? "unknown" : "applicable"),
      not_applicable_reason: str(getPath(d, "scope3.not_applicable_reason")),
      data_quality_dims: dqOut,
      spend: spendOut,
      sold_products: spOut,
    };
  }
  if (source_type === "product_process") {
    const p = (getPath(d, "product") as Record<string, unknown> | undefined) ?? {};
    const alloc = p.allocation as Record<string, unknown> | undefined;
    activity.product = {
      study_id: str(p.study_id),
      boundary: str(p.boundary) ?? "gate_to_gate",
      reference_flow: { quantity: str(getPath(p, "reference_flow.quantity")) ?? "1", unit: str(getPath(p, "reference_flow.unit")) ?? "kg" },
      functional_unit: str(p.functional_unit),
      allocation: alloc && !isEmpty(alloc.basis) && alloc.basis !== "none" ? { basis: String(alloc.basis), share: str(alloc.share), source_ref: str(alloc.source_ref) ?? "" } : null,
    };
  }
  return req;
}

// ---------- Faktör seçenekleri (katalogdan süzme) ----------
/** Kategori başına uygun faktör sınırları (§14–§15 asgari sınır; CONTRACT-v0.2 §5 sınır listesi). Katalog faktörü kategori taşımıyorsa bununla süzülür. */
export const SCOPE3_BOUNDARIES: Record<number, string[]> = {
  1: ["cradle_to_gate", "gate_to_gate", "upstream"],
  2: ["cradle_to_gate", "gate_to_gate", "upstream"],
  3: ["upstream", "well_to_tank"],
  4: ["well_to_wheel", "tank_to_wheel", "well_to_tank"],
  5: ["end_of_life"],
  6: ["well_to_wheel", "tank_to_wheel"],
  7: ["well_to_wheel", "tank_to_wheel"],
  8: ["combustion", "upstream", "well_to_wheel", "cradle_to_gate"],
  9: ["well_to_wheel", "tank_to_wheel", "well_to_tank"],
  10: ["gate_to_gate", "cradle_to_gate"],
  11: ["well_to_wheel", "combustion", "cradle_to_gate"],
  12: ["end_of_life"],
  13: ["combustion", "upstream", "well_to_wheel", "cradle_to_gate"],
  14: ["combustion", "upstream", "well_to_wheel", "cradle_to_gate"],
  15: ["cradle_to_gate", "cradle_to_grave", "upstream"],
};
/** Kapsam 1 şemaları için faktör sınırı: yakma → combustion, proses → process, soğutucu → fugitive. */
export const SCOPE1_BOUNDARY: Record<string, string> = { stationary_combustion: "combustion", mobile_combustion: "combustion", process: "process", refrigerant: "fugitive" };
/** Kaynak türü / kategori / sınır / birim ailesi / yayımlı sürüme göre süzer. Kataloğun kendisi değişmez. */
export function factorOptions(schema: RecordSchema, source: EmissionSource, v: ActivityRecordVersion, catalog: CatalogFactor[], published: (id: string) => string | undefined): CatalogFactor[] {
  const d = v.detail ?? {};
  const fam = unitFamily(v.unit);
  const fuel = str(getPath(d, "fuel")) ?? source.fuel;
  return catalog.filter((fc) => {
    if (published(fc.id) !== fc.version) return false;
    // kaynak türü
    if (fc.source_type) {
      if (fc.source_type !== schema.engine_source_type) return false;
      if (schema.scope === 3 && fc.category != null && fc.category !== schema.category) return false;
      if (schema.scope === 3 && fc.category == null && schema.category && !SCOPE3_BOUNDARIES[schema.category].includes(fc.boundary)) return false; // sınır kategoriye uymuyor
    } else {
      // 0.1 kataloğu: yalnız yakıt eşleşmesiyle yakma; üst aşama faktörü kategori 3'e
      const legacyCombustion = (schema.key === "stationary_combustion" || schema.key === "mobile_combustion") && fc.fuel === (fuel ?? "") && fc.boundary === "combustion";
      const legacyUpstream = schema.key === "scope3:3" && (fc.boundary === "upstream" || fc.boundary === "well_to_tank") && fc.fuel === (str(getPath(d, "scope3.data.fuel")) ?? "");
      if (!legacyCombustion && !legacyUpstream) return false;
    }
    // yakıt
    if (fuel && fc.fuel && schema.scope === 1 && schema.key !== "refrigerant" && fc.fuel !== fuel) return false;
    // soğutucu: gaz eşleşmesi
    if (schema.key === "refrigerant") {
      const gas = str(getPath(d, "refrigerant.gas"));
      const code = gas === "other" ? str(getPath(d, "refrigerant.gas_other")) : gas;
      if (!code || fc.gas !== code) return false;
      return true;
    }
    // birim ailesi: payda ailesi miktar ailesiyle aynı, ya da hacim→enerji dönüşümü için ısıl değer var
    const denomFam = unitFamily(fc.denominator_unit);
    if (schema.key === "scope3:11") return denomFam === "energy"; // ömür boyu kullanım: adet × kWh/yıl × yıl → kWh paydalı faktör
    if (fam && denomFam && denomFam !== fam) {
      const volToEnergy = fam === "volume_gas" && denomFam === "energy" && !!v.calorific_value;
      if (!volToEnergy) return false;
    }
    if (schema.scope === 3 && fam === "money" && denomFam === "money" && fc.denominator_unit !== v.unit) return false; // CURRENCY_MISMATCH öncesi görünür süzme (hesap değil)
    return true;
  });
}

/** Varsayılan seçim: Kapsam 1 yakmada 'combustion' sınırı; Kapsam 2'de konum + artık karışım; Kapsam 3'te sınır çakışmasız ilk uygun. */
export function defaultFactorSelection(schema: RecordSchema, options: CatalogFactor[]): CatalogFactor[] {
  if (schema.scope === 2) return options.filter((fc) => fc.role === "location" || fc.role === "market_residual");
  if (schema.scope === 1 && schema.key !== "refrigerant") {
    const b = SCOPE1_BOUNDARY[schema.key] ?? "combustion";
    const comb = options.filter((fc) => fc.boundary === b);
    if (!comb.length) return [];
    const gasFactors = comb.filter((fc) => fc.gas !== "CO2e");
    return gasFactors.length ? gasFactors : [comb[0]];
  }
  if (schema.scope === 3) {
    const ok = options.filter((fc) => !((schema.category === 1 || schema.category === 2) && fc.boundary === "cradle_to_grave"));
    return ok.length ? [ok[0]] : [];
  }
  return options.length ? [options[0]] : [];
}

// ---------- Sonuç (0.2 genişletmesi) ----------
// Kapsam 2 ikili sonuç, uygulanamaz/bilinmiyor durumu, ürün bağlamı, ömür grubu; kapsama 0.2'de "partial_boundary" ve "carbon_only" alabilir.
export type CalcResultV2 = Omit<CalcResult, "coverage" | "components"> & {
  coverage: CalcResult["coverage"] | "partial_boundary" | "carbon_only";
  components: (Omit<CalcResult["components"][number], "factor_id" | "factor_version"> & { factor_id: string | null; factor_version: string | null; instrument_id?: string; portion_mwh?: string })[];
  value_state?: "known" | "unknown" | "not_applicable";
  results?: { location_based?: Scope2Result; market_based?: Scope2Result };
  primary_method?: string;
  context?: "corporate" | "product";
  scope?: number | null;
  category?: number | null;
  lifetime_group?: { group_id: string; sale_year: string } | null;
  attribution_year?: string;
  data_quality_dims?: Record<string, string | null> | null;
};
export type Scope2Result = CalcResultV2 & { covered_mwh?: string; uncovered_mwh?: string; instrument_ids?: string[]; residual_factor_used?: string };

export function scopeOfSchema(schema: RecordSchema | undefined, source: EmissionSource): 0 | 1 | 2 | 3 {
  return schema ? schema.scope : SCOPE_OF_SOURCE[source.source_type];
}
