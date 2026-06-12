import { Building2, FileSearch } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  type: 'no-clinics' | 'no-results';
  onAction?: () => void;
}

export default function EmptyState({ type, onAction }: EmptyStateProps) {
  const config = {
    'no-clinics': {
      icon: Building2,
      title: 'No practices yet',
      description: 'Get started by adding your first practice or importing from CSV',
      actionLabel: 'Add Practice',
    },
    'no-results': {
      icon: FileSearch,
      title: 'No results found',
      description: 'Try adjusting your search or filter criteria',
      actionLabel: 'Clear Filters',
    },
  };

  const { icon: Icon, title, description, actionLabel } = config[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-[#F3F3F5] rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[#717182]" />
      </div>
      <h3 className="text-xl font-semibold text-[#030213] mb-2">{title}</h3>
      <p className="text-[#5A5568] text-center mb-6 max-w-md">{description}</p>
      {onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
