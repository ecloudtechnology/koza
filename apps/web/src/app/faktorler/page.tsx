"use client";
import Link from "next/link";
import { useState } from "react";
import { TEST_CATALOG } from "@/lib/content";
import { ROLE_LABEL, type ActivityRecord } from "@/lib/domain";
import { useStore } from "@/lib/useStore";
import { ErrorBox, Loading, NoTenant, Notice } from "@/components/ui";

export default function Faktorler() {
  const { store, ready } = useStore();
  const [err, setErr] = useState<unknown>(null);
  const [affected, setAffected] = useState<ActivityRecord[] | null>(null);
  if (!ready || !store) return <Loading />;
  const tenant = store.tenant;
  const ids = Array.from(new Set(TEST_CATALOG.factors.map((f) => f.id)));

  return (
    <>
      <h1>Faktör kataloğu</h1>
      <Notice kind="warn">
        <p>
          <strong>Üretim kataloğu boş.</strong> {TEST_CATALOG.note_tr} Kaynak ve birimi olmayan katsayı kataloğa giremez (§18). Faktör sürümleri alan uzmanı onayıyla etkinleşir (K-05); bu önizlemede "uzman kontrolör" rolü yayımlayabilir.
        </p>
      </Notice>
      <p className="muted">
        Yöntem: {TEST_CATALOG.method.title_tr} {TEST_CATALOG.method.id}@{TEST_CATALOG.method.version} · GWP seti {TEST_CATALOG.method.gwp_set.id} (CH₄ {TEST_CATALOG.method.gwp_set.CH4}, N₂O {TEST_CATALOG.method.gwp_set.N2O}) · {TEST_CATALOG.method.note_tr}
      </p>
      {!tenant && <NoTenant />}
      <ErrorBox error={err} />
      {affected && (
        <Notice kind={affected.length ? "warn" : "ok"}>
          <p>
            <strong>Yayımlandı.</strong> Etkilenen kayıt: {affected.length}. Eski onaylı sonuçlar değişmedi; her kayıt için yeni koşu önerilir, fark önizlemesi kayıt sayfasında (T13).
          </p>
          {affected.length > 0 && (
            <ul className="small">
              {affected.map((r) => (
                <li key={r.id}>
                  <Link href={`/kayit/?id=${r.id}`} className="mono">
                    {r.id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Kimlik@sürüm</th>
              <th>Başlık</th>
              <th>Değer</th>
              <th>Gaz</th>
              <th>Esas</th>
              <th>Sınır</th>
              <th>Geçerlilik</th>
              <th>Kaynak</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {TEST_CATALOG.factors.map((f) => {
              const pub = tenant ? store.publishedVersion(f.id) === f.version : false;
              return (
                <tr key={`${f.id}@${f.version}`}>
                  <td className="mono small">
                    {f.id}@{f.version}
                  </td>
                  <td>{f.title_tr}</td>
                  <td className="num">
                    {f.value} {f.numerator_unit} {f.gas}/{f.denominator_unit}
                  </td>
                  <td>{f.gas}</td>
                  <td>{f.basis ?? "—"}</td>
                  <td>{f.boundary}</td>
                  <td className="small">
                    {f.valid_from} → {f.valid_to ?? "açık"}
                  </td>
                  <td className="small">
                    {f.source_ref} · {f.license}
                  </td>
                  <td>{pub ? <span className="badge ok">etkin</span> : <span className="badge neutral">pasif</span>} <span className="badge warn">kurgusal</span></td>
                  <td>
                    {tenant && !pub && (
                      <button
                        disabled={store.role !== "reviewer"}
                        title={store.role !== "reviewer" ? "Yalnız uzman kontrolör yayımlar" : undefined}
                        onClick={() => {
                          setErr(null);
                          try {
                            setAffected(store.publishFactorVersion(f.id, f.version).affected);
                          } catch (e) {
                            setErr(e);
                          }
                        }}
                      >
                        Bu sürümü etkinleştir
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        {ids.length} faktör kimliği, {TEST_CATALOG.factors.length} sürüm. Rol: {ROLE_LABEL[store.role]}. Yeni faktör bildirimi eski sonucu değiştirmez; etkilenen kayıt listesi ve fark önizlemesi üretir (§18).
      </p>
    </>
  );
}
