import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const TEAM = ["Muhammet Polat", "Enes Koç", "Çağla Kumru", "Elif Sarıkaş", "Havva Dönmez", "Mısra Toprak", "Okan Yılmaz", "Zeynep Esmer"];
export const MENTOR = "Onur Dedeoğlu";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toLocaleUpperCase("tr");
}

export default function Ekip() {
  return (
    <>
      <PageHeader
        eyebrow="MEXT Teknoloji Merkezi"
        title="Ekip"
        lead="Koza'yı oluşturan çalışma grubu: GreenSync Young Professionals Forum, “İş Dünyasında Sorumlu Üretim” teması. Grup, atölyedeki ESG balık kılçığını çözüm önerilerine, altı katmanlı sistem mimarisine ve TR ETS ekine dönüştürdü; bu önizleme o çıktının ürün karşılığıdır."
      />
      <h2>Çalışma grubu</h2>
      <div className="team">
        {TEAM.map((n) => (
          <div className="person" key={n}>
            <div className="avatar" aria-hidden="true">
              {initials(n)}
            </div>
            <div>
              <div className="n">{n}</div>
              <div className="r">Proje ekibi</div>
            </div>
          </div>
        ))}
      </div>
      <h2>Mentor</h2>
      <div className="team">
        <div className="person mentor">
          <div className="avatar" aria-hidden="true">
            {initials(MENTOR)}
          </div>
          <div>
            <div className="n">{MENTOR}</div>
            <div className="r">Mentor</div>
          </div>
        </div>
      </div>
      <h2>Grubun belgeleri</h2>
      <ul>
        <li>
          <Link href="/belgeler/?d=forum-tr">ESG balık kılçığı: çözüm önerileri (TR)</Link> · <Link href="/belgeler/?d=forum-en">EN</Link> — beş eksen, yol haritası, etki ölçütleri; Ek B: TR ETS entegrasyonu ve karbon varlık yönetimi (Enes Koç).
        </li>
        <li>
          <Link href="/belgeler/?d=mimari-notu">Sürdürülebilirlik odaklı sistem mimarisi ve karar akışı</Link> — altı katman, yedi adımlı karar döngüsü, yönetim modeli (Havva Dönmez).
        </li>
        <li>
          <Link href="/belgeler/?d=v11-rehber">KOZA v1.1 — forum bulgularıyla geliştirilmiş ürün yönü</Link> — forum eksenlerinin gerekliliklere eşlenmesi.
        </li>
      </ul>
      <p className="small muted">İsimler grup tarafından bildirilen listedir; rol ve iletişim bilgisi grubun onayıyla eklenir.</p>
    </>
  );
}
