import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="card">
        <span className="badge neutral">404</span>
        <h1 style={{ marginTop: "0.6rem" }}>Bu adreste sayfa yok</h1>
        <p>Adres yanlış yazılmış ya da sayfa taşınmış olabilir. Kurum verisi etkilenmez.</p>
        <div className="actions">
          <Link className="btn primary" href="/">
            Ana sayfa
          </Link>
          <Link className="btn" href="/hakkinda/">
            Koza nedir?
          </Link>
        </div>
      </div>
    </div>
  );
}
