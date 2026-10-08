// ─── Smile Genius Go — app state ─────────────────────────────────────────────
// One in-memory store for the prototype: auth, theme, practice scope, lab
// work, finance and toasts. Nothing leaves the browser.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ATTENTION, Invoice, InvoiceStatus, LabCase, PracticeId, SEED_CASES, SEED_INVOICES, SEED_STATEMENTS, Statement, matchesAttention, nowIso,
} from './data';

/** Reviewer demo: how many of Home's four statuses have work (1–4), or 0 = a
 *  brand-new practice with no lab work at all. null = the normal seed data. */
export type DemoFill = 0 | 1 | 2 | 3 | 4 | null;

export type ThemePref = 'light' | 'dark' | 'system';
export type ToastTone = 'ok' | 'info' | 'bad';
export interface Toast { id: number; text: string; tone: ToastTone }
export interface Notice { id: string; title: string; body: string; at: string; to: string; read: boolean; kind: 'question' | 'shipped' | 'invoice' | 'overdue' | 'statement' }

// Signed-in user — the app is used mostly by practice managers and nurses.
export const ME = { name: 'John Carter', first: 'John', role: 'Practice manager', email: 'john.carter@example.test' };

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const sessGet = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const sessSet = (k: string, v: string | null) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ignore */ } };

interface GoStore {
  themePref: ThemePref;
  theme: 'light' | 'dark';
  setThemePref: (t: ThemePref) => void;
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  practice: PracticeId | 'all';
  setPractice: (p: PracticeId | 'all') => void;
  /** Set when the signed-in user belongs to one practice only — no switcher. */
  soloPractice: PracticeId | null;
  setSoloPractice: (p: PracticeId | null) => void;
  demoFill: DemoFill;
  setDemoFill: (f: DemoFill) => void;
  /** Setup switch (reviewer side panel): show the Invoices section on Home. Off for now. */
  homeInvoices: boolean;
  setHomeInvoices: (on: boolean) => void;
  cases: LabCase[];
  updateCase: (id: string, patch: Partial<LabCase> | ((c: LabCase) => Partial<LabCase>)) => void;
  addCase: (c: LabCase) => void;
  invoices: Invoice[];
  setInvoiceStatus: (id: string, status: InvoiceStatus, activity: string) => void;
  statements: Statement[];
  updateStatement: (id: string, fn: (s: Statement) => Statement) => void;
  notices: Notice[];
  markNoticesRead: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: ToastTone) => void;
  /** Portal target for sheets so they stay inside the phone frame. */
  sheetRoot: HTMLElement | null;
  setSheetRoot: (el: HTMLElement | null) => void;
}

const Ctx = createContext<GoStore | null>(null);

