// ─── Create manually ─────────────────────────────────────────────────────────
// Mirrors the web create-case form, laid out for a phone:
//   1 Patient & lab — search existing or create on the spot (patient, offline lab)
//   2 Services      — one or more items. Each service asks exactly what the web
//                     form asks for its category (material/shade incl. per-tooth,
//                     implant system, retainer/aligner/occlusion, denture stage,
//                     appliance option, custom service name)
//                     Each service has its own delivery date; a denture has a date per
//                     stage and clear aligners (Phasing = Yes) a date per phase.
//   3 Order details — order type, appointment, source, notes, files
//   4 Review
// A case can be saved as a draft at any point and reopened filled in.
// The form model (FormItem, CaseForm, buildCase, buildDraft…) lives in lib/caseForm.ts.
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ReadHint, SourceCard } from './ReadSource';
import type { ReadSource } from '../lib/readSource';
import {
  CalendarClock, Check, CheckCircle2, ChevronRight, Eye, ImagePlus, Paperclip, PlusCircle, Search, Star, Trash, Truck, UserPlus, X,
} from '../components/icons';
import { ME, useGo } from '../store/store';
import {
  CASE_SOURCES, CLINICIANS, DetailField, IMPLANT_BRAND_CATALOG, LABS, LabCase, MATERIALS, OCCLUSION_SIDES, OTHER_SPECIFY, PATIENTS,
  PRACTICES, PracticeId, SERVICE_CATEGORIES, SHADES, STAGE_NAMES, addLab, addPatient, allItems, clinicianName, detailFields, dueLabel, fmtDate,
  freeTextMaterial, labName, needsMaterial, patientById, phaseName, practiceName, serviceLabel,
} from '../data/data';
import {
  CaseForm, FormItem, buildCase, buildDraft, emptyForm, itemComplete, itemDateSummary, itemMissing, itemName, itemStaged, itemSummary, newItem, normForm,
  chosenStages, formSoonest, normItem, plusDays, todayDay,
} from '../lib/caseForm';
import {
  Btn, Card, Chips, DateField, GoMark, Grad, Input, KV, Label, Pill, PickerField, Rows, Screen, SearchBox, Segmented, Sheet, T, TextArea, Toggle, TopBar,
  cx, useCardShadow,
} from '../components/ui';
import { useTheme } from '../theme/ThemeRoot';

const ini = (name: string) => name.split(' ').map(s => s[0]).slice(0, 2).join('');

/** Uppercase section label (web: text-[11px] font-bold uppercase tracking-[0.14em]). */
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <T className={cx('text-[11px] font-bold uppercase tracking-[1.5px] text-go-muted', className)}>{children}</T>;
}

/** The warn outline the web draws with border-go-warn + ring-4 ring-go-warn/15. */
function useWarnStyle(on: boolean | undefined) {
  const { c } = useTheme();
  return on ? { borderColor: c.warn } : undefined;
}

// ─── Tooth picker (UK Palmer-style notation: UR6, LL5…) ─────────────────────

