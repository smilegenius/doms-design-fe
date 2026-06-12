import { useState } from 'react';
import { X, ChevronDown, Info } from 'lucide-react';
import { Supplier, SupplierGLMapping, GL_ACCOUNTS, EXPENSE_CATEGORIES, WorkflowType } from '../data/suppliersData';

interface GLCodeMappingPanelProps {
  supplier: Supplier;
  onClose: () => void;
  onSave: (supplierId: string, mapping: SupplierGLMapping) => void;
}

const WORKFLOW_OPTIONS: WorkflowType[] = ['Auto Approve', 'Single Approver', 'Two-Stage', 'CFO Required'];
const PAYMENT_TERMS = ['Due on receipt', 'Net 7', 'Net 14', 'Net 30', 'Net 60', 'Net 90'];

function Select({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#717182] mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none border border-[#E0E0E6] rounded-lg px-3.5 py-2.5 text-sm text-[#030213] bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7] transition-colors pr-8"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

export default function GLCodeMappingPanel({ supplier, onClose, onSave }: GLCodeMappingPanelProps) {
  const existing = supplier.glMapping;
  const [glCode, setGlCode] = useState(existing?.glCode.code ?? GL_ACCOUNTS[0].code);
  const [category, setCategory] = useState(existing?.category ?? EXPENSE_CATEGORIES[0]);
  const [workflow, setWorkflow] = useState<WorkflowType>(existing?.workflow ?? 'Single Approver');
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms ?? 'Net 30');

  const selectedGL = GL_ACCOUNTS.find(g => g.code === glCode) ?? GL_ACCOUNTS[0];

  function handleSave() {
    onSave(supplier.id, {
      glCode: selectedGL,
      category,
      workflow,
      paymentTerms,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#F0EFF6]">
          <div>
            <h2 className="text-sm font-semibold text-[#030213]">{supplier.name}</h2>
            <p className="text-xs text-[#717182]">{supplier.vendorId} · {supplier.country}</p>
          </div>
          <button onClick={onClose} className="text-[#A0A0B0] hover:text-[#5A5568] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 p-3 bg-[#F8F9FC] rounded-lg border border-[#E0E0E6]">
            <Info className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" />
            <p className="text-xs text-[#717182] leading-relaxed">
              GL mappings are specific to your organisation. The same supplier can have different codes across different dental groups.
            </p>
          </div>

          {/* GL / Nominal account */}
          <div>
            <label className="block text-xs font-medium text-[#717182] mb-1.5">GL / Nominal Account</label>
            <div className="relative">
              <select
                value={glCode}
                onChange={e => setGlCode(e.target.value)}
                className="w-full appearance-none border border-[#E0E0E6] rounded-lg px-3.5 py-2.5 text-sm text-[#030213] bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7] transition-colors pr-8"
              >
                {GL_ACCOUNTS.map(g => (
                  <option key={g.code} value={g.code}>{g.code} · {g.nominalName}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {selectedGL && (
              <p className="text-xs text-[#4D8EF7] mt-1 px-1">{selectedGL.code} — {selectedGL.nominalName}</p>
            )}
          </div>

          <Select
            label="Expense Category"
            value={category}
            options={EXPENSE_CATEGORIES}
            onChange={setCategory}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Approval Workflow"
              value={workflow}
              options={WORKFLOW_OPTIONS}
              onChange={v => setWorkflow(v as WorkflowType)}
            />
            <Select
              label="Payment Terms"
              value={paymentTerms}
              options={PAYMENT_TERMS}
              onChange={setPaymentTerms}
            />
          </div>

          {/* Future integrations notice */}
          <div className="p-3 rounded-lg border border-dashed border-[#E0E0E6]">
            <p className="text-xs font-medium text-[#A0A0B0] mb-1">Accounting integrations</p>
            <p className="text-xs text-[#A0A0B0]">Xero · QuickBooks · auto-sync — coming soon</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 border border-[#E0E0E6] text-[#5A5568] text-sm font-medium rounded-lg py-2.5 hover:bg-[#F8F9FC] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-sm font-semibold rounded-lg py-2.5 hover:opacity-90 transition-opacity"
          >
            Save mapping
          </button>
        </div>
      </div>
    </div>
  );
}
