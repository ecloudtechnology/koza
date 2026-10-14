"use client";
import Link from "next/link";
import { useState } from "react";
import { PREVIEW_USERS, ROLE_LABEL, PERMISSIONS } from "@/lib/domain";
import { profileById } from "@/lib/content";
import { resetAll } from "@/lib/store";
import { useStore } from "@/lib/useStore";
import { ErrorBox, Loading, Notice, PageHeader } from "@/components/ui";

export default function Ayarlar() {
  const { store, ready } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  if (!ready || !store) return <Loading />;
  const t = store.tenant;
  return (
    <>
      <PageHeader eyebrow="Kurum · §04" title="Kurum ayarları" lead="Kurum profili, görev ayrılığı politikası, rol matrisi ve önizleme verisi." />
      <Notice kind="info">
        <p>Bu önizlemede kimlik, davet, SSO, çok faktörlü doğrulama, entegrasyon ve abonelik yoktur; roller üst çubuktaki kullanıcı seçicisiyle canlandırılır. Sunucu tarafı yetki katmanı <code>apps/api/koza_api/auth.py</code> ve <code>workflow.py</code> içindedir.</p>
      </Notice>
      {t ? (
        <div className="card">
          <h2>{t.name}</h2>
          <dl className="kv">
            <dt>Kimlik</dt>
            <dd className="mono small">{t.id}</dd>
            <dt>Ülke / NACE</dt>
            <dd>
              {t.country} / {t.nace_code ?? "bilinmiyor"}
            </dd>
            <dt>Profil</dt>
            <dd>
              {profileById(t.profile_id)?.title.tr} v{t.profile_version} {t.profile_confirmed ? <span className="badge ok">kullanıcı onayladı</span> : <span className="badge warn">onaysız</span>}
            </dd>
            <dt>Görev ayrılığı</dt>
            <dd>{t.policy.allow_self_approval ? `istisna açık: ${t.policy.self_approval_reason}` : "veri giren ≠ onaylayan (varsayılan)"}</dd>
            <dt>Tesis / kaynak / dönem</dt>
            <dd>
              {store.facilities().length} / {store.sources().length} / {store.periods().length}
            </dd>
          </dl>
          <p className="small">
            <Link href="/kurulum/">Kurulumu düzenle</Link>
          </p>
          <h3>Görev ayrılığı politikası (§04)</h3>
          <p className="small">Varsayılan: veri giren ile onaylayan farklıdır. Küçük ekip istisnası gerekçe, izin veren ve süre ile kaydedilir ve raporda görünür.</p>
          <ErrorBox error={err} />
          {t.policy.allow_self_approval ? (
            <div className="actions">
              <button
                className="danger"
                disabled={store.role !== "admin"}
                onClick={() => {
                  setErr(null);
                  try {
                    store.setPolicy({ allow_self_approval: false, reason: "", until: null });
                  } catch (e) {
                    setErr(e);
                  }
                }}
              >
                İstisnayı kapat
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                try {
                  store.setPolicy({ allow_self_approval: true, reason, until: until || null });
                  setReason("");
                } catch (ex) {
                  setErr(ex);
                }
              }}
            >
              <div className="row">
                <input placeholder="İstisna gerekçesi (ör. 3 kişilik ekip, pilot süresince)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ maxWidth: 420 }} aria-label="İstisna gerekçesi" />
                <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Bitiş tarihi" style={{ maxWidth: 170 }} />
                <button type="submit" disabled={store.role !== "admin"}>
                  Küçük ekip istisnasını aç
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <p className="muted">Kurum yok.</p>
      )}
      <div className="card">
        <h2>Rol matrisi (önizleme)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>İşlem</th>
                {PREVIEW_USERS.map((u) => (
                  <th key={u.id}>{ROLE_LABEL[u.role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([action, roles]) => (
                <tr key={action}>
                  <td className="mono small">{action}</td>
                  {PREVIEW_USERS.map((u) => (
                    <td key={u.id}>{roles.includes(u.role) ? "✓" : ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Tam rol tablosu: Belgeler → Rol ve yetki matrisi. Tedarikçi, veri sorumlusu ve içerik editörü rolleri bu önizlemede kullanıcı olarak yok.</p>
      </div>
      <div className="card">
        <h2>Kurumlar arası izolasyon gösterimi (T14)</h2>
        <p className="small">İkinci bir kurum oluşturup üst çubuktan kurumu değiştirin: ilk kurumun kayıt kimliğini <code>/kayit/?id=…</code> ile açmaya çalışınca "bulunamadı" alırsınız. Bu istemci tarafı bir gösterimdir; gerçek test <code>tests/isolation/</code> altında API'ye karşı koşar (37 test geçti).</p>
        <Link className="btn" href="/kurulum/">İkinci kurum oluştur (kurulum, 1. adım — önce üst çubuktan "kurum yok" seçin)</Link>
      </div>
      <div className="card">
        <h2>Önizleme verisini sıfırla</h2>
        <p className="small">Bu tarayıcıdaki tüm kurum, kayıt, koşu, rapor ve denetim izini siler. Geri alınamaz. Üretimde böyle bir işlem yoktur; kayıt silme yerine sürümleme vardır (kural 9).</p>
        {!confirm ? (
          <button className="danger" onClick={() => setConfirm(true)}>
            Sıfırla…
          </button>
        ) : (
          <div className="actions">
            <button className="danger" onClick={() => { resetAll(); setConfirm(false); }}>
              Evet, bu tarayıcıdaki önizleme verisini sil
            </button>
            <button onClick={() => setConfirm(false)}>Vazgeç</button>
          </div>
        )}
      </div>
    </>
  );
}
