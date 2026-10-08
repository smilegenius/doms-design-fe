// ─── What audio / photo read — shared by Capture and the case form ──────────
// Audio and photo don't have their own review screen: they prefill the same
// step-by-step form as "Manually", and pass along what they couldn't read for
// sure (flags) so the form can highlight those fields.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Mic, RotateCcw } from '../icons';
import { Card, cx } from '../ui';

export type ReadMode = 'photo' | 'audio';
export type RxScenario = 'single' | 'multi' | 'clean';

/** A field the read wasn't sure about. field = a CaseForm key, or `${itemUid}.${key}` for a service. */
export interface ReadFlag { field: string; label: string; heard: string; missing?: boolean }
export interface ReadSource {
  mode: ReadMode;
  rx: RxScenario;
  secs: number;
  transcript: { t: string; flag?: boolean }[];
  flags: ReadFlag[];
}

export const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Stylised paper Rx used as the "photo" — fixed light colours, like paper. */
export function PaperRx({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 210 270" className={className}>
      <rect width="210" height="270" rx="6" fill="#FBFBF8" />
      <rect x="16" y="16" width="90" height="10" rx="3" fill="#4D8EF7" opacity=".85" />
      <rect x="150" y="14" width="44" height="14" rx="3" fill="#E0E0E6" />
      {[44, 58, 72].map(y => <rect key={y} x="16" y={y} width={y === 58 ? 120 : 160} height="5" rx="2.5" fill="#C9C9D3" />)}
      <rect x="16" y="92" width="178" height="62" rx="5" fill="none" stroke="#D4D4DD" />
      <path d="M30 128c10-14 20 14 30 0s20 14 30 0 20 14 30 0" stroke="#2A2A3A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <text x="140" y="130" fontSize="16" fontFamily="cursive" fill="#2A2A3A">LL5</text>
      {[168, 182, 196, 210].map((y, i) => <path key={y} d={`M16 ${y} q ${40 + i * 6} -6 ${120 - i * 14} 0`} stroke="#3A3A4A" strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
      <text x="16" y="240" fontSize="13" fontFamily="cursive" fill="#2A2A3A">A2/3 ?</text>
      <path d="M120 244c10-16 18 10 26-4s12 8 22 0" stroke="#1565C0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Voice note + collapsible transcript, or the lab form photo — on top of the form's first step. */
export function SourceCard({ src, toCheck }: { src: ReadSource; toCheck: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const audio = src.mode === 'audio';
  const again = () => navigate(`/go/new/${audio ? 'audio' : 'capture'}${src.rx === 'single' ? '' : `?rx=${src.rx}`}`, { replace: true });
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        {audio
          ? <span className="w-10 h-10 rounded-full go-grad text-white flex items-center justify-center flex-shrink-0"><Mic className="w-5 h-5" /></span>
          : <PaperRx className="w-10 h-[52px] rounded-md flex-shrink-0 border border-go-line" />}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-go-ink">{audio ? `Voice note · ${fmtDur(src.secs)}` : 'Lab form photo'}</p>
          <p className={cx('text-[12px]', toCheck ? 'text-go-warn font-medium' : 'text-go-ok font-medium')}>
            {toCheck ? `${toCheck} detail${toCheck > 1 ? 's' : ''} to check` : 'Everything filled in. Check it over.'}
          </p>
        </div>
        <button onClick={again} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-go-brand">
          <RotateCcw className="w-4 h-4" />{audio ? 'Re-record' : 'Retake'}
        </button>
      </div>
      {audio && (
        // Transcript — 3 lines by default, tap to expand / collapse
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="mt-3 w-full text-left p-3 rounded-2xl bg-go-raised">
          <p className={cx('text-[13px] leading-relaxed text-go-ink2', !open && 'line-clamp-3')}>
            “{src.transcript.map((s, i) => s.flag
              ? <mark key={i} className="bg-go-warn-soft text-go-warn font-semibold rounded px-0.5">{s.t}</mark>
              : <span key={i}>{s.t}</span>)}”
          </p>
          <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-go-brand">
            {open ? 'Show less' : 'Show full transcript'}
            <ChevronDown className={cx('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
          </span>
        </button>
      )}
    </Card>
  );
}

/** Warn line under a field the read wasn't sure about. */
export function ReadHint({ flag, mode }: { flag?: ReadFlag; mode?: ReadMode }) {
  if (!flag) return null;
  return (
    <p className="text-[12px] text-go-warn font-medium mt-1.5 px-1">
      {flag.missing ? (mode === 'audio' ? 'Not mentioned in your voice note.' : 'Not found on the form.') : `${mode === 'audio' ? 'You said' : 'On the form'}: “${flag.heard}”.`} Please check.
    </p>
  );
}
