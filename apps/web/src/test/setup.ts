// Node altında tarayıcı deposu ve olay sistemi için en küçük taklit (vitest). jsdom gerekmez.
const mem = new Map<string, string>();
const ls = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => Array.from(mem.keys())[i] ?? null,
  get length() {
    return mem.size;
  },
};
const target = new EventTarget();
Object.assign(globalThis, {
  localStorage: ls,
  window: Object.assign(target, { localStorage: ls }),
});
