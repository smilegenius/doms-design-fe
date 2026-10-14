import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import IntakeForm from './IntakeForm';
import { useIntake } from './intakeStore';

// ── /intake/:slug — the lab's public intake form ─────────────────────────────
// Linked from the lab's website, or embedded there with ?embed=1 (no page
// background or padding, so it sits inside the lab's own iframe).

export default function PublicIntakePage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const { config } = useIntake();
  const found = slug === config.slug;

  useEffect(() => { document.title = found ? `New case · ${config.labName}` : 'Form not found'; }, [found, config.labName]);
  useEffect(() => {
    if (!embed) return;
    const prev = document.body.style.background;
    document.body.style.background = 'transparent';
    return () => { document.body.style.background = prev; };
  }, [embed]);

  const body = found ? <IntakeForm config={config} /> : (
    <div className="bg-white border border-[#E0E0E6] rounded-2xl px-6 py-12 text-center">
      <p className="text-sm font-semibold text-[#030213]">We couldn't find this form</p>
      <p className="text-xs text-[#717182] mt-1">The lab may have changed its link. Please contact them directly.</p>
    </div>
  );

  return embed
    ? <div className="max-w-3xl mx-auto">{body}</div>
    : <div className="min-h-screen bg-[#F8F9FC] px-4 py-8 sm:py-12"><div className="max-w-3xl mx-auto">{body}</div></div>;
}
