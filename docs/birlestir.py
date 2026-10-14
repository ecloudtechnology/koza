#!/usr/bin/env python3
"""Ekip çalışma dosyasını üretir: tüm proje belgelerini tek Markdown'da birleştirir.

Çıktı: docs/KOZA-EKIP-CALISMA-DOSYASI.md (içindekiler + her belge kendi bölümünde, başlıklar bir seviye indirilir).
Kullanım: python3 docs/birlestir.py   (depo kökünden)
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "KOZA-EKIP-CALISMA-DOSYASI.md"

# (bölüm, başlık, yol)
PARTS: list[tuple[str, str, str]] = [
    ("A. Projeye giriş", "README", "README.md"),
    ("A. Projeye giriş", "Ekip ve mentor", "docs/ekip.md"),
    ("A. Projeye giriş", "İnceleme rehberi", "docs/inceleme-rehberi.md"),
    ("A. Projeye giriş", "Geliştirme kuralları", "GELISTIRME-KURALLARI.md"),
    ("B. Grubun forum çıktıları", "ESG balık kılçığı: çözüm önerileri (TR)", "docs/forum/YPF-ESG-cozum-onerileri-TR.md"),
    ("B. Grubun forum çıktıları", "ESG fishbone: solution proposals (EN)", "docs/forum/YPF-ESG-cozum-onerileri-EN.md"),
    ("B. Grubun forum çıktıları", "Sistem mimarisi ve karar akışı notu", "docs/forum/sistem-mimarisi-karar-akisi.md"),
    ("C. Ürün şartnamesi", "Şartname v1.0 (§01–§34)", "docs/spec/KOZA_sartname_v1.0.md"),
    ("C. Ürün şartnamesi", "v1.1 gereklilik eki", "docs/spec/KOZA_v1.1_gereklilikler.md"),
    ("C. Ürün şartnamesi", "v1.1 rehber (uzun biçim)", "docs/spec/KOZA_v1.1_rehber.md"),
    ("D. Kararlar ve izleme", "Karar kaydı", "docs/karar-kaydi.md"),
    ("D. Kararlar ve izleme", "Gereklilik izleme matrisi", "docs/gereklilik-izleme.md"),
    ("D. Kararlar ve izleme", "Teslim notu", "docs/teslim-notu-dilim-0-1.md"),
    ("E. Tasarım ve mimari", "Rol ve yetki matrisi", "docs/rol-matrisi.md"),
    ("E. Tasarım ve mimari", "Veri modeli ve göçler", "docs/veri-modeli.md"),
    ("E. Tasarım ve mimari", "Geliştirici iş akışı", "docs/gelistirici-is-akisi.md"),
    ("E. Tasarım ve mimari", "Hesap motoru sözleşmesi v0.1", "packages/calc-engine/CONTRACT.md"),
    ("E. Tasarım ve mimari", "Hesap motoru sözleşmesi v0.2", "packages/calc-engine/CONTRACT-v0.2.md"),
    ("E. Tasarım ve mimari", "Hesap motoru README", "packages/calc-engine/README.md"),
    ("E. Tasarım ve mimari", "İş API'si README", "apps/api/README.md"),
    ("E. Tasarım ve mimari", "Web modül sözleşmesi", "apps/web/src/modules/README.md"),
    ("F. Süreç ve işletim", "Dilim döngüsü", "docs/surec/dilim.md"),
    ("F. Süreç ve işletim", "Kural kontrol listesi", "docs/surec/kontrol.md"),
    ("F. Süreç ve işletim", "Üretime geçiş yönergesi", "docs/uretime-gecis.md"),
]


def slug(s: str) -> str:
    s = s.replace("İ", "i").replace("I", "i").lower()
    for a, b in (("ı", "i"), ("ğ", "g"), ("ü", "u"), ("ş", "s"), ("ö", "o"), ("ç", "c"), ("â", "a"), ("î", "i"), ("û", "u")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def demote(md: str) -> str:
    """Başlıkları bir seviye indir (# → ##) ki belge bölümü altında kalsın; kod blokları korunur."""
    out, in_code = [], False
    for line in md.splitlines():
        if line.strip().startswith("```"):
            in_code = not in_code
        if not in_code and re.match(r"^#{1,5} ", line):
            line = "#" + line
        out.append(line)
    return "\n".join(out)


def error_dictionary() -> str:
    """apps/web/src/lib/errors.ts içindeki sözlüğü tabloya döker (kaynak/neden/sonuç/eylem)."""
    src = (ROOT / "apps/web/src/lib/errors.ts").read_text(encoding="utf-8")
    rows = re.findall(r'\{ code: "([^"]+)", title: "([^"]+)", layer: "([^"]+)", source: "([^"]*)", cause: "([^"]*)", consequence: "([^"]*)", action: "([^"]*)", requirement: "([^"]*)"', src)
    lines = ["| Kod | Başlık | Katman | Kaynak | Neden | Sonuç | Ne yapmalı | Dayanak |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for code, title, layer, source, cause, cons, action, req in rows:
        esc = lambda x: x.replace("|", "\\|")
        lines.append(f"| `{code}` | {esc(title)} | {layer} | {esc(source)} | {esc(cause)} | {esc(cons)} | {esc(action)} | {esc(req)} |")
    return "\n".join(lines)


def sector_profiles() -> str:
    out = []
    for p in sorted((ROOT / "content/sector-profiles").glob("*.yaml")):
        out.append(f"### {p.name}\n\n```yaml\n{p.read_text(encoding='utf-8').rstrip()}\n```\n")
    return "\n".join(out)


def main() -> None:
    today = dt.date.today().isoformat()
    toc, body = [], []
    section_seen: set[str] = set()
    for section, title, rel in PARTS:
        path = ROOT / rel
        if not path.exists():
            continue
        if section not in section_seen:
            section_seen.add(section)
            toc.append(f"- **{section}**")
            body.append(f"\n\n---\n\n# {section}\n")
        anchor = slug(title)
        toc.append(f"  - [{title}](#{anchor})")
        text = path.read_text(encoding="utf-8")
        body.append(f'\n\n## {title}\n\n<a id="{anchor}"></a>\n\n*Kaynak dosya: `{rel}`*\n\n{demote(text)}\n')
    # Ekler: hata sözlüğü ve sektör profilleri
    toc.append("- **G. Ekler**")
    toc.append("  - [Hata sözlüğü](#hata-sozlugu)")
    toc.append("  - [Sektör profilleri (YAML)](#sektor-profilleri-yaml)")
    body.append('\n\n---\n\n# G. Ekler\n\n## Hata sözlüğü\n\n<a id="hata-sozlugu"></a>\n\n*Kaynak: `apps/web/src/lib/errors.ts` (modül kodları çalışma anında eklenir; bkz. uygulamadaki Hata sözlüğü sayfası)*\n\n' + error_dictionary())
    body.append('\n\n## Sektör profilleri (YAML)\n\n<a id="sektor-profilleri-yaml"></a>\n\n*Kaynak: `content/sector-profiles/`*\n\n' + sector_profiles())
    head = (
        "# KOZA — Ekip Çalışma Dosyası\n\n"
        f"Üretim tarihi: {today}. Bu dosya depodaki tüm proje belgelerini tek yerde toplar; ekip bunun üzerinden çalışır. "
        "Kaynak dosyalar depoda ayrı ayrı durur; bu dosya `python3 docs/birlestir.py` ile yeniden üretilir, elle düzenlenmez. "
        "Uygulama: https://ecloudtechnology.github.io/koza/ · Depo: https://github.com/ecloudtechnology/koza\n\n"
        "## İçindekiler\n\n" + "\n".join(toc) + "\n"
    )
    OUT.write_text(head + "".join(body) + "\n", encoding="utf-8")
    words = len(OUT.read_text(encoding="utf-8").split())
    print(f"{OUT.relative_to(ROOT)} yazıldı: {len(PARTS)} belge, ~{words} kelime")


if __name__ == "__main__":
    main()
