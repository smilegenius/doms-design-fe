import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Case } from '../../src/app/pages/CasesPage';
import { mockCases } from '../../src/app/pages/CasesPage';
import { getCreatedCases } from '../../src/app/data/createdCases';
import type { DesignFile } from '../design-studio/data/designStudio';
import { getFile } from '../design-studio/store/fileStore';
import { sampleForCase } from '../lab-prescription-inbox/inboxStore';
import IntakeOrderForm from '../intake-form/IntakeOrderForm';
import { withOrder } from '../intake-form/IntakeFilesDock';
import { getIntakeConfig, labLinkForCase, submissionBehind } from '../intake-form/intakeStore';
import { emailBehind, emailForDraft, emailsForCase, type ForwardedEmail } from '../forwarded-email/emailStore';
import { convertedFrom } from './draftCases';
import { ScannerOrderFormPrint, SgOrderFormPrint } from './printForms';
import type { FolderNaming, IncludeKey } from './bulkDefaults';
import type { ZipEntry } from './zip';

// ── What Bulk Actions knows about a case ─────────────────────────────────────
// Every case the lab can see in Growth (created + the portal's seeded cases),
// the real files attached to each (LabLink, forwarded emails, prescription
// photos), and its original order form, if it has one.

export function allCases(): Case[] {
  const created = getCreatedCases();
  const ids = new Set(created.map(c => c.id));
  return [...created, ...mockCases.filter(c => !ids.has(c.id))].filter(c => !c.archived);
}

const safe = (s: string) => s.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'file';
const abs = (u: string) => new URL(u, window.location.origin).href;

/** The draft a case came from, if it was converted (so its originals still resolve). */
const origin = (c: Case) => convertedFrom(c.id) ?? c.id;

function originalEmail(c: Case): ForwardedEmail | undefined {
  return emailBehind(c.id) ?? emailForDraft(origin(c));
}

/** Everything that counts as the case's original order form. */
export function originalForms(c: Case): { label: string; node: ReactElement }[] {
  const out: { label: string; node: ReactElement }[] = [];
  const sub = submissionBehind(c.id) ?? submissionBehind(origin(c));
  if (sub) out.push({ label: `LabLink form ${sub.ref}`, node: <IntakeOrderForm sub={withOrder(sub)} config={getIntakeConfig()} print /> });
  const rx = sampleForCase(origin(c));
  if (rx) {
    out.push({
      label: `Prescription photo (${rx.pages.length} page${rx.pages.length === 1 ? '' : 's'})`,
      node: (
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>{c.id} · Original prescription ({rx.photoName})</p>
          {rx.pages.map((p, i) => <img key={i} src={abs(p)} alt={`Page ${i + 1}`} style={{ width: '100%', marginBottom: 12, border: '1px solid #E0E0E6' }} />)}
        </div>
      ),
    });
  }
  const em = originalEmail(c);
  const ep = c.emailPrescription;
  if (em || (!sub && !rx && ep)) {
    out.push({
      label: 'Original email',
      node: (
        <div style={{ fontSize: 12, color: '#030213' }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>{c.id} · Original email</p>
          <p style={{ margin: '2px 0' }}><b>From:</b> {em ? `${em.fromName} <${em.fromEmail}>` : `${ep!.fromName} <${ep!.fromEmail}>`}</p>
          <p style={{ margin: '2px 0' }}><b>Subject:</b> {em?.subject ?? ep!.subject}</p>
          <p style={{ margin: '2px 0 10px' }}><b>Received:</b> {em ? new Date(em.at).toLocaleString('en-GB') : ep!.receivedAt}</p>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, borderTop: '1px solid #F0EFF6', paddingTop: 10 }}>{em?.body ?? ep!.bodyPreview}</p>
          <p style={{ color: '#717182', marginTop: 10 }}>Attachments: {em ? em.files.map(f => f.name).join(', ') || 'none' : ep!.attachmentName}</p>
        </div>
      ),
    });
  }
  // A scanner case's original is the scanner's order form.
  if (!out.length && c.source === 'scanner') out.push({ label: `${c.scanner} scanner order form`, node: <ScannerOrderFormPrint c={c} /> });
  return out;
}

/** Real (downloadable) files on a case, with a short label of where each came from. */
export function caseFiles(c: Case): { file: DesignFile; from: string }[] {
  return [
    ...labLinkForCase(c.id).flatMap(s => s.files.map(file => ({ file, from: `LabLink ${s.ref}` }))),
    ...emailsForCase(c.id).flatMap(e => e.files.map(file => ({ file, from: `Email ${e.id}` }))),
    // An email draft not yet resolved still carries its files.
    ...(c.status === 'draft' ? (emailForDraft(c.id)?.files ?? []).map(file => ({ file, from: 'Email draft' })) : []),
  ];
}