export function GoStoreProvider({ children }: { children: React.ReactNode }) {
  const [themePref, setThemePrefState] = useState<ThemePref>(() => (safeGet('sg-go-theme') as ThemePref) || 'system');
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const setThemePref = useCallback((t: ThemePref) => { setThemePrefState(t); safeSet('sg-go-theme', t); }, []);
  const theme = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;

  const [signedIn, setSignedIn] = useState(() => sessGet('sg-go-auth') === '1');
  const signIn = useCallback(() => { setSignedIn(true); sessSet('sg-go-auth', '1'); }, []);
  const signOut = useCallback(() => { setSignedIn(false); sessSet('sg-go-auth', null); }, []);

  const [practice, setPractice] = useState<PracticeId | 'all'>('all');
  const [soloPractice, setSoloPractice] = useState<PracticeId | null>(null);
  const [demoFill, setDemoFill] = useState<DemoFill>(null);
  const [homeInvoices, setHomeInvoicesState] = useState(() => safeGet('sg-go-home-invoices') === '1');
  const setHomeInvoices = useCallback((on: boolean) => { setHomeInvoicesState(on); safeSet('sg-go-home-invoices', on ? '1' : '0'); }, []);
  const [cases, setCases] = useState<LabCase[]>(SEED_CASES);
  const [invoices, setInvoices] = useState<Invoice[]>(SEED_INVOICES);
  const [statements, setStatements] = useState<Statement[]>(SEED_STATEMENTS);
  const [notices, setNotices] = useState<Notice[]>(() => [
    { id: 'n1', kind: 'question', title: 'Additional information required', body: 'Northstar Dental Lab · SG-28485 · M. Patel. Bite registration looks distorted.', at: SEED_CASES[3].messages[0].at, to: '/go/work/SG-28485', read: false },
    { id: 'n2', kind: 'shipped', title: 'Shipped by Precision Dental Works', body: 'SG-28488 · J. Williams. Arriving today.', at: SEED_CASES[2].events[4].at, to: '/go/work/SG-28488', read: false },
    { id: 'n3', kind: 'invoice', title: 'Invoice needs review', body: 'PDW-7731 · 38% above usual for full dentures.', at: SEED_INVOICES[0].received, to: '/go/invoices/invoice/PDW-7731', read: false },
    { id: 'n4', kind: 'overdue', title: 'Lab work overdue', body: 'SG-28479 · D. Morgan. Delivery date was 2 days ago.', at: new Date(Date.now() - 2 * 864e5).toISOString(), to: '/go/work/SG-28479', read: true },
    { id: 'n5', kind: 'statement', title: 'Statement received', body: 'Dental Supplies UK · 2 lines to resolve.', at: new Date(Date.now() - 3 * 864e5).toISOString(), to: '/go/invoices/statement/ST-DSU-0926', read: true },
  ]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sheetRoot, setSheetRoot] = useState<HTMLElement | null>(null);

  const toast = useCallback((text: string, tone: ToastTone = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  const value = useMemo<GoStore>(() => ({
    themePref, theme, setThemePref, signedIn, signIn, signOut, practice, setPractice, soloPractice, setSoloPractice, demoFill, setDemoFill, homeInvoices, setHomeInvoices,
    cases,
    updateCase: (id, patch) => setCases(cs => cs.map(c => (c.id === id ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c))),
    addCase: c => setCases(cs => [c, ...cs]),
    invoices,
    setInvoiceStatus: (id, status, activity) =>
      setInvoices(is => is.map(i => (i.id === id ? { ...i, status, activity: [...i.activity, { text: activity, at: nowIso() }] } : i))),
    statements,
    updateStatement: (id, fn) => setStatements(ss => ss.map(s => (s.id === id ? fn(s) : s))),
    notices,
    markNoticesRead: () => setNotices(ns => ns.map(n => ({ ...n, read: true }))),
    toasts, toast, sheetRoot, setSheetRoot,
  }), [themePref, theme, setThemePref, signedIn, signIn, signOut, practice, soloPractice, demoFill, homeInvoices, setHomeInvoices, cases, invoices, statements, notices, toasts, toast, sheetRoot]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGo() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGo outside GoStoreProvider');
  return v;
}

/** Cases / invoices narrowed to the selected practice (and the reviewer demo fill). */
export function useScoped() {
  const { cases, invoices, statements, practice, demoFill } = useGo();
  return useMemo(() => {
    const inScope = <T extends { practice: PracticeId }>(xs: T[]) => (practice === 'all' ? xs : xs.filter(x => x.practice === practice));
    if (demoFill === 0) return { cases: [] as LabCase[], invoices: [] as Invoice[], statements: [] as Statement[] };
    // Drop the work behind Home's later statuses so only the first N have counts
    const off = demoFill === null ? [] : ATTENTION.filter(a => a.home).slice(demoFill).map(a => a.id);
    const shown = off.length ? cases.filter(c => !off.some(a => matchesAttention(c, a))) : cases;
    return { cases: inScope(shown), invoices: inScope(invoices), statements: inScope(statements) };
  }, [cases, invoices, statements, practice, demoFill]);
}
