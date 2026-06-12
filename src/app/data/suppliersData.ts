// GL Code architecture: Organization → Supplier → GL Mapping
// GL codes are per-organization, NOT global. Same supplier can map to different
// GL codes across different dental groups.

export interface GLCode {
  code: string;          // e.g. "2410"
  nominalName: string;   // e.g. "Materials_Purchases"
}

export type WorkflowType = 'Auto Approve' | 'Single Approver' | 'Two-Stage' | 'CFO Required';

export type SupplierRelationshipStatus = 'Active' | 'On hold' | 'Not using' | 'Archived' | 'Pending review';

export interface SupplierGLMapping {
  glCode: GLCode;
  category: string;         // expense category e.g. "Clinical", "Maintenance"
  workflow: WorkflowType;
  paymentTerms: string;     // e.g. "Net 30", "Net 14", "Due on receipt"
  // Future: accountingSystemRef (Xero/QuickBooks account ID)
  // Future: autoCategorizationRules: string[]
}

export interface Supplier {
  id: string;
  vendorId: string;
  name: string;
  initials: string;
  avatarColor: string;
  country: string;
  categories: string[];
  relationshipStatus: SupplierRelationshipStatus;
  practiceCount: number;
  ytdSpend: number;
  invoiceCount: number;
  glMapping: SupplierGLMapping | null;
  primaryContact?: string;
  email?: string;
  phone?: string;
  companyUrl?: string;
  billingAddress?: string;
  taxId?: string;
  notes?: string;
  customFields?: Record<string, string>;
}

// Nominal/GL account chart — org-specific in production, shared mock here
export const GL_ACCOUNTS: GLCode[] = [
  { code: '2410', nominalName: 'Materials_Purchases' },
  { code: '2520', nominalName: 'Lab Costs_Private' },
  { code: '2500', nominalName: 'Lab Costs_NHS' },
  { code: '3100', nominalName: 'Agency Staff' },
  { code: '3230', nominalName: 'Water Rates' },
  { code: '3240', nominalName: 'Gas' },
  { code: '3270', nominalName: 'Cleaning' },
  { code: '3280', nominalName: 'Waste Disposal' },
  { code: '3430', nominalName: 'IT Consumables' },
  { code: '3440', nominalName: 'Telephone & Internet' },
  { code: '3620', nominalName: 'Equipment Repairs & Maintenance' },
  { code: '4345', nominalName: 'HO-SOE Subscription' },
  { code: '4400', nominalName: 'Lab Costs_Other Subscriptions' },
];

export const EXPENSE_CATEGORIES = [
  'Clinical', 'Equipment', 'Software', 'Utilities', 'Maintenance',
  'Raw Materials', 'Lab', 'Insurance', 'Marketing', 'Staff & Training',
  'Property', 'Finance', 'Professional Fees', 'Implant Suppliers',
  'Dental Labs', 'Orthodontics', 'Waste Disposal',
];

