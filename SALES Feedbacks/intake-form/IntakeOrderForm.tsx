import type { ReactNode } from 'react';
import { CheckCircle2, Globe } from 'lucide-react';
import { ToothChips } from '../design-studio/markup/FdiPicker';
import { FileList } from '../design-studio/components/FileChips';
import { portalDate, portalDateTime } from '../lab-prescription-inbox/data';
import { LabMark } from './IntakeForm';
import { IntakeConfig, IntakeSubmission } from './intakeStore';

// ── The Smile Genius order form for a website request ───────────────────────
// Everything the dentist entered on the lab's intake form, laid out as the
// lab's order form, with the files they attached. Shown as the source of a
// website draft (in place of the email pane) and on the confirmed case.

const d = (iso?: string) => (iso ? portalDate(new Date(`${iso}T12:00:00`)) : '—');

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 py-1">
      <span className="w-24 flex-shrink-0 text-[10px] font-semibold text-[#717182] uppercase tracking-wide pt-0.5">{k}</span>
      <span className="text-xs text-[#030213] min-w-0 break-words">{children || '—'}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-3.5 py-2.5 border-t border-[#F0EFF6]">
      <p className="text-[10px] font-bold text-[#1565C0] uppercase tracking-wider mb-1">{title}</p>
      {children}
    </div>
  );
}

export default function IntakeOrderForm({ sub, config, showFiles = true }: { sub: IntakeSubmission; config: IntakeConfig; showFiles?: boolean }) {
  const o = sub.order;
  const extras = Object.entries(o?.extras ?? {});
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="px-3.5 py-3 flex items-center justify-between gap-3">
        <LabMark config={config} size={32} />
        <div className="text-right min-w-0">
          <p className="text-xs font-bold text-[#030213] leading-tight">Lab order form</p>
          <p className="text-[10px] text-[#717182]">Ref <span className="font-mono font-semibold text-[#030213]">{sub.ref}</span> · {portalDateTime(sub.at)}</p>
        </div>
      </div>
      <div className="px-3.5 py-1.5 bg-[#EEF4FF] border-t border-[#DBEAFE] flex items-center gap-1.5">
        <Globe className="w-3 h-3 text-[#1565C0]" />
        <p className="text-[10px] font-semibold text-[#1565C0]">Submitted on {config.labName}'s website · Smile Genius intake form</p>
      </div>

      <Block title="Dentist">
        <Row k="Name">{sub.dentist}</Row>
        <Row k="GDC no.">{sub.gdc}</Row>
        <Row k="Practice">{sub.practice}{sub.postcode ? `, ${sub.postcode}` : ''}</Row>
        <Row k="Contact">{sub.email} · {sub.phone}</Row>
      </Block>
      <Block title="Patient">
        <Row k="Name">{sub.patientName}</Row>
        <Row k="Date of birth">{d(o?.patientDob)}</Row>
        <Row k="Clinic ref">{o?.patientRef}</Row>
      </Block>
      <Block title="Prescription">
        <Row k="Service">{sub.service}</Row>
        <Row k="Teeth (FDI)">{o?.teeth.length ? <span className="flex flex-wrap gap-1"><ToothChips teeth={o.teeth} /></span> : '—'}</Row>
        <Row k="Material">{o?.material}</Row>
        <Row k="Shade">{o?.shade}</Row>
        <Row k="Order type">{o?.orderType}</Row>
        <Row k="Needed by">{d(o?.delivery)}</Row>
        {extras.map(([k, v]) => <Row key={k} k={k}>{v}</Row>)}
      </Block>
      {o?.instructions && (
        <Block title="Clinical instructions">
          <p className="text-xs text-[#030213] leading-relaxed whitespace-pre-wrap">{o.instructions}</p>
        </Block>
      )}
      {showFiles && (
        <Block title={`Attachments (${sub.files.length})`}>
          {sub.files.length ? <div className="pt-1"><FileList files={sub.files} /></div> : <p className="text-xs text-[#717182]">No files attached.</p>}
        </Block>
      )}
      <div className="px-3.5 py-2.5 border-t border-[#F0EFF6] bg-[#F8F9FC] flex items-start gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#047857] flex-shrink-0 mt-px" />
        <p className="text-[10px] text-[#5A5568]">The sender confirmed the patient agreed to share these details and records with {config.labName} · {portalDateTime(sub.at)}</p>
      </div>
    </div>
  );
}
