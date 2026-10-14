// Dışa aktarma (§22): JSON manifest, CSV (kayıt başına satır; §25 formül enjeksiyonu önlenir),
// DOCX (en küçük geçerli paket: [Content_Types].xml + _rels/.rels + word/document.xml; sıkıştırmasız ZIP, yerleşik yazıcı).
// Hiçbir sayı burada üretilmez; motor çıktısı biçimlendirilerek yazılır (yuvarlama sunumda, §18).
import { StoreError } from "@/lib/store";
import { fmtDec, kgToT } from "@/lib/useStore";
import { SCOPE2_METHOD_LABEL, type IndexRow } from "./report";
import type { Assurance, PackageManifest, Publication, ReportingMap } from "./types";

// ---------- CSV ----------

/** Hücre =, +, -, @, sekme veya satır sonu ile başlıyorsa tek tırnakla metne zorlanır (§25). */
export function sanitizeCell(v: unknown): { value: string; changed: boolean } {
  const s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) return { value: `'${s}`, changed: true };
  return { value: s, changed: false };
}

export function csvQuote(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(m: PackageManifest): { text: string; sanitized: number } {
  const header = ["record_id", "version", "state", "source_name", "source_type", "scope", "category", "period_start", "period_end", "quantity", "quantity_state", "unit", "data_quality", "run_id", "status", "total_co2e_kg", "coverage", "factor_refs", "evidence_sha256", "invoice_no", "supplier", "note"];
  let sanitized = 0;
  const lines = [header.join(",")];
  for (const r of m.records_detail) {
    const cells = header.map((h) => {
      const { value, changed } = sanitizeCell((r as unknown as Record<string, unknown>)[h]);
      if (changed) sanitized += 1;
      return csvQuote(value);
    });
    lines.push(cells.join(","));
  }
  return { text: "﻿" + lines.join("\r\n") + "\r\n", sanitized };
}

// ---------- Bölüm modeli (DOCX ve yazdırma aynı içeriği kullanır) ----------

export interface Section {
  title: string;
  paragraphs: string[];
  table?: string[][];
}

const SCOPE3_LABEL = (k: string) => `Kategori ${k}`;

export function packageSections(m: PackageManifest, extras: { publications: Publication[]; assurances: Assurance[]; index: { map: ReportingMap; rows: IndexRow[] }[]; report_id: string; report_version: number; package_sha256: string }): Section[] {
  const c = m.aggregate.corporate;
  const s2 = c.scope2_method ? SCOPE2_METHOD_LABEL[c.scope2_method as "location_based" | "market_based"] ?? c.scope2_method : "—";
  const published = extras.publications.length > 0;
  const out: Section[] = [];
  out.push({
    title: "Yönetici özeti",
    paragraphs: [
      `${m.tenant.name} — dönem ${m.period.start} → ${m.period.end}. ${published ? "Yayımlanmış rapor." : "TASLAK: yayımlanmamış rapor; taslak indirmek yayımlamak değildir."}`,
      `${c.label_tr}: ${kgToT(c.total_kg)} t CO₂e (Kapsam 1: ${kgToT(c.scope1_kg)} t; Kapsam 2 (${s2}): ${kgToT(c.scope2_kg)} t; Kapsam 3: ${kgToT(c.scope3_kg)} t).`,
      `Toplamlar yalnız hesap motorunun (${m.engine_version}) toplama çıktısıdır; onaylı/kilitli kayıtlar dahildir. Eksikler ve sınırlar aşağıda listelenir.`,
    ],
  });
  out.push({
    title: "Sınır",
    paragraphs: [m.boundary ? `Konsolidasyon yaklaşımı: ${m.boundary.approach} (${m.boundary.status}). ${m.boundary.note}` : "Envanter sınırı tanımlı değil (kurulum eksik).", `Beklenen kaynak ${m.core.sources_expected}, kayıtlı kaynak ${m.core.sources_with_records}.`],
  });
  out.push({ title: "Dönem", paragraphs: [`${m.period.start} → ${m.period.end}; durum: ${m.period.status === "locked" ? "kilitli" : "açık"}.`] });
  out.push({
    title: "Yöntem",
    paragraphs: [`Hesap yöntemi: ${m.method ? `${m.method.id}@${m.method.version}` : "—"}; motor ${m.engine_version}. Kapsam 2 yöntemi: ${s2}; diğer yöntem ayrıca gösterilir, toplanmaz.`, m.sources.method?.gwp_set ? `GWP seti: ${Object.entries(m.sources.method.gwp_set).map(([k, v]) => `${k}=${v}`).join(", ")}` : "GWP seti: —"],
  });
  const scopeRows: string[][] = [["Kapsam / kategori", "t CO₂e"], ["Kapsam 1", kgToT(c.scope1_kg)], [`Kapsam 2 (${s2})`, kgToT(c.scope2_kg)]];
  if (c.scope2_alternative_kg !== undefined && c.scope2_alternative_kg !== null) scopeRows.push([`Kapsam 2 — diğer yöntem (toplanmaz)`, kgToT(c.scope2_alternative_kg)]);
  scopeRows.push(["Kapsam 3", kgToT(c.scope3_kg)]);
  for (const [k, v] of Object.entries(c.scope3_by_category ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]))) scopeRows.push([`  ${SCOPE3_LABEL(k)}`, kgToT(v)]);
  scopeRows.push([c.label_tr, kgToT(c.total_kg)]);
  if (m.aggregate.biogenic_co2_kg !== null) scopeRows.push(["Biyojenik CO₂ (ayrı)", kgToT(m.aggregate.biogenic_co2_kg)]);
  out.push({ title: "Kapsam ve kategori sonuçları", paragraphs: [], table: scopeRows });
  out.push({ title: "Eksikler ve sınırlar", paragraphs: m.gaps_tr.length ? m.gaps_tr.map((g) => `• ${g}`) : ["Kayıtlı eksik yok."] });
  const q = m.quality;
  out.push({
    title: "Kalite",
    paragraphs: [
      `Tahmini veri payı: kayıt sayısına göre ${fmtDec(q.estimated_share_by_count)}; kg'a göre ${fmtDec(q.estimated_share_by_kg)}.`,
      `İnceleme gerekli ${q.review_required_count}; engelli ${q.blocked_count}; koşusuz ${q.no_run_count}; kanıtsız ${q.evidence_missing_count}; bilinmiyor ${q.unknown_count}; uygulanmaz ${q.not_applicable_count}.`,
      ...(c.excluded.length ? [`Hariç tutulan kayıtlar: ${c.excluded.map((e) => `${e.record_id.slice(0, 12)} (${e.reason})`).join("; ")}`] : []),
    ],
  });
  const prev = m.comparison.previous;
  out.push({
    title: "Karşılaştırmalar",
    paragraphs: [m.comparison.note_tr],
    table: prev
      ? [
          ["", `Önceki (${prev.period.start} → ${prev.period.end})`, `Bu dönem (${m.period.start} → ${m.period.end})`],
          ["Kapsam 1 (t)", kgToT(prev.corporate.scope1_kg), kgToT(c.scope1_kg)],
          ["Kapsam 2 (t)", kgToT(prev.corporate.scope2_kg), kgToT(c.scope2_kg)],
          ["Kapsam 3 (t)", kgToT(prev.corporate.scope3_kg), kgToT(c.scope3_kg)],
          ["Toplam (t)", kgToT(prev.corporate.total_kg), kgToT(c.total_kg)],
        ]
      : undefined,
  });
  out.push({
    title: "Kaynaklar",
    paragraphs: [`Motor ${m.sources.engine_version}; yöntem ${m.method ? `${m.method.id}@${m.method.version}` : "—"}; katalog ${m.sources.catalog_id ?? "—"}; eşleştirme haritaları ${m.sources.reporting_maps.map((r) => `${r.id}@${r.version}`).join(", ")}.`],
    table: [["Faktör", "Sürüm", "Başlık", "Kaynak", "Lisans"], ...m.sources.factors.map((f) => [f.id, f.version, f.title_tr ?? "—", f.source_ref ?? "—", f.license ?? "—"])],
  });
  out.push({
    title: "Kanıt indeksi",
    paragraphs: m.evidence_index.length ? [] : ["Kayıtlara bağlı kanıt dosyası yok."],
    table: m.evidence_index.length ? [["Kayıt", "Kanıt", "Dosya", "SHA-256"], ...m.evidence_index.map((e) => [e.record_id, e.evidence_id, e.file_name, e.sha256])] : undefined,
  });
  out.push({
    title: "Ürün çalışmaları (kurumsal toplama dahil değil)",
    paragraphs: m.product_studies.length ? ["Ürün çalışması ayrı hesap bağlamıdır; sonuçları kurumsal envantere eklenmez (§17, REG-03)."] : ["Bu dönemde ürün çalışması sonucu yok."],
    table: m.product_studies.length ? [["Ürün", "Sürüm", "Sınır / etiket", "kg CO₂e (referans akış başına)", "İddia"], ...m.product_studies.map((p) => [p.product_name, p.product_version, p.label_tr, fmtDec(p.total_kg), p.claim_tr ?? "—"])] : undefined,
  });
  for (const { map, rows } of extras.index) {
    out.push({
      title: `${map.framework} — ${map.title} (${map.version})${map.applicable_from ? `, yürürlük ${map.applicable_from}` : ""}`,
      paragraphs: [map.note_tr, "Bu indeks neyin karşılandığını ve neyin eksik olduğunu gösterir; otomatik 'tam uyum' rozeti üretmez."],
      table: [["Açıklama", "Başlık", "Durum", "Var", "Eksik", "Ayrı kanıt isteyen anlatı"], ...rows.map((r) => [r.id, r.title_tr, r.status_tr, r.covered.map((e) => e.koza).join(", ") || "—", r.missing.map((e) => e.koza).join(", ") || "—", r.narrative.join("; ")])],
    });
  }
  out.push({
    title: "Güvence",
    paragraphs: extras.assurances.length ? extras.assurances.map((a) => `Bağımsız güvence: ${a.provider}; dosya ${a.file_name} (SHA-256 ${a.sha256}); kapsam: ${a.scope}; görüş: ${a.opinion} (${a.level}). ${a.opinion_text}`) : ["Bağımsız güvence raporu eklenmemiş. Platform kendi kendine güvence etiketi veremez."],
  });
  out.push({
    title: "Sürüm ve bütünlük",
    paragraphs: [`Çekirdek manifest SHA-256: ${m.core_manifest_sha256}`, `Paket SHA-256: ${extras.package_sha256}`, `Rapor v${extras.report_version} (${extras.report_id}).`, published ? `Yayım: ${extras.publications.map((p) => `${p.created_at} ${p.created_by} (paket ${p.package_sha256.slice(0, 12)})`).join("; ")}` : "Yayımlanmadı (taslak)."],
  });
  return out;
}