/** A standalone HTML file. `withAppStyles` copies the app's CSS (only forms built from app components need it). */
function htmlDoc(title: string, node: ReactElement, withAppStyles = false) {
  const styles = withAppStyles ? [...document.querySelectorAll('style')].map(s => s.outerHTML).join('\n') : '<style>body{font-family:system-ui,sans-serif}</style>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${styles}<style>body{background:#fff;margin:0;padding:24px;max-width:760px}</style></head><body>${renderToStaticMarkup(node)}</body></html>`;
}

const ALL: Record<IncludeKey, boolean> = { scans: true, dicom: true, photos: true, docs: true, sgForm: true, originalForm: true, fileList: true };

/** Which download filter a file falls under. */
export const includeKeyOf = (f: DesignFile): IncludeKey =>
  f.kind === 'mesh' ? 'scans' : f.kind === 'dicom' ? 'dicom' : f.kind === 'image' ? 'photos' : 'docs';

export function folderFor(c: Case, naming: FolderNaming) {
  return naming === 'id' ? safe(c.id) : naming === 'practice-id' ? `${safe(c.practice || 'No practice')}/${safe(c.id)}` : `${safe(c.id)}_${safe(c.patientName)}`;
}

/** Files and bytes a download would include, without reading any file. */
export function estimate(cases: Case[], include: Record<IncludeKey, boolean>) {
  let files = 0, bytes = 0;
  for (const c of cases) {
    if (include.sgForm) { files++; bytes += 6_000; }
    if (include.originalForm) { const n = originalForms(c).length; files += n; bytes += n * 8_000; }
    if (include.fileList) { files++; bytes += 500; }
    for (const { file } of caseFiles(c)) {
      if (!include[includeKeyOf(file)]) continue;
      files += file.parts?.length ?? 1; bytes += file.size;
    }
    const rx = sampleForCase(origin(c));
    if (rx && include.photos) { files += rx.pages.length; bytes += rx.pages.length * 300_000; }
  }
  return { files, bytes };
}

/** One case's folder in the bulk ZIP. */
export async function zipEntriesFor(c: Case, include: Record<IncludeKey, boolean> = ALL, naming: FolderNaming = 'id-patient'): Promise<ZipEntry[]> {
  const dir = folderFor(c, naming);
  const entries: ZipEntry[] = include.sgForm ? [{ path: `${dir}/order-form.html`, data: htmlDoc(`${c.id} order form`, <SgOrderFormPrint c={c} />) }] : [];
  if (include.originalForm) originalForms(c).forEach((o, i) => {
    if (o.label.startsWith('Prescription photo')) return; // the pages go in as images below
    entries.push({ path: `${dir}/original-${i + 1}_${safe(o.label)}.html`, data: htmlDoc(o.label, o.node, o.label.startsWith('LabLink')) });
  });
  const listed: string[] = [];
  for (const { file, from } of caseFiles(c)) {
    if (!include[includeKeyOf(file)]) continue;
    if (file.parts?.length) {
      for (const [i, id] of file.parts.entries()) {
        const b = await getFile(id);
        if (b) entries.push({ path: `${dir}/${safe(file.name)}/IM${String(i + 1).padStart(4, '0')}.dcm`, data: b });
      }
      listed.push(`${file.name}/ (DICOM, ${file.parts.length} files) · ${from}`);
      continue;
    }
    const b = await getFile(file.id);
    if (b) { entries.push({ path: `${dir}/${safe(file.name)}`, data: b }); listed.push(`${file.name} · ${from}`); }
  }
  const rx = sampleForCase(origin(c));
  if (rx && include.photos) {
    for (const [i, p] of rx.pages.entries()) {
      const b = await fetch(p).then(r => (r.ok ? r.blob() : null)).catch(() => null);
      if (b) { entries.push({ path: `${dir}/prescription-photo_page-${i + 1}.jpg`, data: b }); listed.push(`prescription-photo_page-${i + 1}.jpg · Prescription inbox`); }
    }
  }
  const scans = (c.serviceItems ?? []).reduce((n, si) => n + (si.scanFileCount ?? 0), 0);
  const atts = (c.serviceItems ?? []).reduce((n, si) => n + (si.attachmentCount ?? 0), 0);
  if (include.fileList) entries.push({
    path: `${dir}/files.txt`,
    data: [
      `${c.id} · ${c.patientName} · ${c.practice} · ${c.dentist}`,
      `Services: ${c.services.join(', ')} · Status: ${c.status}`,
      '',
      'In this folder:',
      ...(include.sgForm ? ['  order-form.html (Smile Genius order form)'] : []),
      ...listed.map(l => `  ${l}`),
      '',
      scans || atts ? `Kept with the case${c.source === 'scanner' ? ` (on the ${c.scanner} portal)` : ''}, not in this download: ${scans} scan file${scans === 1 ? '' : 's'}, ${atts} attachment${atts === 1 ? '' : 's'}.` : '',
    ].join('\n'),
  });
  return entries;
}
