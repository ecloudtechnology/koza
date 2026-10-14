"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore, fmtDate } from "@/lib/useStore";
import { sha256Hex } from "@/lib/hash";
import { StoreError } from "@/lib/store";
import { can } from "@/lib/domain";
import { ErrorBox, Loading, NoTenant, Notice, PageHeader } from "@/components/ui";
import { parseCsv, parseXlsx, prepareRows, suggestMapping, targetsFor, type Table } from "@/modules/kayit/importer";
import { SCHEMAS, schemaOf } from "@/modules/kayit/schemas";
import { activeImportByHash, commitImport, importJobs, rollbackImport, type ImportJobRow, type PreparedRow } from "@/modules/kayit/store";
import "@/modules/kayit/style.css";

type Step = "file" | "map" | "preview" | "done";

export default function IceAktar() {
  const { store, ready } = useStore();
  const [err, setErr] = useState<unknown>(null);
  const [schemaKey, setSchemaKey] = useState("stationary_combustion");
  const [step, setStep] = useState<Step>("file");
  const [file, setFile] = useState<{ name: string; sha256: string } | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [prepared, setPrepared] = useState<PreparedRow[] | null>(null);
  const [job, setJob] = useState<ImportJobRow | null>(null);
  const [rolled, setRolled] = useState<{ deleted: string[]; kept: { record_id: string; state: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [training, setTraining] = useState(false);

  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const schema = schemaOf(schemaKey)!;
  const targets = targetsFor(schema);
  const jobs = importJobs(store).slice().reverse();
  const canRun = can(store.role, "kayit.import.run");
  const canRollback = can(store.role, "kayit.import.rollback");

  const onFile = async (f: File) => {
    setErr(null);
    setBusy(true);
    setPrepared(null);
    setJob(null);
    try {
      const buf = await f.arrayBuffer();
      const sha256 = await sha256Hex(buf);
      const dup = activeImportByHash(store, sha256);
      if (dup) throw new StoreError("IMPORT_DUPLICATE_FILE", `Bu dosya daha önce içe aktarıldı (${dup.file_name}, ${fmtDate(dup.created_at)}, iş ${dup.id}); yeniden yüklemek ikinci kayıt oluşturmaz.`, 409);
      let t: Table;
      if (/\.xlsx?$/i.test(f.name)) {
        try {
          t = await parseXlsx(buf);
        } catch (e) {
          throw new StoreError("IMPORT_ROW_INVALID", `${String((e as Error)?.message ?? e)} XLSX okunamadı; dosyayı CSV olarak kaydedip yükleyin.`, 422);
        }
      } else t = parseCsv(new TextDecoder("utf-8").decode(buf));
      if (!t.headers.length || !t.rows.length) throw new StoreError("IMPORT_ROW_INVALID", "Dosyada başlık satırı veya veri satırı yok.", 422);
      setFile({ name: f.name, sha256 });
      setTable(t);
      setMapping(suggestMapping(t.headers, targets));
      setStep("map");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const doPreview = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (!table) return;
      const missing = targets.filter((t) => t.required && !mapping[t.key]);
      if (missing.length) throw new StoreError("VALIDATION", `Zorunlu alanlar eşlenmedi: ${missing.map((m) => m.label).join(", ")}.`, 422);
      setPrepared(await prepareRows(store, schema, table, mapping, training));
      setStep("preview");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const doCommit = () => {
    setErr(null);
    try {
      if (!file || !prepared) return;
      const j = commitImport(store, file, schema.key, mapping, prepared);
      setJob(j);
      setStep("done");
    } catch (e) {
      setErr(e);
    }
  };
  const downloadTemplate = () => {
    const csv = targets.map((t) => t.label.replace(/;/g, ",")).join(";") + "\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `koza-sablon-${schema.key.replace(":", "-")}.csv`;
    a.click();
  };

  return (
    <>
      <PageHeader eyebrow="İçe aktarma · §11" title="Excel / CSV içe aktarma" lead="Dosya önce eşleme ve önizleme alanına alınır; birim, tarih, kaynak ve tekrar kontrolü uygulanır. Hatalı satırlar nedeniyle döner; başarılı satırlar taslak kayıt olur ve aynı dosya/satır ikinci kez kayıt oluşturmaz. İş geri alınabilir; onaylı kayıtlara dokunulmaz." tags={["§11 içe aktarma", "T07", "T20"]} />
      <ol className="steps">
        {(["file", "map", "preview", "done"] as Step[]).map((s, i) => (
          <li key={s} aria-current={step === s ? "step" : undefined} className={["file", "map", "preview", "done"].indexOf(step) > i ? "done" : ""}>
            {["Dosya ve kayıt türü", "Sütun eşleme", "Önizleme ve doğrulama", "Sonuç"][i]}
          </li>
        ))}
      </ol>
      <ErrorBox error={err} />
      {!canRun && (
        <Notice kind="warn">
          <p>İçe aktarma çalıştırma yetkiniz yok (veri giren / veri sorumlusu / yönetici). Önizleme yapabilirsiniz; kayıt oluşturulmaz.</p>
        </Notice>
      )}

      {step === "file" && (
        <div className="card">
          <h2>1. Kayıt türü ve dosya</h2>
          <div className="field">
            <label htmlFor="sk">Kayıt türü (tüm satırlar bu türde)</label>
            <select id="sk" value={schemaKey} onChange={(e) => setSchemaKey(e.target.value)}>
              {SCHEMAS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                </option>
              ))}
            </select>
            <span className="hint">{schema.why_scope}</span>
          </div>
          <div className="field">
            <label htmlFor="f">Dosya (CSV; XLSX için SheetJS cdnjs'ten isteğe bağlı indirilir)</label>
            <input id="f" type="file" accept=".csv,.txt,.xlsx,.xls" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <span className="hint">Dosya içeriği saklanmaz; yalnız SHA-256 karması ve satır karmaları tutulur (idempotentlik).</span>
          </div>
          <label className="check">
            <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} /> Eğitim kaydı olarak işaretle (§06)
          </label>
          <div className="actions" style={{ marginTop: "0.5rem" }}>
            <button type="button" onClick={downloadTemplate}>
              Şablon CSV indir ({targets.length} sütun)
            </button>
          </div>
          <p className="small muted" style={{ marginTop: "0.5rem" }}>
            Beklenen sütunlar: {targets.map((t) => `${t.label}${t.required ? "*" : ""}`).join(" · ")}
          </p>
        </div>
      )}

      {step === "map" && table && (
        <div className="card">
          <h2>2. Sütun eşleme — {file?.name} ({table.rows.length} satır)</h2>
          <p className="small muted">Öneriler başlık adından; onaylayın veya değiştirin. Eşlenmeyen isteğe bağlı alanlar boş kalır (bilinmiyor, sıfır değil).</p>
          <div className="map-grid">
            {targets.map((t) => (
              <span key={t.key} style={{ display: "contents" }}>
                <label htmlFor={`m-${t.key}`}>
                  {t.label} {t.required && <span className="req">*</span>}
                  {t.hint && <span className="hint"> {t.hint}</span>}
                </label>
                <select id={`m-${t.key}`} value={mapping[t.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [t.key]: e.target.value })}>
                  <option value="">— eşlenmedi —</option>
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </span>
            ))}
          </div>
          <div className="actions" style={{ marginTop: "0.75rem" }}>
            <button className="primary" onClick={doPreview} disabled={busy}>
              Önizle ve doğrula
            </button>
            <button onClick={() => setStep("file")}>Geri</button>
          </div>
        </div>
      )}

      {step === "preview" && prepared && (
        <div className="card">
          <h2>3. Önizleme — {prepared.filter((p) => !p.error && !p.existing_record_id).length} yeni, {prepared.filter((p) => p.existing_record_id).length} zaten var, {prepared.filter((p) => p.error).length} hatalı</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Satır</th>
                  <th>Durum</th>
                  <th>Kaynak</th>
                  <th>Dönem</th>
                  <th>Miktar</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {prepared.map((p) => (
                  <tr key={p.row}>
                    <td className="num">{p.row}</td>
                    <td>{p.error ? <span className="badge crit">hata</span> : p.existing_record_id ? <span className="badge neutral">zaten var</span> : <span className="badge ok">taslak olacak</span>}</td>
                    <td>{p.input ? store.sources().find((s) => s.id === p.input!.version.source_id)?.name : "—"}</td>
                    <td className="num">{p.input ? `${p.input.version.period_start} → ${p.input.version.period_end}` : "—"}</td>
                    <td className="num">{p.input ? (p.input.version.quantity_state === "unknown" ? "bilinmiyor" : `${p.input.version.quantity} ${p.input.version.unit ?? "(birim?)"}`) : "—"}</td>
                    <td className="small">{p.error ? <span className="row-err">{p.error}</span> : p.existing_record_id ? <Link href={`/kayit/?id=${p.existing_record_id}`}>mevcut kayıt</Link> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions" style={{ marginTop: "0.75rem" }}>
            <button className="primary" onClick={doCommit} disabled={!canRun || prepared.every((p) => p.error || p.existing_record_id)}>
              Taslak kayıtları oluştur
            </button>
            <button onClick={() => setStep("map")}>Eşlemeye dön</button>
            <span className="small muted">Hatalı satırlar atlanır; dosyada düzeltip yeniden yüklediğinizde yalnız yeni satırlar kaydedilir.</span>
          </div>
        </div>
      )}

      {step === "done" && job && (
        <div className="card">
          <h2>4. Sonuç — iş {job.id}</h2>
          <Notice kind={job.ok_count ? "ok" : "warn"} title="İçe aktarma tamamlandı (bu tarayıcıda kaydedildi)">
            <p>
              {job.ok_count} taslak kayıt oluşturuldu, {job.skipped_count} satır zaten vardı, {job.error_count} satır hatalı. Sonraki adım: her kaydın sayfasında hesap önizlemesi ve kontrole gönderme.
            </p>
          </Notice>
          <ul className="small">
            {job.rows.map((r) => (
              <li key={r.row}>
                Satır {r.row}: {r.status === "created" ? <Link href={`/kayit/?id=${r.record_id}`}>kayıt {r.record_id}</Link> : r.status === "skipped_existing" ? `atlandı — ${r.reason}` : <span className="row-err">{r.reason}</span>}
              </li>
            ))}
          </ul>
          <div className="actions">
            <button onClick={() => { setStep("file"); setTable(null); setPrepared(null); setJob(null); setFile(null); }}>Yeni dosya</button>
            <Link className="btn" href="/envanter/">
              Envantere git
            </Link>
          </div>
        </div>
      )}

      <div className="card">
        <h2>İçe aktarma işleri ({jobs.length})</h2>
        {rolled && (
          <Notice kind="ok" title="Geri alındı">
            <p>
              {rolled.deleted.length} taslak silindi{rolled.kept.length > 0 && `; ${rolled.kept.length} kayıt korundu (${rolled.kept.map((k) => `${k.record_id.slice(0, 12)}: ${k.state}`).join(", ")}) — taslak aşamasını geçmiş kayıtlar silinmez`}.
            </p>
          </Notice>
        )}
        {jobs.length === 0 ? (
          <p className="muted">Henüz içe aktarma yok.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Dosya</th>
                  <th>Tür</th>
                  <th>Durum</th>
                  <th>Satır</th>
                  <th>Oluşan</th>
                  <th>Atlanan</th>
                  <th>Hatalı</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{fmtDate(j.created_at)}</td>
                    <td>
                      {j.file_name} <span className="mono small">{j.file_sha256.slice(0, 10)}…</span>
                    </td>
                    <td>{schemaOf(j.schema_key)?.title ?? j.schema_key}</td>
                    <td>{j.status === "done" ? <span className="badge ok">tamam</span> : <span className="badge neutral">geri alındı</span>}</td>
                    <td className="num">{j.row_count}</td>
                    <td className="num">{j.ok_count}</td>
                    <td className="num">{j.skipped_count}</td>
                    <td className="num">{j.error_count}</td>
                    <td>
                      {j.status === "done" && j.ok_count > 0 && (
                        <button
                          className="mini danger"
                          disabled={!canRollback}
                          title={canRollback ? "Yalnız hâlâ taslak kayıtlar silinir" : "Yalnız kurum yöneticisi"}
                          onClick={() => {
                            setErr(null);
                            try {
                              setRolled(rollbackImport(store, j.id));
                            } catch (e) {
                              setErr(e);
                            }
                          }}
                        >
                          İçe aktarmayı geri al
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