// ---------- DOCX ----------

function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function para(text: string, style?: string): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function table(rows: string[][]): string {
  const tr = rows.map((r, i) => `<w:tr>${r.map((c) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:r>${i === 0 ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xmlEsc(c)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${tr}</w:tbl>`;
}

export function buildDocumentXml(title: string, sections: Section[]): string {
  const body = [para(title, "Title"), ...sections.flatMap((s) => [para(s.title, "Heading1"), ...s.paragraphs.map((p) => para(p)), ...(s.table ? [table(s.table), para("")] : [])])].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

// CRC-32 (ZIP). Tablo bir kez üretilir.
let CRC_TABLE: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Sıkıştırmasız (store) ZIP. Tarih sabit (deterministik çıktı). */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const le16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
  const le32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const dosTime = 0;
  const dosDate = (1 << 5) | 1; // 1980-01-01
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array([...le32(0x04034b50), ...le16(20), ...le16(0x0800), ...le16(0), ...le16(dosTime), ...le16(dosDate), ...le32(crc), ...le32(f.data.length), ...le32(f.data.length), ...le16(name.length), ...le16(0), ...name]);
    parts.push(local, f.data);
    central.push(new Uint8Array([...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0x0800), ...le16(0), ...le16(dosTime), ...le16(dosDate), ...le32(crc), ...le32(f.data.length), ...le32(f.data.length), ...le16(name.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...name]));
    offset += local.length + f.data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array([...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(files.length), ...le16(files.length), ...le32(cdSize), ...le32(offset), ...le16(0)]);
  const total = offset + cdSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of [...parts, ...central, eocd]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

export function buildDocxBytes(title: string, sections: Section[]): Uint8Array {
  try {
    if (typeof TextEncoder === "undefined") throw new Error("TextEncoder yok");
    const enc = new TextEncoder();
    return zipStore([
      { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
      { name: "_rels/.rels", data: enc.encode(RELS) },
      { name: "word/document.xml", data: enc.encode(buildDocumentXml(title, sections)) },
    ]);
  } catch (e) {
    throw new StoreError("DOCX_LIB_UNAVAILABLE", `DOCX paketlenemedi: ${String((e as Error)?.message ?? e)}`, 500);
  }
}

export function downloadBlob(data: string | Uint8Array, name: string, type: string): void {
  const blob = new Blob([data as BlobPart], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
