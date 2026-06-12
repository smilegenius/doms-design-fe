export interface Manager {
  name: string;
  email: string;
  phone?: string;
}

export interface Dentist {
  name: string;
  email: string;
  phone?: string;
  performerCode?: string;
}

export interface Staff {
  name: string;
  email: string;
  phone?: string;
}

export interface StaffMember {
  id: string;
  practiceId: string;
  practiceName: string;
  name: string;
  staffType: 'Practice Manager' | 'Dentist' | string;
  email?: string;
  phone?: string;
  performerCode?: string;
  performerName?: string;
  employeeId?: string;
  status: 'active' | 'inactive' | 'pending-invite' | 'invited' | 'draft' | 'archived';
  invitedAt?: string;
  activatedAt?: string;
}

export interface Practice {
  id: string;
  name: string;
  practiceCode?: string;
  address?: string;
  postcode?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending-invite' | 'invited' | 'draft' | 'archived';
  managers: Manager[];
  dentists: Dentist[];
  staff?: Staff[];
  monthlyRevenue?: number;
  invoiceCount?: number;
  invitedAt?: string;
  activatedAt?: string;
}

// Keep Clinic as an alias for backwards compatibility
export type Clinic = Practice;

// Generate large dataset for demonstration
const generatePractices = (): Practice[] => {
  const cities = ['London', 'Manchester', 'Edinburgh', 'Bristol', 'Leeds', 'Brighton', 'Birmingham', 'Liverpool', 'Newcastle', 'Glasgow', 'Cardiff', 'Belfast', 'Oxford', 'Cambridge', 'York'];
  const statuses: Array<'active' | 'inactive' | 'pending-invite' | 'invited'> = ['active', 'active', 'active', 'inactive', 'pending-invite', 'invited'];
  const firstNames = ['Sarah', 'James', 'Emma', 'David', 'Fiona', 'Oliver', 'Sophie', 'Michael', 'Laura', 'Robert', 'Jessica', 'Daniel', 'Rachel', 'Thomas', 'Amy'];
  const lastNames = ['Chen', 'O\'Connor', 'Thompson', 'Patel', 'MacLeod', 'Grant', 'Wilson', 'Brown', 'Davies', 'Khan', 'Smith', 'Jones', 'Williams', 'Taylor', 'White'];
  const dentistNames = ['Hartwell', 'Webb', 'Sharma', 'Whitfield', 'Khan', 'Reid', 'Russo', 'Cole', 'Bell', 'Mehta', 'Chen', 'Davies', 'Anderson', 'Murphy', 'Campbell'];

  const practices: Practice[] = [];

  for (let i = 1; i <= 150; i++) {
    const city = cities[i % cities.length];
    const status = statuses[i % statuses.length];
    const managerFirst = firstNames[i % firstNames.length];
    const managerLast = lastNames[i % lastNames.length];

    const dentistCount = 2 + (i % 4);
    const dentists: Dentist[] = [];
    for (let d = 0; d < dentistCount; d++) {
      dentists.push({
        name: `Dr. ${dentistNames[(i + d) % dentistNames.length]}`,
        email: `${dentistNames[(i + d) % dentistNames.length].toLowerCase()}${i}@smilegenius.com`,
        performerCode: `DEN-${String(i * 10 + d).padStart(4, '0')}`,
      });
    }

    practices.push({
      id: String(i),
      name: `Smile Genius ${city} ${i > cities.length ? Math.floor(i / cities.length) : ''}`.trim(),
      practiceCode: `SG${city.substring(0, 2).toUpperCase()}-${String(i).padStart(3, '0')}`,
      address: `${10 + (i % 90)} ${['High Street', 'Main Road', 'Park Lane', 'Queen Street', 'George Street'][i % 5]}`,
      postcode: `${['SW', 'NW', 'SE', 'NE', 'E', 'W', 'N', 'S'][i % 8]}${Math.floor(1 + (i % 9))} ${Math.floor(1 + (i % 9))}${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}`,
      city,
      country: 'United Kingdom',
      status,
      managers: [
        {
          name: `${managerFirst} ${managerLast}`,
          email: `${managerFirst.toLowerCase()}.${managerLast.toLowerCase()}${i}@smilegenius.com`,
          phone: `+44 ${20 + (i % 80)} ${1000 + i} ${5000 + i}`,
        }
      ],
      dentists,
      staff: i % 3 === 0 ? [
        { name: `${firstNames[(i + 5) % firstNames.length]} Staff`, email: `staff${i}@smilegenius.com` }
      ] : undefined,
      monthlyRevenue: status === 'active' ? 10000 + (i * 150) : undefined,
      invoiceCount: status === 'active' ? 20 + (i % 50) : undefined,
      activatedAt: status === 'active' ? `2024-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}` : undefined,
      invitedAt: status === 'invited' ? `2024-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}` : undefined,
    });
  }

  return practices;
};

export const mockPractices: Practice[] = generatePractices();

// Alias for backwards compatibility
export const mockClinics = mockPractices;

// Generate staff members from practices
const generateStaffMembers = (practices: Practice[]): StaffMember[] => {
  const staff: StaffMember[] = [];
  const statuses: Array<'active' | 'inactive' | 'pending-invite' | 'invited'> = ['active', 'active', 'active', 'inactive', 'pending-invite', 'invited'];
  const otherStaffTypes = ['Receptionist', 'Hygienist', 'Dental Nurse', 'Practice Coordinator'];

  practices.forEach((practice, practiceIndex) => {
    // Add manager
    const manager = practice.managers[0];
    staff.push({
      id: `staff-${staff.length + 1}`,
      practiceId: practice.id,
      practiceName: practice.name,
      name: manager.name,
      staffType: 'Practice Manager',
      email: manager.email,
      phone: manager.phone,
      status: practice.status,
      activatedAt: practice.activatedAt,
      invitedAt: practice.invitedAt,
    });

    // Add dentists
    practice.dentists.forEach((dentist, dentistIndex) => {
      staff.push({
        id: `staff-${staff.length + 1}`,
        practiceId: practice.id,
        practiceName: practice.name,
        name: dentist.name,
        staffType: 'Dentist',
        email: dentist.email,
        phone: dentist.phone,
        performerCode: dentist.performerCode,
        status: statuses[(practiceIndex + dentistIndex) % statuses.length],
        activatedAt: practice.status === 'active' ? practice.activatedAt : undefined,
        invitedAt: practice.status === 'invited' ? practice.invitedAt : undefined,
      });
    });

    // Add other staff
    if (practice.staff) {
      practice.staff.forEach((s, staffIndex) => {
        staff.push({
          id: `staff-${staff.length + 1}`,
          practiceId: practice.id,
          practiceName: practice.name,
          name: s.name,
          staffType: otherStaffTypes[staffIndex % otherStaffTypes.length],
          email: s.email,
          phone: s.phone,
          status: practice.status,
          activatedAt: practice.activatedAt,
          invitedAt: practice.invitedAt,
        });
      });
    }
  });

  return staff;
};

export const mockStaffMembers: StaffMember[] = generateStaffMembers(mockPractices);
