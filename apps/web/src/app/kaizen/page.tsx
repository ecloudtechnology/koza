"use client";
import "@/modules/performans/style.css";
import { useStore } from "@/lib/useStore";
import { Loading, NoTenant, PageHeader } from "@/components/ui";
import { KaizenView } from "@/modules/performans/KaizenView";

export default function Kaizen() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  return (
    <>
      <PageHeader eyebrow="Performans · KZN-01…03 · kural 11" title="Green Kaizen" lead="Saha çalışanı üç alanla öneri verir; elçi ön değerlendirir; uygun öneri aksiyon tetikleyicisi olur; uygulanan öneri ölçülen etkisiyle sahibine geri bildirilir. Pano yalnız birim düzeyindedir." tags={["KZN", "K-09", "K-10"]} />
      <KaizenView store={store} />
    </>
  );
}
