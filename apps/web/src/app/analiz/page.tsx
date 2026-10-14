"use client";
import "@/modules/performans/style.css";
import { useStore } from "@/lib/useStore";
import { Loading, NoTenant, PageHeader } from "@/components/ui";
import { AnalizView } from "@/modules/performans/AnalizView";

export default function Analiz() {
  const { store, ready } = useStore();
  if (!ready || !store) return <Loading />;
  if (!store.tenant) return <NoTenant />;
  return (
    <>
      <PageHeader eyebrow="Performans · §22 · GÖS-01…04 · v1.1 yönetişim" title="Analiz ve hedefler" lead="Gösterge sözlüğü ve dönem başına değer girişi, onaylı/taslak ayrımıyla mutlak ve yoğunluk analizi, fark ayrıştırması, hedef kartı, RACI ve iki hedefin durumu." tags={["GÖS", "§22", "AKS-01 tetikleyici", "kural 2 · 5 · 7 · 11"]} />
      <AnalizView store={store} />
    </>
  );
}