const ARCHES = ['Upper arch', 'Lower arch', 'Both arches'] as const;
const QUADS = [
  { id: 'UR', label: 'Upper right', order: [8, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'UL', label: 'Upper left', order: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: 'LR', label: 'Lower right', order: [8, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'LL', label: 'Lower left', order: [1, 2, 3, 4, 5, 6, 7, 8] },
] as const;

export function ToothPicker({ value, onChange, invalid }: { value: string[]; onChange: (v: string[]) => void; invalid?: boolean }) {
  const [quad, setQuad] = useState<(typeof QUADS)[number]['id']>('UR');
  const shadow = useCardShadow();
  const warn = useWarnStyle(invalid);
  const q = QUADS.find(x => x.id === quad)!;
  const isArch = value.some(v => (ARCHES as readonly string[]).includes(v));
  const toggle = (t: string) => {
    const base = value.filter(v => !(ARCHES as readonly string[]).includes(v));
    onChange(base.includes(t) ? base.filter(x => x !== t) : [...base, t]);
  };
  return (
    <View className="rounded-[22px] border border-go-line p-3.5 bg-go-surface" style={warn}>
      <Chips options={ARCHES} value={isArch ? (value[0] as (typeof ARCHES)[number]) : null} onChange={(a: string) => onChange(value[0] === a ? [] : [a])} />
      <View className="flex-row items-center gap-2 my-3">
        <View className="h-px flex-1 bg-go-line" /><T className="text-[11px] text-go-faint">or individual teeth</T><View className="h-px flex-1 bg-go-line" />
      </View>
      <View className="flex-row gap-1 p-1 rounded-2xl bg-go-raised">
        {QUADS.map(x => {
          const n = value.filter(v => v.startsWith(x.id)).length;
          const on = quad === x.id;
          return (
            <Pressable key={x.id} onPress={() => setQuad(x.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              className={cx('flex-1 h-9 rounded-xl items-center justify-center', on && 'bg-go-surface')} style={on ? shadow : undefined}>
              <T className={cx('text-[12.5px] font-semibold', on ? 'text-go-ink' : 'text-go-muted')}>{x.id}</T>
              {n > 0 && <View className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-go-brand" />}
            </Pressable>
          );
        })}
      </View>
      <T className="text-[11.5px] text-go-muted text-center mt-2.5">{q.label} · {q.order[0] === 8 ? 'back → front' : 'front → back'}</T>
      <View className="flex-row gap-1.5 mt-2">
        {q.order.map(n => {
          const t = `${q.id}${n}`;
          const on = value.includes(t);
          return (
            <Pressable key={t} onPress={() => toggle(t)} accessibilityRole="button" accessibilityLabel={t} accessibilityState={{ selected: on }}
              className="flex-1 active:opacity-90">
              {on ? (
                <Grad glow className="aspect-[3/4] rounded-xl items-center justify-center"><T className="text-[14px] font-bold text-white">{n}</T></Grad>
              ) : (
                <View className="aspect-[3/4] rounded-xl items-center justify-center bg-go-raised border border-go-line"><T className="text-[14px] font-bold text-go-ink2">{n}</T></View>
              )}
            </Pressable>
          );
        })}
      </View>
      {!!value.length && (
        <View className="flex-row flex-wrap gap-1.5 mt-3 pt-3 border-t border-go-line">
          <T className="text-[12px] text-go-muted mr-1 self-center">Selected</T>
          {value.map(t => (
            <Pressable key={t} onPress={() => onChange(value.filter(x => x !== t))} accessibilityRole="button" accessibilityLabel={`Remove ${t}`}
              className="flex-row items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-go-brand-soft">
              <T className="text-[12px] font-semibold text-go-brand-ink">{t}</T><X className="w-3.5 h-3.5 text-go-brand-ink" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Patient: search existing or create on the spot ─────────────────────────

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

export function PatientPicker({ value, onChange, invalid }: { value: string | null; onChange: (id: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  // Editing the details of a patient added on the spot (web: "+ Add additional details")
  const [editId, setEditId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const blank = { name: '', id: '', dob: '', phone: '', email: '', gender: '' };
  const [np, setNp] = useState(blank);
  const [, force] = useState(0);
  const warn = useWarnStyle(invalid);
  const p = value ? patientById(value) : null;
  // Same as the web: match on name or patient ID
  const hits = PATIENTS.filter(x => `${x.name} ${x.id}`.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = PATIENTS.some(x => x.name.toLowerCase() === q.trim().toLowerCase());
  const close = () => { setOpen(false); setCreating(false); setEditId(null); setQ(''); };
  const startCreate = () => { setNp({ ...blank, name: q.trim() }); setCreating(true); };
  const ukDate = (iso: string) => (iso ? new Date(`${iso}T12:00`).toLocaleDateString('en-GB') : '—');
  const isoDate = (uk: string) => { const [d, m, y] = uk.split('/'); return y ? `${y}-${m}-${d}` : ''; };
  const editDetails = () => {
    if (!p) return;
    setNp({ name: p.name, id: p.id, dob: isoDate(p.dob), phone: (p.phone ?? '').replace(/^\+44\s*/, ''), email: p.email ?? '', gender: p.gender ?? '' });
    setEditId(p.id); setCreating(true); setOpen(true);
  };
  const save = () => {
    const details = { name: np.name.trim(), dob: ukDate(np.dob), phone: np.phone ? `+44 ${np.phone.replace(/^\+44\s*/, '')}` : undefined, email: np.email || undefined, gender: np.gender || undefined };
    if (editId) {
      const rec = PATIENTS.find(x => x.id === editId);
      if (rec) Object.assign(rec, details);
      force(n => n + 1); close(); return;
    }
    const id = addPatient({ ...details, id: np.id.trim() || undefined });
    onChange(id); force(n => n + 1); close();
  };
  const set = (k: keyof typeof np) => (v: string) => setNp(s => ({ ...s, [k]: v }));
  const extras = p?.isNew ? [p.dob !== '—' && `DOB ${p.dob}`, p.gender, p.phone, p.email].filter(Boolean) as string[] : [];

  return (
    <View>
      <Label>Patient</Label>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Patient"
        className="w-full min-h-[52px] rounded-2xl bg-go-surface border border-go-line px-3 py-2 flex-row items-center gap-3" style={warn}>
        {p ? (
          <>
            <Grad className="w-9 h-9 rounded-full items-center justify-center"><T className="text-white text-[12px] font-bold">{ini(p.name)}</T></Grad>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5">
                <T className="flex-shrink text-[15px] font-semibold truncate">{p.name}</T>{p.isNew && <Pill tone="brand" className="h-5 px-2">New</Pill>}
              </View>
              <T className="text-[12px] text-go-muted truncate">{p.isNew ? (extras.length ? extras.join(' · ') : 'Added when you create the case') : `${p.id} · DOB ${p.dob}`}</T>
            </View>
          </>
        ) : (
          <>
            <Search className="w-[18px] h-[18px] text-go-muted ml-1" />
            <T className="flex-1 text-[15px] text-go-faint">Search name or patient ID</T>
          </>
        )}
        <ChevronRight className="w-[18px] h-[18px] text-go-muted" />
      </Pressable>
      {/* New patient: details are optional — add them any time before submitting */}
      {p?.isNew && (
        <Pressable onPress={editDetails} accessibilityRole="button" className="mt-2 px-1 flex-row items-center gap-1.5 self-start">
          <PlusCircle className="w-4 h-4 text-go-brand" /><T className="text-[13px] font-semibold text-go-brand">{extras.length ? 'Edit patient details' : 'Add patient details'}</T>
        </Pressable>
      )}
      {/* Existing patient: read-only details */}
      {p && !p.isNew && (
        <Pressable onPress={() => setViewing(true)} accessibilityRole="button" className="mt-2 px-1 flex-row items-center gap-1.5 self-start">
          <Eye className="w-4 h-4 text-go-brand" /><T className="text-[13px] font-semibold text-go-brand">View patient details</T>
        </Pressable>
      )}
      {p && (
        <Sheet open={viewing} onClose={() => setViewing(false)} title={p.name} sub={`Patient ID ${p.id}`}
          footer={<Btn block variant="secondary" onPress={() => setViewing(false)}>Done</Btn>}>
          <Card className="px-4 py-1">
            <KV rows={[
              ['Patient ID', p.id],
              ['Date of birth', p.dob || '—'],
              ['Gender', p.gender ?? '—'],
              ['Phone', p.phone ?? '—'],
              ['Email', p.email ?? '—'],
            ]} />
          </Card>
          {/* Native: one modal must finish closing before the next opens */}
          <Pressable onPress={() => { setViewing(false); setTimeout(() => setOpen(true), 350); }} accessibilityRole="button" className="mt-4 w-full items-center">
            <T className="text-[13px] font-semibold text-go-brand">Choose a different patient</T>
          </Pressable>
        </Sheet>
      )}

      <Sheet open={open} onClose={close} tall title={creating ? (editId ? 'Patient details' : 'New patient') : 'Patient'}
        sub={creating ? 'Only the name is required. Add any other details now, or later.' : 'Search for a patient, or add a new one.'}
        footer={creating ? (
          <View className="flex-row gap-2">
            {!editId && <Btn variant="secondary" onPress={() => setCreating(false)}>Back</Btn>}
            <View className="flex-1">
              <Btn block disabled={!np.name.trim()} onPress={save}
                icon={editId ? <Check className="w-[18px] h-[18px] text-white" /> : <UserPlus className="w-[18px] h-[18px] text-white" />}>{editId ? 'Save details' : 'Add patient'}</Btn>
            </View>
          </View>
        ) : undefined}>
        {!creating ? (
          <>
            <View className="pb-3"><SearchBox value={q} onChange={setQ} placeholder="Name or patient ID" /></View>
            {/* Always offered, like the web's "New patient" — prefilled with whatever was typed */}
            {!exact && (
              <Pressable onPress={startCreate} accessibilityRole="button"
                className="w-full flex-row items-center gap-3 p-3 mb-3 rounded-2xl border border-dashed border-go-brand/50 bg-go-brand-soft">
                <Grad className="w-9 h-9 rounded-full items-center justify-center"><UserPlus className="w-[18px] h-[18px] text-white" /></Grad>
                <View className="flex-1 min-w-0">
                  <T className="text-[14px] font-semibold text-go-brand-ink truncate">{q.trim() ? `Add “${q.trim()}” as a new patient` : 'Add a new patient'}</T>
                  <T className="text-[12px] text-go-muted">Name only, or add their details too</T>
                </View>
                <ChevronRight className="w-4 h-4 text-go-brand" />
              </Pressable>
            )}
            <Eyebrow className="px-1 mb-1">Existing patients · {hits.length}</Eyebrow>
            <View className="gap-1">
              {hits.map(x => (
                <Pressable key={x.id} onPress={() => { onChange(x.id); close(); }} accessibilityRole="button"
                  className={cx('w-full flex-row items-center gap-3 px-3 py-2.5 rounded-2xl', x.id === value ? 'bg-go-brand-soft' : 'active:bg-go-raised')}>
                  <View className="w-9 h-9 rounded-full bg-go-raised border border-go-line items-center justify-center"><T className="text-go-ink2 text-[12px] font-bold">{ini(x.name)}</T></View>
                  <View className="flex-1 min-w-0">
                    <T className="text-[14.5px] font-medium truncate">{x.name}</T>
                    <T className="text-[12px] text-go-muted">{x.id} · DOB {x.dob}</T>
                  </View>
                  {x.id === value && <Check className="w-5 h-5 text-go-brand" />}
                </Pressable>
              ))}
              {!hits.length && <T className="text-center text-[13px] text-go-muted py-6">No patients found. You can add them as a new patient above.</T>}
            </View>
          </>
        ) : (
          // Mobile: name plus every optional detail on one screen, no extra taps
          <View className="gap-4">
            <View><Label>Full name</Label><Input autoFocus={!editId} value={np.name} onChangeText={set('name')} placeholder="e.g. Grace Mitchell" autoCapitalize="words" /></View>
            <Eyebrow className="px-1 pt-1">Additional details · optional</Eyebrow>
            <View className="flex-row gap-3">
              <View className="flex-1"><Label optional>Patient ID</Label><Input value={np.id} onChangeText={set('id')} placeholder="PAT-2026-0118" editable={!editId} className={editId ? 'opacity-50' : undefined} autoCapitalize="characters" /></View>
              <View className="flex-1"><Label optional>Date of birth</Label><DateField value={np.dob} onChange={set('dob')} max={todayDay()} placeholder="Date" accessibilityLabel="Date of birth" /></View>
            </View>
            <View>
              <Label optional>Phone</Label>
              <View className="flex-row gap-2">
                <View className="h-[52px] px-3 rounded-2xl bg-go-raised border border-go-line flex-row items-center"><T className="text-[14px] font-medium text-go-ink2">🇬🇧 +44</T></View>
                <View className="flex-1"><Input keyboardType="phone-pad" textContentType="telephoneNumber" value={np.phone} onChangeText={set('phone')} placeholder="7700 900123" /></View>
              </View>
            </View>
            <View><Label optional>Email</Label><Input keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={np.email} onChangeText={set('email')} placeholder="patient@example.com" /></View>
            <View><Label optional>Gender</Label><Chips options={GENDERS} value={np.gender || null} onChange={(v: string) => setNp(s => ({ ...s, gender: v }))} /></View>
          </View>
        )}
      </Sheet>
    </View>
  );
}

// ─── Lab: search, favourites, or add an offline lab on the spot ─────────────

export function LabPicker({ value, onChange, invalid }: { value: string | null; onChange: (id: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'fav'>('all');
  const [favs, setFavs] = useState<string[]>(['northstar']);
  const [creating, setCreating] = useState(false);
  const [nl, setNl] = useState({ name: '', town: '', email: '', phone: '' });
  const warn = useWarnStyle(invalid);
  const lab = value ? LABS.find(l => l.id === value) : null;
  const term = q.trim().toLowerCase();
  const hits = LABS.filter(l => (tab === 'all' || favs.includes(l.id)) && `${l.name} ${l.town}`.toLowerCase().includes(term));
  const exact = LABS.some(l => l.name.toLowerCase() === term);
  const close = () => { setOpen(false); setCreating(false); setQ(''); };
  const create = () => { const id = addLab({ name: nl.name.trim(), town: nl.town.trim() || '—', email: nl.email || undefined, phone: nl.phone || undefined }); onChange(id); close(); };

  return (
    <View>
      <Label>Lab</Label>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Lab"
        className="w-full min-h-[52px] rounded-2xl bg-go-surface border border-go-line px-3 py-2 flex-row items-center gap-3" style={warn}>
        {lab ? (
          <>
            <View className="w-9 h-9 rounded-xl bg-go-violet-soft items-center justify-center"><T className="text-go-violet text-[12px] font-bold">{ini(lab.name)}</T></View>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5">
                <T className="flex-shrink text-[15px] font-semibold truncate">{lab.name}</T>{lab.offline && <Pill tone="warn" className="h-5 px-2">Offline</Pill>}
              </View>
              <T className="text-[12px] text-go-muted">{lab.town}</T>
            </View>
          </>
        ) : (
          <>
            <Search className="w-[18px] h-[18px] text-go-muted ml-1" />
            <T className="flex-1 text-[15px] text-go-faint">Search for a lab</T>
          </>
        )}
        <ChevronRight className="w-[18px] h-[18px] text-go-muted" />
      </Pressable>

      <Sheet open={open} onClose={close} tall title={creating ? 'Add a lab' : 'Lab'}
        sub={creating ? 'This lab isn’t on Smile Genius yet. They’ll get the case by email.' : 'Search by name or town.'}
        footer={creating ? (
          <View className="flex-row gap-2">
            <Btn variant="secondary" onPress={() => setCreating(false)}>Back</Btn>
            <View className="flex-1">
              <Btn block disabled={!nl.name.trim()} onPress={create} icon={<PlusCircle className="w-[18px] h-[18px] text-white" />}>Add lab</Btn>
            </View>
          </View>
        ) : undefined}>
        {!creating ? (
          <>
            <View className="pb-3 gap-2">
              <SearchBox value={q} onChange={setQ} placeholder="Lab name or town" />
              <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All labs', count: LABS.length }, { value: 'fav', label: 'Favourites', count: favs.length }]} />
            </View>
            {!!term && !exact && (
              <Pressable onPress={() => { setNl({ name: q.trim(), town: '', email: '', phone: '' }); setCreating(true); }} accessibilityRole="button"
                className="w-full flex-row items-center gap-3 p-3 mb-2 rounded-2xl border border-dashed border-go-brand/50 bg-go-brand-soft">
                <Grad className="w-9 h-9 rounded-xl items-center justify-center"><PlusCircle className="w-[18px] h-[18px] text-white" /></Grad>
                <View className="flex-1 min-w-0">
                  <T className="text-[14px] font-semibold text-go-brand-ink truncate">Add “{q.trim()}” as a new lab</T>
                  <T className="text-[12px] text-go-muted">Not on Smile Genius yet</T>
                </View>
              </Pressable>
            )}
            <View className="gap-1">
              {hits.map(l => {
                const fav = favs.includes(l.id);
                return (
                  <View key={l.id} className={cx('flex-row items-center gap-3 px-3 py-2.5 rounded-2xl', l.id === value && 'bg-go-brand-soft')}>
                    <Pressable onPress={() => { onChange(l.id); close(); }} accessibilityRole="button" className="flex-1 min-w-0 flex-row items-center gap-3">
                      <View className="w-9 h-9 rounded-xl bg-go-violet-soft items-center justify-center"><T className="text-go-violet text-[12px] font-bold">{ini(l.name)}</T></View>
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-1.5">
                          <T className="flex-shrink text-[14.5px] font-medium truncate">{l.name}</T>{l.offline && <Pill tone="warn" className="h-5 px-2">Offline</Pill>}
                        </View>
                        <T className="text-[12px] text-go-muted">{l.town}</T>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => setFavs(f => (fav ? f.filter(x => x !== l.id) : [...f, l.id]))} accessibilityRole="button"
                      accessibilityLabel={fav ? 'Remove from favourites' : 'Add to favourites'} className="w-9 h-9 rounded-full items-center justify-center">
                      <Star className={cx('w-5 h-5', fav ? 'text-go-warn' : 'text-go-line')} />
                    </Pressable>
                  </View>
                );
              })}
              {!hits.length && <T className="text-center text-[13px] text-go-muted py-6">{tab === 'fav' ? 'No favourites yet. Tap the star on a lab.' : 'No labs found. You can add it as a new lab above.'}</T>}
            </View>
          </>
        ) : (
          <View className="gap-4">
            <View><Label>Lab name</Label><Input value={nl.name} onChangeText={v => setNl(s => ({ ...s, name: v }))} placeholder="e.g. Westport Denture Works" autoCapitalize="words" /></View>
            <View><Label optional>Town</Label><Input value={nl.town} onChangeText={v => setNl(s => ({ ...s, town: v }))} placeholder="e.g. Bristol" autoCapitalize="words" /></View>
            <View><Label optional>Email</Label><Input keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={nl.email} onChangeText={v => setNl(s => ({ ...s, email: v }))} placeholder="cases@lab.co.uk" /></View>
            <View><Label optional>Phone</Label><Input keyboardType="phone-pad" value={nl.phone} onChangeText={v => setNl(s => ({ ...s, phone: v }))} placeholder="+44 117 496 0000" /></View>
          </View>
        )}
      </Sheet>
    </View>
  );
}

// ─── Service editor sheet (pick a service, then its details) ────────────────

/** Chips with an "Other (specify)" escape hatch, like the web dropdowns. */
function ChoiceWithOther({ options, value, onChange, placeholder }: { options: string[]; value: string | null; onChange: (v: string | null) => void; placeholder: string }) {
  const isOther = value !== null && !options.includes(value);
  return (
    <View className="gap-2">
      <Chips options={[...options, OTHER_SPECIFY]} value={isOther ? OTHER_SPECIFY : value}
        onChange={(v: string) => onChange(v === OTHER_SPECIFY ? '' : v)} />
      {isOther && <Input autoFocus value={value ?? ''} onChangeText={onChange} placeholder={placeholder} />}
    </View>
  );
}

/** Implant system: Brand → System → Platform, as on the web form. */
function BrandField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [brand = '', system = '', platform = ''] = value ? value.split(' · ') : [];
  const node = IMPLANT_BRAND_CATALOG.find(b => b.brand === brand);
  const sys = node?.systems.find(s => s.name === system);
  const join = (b: string, s = '', p = '') => [b, s, p].filter(Boolean).join(' · ');
  return (
    <View className="gap-3">
      <PickerField label="Brand" searchable value={brand || null} onChange={b => onChange(join(b))}
        options={IMPLANT_BRAND_CATALOG.map(b => ({ value: b.brand, label: b.brand }))} />
      {brand === 'Other' ? (
        <View><Label>Brand and system</Label><Input value={system} onChangeText={v => onChange(join('Other', v))} placeholder="e.g. Osstem TSIII, regular" /></View>
      ) : node ? (
        <PickerField label="System" value={system || null} onChange={s => onChange(join(brand, s))}
          options={node.systems.map(s => ({ value: s.name, label: s.name }))} />
      ) : null}
      {sys && <View><Label>Platform</Label><Chips options={sys.platforms} value={platform || null} onChange={(p: string) => onChange(join(brand, system, p))} /></View>}
    </View>
  );
}

function DetailInput({ field, value, onChange, hint }: { field: DetailField; value: string | string[] | undefined; onChange: (v: string | string[]) => void; hint?: React.ReactNode }) {
  const v = value ?? (field.kind === 'multi' ? [] : '');
  const [cls = '', side = ''] = field.kind === 'occlusion' && (v as string) ? (v as string).split(' · ') : [];
  return (
    <View>
      <Label optional={!field.required}>{field.label}</Label>
      {field.kind === 'chips' && <Chips options={field.options ?? []} value={(v as string) || null} onChange={(x: string) => onChange(x)} />}
      {field.kind === 'multi' && <Chips options={field.options ?? []} value={v as string[]} onChange={(x: string[]) => onChange(x)} multi />}
      {field.kind === 'text' && <Input value={v as string} onChangeText={onChange} placeholder={`Enter ${field.label.toLowerCase()}`} />}
      {field.kind === 'textarea' && <TextArea rows={3} value={v as string} onChangeText={onChange} />}
      {field.kind === 'brand' && <BrandField value={v as string} onChange={onChange} />}
      {field.kind === 'occlusion' && (
        <View className="gap-2">
          <Chips options={field.options ?? []} value={cls || null} onChange={(c: string) => onChange([c, side].filter(Boolean).join(' · '))} />
          {!!cls && <Chips options={OCCLUSION_SIDES} value={side || null} onChange={(s: string) => onChange([cls, s].join(' · '))} />}
        </View>
      )}
      {hint}
    </View>
  );
}

/** Web uses a compact 156px date input in stage / phase rows; native date text needs a little more room. */
const ROW_DATE_W = 172;

/** Delivery for one service: a date, a date per denture stage, or a date per aligner phase. */
function DeliveryField({ it, set, hint }: { it: FormItem; set: (p: Partial<FormItem>) => void; hint?: React.ReactNode }) {
  const kind = itemStaged(it);
  if (kind === 'stage') {
    const st = chosenStages(it);
    const first = st.map(n => it.stageDates[n]).find(Boolean);
    return (
      <View>
        <Label hint="A date for each stage">Delivery dates</Label>
        {!st.length ? <T className="text-[12.5px] text-go-muted px-1">Please choose the stages above first.</T> : (
          <Rows className="rounded-2xl border border-go-line bg-go-surface">
            {st.map((n, i) => {
              const d = it.stageDates[n] ?? '';
              return (
                <View key={n} className="flex-row items-center gap-3 px-3 py-2.5">
                  <View className="w-6 h-6 rounded-lg bg-go-violet-soft items-center justify-center"><T className="text-go-violet text-[11px] font-bold">{i + 1}</T></View>
                  <View className="flex-1 min-w-0">
                    <T className="text-[14px] font-semibold truncate">{n}</T>
                    {!!d && d < todayDay() && <T className="text-[11.5px] text-go-muted">Done earlier</T>}
                  </View>
                  <View style={{ width: ROW_DATE_W }}>
                    <DateField accessibilityLabel={`${n} delivery date`} value={d} placeholder="Choose" onChange={x => set({ stageDates: { ...it.stageDates, [n]: x } })} />
                  </View>
                </View>
              );
            })}
          </Rows>
        )}
        {st.length > 1 && !!first && (
          <Pressable onPress={() => set({ stageDates: Object.fromEntries(st.map(n => [n, first])) })} accessibilityRole="button" className="mt-2 px-1 self-start">
            <T className="text-[13px] font-semibold text-go-brand">Use the first date for all stages</T>
          </Pressable>
        )}
        <T className="text-[12px] text-go-muted mt-2 px-1">A date in the past means that stage was done earlier. You can order more stages later from the case.</T>
        {hint}
      </View>
    );
  }
  if (kind === 'phase') {
    return (
      <View>
        <Label hint="A date for each phase">Delivery dates</Label>
        <Rows className="rounded-2xl border border-go-line bg-go-surface">
          {it.phases.map((d, i) => (
            <View key={i} className="flex-row items-center gap-3 px-3 py-2.5">
              <T className="flex-1 text-[14px] font-semibold">{phaseName(i + 1)}</T>
              <View style={{ width: ROW_DATE_W }}>
                <DateField accessibilityLabel={`${phaseName(i + 1)} delivery date`} value={d} min={plusDays(1)} placeholder="Choose"
                  onChange={x => set({ phases: it.phases.map((y, j) => (j === i ? x : y)) })} />
              </View>
              {it.phases.length > 1 && (
                <Pressable onPress={() => set({ phases: it.phases.filter((_, j) => j !== i) })} accessibilityRole="button" accessibilityLabel={`Remove ${phaseName(i + 1)}`}
                  className="w-8 h-8 rounded-full items-center justify-center"><X className="w-4 h-4 text-go-muted" /></Pressable>
              )}
            </View>
          ))}
        </Rows>
        <Pressable onPress={() => set({ phases: [...it.phases, ''] })} accessibilityRole="button" className="mt-2 flex-row items-center gap-1.5 px-1 self-start">
          <PlusCircle className="w-4 h-4 text-go-brand" /><T className="text-[13px] font-semibold text-go-brand">Add {phaseName(it.phases.length + 1)}</T>
        </Pressable>
        <T className="text-[12px] text-go-muted mt-1 px-1">You can also order the next phase later from the case.</T>
        {hint}
      </View>
    );
  }
  return (
    <View>
      <Label optional>Delivery date</Label>
      <DateField value={it.returnBy} min={plusDays(1)} onChange={x => set({ returnBy: x })} accessibilityLabel="Delivery date" />
      <View className="flex-row gap-2 mt-2">
        {[7, 10, 14, 21].map(n => {
          const on = it.returnBy === plusDays(n);
          return (
            <Pressable key={n} onPress={() => set({ returnBy: plusDays(n) })} accessibilityRole="button" accessibilityState={{ selected: on }}
              className={cx('flex-1 h-9 rounded-xl border items-center justify-center', on ? 'border-go-brand bg-go-brand-soft' : 'border-go-line')}>
              <T className={cx('text-[12.5px] font-semibold', on ? 'text-go-brand-ink' : 'text-go-ink2')}>+{n} days</T>
            </Pressable>
          );
        })}
      </View>
      {hint}
    </View>
  );
}

/** hints: per-field "please check" lines from an audio / photo read (keys: material, shade, or a detail key). */
export function ServiceSheet({ open, item, onSave, onClose, hints }: { open: boolean; item: FormItem | null; onSave: (it: FormItem) => void; onClose: () => void; hints?: Record<string, React.ReactNode> }) {
  const [draft, setDraft] = useState<FormItem | null>(item && normItem(item));
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) { setLastOpen(open); if (open) setDraft(item && normItem(item)); } // reset on open
  const set = (patch: Partial<FormItem>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const setDetail = (k: string, v: string | string[]) => setDraft(d => (d ? { ...d, details: { ...d.details, [k]: v } } : d));
  const setTooth = (t: string, patch: { material?: string | null; shade?: string | null }) =>
    setDraft(d => (d ? { ...d, perTooth: { ...d.perTooth, [t]: { ...d.perTooth[t], ...patch } } } : d));
  const missing = draft ? itemMissing(draft) : [];
  const free = draft ? freeTextMaterial(draft.itemId) : false;

  return (
    <Sheet open={open} onClose={onClose} tall title={draft ? serviceLabel(draft.itemId) : 'Add a service'}
      sub={draft ? (missing.length ? `Optional · not set: ${missing.join(', ')}` : 'All details added') : 'Choose what the lab is making.'}
      footer={draft ? (
        <View className="flex-row gap-2">
          {!item && <Btn variant="secondary" onPress={() => setDraft(null)}>Change</Btn>}
          <View className="flex-1"><Btn block onPress={() => onSave(draft)}>Save service</Btn></View>
        </View>
      ) : undefined}>
      {!draft ? (
        <View className="gap-4">
          {SERVICE_CATEGORIES.map(cat => (
            <View key={cat.id}>
              <Eyebrow className="mb-2">{cat.label}</Eyebrow>
              <View className="flex-row flex-wrap gap-2">
                {cat.items.map(s => (
                  <Pressable key={s.id} onPress={() => setDraft(newItem(s.id, { returnBy: plusDays(14) }))} accessibilityRole="button"
                    className="h-10 px-3.5 rounded-full border border-go-line bg-go-surface items-center justify-center active:border-go-brand/50">
                    <T className="text-[13.5px] font-medium">{s.label}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="gap-5">
          {/* "Other" asks for the service name first */}
          {detailFields(draft.itemId).filter(f => f.key === 'customServiceName').map(f => (
            <DetailInput key={f.key} field={f} value={draft.details[f.key]} onChange={v => setDetail(f.key, v)} hint={hints?.[f.key]} />
          ))}
          <View><Label>Teeth or arch</Label><ToothPicker value={draft.teeth} onChange={v => set({ teeth: v })} /></View>

          {needsMaterial(draft.itemId) && (
            <>
              {draft.teeth.length > 1 && !free && (
                <View className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-go-raised">
                  <T className="flex-1 text-[13.5px]">Same material and shade for all teeth</T>
                  <Toggle on={draft.sameForAll} onChange={v => set({ sameForAll: v })} label="Same material and shade for all teeth" />
                </View>
              )}
              {draft.sameForAll || free ? (
                <>
                  <View>
                    <Label>Material</Label>
                    {free ? <Input value={draft.material ?? ''} onChangeText={v => set({ material: v })} placeholder="Enter material" />
                      : <ChoiceWithOther options={MATERIALS} value={draft.material} onChange={v => set({ material: v })} placeholder="Type the material" />}
                    {hints?.material}
                  </View>
                  <View>
                    <Label>Tooth shade</Label>
                    {free ? <Input value={draft.shade ?? ''} onChangeText={v => set({ shade: v })} placeholder="Enter shade" />
                      : <ChoiceWithOther options={SHADES} value={draft.shade} onChange={v => set({ shade: v })} placeholder="Type the shade" />}
                    {hints?.shade}
                  </View>
                </>
              ) : (
                <View className="gap-2">
                  <Label>Material and shade per tooth</Label>
                  {draft.teeth.map(t => (
                    <View key={t} className="rounded-2xl border border-go-line bg-go-surface p-3">
                      <T className="text-[13px] font-bold mb-2">{t}</T>
                      <View className="flex-row gap-2">
                        <View className="flex-1">
                          <PickerField label="Material" value={draft.perTooth[t]?.material ?? null} onChange={v => setTooth(t, { material: v })}
                            options={MATERIALS.map(m => ({ value: m, label: m }))} />
                        </View>
                        <View className="flex-1">
                          <PickerField label="Shade" value={draft.perTooth[t]?.shade ?? null} onChange={v => setTooth(t, { shade: v })}
                            options={SHADES.map(s => ({ value: s, label: s }))} />
                        </View>
                      </View>
                    </View>
                  ))}
                  {!draft.teeth.length && <T className="text-[12.5px] text-go-muted">Please choose the teeth first.</T>}
                </View>
              )}
            </>
          )}

          {detailFields(draft.itemId).filter(f => f.key !== 'customServiceName').map(f => (
            <DetailInput key={f.key} field={f} value={draft.details[f.key]} onChange={v => setDetail(f.key, v)} hint={hints?.[f.key]} />
          ))}

          <View className="pt-1 border-t border-go-line" />
          <DeliveryField it={draft} set={set} hint={hints?.returnBy} />
        </View>
      )}
    </Sheet>
  );
}

// ─── Success ────────────────────────────────────────────────────────────────

export function CaseCreated({ c }: { c: LabCase }) {
  return (
    <Screen>
      {/* Web: a blurred brand glow behind the mark — omitted natively */}
      <View className="items-center px-6 pt-16">
        <Animated.View entering={FadeInUp.duration(400)}><GoMark size={84} /></Animated.View>
        <View className="mt-6 flex-row items-center gap-1.5 h-7 px-3 rounded-full bg-go-ok-soft">
          <CheckCircle2 className="w-4 h-4 text-go-ok" /><T className="text-go-ok text-[12px] font-semibold">Case created</T>
        </View>
        <T className="text-[26px] leading-[32px] font-bold mt-3 text-center">Ready to dispatch</T>
        <T className="text-[14px] text-go-muted mt-1.5 leading-[22px] text-center">
          <T className="text-[14px] font-semibold" style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>{c.id}</T> is ready to send to {labName(c.lab)}.
        </T>
      </View>
      <View className="px-4 mt-8">
        <Card className="px-4 py-1">
          <KV rows={[
            ['Patient', patientById(c.patientId).name],
            ...allItems(c).map((it, i, all) => [all.length > 1 ? `Item ${i + 1}` : 'Service', `${it.service} · ${it.teeth.join(', ')}`] as [string, string]),
            ['Next delivery', `${dueLabel(c) ? `${dueLabel(c)} · ` : ''}${fmtDate(c.returnBy)}`],
          ]} />
        </Card>
      </View>
      <View className="px-4 mt-6 gap-2.5">
        <Btn block icon={<Truck className="w-5 h-5 text-white" />} onPress={() => router.replace(`/work/${c.id}/dispatch`)}>Print label and dispatch</Btn>
        <Btn block variant="secondary" onPress={() => router.replace(`/work/${c.id}`)}>View case</Btn>
        <Btn block variant="ghost" size="md" onPress={() => router.replace('/home')}>Back to home</Btn>
      </View>
      <T className="text-center text-[12px] text-go-faint mt-4">You can send it now, or later from Lab work.</T>
    </Screen>
  );
}

// ─── Manual create ──────────────────────────────────────────────────────────

const STEPS = ['Patient & lab', 'Services', 'Order details', 'Review'];

/** Review card header: section label + Edit link. */
function ReviewHead({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <View className="flex-row items-center justify-between pt-3">
      <Eyebrow>{title}</Eyebrow>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${title}`} hitSlop={8}>
        <T className="text-[12.5px] font-semibold text-go-brand">Edit</T>
      </Pressable>
    </View>
  );
}

export default function ManualCaseScreen() {
  const { addCase, updateCase, cases, toast, pendingRead, setPendingRead } = useGo();
  const { c: col } = useTheme();
  // ?draft=SG-D1004 reopens a saved draft with everything filled in
  const { draft: draftId } = useLocalSearchParams<{ draft?: string }>();
  const draftCase = draftId ? cases.find(c => c.id === draftId && c.stage === 'draft') : undefined;
  const [step, setStep] = useState(0);
  // By audio / by photo arrive here with the read as a prefill, plus flags for what it wasn't sure about.
  // Web passed it as router state; natively it waits in the store (pendingRead) and is cleared once taken.
  const incoming = draftCase ? null : pendingRead;
  const [read, setRead] = useState<ReadSource | null>(() => incoming?.read ?? null);
  const [f, setF] = useState<CaseForm>(() => normForm(draftCase?.draftForm ? { ...emptyForm(), ...(draftCase.draftForm as CaseForm) }
    : incoming?.prefill ? { ...emptyForm(), ...incoming.prefill } : emptyForm()));
  useEffect(() => { if (pendingRead) setPendingRead(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const flags = read?.flags ?? [];
  const flagFor = (field: string) => flags.find(x => x.field === field);
  const itemFlags = (uid: string) => flags.filter(x => x.field.startsWith(`${uid}.`));
  const dropFlags = (pred: (field: string) => boolean) => setRead(r => (r ? { ...r, flags: r.flags.filter(x => !pred(x.field)) } : r));
  const hint = (field: string) => <ReadHint flag={flagFor(field)} mode={read?.mode} />;
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<LabCase | null>(null);
  const [svcOpen, setSvcOpen] = useState(false);
  const [editing, setEditing] = useState<FormItem | null>(null);
  const set = <K extends keyof CaseForm>(k: K, v: CaseForm[K]) => { setF(s => ({ ...s, [k]: v })); dropFlags(x => x === k); };

  // Compulsory: patient, dentist, lab and at least one service. A service's own fields are optional.
  // Unclear audio / photo reads stay highlighted, but don't block.
  const okByStep = useMemo(() => [!!(f.clinician && f.patientId && f.lab), f.items.length > 0, true, true], [f]);
  const ok = okByStep[step];
  const bad = (v: unknown) => tried && !v;

  const next = () => {
    if (!ok) { setTried(true); return; }
    setTried(false);
    if (step < 3) { setStep(step + 1); return; }
    const built = buildCase(f, read?.mode === 'photo' ? 'photo' : 'manual');
    // A finished draft keeps its id and becomes a live case
    const c = draftCase ? { ...built, id: draftCase.id.replace('SG-D', 'SG-2') } : built;
    if (draftCase) updateCase(draftCase.id, { ...c, draftForm: undefined }); else addCase(c);
    setCreated(c);
  };
  const saveDraft = () => {
    if (!f.patientId) { setStep(0); setTried(true); toast('Please add a patient before saving a draft', 'info'); return; }
    const d = buildDraft(f, draftCase?.id);
    if (draftCase) updateCase(draftCase.id, d); else addCase(d);
    toast('Draft saved. Find it under Draft in Lab work');
    router.replace('/work?f=draft');
  };
  const saveItem = (it: FormItem) => {
    setF(s => ({ ...s, items: s.items.some(x => x.uid === it.uid) ? s.items.map(x => (x.uid === it.uid ? it : x)) : [...s.items, it] }));
    setSvcOpen(false);
    dropFlags(x => x.startsWith(`${it.uid}.`)); // checked by you
  };
  const addFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], multiple: true, copyToCacheDirectory: false });
    if (!res.canceled) set('attachments', [...f.attachments, ...res.assets.map(a => a.name)]);
  };
  const flagsOnStep = (s: number) => flags.filter(x => (s === 1 ? x.field.includes('.') : s === 2 ? !x.field.includes('.') : false)).length;

  if (created) return <CaseCreated c={created} />;
  const soonest = formSoonest(f);
  const apptClash = !!f.apptDate && !!soonest && soonest >= f.apptDate;

  return (
    <Screen
      header={
        <View>
          <TopBar back fallback="/home" title={draftCase ? 'Finish draft' : read ? `Create lab work by ${read.mode}` : 'Create lab work manually'} sub={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
            right={<Pressable onPress={saveDraft} accessibilityRole="button" hitSlop={8} className="pr-1"><T className="text-[13px] font-semibold text-go-brand">Save draft</T></Pressable>} />
          <View className="flex-row gap-1.5 px-4 pb-3 bg-go-bg/80">
            {STEPS.map((s, i) => (i <= step
              ? <Grad key={s} className="h-1 flex-1 rounded-full" />
              : <View key={s} className="h-1 flex-1 rounded-full bg-go-line" />))}
          </View>
        </View>
      }
      footer={
        <View className="flex-row gap-2.5">
          {step > 0 && <Btn variant="secondary" onPress={() => { setStep(step - 1); setTried(false); }}>Back</Btn>}
          <View className="flex-1">
            <Btn block onPress={next} icon={step === 3 ? <Check className="w-5 h-5 text-white" /> : undefined}>
              {step === 3 ? 'Create case' : step === 1 && !f.items.length ? 'Add a service to continue' : read ? 'Confirm' : 'Continue'}
            </Btn>
          </View>
        </View>
      }>
      {tried && !ok && <T className="px-5 pt-1 pb-2 text-[13px] text-go-warn font-medium">Please fill in the highlighted details to continue.</T>}
      {!tried && step > 0 && flagsOnStep(step) > 0 && (
        <View className="mx-4 mt-1 mb-1 px-3 py-2.5 rounded-2xl bg-go-warn-soft">
          <T className="text-[13px] text-go-warn font-medium">
            {flagsOnStep(step)} detail{flagsOnStep(step) > 1 ? 's' : ''} on this step {read?.mode === 'audio' ? 'weren’t clear in your voice note' : 'weren’t clear on the form'}. Please check.
          </T>
        </View>
      )}

      {step === 0 && (
        <View className="px-4 pt-2 gap-5">
          {read && <SourceCard src={read} toCheck={flags.length} />}
          <PatientPicker value={f.patientId} onChange={v => set('patientId', v)} invalid={bad(f.patientId)} />
          <LabPicker value={f.lab} onChange={v => set('lab', v)} invalid={bad(f.lab)} />
          <PickerField label="Dentist" value={f.clinician} onChange={v => set('clinician', v)} placeholder="Choose a dentist" invalid={bad(f.clinician)}
            options={CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `GDC ${c.gdc}` }))} />
          <PickerField label="Practice" value={f.practice} onChange={v => set('practice', v as PracticeId)} invalid={bad(f.practice)}
            options={PRACTICES.map(p => ({ value: p.id, label: p.name }))} />
        </View>
      )}

      {step === 1 && (
        <View className="px-4 pt-2">
          <View className="gap-2.5">
            {f.items.map((it, i) => {
              const done = itemComplete(it);
              const unsure = itemFlags(it.uid);
              return (
                <Card key={it.uid} className="p-3.5" style={unsure.length > 0 ? { borderColor: col.warn } : undefined}>
                  <View className="flex-row items-start gap-3">
                    <Grad className="w-7 h-7 rounded-lg items-center justify-center"><T className="text-white text-[12px] font-bold">{i + 1}</T></Grad>
                    <Pressable onPress={() => { setEditing(it); setSvcOpen(true); }} accessibilityRole="button" className="flex-1 min-w-0">
                      <T className="text-[15px] font-semibold">{itemName(it)} <T className="text-[15px] text-go-muted font-medium">{it.teeth.join(', ')}</T></T>
                      <T className="text-[12px] mt-0.5 text-go-muted">{[itemSummary(it), !done && `Not set: ${itemMissing(it).join(', ')}`].filter(Boolean).join(' · ') || 'Ready'}</T>
                      <View className="flex-row items-start gap-1.5 mt-1">
                        <CalendarClock className="w-3.5 h-3.5 mt-px text-go-brand" />
                        <T className="flex-1 text-[12px] text-go-ink2">{itemDateSummary(it)}</T>
                      </View>
                      {unsure.map(u => (
                        <T key={u.field} className="text-[11.5px] text-go-warn mt-0.5">{u.label}: {read?.mode === 'audio' ? 'you said' : 'form says'} “{u.heard}”</T>
                      ))}
                    </Pressable>
                    <Pressable onPress={() => set('items', f.items.filter(x => x.uid !== it.uid))} accessibilityRole="button" accessibilityLabel={`Remove ${itemName(it)}`}
                      className="w-8 h-8 rounded-full items-center justify-center active:bg-go-bad-soft"><Trash className="w-4 h-4 text-go-muted" /></Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
          <Pressable onPress={() => { setEditing(null); setSvcOpen(true); }} accessibilityRole="button"
            className={cx('w-full mt-3 h-14 rounded-[20px] border-2 border-dashed flex-row items-center justify-center gap-2',
              bad(f.items.length) ? 'border-go-warn' : 'border-go-line active:border-go-brand/60')}>
            <PlusCircle className={cx('w-5 h-5', bad(f.items.length) ? 'text-go-warn' : 'text-go-brand')} />
            <T className={cx('text-[14px] font-semibold', bad(f.items.length) ? 'text-go-warn' : 'text-go-brand')}>{f.items.length ? 'Add another service' : 'Add a service'}</T>
          </Pressable>
          {f.items.length > 1 && <T className="text-[12px] text-go-muted text-center mt-3">{f.items.length} services on one case · each has its own delivery date</T>}
        </View>
      )}

      {step === 2 && (
        <View className="px-4 pt-2 gap-5">
          <View>
            <Label optional>Order type</Label>
            <View className={cx('rounded-2xl', (flagFor('funding') || bad(f.funding)) && 'border-2 border-go-warn/60')}>
              <Segmented value={(f.funding ?? '') as 'NHS'} onChange={v => set('funding', v)} options={[{ value: 'NHS', label: 'NHS' }, { value: 'Private', label: 'Private' }]} />
            </View>
            {hint('funding')}
          </View>
          <View>
            <Label optional>Patient appointment</Label>
            <View className="flex-row gap-2 items-center">
              <View className="flex-1"><DateField value={f.apptDate} onChange={v => set('apptDate', v)} accessibilityLabel="Patient appointment" /></View>
              {/* Native DateField has its own clear button; the browser date input doesn't */}
              {Platform.OS === 'web' && !!f.apptDate && (
                <Pressable onPress={() => set('apptDate', '')} accessibilityRole="button" accessibilityLabel="Clear appointment" className="w-10 h-10 rounded-full bg-go-raised items-center justify-center">
                  <X className="w-4 h-4 text-go-muted" />
                </Pressable>
              )}
            </View>
            {!!f.apptDate && <View className="mt-2"><Chips options={['Fit', 'Try-in', 'Issue'] as const} value={f.apptKind} onChange={v => set('apptKind', v)} /></View>}
            {apptClash && <T className="text-[12px] text-go-bad mt-2 px-1">The first delivery date is on or after the appointment. Please choose an earlier date on the service.</T>}
          </View>
          <View><Label optional>Case source</Label><Chips options={CASE_SOURCES} value={f.caseSource} onChange={(v: string) => set('caseSource', v)} /></View>
          <View><Label optional>Case instructions</Label><TextArea rows={4} value={f.instructions} onChangeText={v => set('instructions', v)} placeholder="Any specific instructions for the lab…" /></View>
          <View>
            <Label optional>Attachments</Label>
            <Pressable onPress={addFiles} accessibilityRole="button"
              className="w-full h-20 rounded-[22px] border-2 border-dashed border-go-line active:border-go-brand/60 items-center justify-center gap-1">
              <ImagePlus className="w-6 h-6 text-go-brand" />
              <T className="text-[13px] font-semibold">Add photos, X-rays or other files</T>
            </Pressable>
            {!!f.attachments.length && (
              <View className="mt-3 gap-2">
                {f.attachments.map((a, i) => (
                  <View key={a + i} className="flex-row items-center gap-2.5 h-11 px-3.5 rounded-2xl bg-go-surface border border-go-line">
                    <Paperclip className="w-4 h-4 text-go-muted" /><T className="flex-1 truncate text-[13px]">{a}</T>
                    <Pressable onPress={() => set('attachments', f.attachments.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${a}`} hitSlop={8}>
                      <X className="w-4 h-4 text-go-muted" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {step === 3 && (
        <View className="px-4 pt-2 gap-3">
          <Card className="px-4 py-1">
            <ReviewHead title="Patient & lab" onEdit={() => setStep(0)} />
            <KV rows={[
              ['Patient', `${patientById(f.patientId!).name}${patientById(f.patientId!).isNew ? ' (new)' : ''}`],
              ['Lab', labName(f.lab!)],
              ['Dentist', clinicianName(f.clinician!)],
              ['Practice', practiceName(f.practice!)],
            ]} />
          </Card>
          <Card className="px-4 py-1">
            <ReviewHead title={`Services · ${f.items.length}`} onEdit={() => setStep(1)} />
            <KV rows={f.items.map((it, i) => [`${i + 1}. ${itemName(it)}`, (
              <View key={it.uid} className="items-end">
                <T className="text-[13.5px] font-medium text-right">{it.teeth.join(', ')}</T>
                {!!itemSummary(it) && <T className="text-[12px] text-go-muted text-right">{itemSummary(it)}</T>}
                <T className="text-[12px] text-go-ink2 text-right">{itemDateSummary(it)}</T>
              </View>
            )] as [string, React.ReactNode])} />
          </Card>
          <Card className="px-4 py-1">
            <ReviewHead title="Order details" onEdit={() => setStep(2)} />
            <KV rows={[
              ['Order type', f.funding ?? '—'],
              ['Appointment', f.apptDate ? `${f.apptKind} · ${fmtDate(new Date(f.apptDate).toISOString())}` : 'Not booked'],
              ['Case source', f.caseSource ?? '—'],
              ['Attachments', f.attachments.length ? `${f.attachments.length} file${f.attachments.length > 1 ? 's' : ''}` : 'None'],
            ]} />
            {!!f.instructions && <View className="py-3 border-t border-go-line"><T className="text-[13.5px] leading-[21px]">{f.instructions}</T></View>}
          </Card>
          <T className="px-1 text-[12px] text-go-muted leading-[18px]">
            Created by {ME.name} on behalf of {clinicianName(f.clinician!)} (GDC {CLINICIANS.find(c => c.id === f.clinician)!.gdc}), the prescribing dentist.
          </T>
        </View>
      )}

      <ServiceSheet open={svcOpen} item={editing} onSave={saveItem} onClose={() => setSvcOpen(false)}
        hints={editing ? Object.fromEntries(itemFlags(editing.uid).map(x => [x.field.slice(editing.uid.length + 1), hint(x.field)])) : undefined} />
    </Screen>
  );
}
