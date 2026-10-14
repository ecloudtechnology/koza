"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GOLDEN } from "@/lib/content";
import { engineReady, engineVersion, runGolden, type GoldenRun } from "@/lib/calc";
import { Loading, Notice, PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AltinSet />
    </Suspense>
  );
}

function AltinSet() {
  const params = useSearchParams();
  const auto = params.get("auto") === "1";
  const [state, setState] = useState<"idle" | "loading" | "running" | "done" | "failed">("idle");
  const [err, setErr] = useState("");
  const [ver, setVer] = useState("");
  const [res, setRes] = useState<GoldenRun | null>(null);
  const [files, setFiles] = useState<string[]>([]);

  const run = async () => {
    setState("loading");
    setErr("");
    try {
      const { files } = await engineReady();
      setFiles(files);
      setVer(await engineVersion());
      setState("running");
      setRes(await runGolden(GOLDEN));
      setState("done");
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
      setState("failed");
    }
  };

  // ?auto=1: sayfa açılınca çalıştır (inceleme ve otomatik kontrol için)
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => void run(), 0);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <>
      <PageHeader eyebrow="Doğrulama · §29" title="Altın set — hesap motoru doğrulaması" />
      <p className="muted">
        {GOLDEN.length} kurgusal senaryo (T01–T04, T20 ve birim/esas/sınır engelleri) depodaki <code>tests/golden/*.json</code> dosyalarından okunur ve <b>aynı Python motoru</b> (packages/calc-engine) tarayıcıda Pyodide ile çalıştırılır. Sonuç burada üretilir; önceden hesaplanmış bir tablo değildir.
      </p>
      <Notice kind="warn">
        <p>Katsayılar kurgusaldır ve yalnız yazılım testi içindir (kural 12). Altın set <b>uzman imzası bekliyor</b> (§29): referans sonuç, yöntem kaynağı ve tolerans alan uzmanınca imzalanmadan hesap özelliği tamamlanmış sayılmaz.</p>
      </Notice>
      <div className="actions">
        <button className="primary" onClick={run} disabled={state === "loading" || state === "running"}>
          {state === "idle" || state === "done" || state === "failed" ? "Altın seti tarayıcıda çalıştır" : state === "loading" ? "Motor yükleniyor…" : "Çalışıyor…"}
        </button>
        {ver && (
          <span className="small muted">
            koza_calc {ver} · dosyalar: {files.join(", ")}
          </span>
        )}
      </div>
      {state === "loading" && <Loading what="Pyodide (~10 MB, ilk sefer)" />}
      {state === "failed" && (
        <Notice kind="crit">
          <p>
            <strong>Çalıştırılamadı:</strong> {err}. Motor yüklenemediğinde sonuç gösterilmez. Aynı testler CI'da pytest ile koşar (bkz. Proje durumu).
          </p>
        </Notice>
      )}
      {res && (
        <>
          <Notice kind={res.failed === 0 ? "ok" : "crit"}>
            <p>
              <strong>
                {res.passed} geçti, {res.failed} kaldı
              </strong>{" "}
              — {new Date().toLocaleString("tr-TR")} · bu tarayıcıda.
            </p>
          </Notice>
          <div className="table-wrap card" data-golden-passed={res.passed} data-golden-failed={res.failed}>
            <table>
              <thead>
                <tr>
                  <th>Sonuç</th>
                  <th>Senaryo</th>
                  <th>Gereklilik</th>
                  <th>Beklenen</th>
                  <th>Fark</th>
                </tr>
              </thead>
              <tbody>
                {res.results.map((r) => {
                  const fx = GOLDEN.find((g) => g.id === r.id);
                  const exp = fx?.expected as { status?: string; total_co2e_kg?: string; coverage?: string; block_codes?: string[] } | undefined;
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className={`badge ${r.ok ? "ok" : "crit"}`}>{r.ok ? "geçti" : "kaldı"}</span>
                      </td>
                      <td>
                        <span className="mono small">{r.id}</span>
                        <div className="small">{fx?.title_tr}</div>
                      </td>
                      <td className="small">{fx?.requirements.join(", ")}</td>
                      <td className="small">
                        {exp?.status}
                        {exp?.total_co2e_kg !== undefined && ` · ${exp.total_co2e_kg} kg`}
                        {exp?.coverage && ` · ${exp.coverage}`}
                        {exp?.block_codes?.length ? ` · ${exp.block_codes.join(",")}` : ""}
                      </td>
                      <td className="small">{r.diff.join("; ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <details className="card">
        <summary>Senaryo listesi ({GOLDEN.length})</summary>
        <ul className="small">
          {GOLDEN.map((g) => (
            <li key={g.id}>
              <span className="mono">{g.id}</span> — {g.title_tr} <span className="badge neutral">{g.requirements.join(", ")}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
