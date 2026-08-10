import { useEffect, useState } from 'react';
import { X, FlaskConical } from 'lucide-react';
import ModalPortal from './ModalPortal';
import Button from './Button';
import { useToast } from '../context/ToastContext';
import { SERVICE_CATEGORIES } from '../pages/CreateCasePage';
import { addCustomService, getCustomServices, CustomService } from '../data/customServices';

// ── Create Custom Service — shared modal ─────────────────────────────────────
// One modal, two entry points: Settings → Custom Services, and the service
// picker on the case-creation screen. Same fields, validation, and business
// rules in both places. Renders above the service-picker drawer (z-[100]),
// hence its own z-[120] shell instead of the shared Modal (z-50).

interface CreateCustomServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Prefill the name field (e.g. text typed into the picker search). */
  defaultName?: string;
  /** Called after the service is created, before the modal closes. */
  onCreated?: (service: CustomService) => void;
}

export default function CreateCustomServiceModal({ isOpen, onClose, defaultName = '', onCreated }: CreateCustomServiceModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset / prefill whenever the modal opens.
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setDescription('');
      setError(null);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  function validate(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Service name is required.';
    if (trimmed.length < 2) return 'Service name must be at least 2 characters.';
    const lower = trimmed.toLowerCase();
    const clashesCatalogue = SERVICE_CATEGORIES.some(cat => cat.items.some(i => i.label.toLowerCase() === lower));
    const clashesCustom = getCustomServices().some(s => s.name.toLowerCase() === lower);
    if (clashesCatalogue || clashesCustom) return 'A service with this name already exists.';
    return null;
  }

  function handleCreate() {
    const err = validate(name);
    if (err) { setError(err); return; }
    const svc = addCustomService({ name, description });
    toast.success(`Custom service "${svc.name}" created`);
    onCreated?.(svc);
    onClose();
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#E0E0E6] flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#030213] truncate">Create Custom Service</h2>
                <p className="text-[11px] text-[#717182] truncate">Added to your service catalogue for this and future cases.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F3F3F5] transition-colors flex-shrink-0">
              <X className="w-5 h-5 text-[#717182]" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto min-h-0">
            <div>
              <label className="block text-xs font-semibold text-[#030213] mb-1.5">
                Service Name <span className="text-[#D4183D]">*</span>
              </label>
              <input
                type="text"
                value={name}
                autoFocus
                maxLength={60}
                onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="e.g. Periodontal Splint, Sleep Appliance…"
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${
                  error
                    ? 'border-[#D4183D] focus:border-[#D4183D] focus:ring-2 focus:ring-[#D4183D]/20'
                    : 'border-[#E0E0E6] focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20'
                }`}
              />
              {error && <p className="mt-1.5 text-xs text-[#D4183D]">{error}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#030213] mb-1.5">
                Description <span className="font-normal text-[#A0A0B0]">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={240}
                placeholder="What the lab should know about this service…"
                className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none resize-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#E0E0E6] px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreate}>Create Service</Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
