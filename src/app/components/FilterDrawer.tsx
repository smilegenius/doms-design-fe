import { X } from 'lucide-react';
import Button from './Button';
import DropdownFilter from './DropdownFilter';
import ModalPortal from './ModalPortal';

interface SelectFilter {
  type?: 'select';
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface DateRangeFilter {
  type: 'daterange';
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

type Filter = SelectFilter | DateRangeFilter;

const dateInputClass =
  'w-full px-3 py-2 bg-white border border-[#E0E0E6] rounded-lg text-sm text-[#030213] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20 transition-colors';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filter[];
  onApply: () => void;
  onReset: () => void;
}

export default function FilterDrawer({
  isOpen,
  onClose,
  filters,
  onApply,
  onReset,
}: FilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      {/* Overlay */}
      {/* z-index sits above the app sidebar/header (z-50) — the drawer is
          portaled to <body>, so it must out-stack the chrome, not just the page. */}
      <div
        className="fixed inset-0 bg-black/20 z-[60]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 max-w-md bg-white shadow-xl z-[70] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E0E0E6]">
          <h3 className="font-semibold text-[#030213]">Filter By</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F8F9FC] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[#717182]" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 space-y-4">
          {filters.map((filter, index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-[#030213] mb-2">
                {filter.label}
              </label>
              {filter.type === 'daterange' ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="block text-[11px] text-[#717182] mb-1">From</span>
                    <input
                      type="date"
                      value={filter.from}
                      max={filter.to || undefined}
                      onChange={e => filter.onFromChange(e.target.value)}
                      className={dateInputClass}
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-[11px] text-[#717182] mb-1">To</span>
                    <input
                      type="date"
                      value={filter.to}
                      min={filter.from || undefined}
                      onChange={e => filter.onToChange(e.target.value)}
                      className={dateInputClass}
                    />
                  </div>
                </div>
              ) : (
                <DropdownFilter
                  label=""
                  options={filter.options}
                  value={filter.value}
                  onChange={filter.onChange}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E0E0E6] bg-white">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onReset}
              className="flex-1"
            >
              Reset all
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onApply();
                onClose();
              }}
              className="flex-1"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
