import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import PortalSelectPage from '../../src/app/pages/PortalSelectPage';
import { useAuth } from '../../src/app/context/AuthContext';
import { GROWTH_BASE } from '../growthIsolation';

// ── Portal select + "Growth Team Feedback" ───────────────────────────────────
// The real PortalSelectPage, unchanged, with one extra full-width card slotted
// in after Smile Genius Go (markup follows that card). It's attached at
// runtime, like the case-page items, so src/ stays untouched.

const FEATURES = ['Prescription email inbox', 'Design Studio reviews', 'Clinician upload links', 'Website intake form'];

function GrowthCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const open = () => navigate(user ? GROWTH_BASE : `/login?portal=lab&next=${encodeURIComponent(GROWTH_BASE)}`);
  return (
    <section className="w-full max-w-5xl mt-6">
      <button
        onClick={open}
        className="group relative w-full text-left bg-white border border-[#E0E0E6] rounded-2xl p-6 overflow-hidden hover:shadow-xl hover:border-[#0F9F8F] transition-all"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{ background: 'radial-gradient(circle at right top, #0F9F8F14, transparent 60%), radial-gradient(circle at 70% 120%, #4D8EF714, transparent 60%)' }}
        />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#0F9F8F] to-[#4D8EF7] shadow-[0_8px_20px_-8px_rgba(15,159,143,.6)]">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-[#030213] leading-tight">Growth Team Feedback</h2>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-[#ECFDF5] text-[#047857] border-[#A7F3D0] flex-shrink-0">Lab portal</span>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-[#FFF8E1] text-[#B45309] border-[#FDE68A] flex-shrink-0">In progress</span>
            </div>
            <p className="text-xs text-[#717182] mt-1 leading-relaxed">
              Sales feedback features on a separate copy of the Lab portal. Nothing here changes the other portals.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {FEATURES.map(f => (
                <span key={f} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F8F9FC] text-[#5A5568] border border-[#F0EFF6]">{f}</span>
              ))}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-[#0F9F8F] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>
    </section>
  );
}

/** Where the card goes: right after the Smile Genius Go section. */
function findAnchor(): Element | null {
  for (const h of document.querySelectorAll('main h2')) {
    if (h.textContent?.trim() === 'Smile Genius Go') return h.closest('section');
  }
  return null;
}

export default function PortalSelectWithGrowth() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const anchor = findAnchor();
    if (!anchor) return;
    const el = document.createElement('div');
    el.className = 'w-full max-w-5xl flex flex-col items-center';
    anchor.insertAdjacentElement('afterend', el);
    setHost(el);
    return () => { el.remove(); setHost(null); };
  }, []);
  return (
    <>
      <PortalSelectPage />
      {host && createPortal(<GrowthCard />, host)}
    </>
  );
}
