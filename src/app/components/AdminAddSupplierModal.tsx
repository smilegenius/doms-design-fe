import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import CountrySelect from './CountrySelect';
import { GlobalSupplier } from '../data/globalSuppliersData';
import { EXPENSE_CATEGORIES } from '../data/suppliersData';

interface AdminAddSupplierModalProps {
  onAdd: (supplier: GlobalSupplier) => void;
  onDraft?: (supplier: GlobalSupplier) => void;
  onClose: () => void;
}

const COLORS = [
  'bg-[#E8F0FE] text-[#4D8EF7]', 'bg-[#E8F5E9] text-[#2E7D32]',
  'bg-[#FFF3E0] text-[#E65100]', 'bg-[#EDE7F6] text-[#6A1B9A]',
  'bg-[#E0F7FA] text-[#00838F]', 'bg-[#FCE4EC] text-[#AD1457]',
];

export default function AdminAddSupplierModal({ onAdd, onDraft, onClose }: AdminAddSupplierModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '', category: '', primaryContact: '', email: '', phone: '',
    companyUrl: '', country: '', billingAddress: '', taxId: '',
    nominalCode: '', nominalName: '', notes: '',
  });

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function buildSupplier(): GlobalSupplier {
    const words = form.name.trim().split(' ');
    const initials = words.map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      id: `gs_${Date.now()}`,
      name: form.name.trim(),
      initials,
      avatarColor,
      country: form.country || 'GB',
      categories: form.category ? [form.category] : [],
      vendorId: `GV${String(Math.floor(Math.random() * 900 + 100))}`,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd(buildSupplier());
    setSubmitted(true);
  }

  function handleDraft() {
    if (!form.name.trim()) return;
    onDraft?.(buildSupplier());
    onClose();
  }

  const inputCls = 'w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]';

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col items-center py-16 px-8">
          <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-[#2E7D32]" />
          </div>
          <h3 className="text-lg font-semibold text-[#030213] mb-2">Supplier added</h3>
          <p className="text-sm text-[#717182] text-center max-w-sm mb-6">
            The supplier has been added to the global registry.
          </p>
          <div className="flex gap-3">
            <button onClick={() => { setForm({ name:'',category:'',primaryContact:'',email:'',phone:'',companyUrl:'',country:'',billingAddress:'',taxId:'',nominalCode:'',nominalName:'',notes:'' }); setSubmitted(false); }} className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
              Add another
            </button>
            <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-[#F0EFF6]">
          <div>
            <h2 className="text-lg font-semibold text-[#030213]">Add to Global Registry</h2>
            <p className="text-xs text-[#717182] mt-0.5">Supplier will be immediately available to all tenant organisations.</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="admin-add-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-7 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Supplier Name <span className="text-[#C62828]">*</span></label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Henry Schein" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">Select category</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Primary Contact <span className="text-[#C62828]">*</span></label>
              <input required value={form.primaryContact} onChange={e => set('primaryContact', e.target.value)} placeholder="Jane Smith" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Email Address <span className="text-[#C62828]">*</span></label>
              <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@supplier.com" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Phone Number <span className="text-[#C62828]">*</span></label>
              <input required value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 20 0000 0000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Company URL</label>
              <input value={form.companyUrl} onChange={e => set('companyUrl', e.target.value)} placeholder="example.com" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Billing Address</label>
              <input value={form.billingAddress} onChange={e => set('billingAddress', e.target.value)} placeholder="123 Main St, London" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Tax ID / VAT <span className="text-[#C62828]">*</span></label>
              <input required value={form.taxId} onChange={e => set('taxId', e.target.value)} placeholder="GB123456789" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">Country</label>
              <CountrySelect value={form.country} onChange={v => set('country', v)} />
            </div>
            <div />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#030213] mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes..." rows={3} className={`${inputCls} resize-none`} />
          </div>

        </form>
        <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-between gap-3 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={handleDraft}
            disabled={!form.name.trim()}
            className="px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save as Draft
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
              Cancel
            </button>
            <button type="submit" form="admin-add-form" className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
              Add to registry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