export const mockSuppliers: Supplier[] = [
  {
    id: 's1', vendorId: 'V02000', name: 'Henry Schein', initials: 'HS',
    avatarColor: 'bg-[#E8F0FE] text-[#4D8EF7]',
    country: 'IE', categories: ['Clinical', 'Equipment'],
    relationshipStatus: 'Active',    practiceCount: 2, ytdSpend: 64468, invoiceCount: 43,
    glMapping: { glCode: { code: '2410', nominalName: 'Materials_Purchases' }, category: 'Orthodontics', workflow: 'Auto Approve', paymentTerms: 'Net 30' },
  },
  {
    id: 's2', vendorId: 'V02001', name: 'DD Group', initials: 'DD',
    avatarColor: 'bg-[#FFF3E0] text-[#E65100]',
    country: 'IE', categories: ['Implant Suppliers'],
    relationshipStatus: 'Active',    practiceCount: 3, ytdSpend: 29583, invoiceCount: 79,
    glMapping: { glCode: { code: '2520', nominalName: 'Lab Costs_Private' }, category: 'Implant Suppliers', workflow: 'Single Approver', paymentTerms: 'Net 14' },
  },
  {
    id: 's3', vendorId: 'V02002', name: 'Dental Directory', initials: 'DD',
    avatarColor: 'bg-[#E8F5E9] text-[#2E7D32]',
    country: 'IE', categories: ['Utilities'],
    relationshipStatus: 'Active',    practiceCount: 4, ytdSpend: 54092, invoiceCount: 35,
    glMapping: { glCode: { code: '2500', nominalName: 'Lab Costs_NHS' }, category: 'Utilities', workflow: 'Two-Stage', paymentTerms: 'Net 60' },
  },
  {
    id: 's4', vendorId: 'V02003', name: 'Wrights', initials: 'W',
    avatarColor: 'bg-[#EDE7F6] text-[#6A1B9A]',
    country: 'IE', categories: ['Software'],
    relationshipStatus: 'Active',    practiceCount: 5, ytdSpend: 30862, invoiceCount: 37,
    glMapping: { glCode: { code: '4400', nominalName: 'Lab Costs_Other Subscriptions' }, category: 'Software', workflow: 'CFO Required', paymentTerms: 'Net 30' },
  },
  {
    id: 's5', vendorId: 'V02004', name: 'Ivoclar', initials: 'IV',
    avatarColor: 'bg-[#FCE4EC] text-[#AD1457]',
    country: 'LI', categories: ['Clinical', 'Raw Materials'],
    relationshipStatus: 'Active',    practiceCount: 6, ytdSpend: 51250, invoiceCount: 36,
    glMapping: { glCode: { code: '3100', nominalName: 'Agency Staff' }, category: 'Cleaning', workflow: 'Auto Approve', paymentTerms: 'Net 30' },
  },
  {
    id: 's6', vendorId: 'V02005', name: '3Shape', initials: '3S',
    avatarColor: 'bg-[#E0F7FA] text-[#00838F]',
    country: 'DK', categories: ['Equipment', 'Software'],
    relationshipStatus: 'Active',    practiceCount: 7, ytdSpend: 8779, invoiceCount: 25,
    glMapping: { glCode: { code: '3430', nominalName: 'IT Consumables' }, category: 'Waste Disposal', workflow: 'Single Approver', paymentTerms: 'Net 14' },
  },
  {
    id: 's7', vendorId: 'V02006', name: 'Medit', initials: 'MD',
    avatarColor: 'bg-[#FFF8E1] text-[#F57F17]',
    country: 'KR', categories: ['Equipment'],
    relationshipStatus: 'Active',    practiceCount: 2, ytdSpend: 48768, invoiceCount: 47,
    glMapping: { glCode: { code: '3280', nominalName: 'Waste Disposal' }, category: 'Maintenance', workflow: 'Two-Stage', paymentTerms: 'Net 60' },
  },
  {
    id: 's8', vendorId: 'V02007', name: 'Dentsply Sirona', initials: 'DS',
    avatarColor: 'bg-[#E8EAF6] text-[#283593]',
    country: 'DE', categories: ['Equipment', 'Clinical'],
    relationshipStatus: 'Active',    practiceCount: 3, ytdSpend: 67900, invoiceCount: 56,
    glMapping: { glCode: { code: '3620', nominalName: 'Equipment Repairs & Maintenance' }, category: 'Professional Fees', workflow: 'CFO Required', paymentTerms: 'Due on receipt' },
  },
  {
    id: 's9', vendorId: 'V02008', name: 'Nobel Biocare', initials: 'NB',
    avatarColor: 'bg-[#E8F5E9] text-[#1B5E20]',
    country: 'SE', categories: ['Clinical', 'Implant Suppliers'],
    relationshipStatus: 'Pending review',    practiceCount: 4, ytdSpend: 83951, invoiceCount: 40,
    glMapping: { glCode: { code: '3270', nominalName: 'Cleaning' }, category: 'Marketing', workflow: 'Auto Approve', paymentTerms: 'Net 30' },
    // requestSource: who submitted the supplier for approval.
    //   'clinic' → originated on a clinic portal; requestUser = clinic staff
    //   'dso'    → originated on this dental group portal; requestUser = DSO admin
    customFields: { requestSource: 'clinic', requestUser: 'Sarah Patel', originClinic: 'Smile Genius Manchester', approvalStage: 'awaiting-dso' },
  },
  {
    id: 's10', vendorId: 'V02009', name: 'Kulzer', initials: 'KZ',
    avatarColor: 'bg-[#FBE9E7] text-[#BF360C]',
    country: 'DE', categories: ['Clinical', 'Raw Materials'],
    relationshipStatus: 'Pending review',    practiceCount: 5, ytdSpend: 37621, invoiceCount: 25,
    glMapping: { glCode: { code: '4345', nominalName: 'HO-SOE Subscription' }, category: 'Property', workflow: 'Single Approver', paymentTerms: 'Net 14' },
    customFields: { requestSource: 'clinic', requestUser: 'Michael Thomas', originClinic: 'Smile Genius Birmingham 1', approvalStage: 'awaiting-dso' },
  },
  // DSO-side pending example — the dental group admin added this supplier
  // themselves; the DSO row shows "DSO: <user>" so admins can spot their
  // own submissions vs clinic-requested ones at a glance.
  {
    id: 's14', vendorId: 'V02013', name: 'BrightWhite Aligners', initials: 'BW',
    avatarColor: 'bg-[#FFF8E1] text-[#F57F17]',
    country: 'GB', categories: ['Clinical', 'Orthodontics'],
    relationshipStatus: 'Pending review',    practiceCount: 1, ytdSpend: 0, invoiceCount: 0,
    glMapping: null,
    customFields: { requestSource: 'dso', requestUser: 'Sajid Zahid', originClinic: 'Smile Genius Dental Group' },
  },
  {
    id: 's11', vendorId: 'V02010', name: 'Septodont', initials: 'SP',
    avatarColor: 'bg-[#E3F2FD] text-[#1565C0]',
    country: 'FR', categories: ['Clinical'],
    relationshipStatus: 'On hold',    practiceCount: 6, ytdSpend: 83565, invoiceCount: 52,
    glMapping: { glCode: { code: '3230', nominalName: 'Water Rates' }, category: 'Insurance', workflow: 'Two-Stage', paymentTerms: 'Net 60' },
  },
  {
    id: 's12', vendorId: 'V02011', name: 'NSK', initials: 'NS',
    avatarColor: 'bg-[#EDE7F6] text-[#4527A0]',
    country: 'JP', categories: ['Equipment'],
    relationshipStatus: 'On hold',    practiceCount: 7, ytdSpend: 81087, invoiceCount: 56,
    glMapping: null,
  },
  {
    id: 's13', vendorId: 'V02012', name: 'Carestream Dental', initials: 'CD',
    avatarColor: 'bg-[#FAFAFA] text-[#424242]',
    country: 'US', categories: ['Equipment', 'Software'],
    relationshipStatus: 'On hold',    practiceCount: 2, ytdSpend: 8169, invoiceCount: 56,
    glMapping: { glCode: { code: '3240', nominalName: 'Gas' }, category: 'Staff & Training', workflow: 'Auto Approve', paymentTerms: 'Net 30' },
  },
];
