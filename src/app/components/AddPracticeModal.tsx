import { useState, useEffect } from 'react';
import { Building2, Pencil, FileEdit } from 'lucide-react';
import CountrySelect from './CountrySelect';
import Modal from './Modal';
import Button from './Button';
import { Practice } from '../data/clinicsData';

interface PracticeFormData {
  name: string;
  practiceCode?: string;
  address?: string;
  postcode?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  managers: Manager[];
  dentists: Dentist[];
  staff?: Staff[];
  status?: 'active' | 'draft';
}

interface AddPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Practice;
  onSubmit: (data: PracticeFormData) => void;
}

export default function AddPracticeModal({ isOpen, onClose, initialData, onSubmit }: AddPracticeModalProps) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  const [practiceName, setPracticeName] = useState('');
  const [practiceCode, setPracticeCode] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('GB');
  const [practiceEmail, setPracticeEmail] = useState('');
  const [practicePhone, setPracticePhone] = useState('');

  useEffect(() => {
    if (isOpen && initialData) {
      setPracticeName(initialData.name ?? '');
      setPracticeCode(initialData.practiceCode ?? '');
      setAddress(initialData.address ?? '');
      setPostcode(initialData.postcode ?? '');
      setCity(initialData.city ?? '');
      setCountry(initialData.country ?? 'GB');
      setPracticeEmail(initialData.email ?? '');
      setPracticePhone(initialData.phone ?? '');
    }
  }, [isOpen, initialData]);

  const buildData = (status: 'active' | 'draft') => ({
    name: practiceName,
    practiceCode: practiceCode || undefined,
    address: address || undefined,
    postcode: postcode || undefined,
    city: city || undefined,
    country,
    email: practiceEmail || undefined,
    phone: practicePhone || undefined,
    managers: [],
    dentists: [],
    status,
  });

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    onSubmit(buildData('active'));
    setLoading(false);
    handleClose();
  };

  const handleSaveDraft = async () => {
    setDraftLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    onSubmit(buildData('draft'));
    setDraftLoading(false);
    handleClose();
  };

  const handleClose = () => {
    setPracticeName(''); setPracticeCode(''); setAddress(''); setPostcode('');
    setCity(''); setCountry('GB'); setPracticeEmail(''); setPracticePhone('');
    onClose();
  };

  const inputCls = 'w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] text-sm';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Practice' : 'Add New Practice'}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={handleClose} disabled={loading || draftLoading}>Cancel</Button>
          <div className="flex items-center gap-3">
            {!isEdit && (
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                loading={draftLoading}
                disabled={!practiceName || loading}
                icon={<FileEdit className="w-4 h-4" />}
              >
                Save as Draft
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!practiceName || draftLoading}
              icon={isEdit ? <Pencil className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            >
              {isEdit ? 'Save Changes' : 'Add Practice'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#030213] mb-2">Practice Name <span className="text-[#D4183D]">*</span></label>
              <input type="text" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} placeholder="e.g., Smile Genius Marylebone" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#030213] mb-2">Practice Code</label>
              <input type="text" value={practiceCode} onChange={(e) => setPracticeCode(e.target.value)} placeholder="e.g., SGM-001" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#030213] mb-2">Practice Email</label>
                <input type="email" value={practiceEmail} onChange={(e) => setPracticeEmail(e.target.value)} placeholder="e.g., info@practice.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#030213] mb-2">Practice Phone</label>
                <input type="tel" value={practicePhone} onChange={(e) => setPracticePhone(e.target.value)} placeholder="e.g., +44 20 1234 5678" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#030213] mb-2">Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g., 42 Harley Street" className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#030213] mb-2">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., London" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#030213] mb-2">Postcode</label>
                <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="e.g., W1G 9PA" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#030213] mb-2">Country</label>
                <CountrySelect value={country} onChange={setCountry} />
              </div>
            </div>
      </div>
    </Modal>
  );
}
