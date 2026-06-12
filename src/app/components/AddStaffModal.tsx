import { useState, useEffect } from 'react';
import { UserPlus, FileEdit } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { Practice } from '../data/clinicsData';

export interface StaffFormData {
  practiceId: string;
  name: string;
  staffType: string;
  email?: string;
  phone?: string;
  performerCode?: string;
  performerName?: string;
  employeeId?: string;
  status?: 'active' | 'draft';
}

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  practices: Practice[];
  defaultPracticeId?: string;
  onSubmit: (data: StaffFormData) => void;
  mode?: 'add' | 'edit';
  initialData?: Partial<StaffFormData>;
  hideDraft?: boolean;
  lockPractice?: boolean;
  lockStaffType?: boolean;
}

export default function AddStaffModal({
  isOpen,
  onClose,
  practices,
  defaultPracticeId,
  onSubmit,
  mode = 'add',
  initialData,
  hideDraft = false,
  lockPractice = false,
  lockStaffType = false,
}: AddStaffModalProps) {
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  // Staff Info
  const [practiceId, setPracticeId] = useState('');
  const [staffType, setStaffType] = useState('Practice Manager');
  const [customStaffType, setCustomStaffType] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [performerCode, setPerformerCode] = useState('');
  const [performerName, setPerformerName] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setPracticeId(initialData?.practiceId || defaultPracticeId || '');

    const incomingType = initialData?.staffType;
    if (incomingType === 'Practice Manager' || incomingType === 'Dentist') {
      setStaffType(incomingType);
      setCustomStaffType('');
    } else if (incomingType) {
      setStaffType('Other');
      setCustomStaffType(incomingType);
    } else {
      setStaffType('Practice Manager');
      setCustomStaffType('');
    }

    setName(initialData?.name || '');
    setEmail(initialData?.email || '');
    setPhone(initialData?.phone || '');
    setPerformerCode(initialData?.performerCode || '');
    setPerformerName(initialData?.performerName || '');
    setEmployeeId(initialData?.employeeId || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const buildData = (status: 'active' | 'draft'): StaffFormData => ({
    practiceId,
    name,
    staffType: staffType === 'Other' ? customStaffType : staffType,
    email: email || undefined,
    phone: phone || undefined,
    performerCode: staffType === 'Dentist' ? performerCode : undefined,
    performerName: staffType === 'Dentist' ? performerName : undefined,
    employeeId: staffType === 'Other' ? employeeId : undefined,
    status,
  });

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    onSubmit(buildData('active'));
    setLoading(false);
    handleClose();
  };

  const handleSaveDraft = async () => {
    setDraftLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    onSubmit(buildData('draft'));
    setDraftLoading(false);
    handleClose();
  };

  const handleClose = () => {
    setPracticeId('');
    setStaffType('Practice Manager');
    setCustomStaffType('');
    setName('');
    setEmail('');
    setPhone('');
    setPerformerCode('');
    setPerformerName('');
    setEmployeeId('');
    onClose();
  };

  const canSubmit = () => {
    if (!practiceId || !name || !email) return false;
    if (staffType === 'Other' && !customStaffType) return false;
    if (staffType === 'Dentist' && (!performerCode || !performerName)) return false;
    return true;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'edit' ? 'Edit Staff Member' : 'Add Staff Member'}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={handleClose} disabled={loading || draftLoading}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {!hideDraft && mode === 'add' && (
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                loading={draftLoading}
                disabled={!practiceId || !name || loading}
                icon={<FileEdit className="w-4 h-4" />}
              >
                Save as Draft
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!canSubmit() || draftLoading}
              icon={<UserPlus className="w-4 h-4" />}
            >
              {mode === 'edit' ? 'Save Changes' : 'Add Staff Member'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Practice Selection */}
        <div>
          <label className="block text-sm font-medium text-[#030213] mb-2">
            Practice <span className="text-[#D4183D]">*</span>
          </label>
          <select
            value={practiceId}
            onChange={(e) => setPracticeId(e.target.value)}
            disabled={lockPractice}
            className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] disabled:bg-[#F8F9FC] disabled:text-[#717182] disabled:cursor-not-allowed"
          >
            <option value="">Select a practice...</option>
            {practices.map((practice) => (
              <option key={practice.id} value={practice.id}>
                {practice.name} ({practice.practiceCode})
              </option>
            ))}
          </select>
        </div>

        {/* Staff Type */}
        <div>
          <label className="block text-sm font-medium text-[#030213] mb-2">
            Staff Type <span className="text-[#D4183D]">*</span>
          </label>
          <select
            value={staffType}
            onChange={(e) => setStaffType(e.target.value)}
            disabled={lockStaffType}
            className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] disabled:bg-[#F8F9FC] disabled:text-[#717182] disabled:cursor-not-allowed"
          >
            <option value="Practice Manager">Practice Manager</option>
            <option value="Dentist">Dentist</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Custom Staff Type + Employee ID (if Other is selected) */}
        {staffType === 'Other' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#030213] mb-2">
                Specify Staff Type <span className="text-[#D4183D]">*</span>
              </label>
              <input
                type="text"
                value={customStaffType}
                onChange={(e) => setCustomStaffType(e.target.value)}
                placeholder="e.g., Receptionist, Hygienist"
                className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#030213] mb-2">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g., EMP-0042"
                className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
              />
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[#030213] mb-2">
            Name <span className="text-[#D4183D]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., John Smith"
            className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
          />
        </div>

        {/* Performer Code + Name (only for Dentist) */}
        {staffType === 'Dentist' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#030213] mb-2">
                Performer Code <span className="text-[#D4183D]">*</span>
              </label>
              <input
                type="text"
                value={performerCode}
                onChange={(e) => setPerformerCode(e.target.value)}
                placeholder="e.g., DEN-001"
                className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#030213] mb-2">
                Performer Name <span className="text-[#D4183D]">*</span>
              </label>
              <input
                type="text"
                value={performerName}
                onChange={(e) => setPerformerName(e.target.value)}
                placeholder="e.g., Dr. John Smith"
                className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
              />
            </div>
          </div>
        )}

        {/* Email & Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#030213] mb-2">Email <span className="text-[#D4183D]">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., john@example.com"
              className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#030213] mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., +44 20 1234 5678"
              className="w-full px-4 py-2.5 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
