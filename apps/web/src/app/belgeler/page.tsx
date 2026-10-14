"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import docsJson from "@/generated/docs.json";
import type { DocEntry } from "@/lib/content";

// Belgeler yalnız bu sayfada yüklenir (büyük paket; diğer sayfaların ilk yüklemesini şişirmez)
const DOCS = docsJson as unknown as DocEntry[];
import { Loading, Markdown } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Belgeler />
    </Suspense>
  );
}

function Belgeler() {
  const params = useSearchParams();
  const id = params.get("d") ?? "inceleme-rehberi";
  const doc = DOCS.find((d) => d.id === id) ?? DOCS[0];
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <div className="doc-layout">
      <aside>
        <h2 style={{ marginTop: 0 }}>Belgeler</h2>
        <p className="small muted">Proje belgeleri, şartname ve grup çıktıları. Kaynak dosyalar depoda.</p>
        <nav className="doc-list" aria-label="Belge listesi">
          {DOCS.map((d) => (
            <Link key={d.id} href={`/belgeler/?d=${d.id}`} aria-current={d.id === doc.id ? "page" : undefined}>
              {d.title}
            </Link>
          ))}
        </nav>
        <h3>Ekip çalışma dosyası</h3>
        <p className="small">
          <a href={`${base}/KOZA-EKIP-CALISMA-DOSYASI.md`} download>Tüm belgeler tek Markdown (indir)</a>
          <br />
          <span className="muted">Depodaki tüm belgelerin birleşik hâli; ekip bunun üzerinden çalışır.</span>
        </p>
        <h3>Görseller</h3>
        <nav className="doc-list">
          <a href={`${base}/img/gelistirme-dongusu.svg`} target="_blank" rel="noreferrer">
            Geliştirme döngüsü (SVG)
          </a>
          <a href={`${base}/img/sistem-akisi.svg`} target="_blank" rel="noreferrer">
            Sistem akışı (SVG)
          </a>
          <a href={`${base}/img/gelistirme-dongusu.png`} target="_blank" rel="noreferrer">
            Geliştirme döngüsü (PNG)
          </a>
        </nav>
        <p className="small muted">Kaynak dosyalar (DOCX, Pages, ZIP) depoda <code>docs/kaynak/</code> altındadır.</p>
      </aside>
      <div>
        <p className="small muted">
          Depo yolu: <code>{doc.path}</code>
        </p>
        <Markdown body={doc.body} />
      </div>
    </div>
  );
}
