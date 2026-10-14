// İçerik üretme betiği (prebuild).
// Kaynak: depo kökündeki content/, docs/, tests/ ve packages/calc-engine.
// Hedef: src/generated/*.json ve public/calc-engine/*.py
// Kural 5: sektör profilleri koda değil veriye aittir; burada yalnız YAML → JSON çevrilir.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const root = path.resolve(web, "..", "..");
const gen = path.join(web, "src", "generated");
fs.mkdirSync(gen, { recursive: true });

function readDirFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(dir, f), "utf8") }));
}

// 1. content/<dizin>/*.yaml → content.json {dizin: [...]} (+ geriye uyum için ayrı dosyalar). _ ile başlayan dosyalar (şema) atlanır.
function loadYamlDir(dir) {
  return readDirFiles(dir, ".yaml")
    .filter((f) => !f.name.startsWith("_"))
    .map((f) => {
      try {
        return yaml.load(f.text);
      } catch (e) {
        throw new Error(`YAML hatası ${dir}/${f.name}: ${e.message}`);
      }
    });
}
const contentRoot = path.join(root, "content");
const content = {};
for (const d of fs.readdirSync(contentRoot).filter((d) => fs.statSync(path.join(contentRoot, d)).isDirectory()).sort()) {
  content[d] = loadYamlDir(path.join(contentRoot, d));
}
fs.writeFileSync(path.join(gen, "content.json"), JSON.stringify(content, null, 2));
const profiles = content["sector-profiles"] ?? [];
const terms = content["terms"] ?? [];
const lessons = content["lessons"] ?? [];
fs.writeFileSync(path.join(gen, "profiles.json"), JSON.stringify(profiles, null, 2));
fs.writeFileSync(path.join(gen, "terms.json"), JSON.stringify(terms, null, 2));
fs.writeFileSync(path.join(gen, "lessons.json"), JSON.stringify(lessons, null, 2));
fs.writeFileSync(path.join(gen, "sources.json"), JSON.stringify(content["sources"] ?? [], null, 2));

// 3. Altın set ve test faktör kataloğu (yalnız tests/ altından okunur — kural 12)
const golden = readDirFiles(path.join(root, "tests", "golden"), ".json").map((f) => JSON.parse(f.text));
fs.writeFileSync(path.join(gen, "golden.json"), JSON.stringify(golden, null, 2));
const catalogPath = path.join(root, "tests", "factors", "test-catalog.json");
fs.copyFileSync(catalogPath, path.join(gen, "test-catalog.json"));

// 4. Gereklilik izleme matrisi
const trace = path.join(root, "docs", "gereklilik-izleme.json");
fs.copyFileSync(trace, path.join(gen, "traceability.json"));

