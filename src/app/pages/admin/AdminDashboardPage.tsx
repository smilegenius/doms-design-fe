import { useState } from 'react';
import { ShieldCheck, Building, Users, DollarSign, Activity } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import AdminSuppliersContent from './AdminSuppliersContent';

function StatCard({ label, value, icon, color, bgColor }: {
  label: string; value: string; icon: React.ReactNode; color: string; bgColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E0E0E6] p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-sm text-[#717182] mb-0.5">{label}</p>
        <p className="text-xl font-semibold text-[#030213]">{value}</p>
      </div>
    </div>
  );
}

const recentActivity = [
  { action: 'New tenant registered',  detail: 'Brightsmile Dental Group',              time: '2 min ago'  },
  { action: 'User role updated',       detail: 'admin@cityortho.com → Portal Admin',    time: '18 min ago' },
  { action: 'Subscription activated', detail: 'Premier Dental Partners · Pro Plan',    time: '1 hr ago'   },
  { action: 'Supplier submitted',      detail: 'Northwood Dental Labs — pending review', time: '2 hr ago'   },
  { action: 'New tenant registered',  detail: 'Westside Family Dental',                time: '5 hr ago'   },
];

function DashboardContent() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4D8EF7]/10 to-[#A59DFF]/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[#A59DFF]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#030213]">Super Admin Portal</h1>
          <p className="text-sm text-[#717182]">Platform overview and operations</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Tenants"  value="142"     icon={<Building className="w-5 h-5" />}    color="#4D8EF7"  bgColor="rgba(77,142,247,0.10)"  />
        <StatCard label="Active Users"   value="1,847"   icon={<Users className="w-5 h-5" />}       color="#2E7D32"  bgColor="rgba(46,125,50,0.10)"   />
        <StatCard label="MRR"            value="$48,200" icon={<DollarSign className="w-5 h-5" />}  color="#A59DFF"  bgColor="rgba(165,157,255,0.10)" />
      </div>

      <div className="bg-white rounded-xl border border-[#E0E0E6]">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#E0E0E6]">
          <Activity className="w-4 h-4 text-[#717182]" />
          <h2 className="text-sm font-semibold text-[#030213]">Recent Activity</h2>
        </div>
        <ul className="divide-y divide-[#F0EFF6]">
          {recentActivity.map((item, i) => (
            <li key={i} className="flex items-center justify-between px-6 py-3.5">
              <div>
                <p className="text-sm font-medium text-[#030213]">{item.action}</p>
                <p className="text-xs text-[#717182] mt-0.5">{item.detail}</p>
              </div>
              <span className="text-xs text-[#A0A0B0] ml-8 flex-shrink-0">{item.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlaceholderContent({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-8 pb-6 border-b border-[#F0EFF6]">
        <h1 className="text-xl font-semibold text-[#030213]">{title}</h1>
        <p className="text-sm text-[#717182] mt-1">{description}</p>
      </div>
      <div className="flex-1 flex items-center justify-center text-[#A0A0B0] text-sm">
        Coming soon
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [activePage, setActivePage] = useState('suppliers');

  return (
    <AdminLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === 'dashboard'     && <DashboardContent />}
      {activePage === 'suppliers'     && <AdminSuppliersContent />}
      {activePage === 'practices'     && <PlaceholderContent title="Practices" description="Manage tenant practice locations across all organisations." />}
      {activePage === 'organizations' && <PlaceholderContent title="Organisations" description="Manage tenant accounts, plans, and billing." />}
      {activePage === 'spend'         && <PlaceholderContent title="Spend Management" description="Platform-wide spend overview and GL configuration." />}
      {activePage === 'activity'      && <PlaceholderContent title="Activity Logs" description="Audit trail of all platform events and changes." />}
      {activePage === 'system'        && <PlaceholderContent title="System" description="Platform configuration, maintenance, and diagnostics." />}
      {activePage === 'settings'      && <PlaceholderContent title="Settings" description="Super admin account and portal settings." />}
    </AdminLayout>
  );
}
