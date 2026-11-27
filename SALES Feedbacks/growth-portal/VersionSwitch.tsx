import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers } from 'lucide-react';
import { setVersion, useVersion, VERSIONS } from '../portalVersion';

// ── The design-version switch (V1 · V2), on every Growth page ────────────────
// V1 is the foundation; V2 adds the case handoff workflow on top. Same demo
// data in both, so switching back and forth is safe.

export default function VersionSwitch() {
  const v = useVersion();
  const [hover, setHover] = useState<string | null>(null);
  const about = VERSIONS.find(x => x.id === (hover ?? v))?.about;
  // On document.body: Layout's animated wrapper has a transform, which would pin "fixed" to the page.
  return createPortal(
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-white/95 backdrop-blur border border-[#E0E0E6] shadow-lg" onMouseLeave={() => setHover(null)}>
      <Layers className="w-3.5 h-3.5 text-[#7C6BFF]" />
      <span className="text-[11px] text-[#717182] hidden sm:inline min-w-[180px]">{about}</span>
      <div className="flex rounded-full bg-[#F3F3F7] p-0.5">
        {VERSIONS.map(x => (
          <button key={x.id} onMouseEnter={() => setHover(x.id)} onClick={() => setVersion(x.id)} title={x.about}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${v === x.id ? 'bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF] text-white' : 'text-[#5A5568] hover:text-[#030213]'}`}>{x.label}</button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
