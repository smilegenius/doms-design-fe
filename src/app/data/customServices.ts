import { useSyncExternalStore } from 'react';

// ── Custom services — user-created catalogue entries ─────────────────────────
// Clinics can define their own services (Settings → Custom Services, or inline
// from the case-creation picker). There's no backend in this prototype, so the
// list lives in a tiny module store persisted to localStorage: created services
// survive reloads and are shared by every surface that reads the catalogue.
// Custom ids are namespaced `cs-…` so they never collide with the static
// catalogue's `su-` / `br-` / … ids, and `getCategoryForItem` maps them all to
// the 'custom' category (generic teeth + material + shade detail form).

export interface CustomService {
  id: string;
  name: string;
  description?: string;
  createdAt: string; // ISO date
}

const LS_KEY = 'settings.customServices';
const ID_PREFIX = 'cs-';

function load(): CustomService[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let services: CustomService[] = load();
const listeners = new Set<() => void>();

function commit(next: CustomService[]) {
  services = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage full/blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getCustomServices(): CustomService[] {
  return services;
}

export function isCustomServiceId(itemId: string): boolean {
  return itemId.startsWith(ID_PREFIX);
}

export function findCustomService(itemId: string): CustomService | undefined {
  return services.find(s => s.id === itemId);
}

export function addCustomService(input: { name: string; description?: string }): CustomService {
  const svc: CustomService = {
    id: `${ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  commit([...services, svc]);
  return svc;
}

export function removeCustomService(itemId: string) {
  commit(services.filter(s => s.id !== itemId));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Reactive read — components re-render when a custom service is added/removed. */
export function useCustomServices(): CustomService[] {
  return useSyncExternalStore(subscribe, getCustomServices);
}
