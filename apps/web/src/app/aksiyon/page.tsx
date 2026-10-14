"use client";
import "@/modules/performans/style.css";
import { useStore } from "@/lib/useStore";
import { Loading, NoTenant, PageHeader } from "@/components/ui";
import { AksiyonView } from "@/modules/performans/AksiyonView";

export default function Aksiyon() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  return (
    <>
      <PageHeader eyebrow="Performans · AKS-01…05 · forum karar akışı (7 adım)" title="Karar kapısı ve aksiyon" lead="Tetikleyici → ön değerlendirme → veri doğrulama → seçenekler → pilot → ölçüm → karar. Etki ölçülmeden aksiyon kapanmaz; yatırım talebinde enerji/emisyon etkisi zorunludur, gölge karbon fiyatı senaryo olarak ayrı gösterilir." tags={["AKS", "kural 7", "kural 10", "v1.1 kabul"]} />
      <AksiyonView store={store} />
    </>
  );
}
