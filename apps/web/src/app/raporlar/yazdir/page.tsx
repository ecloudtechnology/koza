"use client";
// Yazdırılabilir rapor görünümü (§22 PDF: tarayıcı yazdırma, @media print biçimi modül style.css'te).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStore, fmtDate } from "@/lib/useStore";
import { Loading, NoTenant, Notice } from "@/components/ui";
import { ReportPackageView } from "@/modules/urun-rapor/components";
import { assurances, packages, publications, recordExport, reportingIndex, reportingMaps } from "@/modules/urun-rapor/report";
import "@/modules/urun-rapor/style.css";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Yazdir />
    </Suspense>
  );
}

function Yazdir() {
  const { store, ready } = useStore();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  const p = packages(store).find((x) => x.id === id);
  if (!p) {
    return (
      <Notice kind="warn">
        <p>
          <strong>Rapor paketi bulunamadı.</strong> Bu kimlik aktif kurumda yok. <Link href="/raporlar/">Raporlara dön</Link>
        </p>
      </Notice>
    );
  }
  const pubs = publications(store, p.id);
  const asr = assurances(store, p.id);
  const index = reportingIndex(reportingMaps(), p.manifest, { assurance: asr.length > 0 });
  const m = p.manifest;
  return (
    <>
      <div className="ur-no-print" style={{ marginBottom: "1rem" }}>
        <p className="small">
          <Link href="/raporlar/">← Raporlar</Link>
        </p>
        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              recordExport(store, p.id, "print");
              window.print();
            }}
          >
            Yazdır / PDF olarak kaydet
          </button>
          <span className="small muted">Tarayıcının yazdırma penceresinde "PDF olarak kaydet" seçin. Menü ve düğmeler çıktıda yer almaz. İndirmek yayımlamak değildir.</span>
        </div>
      </div>
      <div className="ur-print-head">
        Koza · {m.tenant.name} · Rapor v{p.report_version} · paket SHA-256 {p.package_sha256} · {pubs.length ? `yayımlandı ${fmtDate(pubs[0].created_at)}` : "TASLAK — yayımlanmadı"}
      </div>
      <h1>
        {m.tenant.name} — Sera gazı raporu {m.period.start} → {m.period.end}
        {!pubs.length && " (TASLAK)"}
      </h1>
      <p className="small muted">
        Rapor v{p.report_version} · oluşturma {fmtDate(p.created_at)} · motor {m.engine_version} · {pubs.length ? "yayımlanmış" : "taslak; dönem " + (m.period.status === "locked" ? "kilitli" : "açık")}
      </p>
      <ReportPackageView p={p} publications={pubs} assurances={asr} index={index} mode="print" />
    </>
  );
}
