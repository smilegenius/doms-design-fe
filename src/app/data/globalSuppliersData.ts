export interface GlobalSupplier {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  country: string;
  categories: string[];
  vendorId: string;
  taxId?: string;
}

export interface PendingSupplierSubmission {
  id: string;
  name: string;
  category: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  submittedBy: string;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Draft' | 'Archived';
}

export const globalSuppliers: GlobalSupplier[] = [
  { id: 'gs1',  name: '3Shape',              initials: '3',  avatarColor: 'bg-[#FCE4EC] text-[#AD1457]', country: 'DK', categories: ['Equipment', 'Software'],          vendorId: 'GV001', taxId: 'DK-38763941'   },
  { id: 'gs2',  name: 'Dentsply Sirona',      initials: 'DS', avatarColor: 'bg-[#E8EAF6] text-[#283593]', country: 'DE', categories: ['Equipment', 'Clinical'],          vendorId: 'GV002', taxId: 'DE-812345678'  },
  { id: 'gs3',  name: 'ESB Networks',         initials: 'EN', avatarColor: 'bg-[#FFF3E0] text-[#E65100]', country: 'IE', categories: ['Utilities'],                      vendorId: 'GV003', taxId: 'IE-6433435F'   },
  { id: 'gs4',  name: 'Eir Business',         initials: 'EB', avatarColor: 'bg-[#E8F5E9] text-[#2E7D32]', country: 'IE', categories: ['Utilities', 'Software'],          vendorId: 'GV004', taxId: 'IE-4601881T'   },
  { id: 'gs5',  name: 'GC Corporation',       initials: 'GC', avatarColor: 'bg-[#E0F7FA] text-[#00838F]', country: 'JP', categories: ['Clinical', 'Raw Materials'],      vendorId: 'GV005', taxId: 'JP-1010401077' },
  { id: 'gs6',  name: 'Henry Schein Dental',  initials: 'HS', avatarColor: 'bg-[#E8F0FE] text-[#4D8EF7]', country: 'IE', categories: ['Clinical', 'Equipment'],          vendorId: 'GV006', taxId: 'IE-8261504U'   },
  { id: 'gs7',  name: 'Ivoclar Vivadent',     initials: 'IV', avatarColor: 'bg-[#EDE7F6] text-[#6A1B9A]', country: 'LI', categories: ['Clinical', 'Raw Materials'],      vendorId: 'GV007', taxId: 'LI-00101023'   },
  { id: 'gs8',  name: 'Kerr Dental',          initials: 'KD', avatarColor: 'bg-[#FCE4EC] text-[#C62828]', country: 'US', categories: ['Clinical'],                       vendorId: 'GV008', taxId: 'US-471234567'  },
  { id: 'gs9',  name: 'Medit',                initials: 'M',  avatarColor: 'bg-[#FFF8E1] text-[#F57F17]', country: 'KR', categories: ['Equipment'],                      vendorId: 'GV009', taxId: 'KR-2148736591' },
  { id: 'gs10', name: 'Patterson Dental',     initials: 'PD', avatarColor: 'bg-[#E3F2FD] text-[#1565C0]', country: 'US', categories: ['Clinical', 'Equipment', 'Office'], vendorId: 'GV010', taxId: 'US-411234890'  },
  { id: 'gs11', name: 'Shofu Dental',         initials: 'SD', avatarColor: 'bg-[#E8F5E9] text-[#1B5E20]', country: 'JP', categories: ['Clinical', 'Raw Materials'],      vendorId: 'GV011', taxId: 'JP-4010901012' },
  { id: 'gs12', name: 'Ultradent Products',   initials: 'UP', avatarColor: 'bg-[#FBE9E7] text-[#BF360C]', country: 'US', categories: ['Clinical'],                       vendorId: 'GV012', taxId: 'US-870987654'  },
];

export const initialPendingSubmissions: PendingSupplierSubmission[] = [
  {
    id: 'ps1',
    name: 'Northwood Dental Labs',
    category: 'Dental Labs',
    email: 'orders@northwooddentallabs.co.uk',
    phone: '+44 20 7946 0012',
    website: 'northwooddentallabs.co.uk',
    notes: 'Local lab we use for crown and bridge work.',
    submittedBy: 'Brightsmile Dental Group',
    submittedAt: '2026-05-12',
    status: 'Pending',
  },
  {
    id: 'ps2',
    name: 'Smiletech Aligners',
    category: 'Orthodontics',
    email: 'info@smiletechaligners.com',
    phone: '+353 1 234 5678',
    website: 'smiletechaligners.com',
    notes: 'New aligner supplier from Dublin.',
    submittedBy: 'City Orthodontics',
    submittedAt: '2026-05-11',
    status: 'Pending',
  },
  {
    id: 'ps3',
    name: 'Precision Dental Labs',
    category: 'Dental Labs',
    email: 'lab@precisiondental.ie',
    phone: '+353 1 567 8901',
    website: 'precisiondental.ie',
    notes: '',
    submittedBy: 'Westside Family Dental',
    submittedAt: '2026-05-10',
    status: 'Approved',
  },
  {
    id: 'ps4',
    name: 'BrightLab UK',
    category: 'Dental Labs',
    email: 'hello@brightlab.co.uk',
    phone: '+44 161 234 5678',
    website: 'brightlab.co.uk',
    notes: 'Referred by Premier Dental Partners.',
    submittedBy: 'Premier Dental Partners',
    submittedAt: '2026-05-09',
    status: 'Rejected',
  },
];
