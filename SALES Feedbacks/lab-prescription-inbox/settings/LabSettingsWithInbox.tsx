import { useSearchParams } from 'react-router-dom';
import { Bell, Building2, CheckCircle2, Circle, FileText, FlaskConical, Globe, Inbox, Layers, PenTool, Plug, Sliders, User, Users } from 'lucide-react';
import SettingsPage from '../../../src/app/pages/SettingsPage';
import PrescriptionInboxSettings from './PrescriptionInboxSettings';
import RxInboxNotificationCategory from './RxInboxNotificationCategory';
import IntakeNotificationCategory from './IntakeNotificationCategory';
import IntakeFormSettings from '../../intake-form/IntakeFormSettings';
import BulkSettings from '../../bulk-actions/BulkSettings';
import CadSettings from '../../cad-integration/screens/CadSettings';

// ─── Lab Settings + "Prescription Email Inbox" tab ───────────────────────────
// SettingsPage's tab list is internal to it, so this page draws the same
// header and sidebar (markup copied from src/app/pages/SettingsPage.tsx)
// with one extra tab. Every existing tab still renders the real SettingsPage
// unchanged: it reads the same ?tab= param, and sandbox.css hides its own
// header and sidebar so only one of each shows. Notification Preferences
// also get the "Prescription Email Inbox" category appended below the real ones.

type TabId = 'personal' | 'dso' | 'services' | 'users' | 'notifications' | 'prescription-builder' | 'case-scoring' | 'scanners' | 'rx-inbox' | 'intake-form' | 'bulk-actions' | 'cad';

// Same order, labels and icons as SettingsPage's LAB_TABS, plus the new tab.
const TABS: { id: TabId; label: string; description: string; icon: any }[] = [
  { id: 'personal',             label: 'Personal Info',            description: 'Your account profile',          icon: User },
  { id: 'dso',                  label: 'DSO Info',                 description: 'Organization details',          icon: Building2 },
  { id: 'services',             label: 'Custom Services',          description: 'Your own catalogue items',      icon: FlaskConical },
  { id: 'users',                label: 'User Management',          description: 'Team members & roles',          icon: Users },
  { id: 'notifications',        label: 'Notifications',            description: 'Alerts & escalations',          icon: Bell },
  { id: 'prescription-builder', label: 'Prescription Builder',     description: 'Case form fields & services',   icon: FileText },
  { id: 'case-scoring',         label: 'Case Scoring',             description: 'Weights, bands & auto-emails',  icon: Sliders },
  { id: 'scanners',             label: 'Scanner Connections',      description: 'Tokens & expiry reminders',     icon: Plug },
  { id: 'rx-inbox',             label: 'Prescription Email Inbox', description: 'Photo Rx → AI draft cases',     icon: Inbox },
  { id: 'intake-form',          label: 'LabLink (website form)',   description: 'New cases & files from dentists', icon: Globe },
  { id: 'bulk-actions',         label: 'Bulk Actions',             description: 'Your download & print defaults', icon: Layers },
  { id: 'cad',                  label: 'CAD & design',             description: 'exocad, 3Shape, partners',       icon: PenTool },
];

// Matches SettingsPage's CONFIGURED set, plus the inbox and intake form (both exist from day one).
const CONFIGURED: TabId[] = ['personal', 'dso', 'prescription-builder', 'case-scoring', 'rx-inbox', 'intake-form', 'bulk-actions', 'cad'];

export default function LabSettingsWithInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const configured = new Set<TabId>(CONFIGURED);

  const tabParam = searchParams.get('tab');
  const subParam = searchParams.get('sub');
  const caseEmailsDeepLink = subParam === 'case-emails' || tabParam === 'case-emails';
  const activeTab: TabId =
    caseEmailsDeepLink ? 'case-scoring'
    : tabParam && TABS.some(t => t.id === tabParam) ? (tabParam as TabId) : 'personal';

  const setActiveTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'personal') next.delete('tab'); else next.set('tab', id);
    next.delete('sub');
    next.delete('focus');
    setSearchParams(next);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">Settings</h1>
        <p className="text-sm sm:text-base text-[#717182]">
          Manage your account, organization, team, and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        <aside className="lg:w-64 flex-shrink-0">
          <nav className="bg-white border border-[#E0E0E6] rounded-xl p-2 lg:sticky lg:top-6">
            {TABS.map(({ id, label, description, icon: Icon }) => {
              const active = activeTab === id;
              const done = configured.has(id);
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 mb-0.5 rounded-lg text-left transition-all relative ${
                    active
                      ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F5F3FF] text-[#030213]'
                      : 'text-[#5A5568] hover:bg-[#F8F9FC]'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
                  )}
                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${active ? 'text-[#4D8EF7]' : 'text-[#717182]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium leading-tight ${active ? 'text-[#030213]' : 'text-[#5A5568]'}`}>{label}</p>
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32] flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-[#D4CEE1] flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-tight ${done ? 'text-[#2E7D32]' : 'text-[#A0A0B0]'}`}>
                      {done ? 'Configured' : description}
                    </p>
                  </div>
                </button>
              );
            })}

            <div className="mt-2 pt-2 border-t border-[#F0EFF6]">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#717182] uppercase tracking-wide">Setup progress</span>
                <span className="text-[11px] font-semibold text-[#030213]">{configured.size}/{TABS.length}</span>
              </div>
              <div className="mx-3 mb-1 h-1 rounded-full bg-[#F3F3F5] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all"
                  style={{ width: `${(configured.size / TABS.length) * 100}%` }}
                />
              </div>
            </div>
          </nav>
        </aside>

        <section className="flex-1 min-w-0">
          {activeTab === 'rx-inbox' ? (
            <PrescriptionInboxSettings />
          ) : activeTab === 'intake-form' ? (
            <IntakeFormSettings />
          ) : activeTab === 'bulk-actions' ? (
            <BulkSettings />
          ) : activeTab === 'cad' ? (
            <CadSettings />
          ) : (
            <>
              <div className="sf-embedded-settings">
                <SettingsPage portal="lab" />
              </div>
              {activeTab === 'notifications' && subParam !== 'escalations' && (
                <div className="mt-4">
                  <RxInboxNotificationCategory focus={searchParams.get('focus') === 'rx-inbox'} />
                  <div className="mt-4"><IntakeNotificationCategory focus={searchParams.get('focus') === 'intake-form'} /></div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
