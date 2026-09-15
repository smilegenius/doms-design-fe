import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCareStackSettings } from '../../data/carestack';
import CareStackStatusCard from './CareStackStatusCard';

// ─── Settings → Integrations (Clinic + DSO) ──────────────────────────────────
// Mirrors the live portal's Integrations list: one row per connector with a
// status pill and a chevron; the connector's details open underneath when the
// row is expanded. Dentally is the existing (not connected) entry; CareStack
// sits below it and expands into the read-only status card.

type ConnectorId = 'dentally' | 'carestack';

export default function PortalIntegrationsPanel({ portal }: { portal: 'clinic' | 'supplier' }) {
  const settings = useCareStackSettings();
  const [open, setOpen] = useState<ConnectorId | null>(null);
  const toggle = (id: ConnectorId) => setOpen(o => (o === id ? null : id));

  const connectors: { id: ConnectorId; name: string; initial: string; avatarCls: string; status: string; statusCls: string; body: React.ReactNode }[] = [
    {
      id: 'dentally',
      name: 'Dentally',
      initial: 'D',
      avatarCls: 'bg-[#EEF4FF] text-[#4D8EF7]',
      status: 'Not Connected',
      statusCls: 'bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6]',
      body: (
        <div className="rounded-xl border border-[#E0E0E6] p-5">
          <p className="text-sm font-bold text-[#030213]">Dentally</p>
          <p className="text-xs text-[#717182] mt-1 leading-relaxed">
            Practice-management integration for Dentally sites. Not connected for {portal === 'clinic' ? 'your practice' : 'your group'} — contact Smile Genius support to set it up.
          </p>
        </div>
      ),
    },
    {
      id: 'carestack',
      name: 'CareStack',
      initial: 'C',
      avatarCls: 'bg-[#ECFEFF] text-[#0F766E]',
      status: settings.enabled ? (settings.connection === 'connected' ? 'Connected' : 'Disconnected') : 'Not Connected',
      statusCls: settings.enabled && settings.connection === 'connected'
        ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
        : 'bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6]',
      body: <CareStackStatusCard portal={portal} />,
    },
  ];

  return (
    <div className="divide-y divide-[#F0EFF6]">
      {connectors.map(c => {
        const expanded = open === c.id;
        return (
          <div key={c.id}>
            <button
              onClick={() => toggle(c.id)}
              aria-expanded={expanded}
              className="w-full flex items-center gap-3 py-4 text-left"
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${c.avatarCls}`}>{c.initial}</span>
              <span className="text-sm font-semibold text-[#030213] flex-1 min-w-0">{c.name}</span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.statusCls}`}>{c.status}</span>
              <ChevronDown className={`w-4 h-4 text-[#717182] flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && <div className="pb-5">{c.body}</div>}
          </div>
        );
      })}
    </div>
  );
}
