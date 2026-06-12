import { CheckCircle2, AlertCircle, Clock, Mail } from 'lucide-react';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'invited';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    active: {
      bg: 'bg-[#E8F5E9]',
      text: 'text-[#2E7D32]',
      icon: CheckCircle2,
      label: 'Active',
    },
    inactive: {
      bg: 'bg-[#FFF3E0]',
      text: 'text-[#E65100]',
      icon: AlertCircle,
      label: 'Inactive',
    },
    invited: {
      bg: 'bg-[#E3F2FD]',
      text: 'text-[#1565C0]',
      icon: Mail,
      label: 'Invited',
    },
  };

  const { bg, text, icon: Icon, label } = config[status];

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${bg} ${text}`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
