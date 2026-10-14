// Hesap motoru köprüsü.
// Sayısal sonuç yalnız packages/calc-engine (koza_calc) üretir (kural 1). Önizlemede aynı Python
// dosyaları Pyodide ile tarayıcıda çalıştırılır; TypeScript tarafında hesap YOKTUR.
// Motor yüklenemezse hesap yapılmaz ve ekran "yüklenemedi" durumunu gösterir (sahte sonuç yok).

import type { CalcResult } from "./domain";

type Pyodide = {
  FS: { mkdirTree(p: string): void; writeFile(p: string, data: string): void };
  runPythonAsync(code: string): Promise<unknown>;
  globals: { get(name: string): unknown };
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<Pyodide>;
  }
}

const PYODIDE_VERSION = "0.27.7";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let instance: Promise<{ py: Pyodide; files: string[] }> | null = null;

export function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Pyodide betiği yüklenemedi (ağ veya CDN engeli)."));
    document.head.appendChild(s);
  });
}

export function engineReady(): Promise<{ py: Pyodide; files: string[] }> {
  if (!instance) {
    instance = (async () => {
      await loadScript(`${PYODIDE_URL}pyodide.js`);
      if (!window.loadPyodide) throw new Error("loadPyodide bulunamadı.");
      const py = await window.loadPyodide({ indexURL: PYODIDE_URL });
      const manifestRes = await fetch(`${basePath()}/calc-engine/manifest.json`, { cache: "no-store" });
      if (!manifestRes.ok) throw new Error("Hesap motoru dosya listesi bulunamadı.");
      const manifest = (await manifestRes.json()) as { files: string[] };
      if (!manifest.files.length) throw new Error("Hesap motoru dosyaları paketlenmemiş (packages/calc-engine boş).");
      py.FS.mkdirTree("/koza/koza_calc");
      for (const f of manifest.files) {
        const r = await fetch(`${basePath()}/calc-engine/${f}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`Motor dosyası alınamadı: ${f}`);
        py.FS.writeFile(`/koza/koza_calc/${f}`, await r.text());
      }
      await py.runPythonAsync(`
import sys, json
sys.path.insert(0, "/koza")
import koza_calc
from koza_calc import calculate, ENGINE_VERSION
from koza_calc.golden import run_fixtures
def _calc(req_json):
    return json.dumps(calculate(json.loads(req_json)), ensure_ascii=False)
def _golden(fixtures_json):
    return json.dumps(run_fixtures(json.loads(fixtures_json)), ensure_ascii=False)
def _aggregate(req_json):
    from koza_calc import aggregate
    return json.dumps(aggregate(json.loads(req_json)), ensure_ascii=False)
def _supported():
    try:
        from koza_calc import SUPPORTED
        return json.dumps(SUPPORTED, ensure_ascii=False)
    except Exception:
        return "null"
`);
      return { py, files: manifest.files };
    })().catch((e) => {
      instance = null;
      throw e;
    });
  }
  return instance;
}

export async function engineVersion(): Promise<string> {
  const { py } = await engineReady();
  return String(await py.runPythonAsync("ENGINE_VERSION"));
}

export async function calculate(request: unknown): Promise<CalcResult> {
  const { py } = await engineReady();
  const fn = py.globals.get("_calc") as (s: string) => string;
  const out = fn(JSON.stringify(request));
  return JSON.parse(out) as CalcResult;
}

// Toplama (CONTRACT-v0.2 §7): yalnız motor toplar; arayüz yeni sayı üretmez.
export async function aggregate(request: unknown): Promise<AggregateResult> {
  const { py } = await engineReady();
  const fn = py.globals.get("_aggregate") as (s: string) => string;
  return JSON.parse(fn(JSON.stringify(request))) as AggregateResult;
}

export async function supportedMatrix(): Promise<Record<string, unknown> | null> {
  const { py } = await engineReady();
  const fn = py.globals.get("_supported") as () => string;
  return JSON.parse(fn()) as Record<string, unknown> | null;
}

export interface AggregateResult {
  engine_version: string;
  corporate: {
    scope1_kg: string | null;
    scope2_kg: string | null;
    scope2_method: string | null;
    scope2_alternative_kg?: string | null;
    scope3_kg: string | null;
    scope3_by_category: Record<string, string>;
    total_kg: string | null;
    label_tr: string;
    excluded: { record_id: string; reason: string }[];
    coverage_notes_tr: string[];
    estimated_share_by_count: string | null;
    estimated_share_by_kg: string | null;
  };
  product: Record<string, { total_kg: string | null; claim_tr: string }>;
  biogenic_co2_kg: string | null;
  not_applicable: string[];
  unknown: string[];
}

export interface GoldenRun {
  passed: number;
  failed: number;
  results: { id: string; ok: boolean; diff: string[] }[];
}

export async function runGolden(fixtures: unknown[]): Promise<GoldenRun> {
  const { py } = await engineReady();
  const fn = py.globals.get("_golden") as (s: string) => string;
  return JSON.parse(fn(JSON.stringify(fixtures))) as GoldenRun;
}