// 5. Belgeler (Markdown → JSON; tarayıcıda marked ile çizilir)
const docList = [
  ["readme", "README — projeye giriş", "README.md"],
  ["ekip", "Ekip ve mentor", "docs/ekip.md"],
  ["inceleme-rehberi", "İnceleme rehberi (grup için)", "docs/inceleme-rehberi.md"],
  ["teslim-notu", "Teslim notu — Dilim 0 ve 1", "docs/teslim-notu-dilim-0-1.md"],
  ["gereklilik-izleme", "Gereklilik izleme matrisi", "docs/gereklilik-izleme.md"],
  ["sartname", "Şartname v1.0 (§01–§34)", "docs/spec/KOZA_sartname_v1.0.md"],
  ["v11", "v1.1 gereklilik eki", "docs/spec/KOZA_v1.1_gereklilikler.md"],
  ["v11-rehber", "v1.1 rehber (uzun biçim)", "docs/spec/KOZA_v1.1_rehber.md"],
  ["forum-tr", "Forum bulguları — ESG balık kılçığı (TR)", "docs/forum/YPF-ESG-cozum-onerileri-TR.md"],
  ["forum-en", "Forum findings — ESG fishbone (EN)", "docs/forum/YPF-ESG-cozum-onerileri-EN.md"],
  ["mimari-notu", "Sistem mimarisi ve karar akışı notu", "docs/forum/sistem-mimarisi-karar-akisi.md"],
  ["karar-kaydi", "Karar kaydı (K-01…K-16)", "docs/karar-kaydi.md"],
  ["is-akisi", "Geliştirici iş akışı", "docs/gelistirici-is-akisi.md"],
  ["rol-matrisi", "Rol ve yetki matrisi", "docs/rol-matrisi.md"],
  ["veri-modeli", "Veri modeli ve göçler", "docs/veri-modeli.md"],
  ["uretime-gecis", "Üretime geçiş yönergesi", "docs/uretime-gecis.md"],
  ["calc-contract", "Hesap motoru sözleşmesi v0.1", "packages/calc-engine/CONTRACT.md"],
  ["calc-contract-2", "Hesap motoru sözleşmesi v0.2", "packages/calc-engine/CONTRACT-v0.2.md"],
  ["calc-readme", "Hesap motoru README", "packages/calc-engine/README.md"],
  ["api-readme", "İş API'si README", "apps/api/README.md"],
  ["kurallar", "Geliştirme kuralları", "GELISTIRME-KURALLARI.md"],
  ["surec-dilim", "Süreç: dilim döngüsü", "docs/surec/dilim.md"],
  ["surec-kontrol", "Süreç: kural kontrol listesi", "docs/surec/kontrol.md"],
];
const docs = docList
  .filter(([, , rel]) => fs.existsSync(path.join(root, rel)))
  .map(([id, title, rel]) => ({ id, title, path: rel, body: fs.readFileSync(path.join(root, rel), "utf8") }));
fs.writeFileSync(path.join(gen, "docs.json"), JSON.stringify(docs));

// 5b. Şartname bölümleri (asistan ve bağlamsal yardım için): "## NN Başlık" → {id, title, body}; v1.1 maddeleri de eklenir
const spec = fs.readFileSync(path.join(root, "docs", "spec", "KOZA_sartname_v1.0.md"), "utf8");
const sections = [];
let cur = null;
for (const line of spec.split("\n")) {
  const m = line.match(/^## (\d{2}) (.+)$/);
  if (m) {
    if (cur) sections.push(cur);
    cur = { id: `§${m[1]}`, title: m[2].trim(), body: "" };
  } else if (cur) cur.body += line + "\n";
}
if (cur) sections.push(cur);
const v11 = fs.readFileSync(path.join(root, "docs", "spec", "KOZA_v1.1_gereklilikler.md"), "utf8");
for (const m of v11.matchAll(/^- \*\*([A-ZÖĞÜŞİÇ]+-\d{2})\*\* (.+)$/gm)) sections.push({ id: m[1], title: m[1], body: m[2] });
fs.writeFileSync(path.join(gen, "spec-sections.json"), JSON.stringify(sections));

// 6. Hesap motoru kaynak kodu → public/calc-engine (tarayıcıda Pyodide aynı dosyaları çalıştırır)
const engineSrc = path.join(root, "packages", "calc-engine", "koza_calc");
const enginePub = path.join(web, "public", "calc-engine");
fs.rmSync(enginePub, { recursive: true, force: true });
fs.mkdirSync(enginePub, { recursive: true });
const engineFiles = [];
if (fs.existsSync(engineSrc)) {
  for (const f of fs.readdirSync(engineSrc).filter((f) => f.endsWith(".py")).sort()) {
    fs.copyFileSync(path.join(engineSrc, f), path.join(enginePub, f));
    engineFiles.push(f);
  }
}
fs.writeFileSync(path.join(enginePub, "manifest.json"), JSON.stringify({ files: engineFiles }));

// 7. Görseller
const imgPub = path.join(web, "public", "img");
fs.mkdirSync(imgPub, { recursive: true });
for (const f of fs.readdirSync(path.join(root, "docs", "img"))) fs.copyFileSync(path.join(root, "docs", "img", f), path.join(imgPub, f));

console.log(`gen-content: ${Object.keys(content).map((k) => `${k}=${content[k].length}`).join(", ")}; ${golden.length} altın örnek; ${docs.length} belge; ${sections.length} şartname bölümü; ${engineFiles.length} motor dosyası`);
