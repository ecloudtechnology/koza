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
