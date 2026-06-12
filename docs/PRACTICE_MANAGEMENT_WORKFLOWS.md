# Practice Management Module - Workflows Documentation

## Overview
The Practice Management module is a comprehensive system for managing dental practices, their team members (managers, dentists, and staff), and handling invitation workflows. This document outlines all the workflows implemented in the module.

---

## 1. Practice Import Workflow (CSV)

### Purpose
Bulk import multiple practices with their team members from a CSV file.

### Flow
1. **Upload CSV**: User clicks "Import CSV" button
2. **File Validation**: System parses CSV and validates each row
   - Required fields: Practice Name, Practice Code, Manager Name, Manager Email, at least one Dentist
   - Email format validation
   - Duplicate practice code detection
3. **Validation Results**: Modal displays validation summary
   - Shows count of valid rows vs total rows
   - Lists all errors by row number and field
   - Option to proceed with valid rows only
4. **Import Confirmation**: Success modal shows count of imported practices
5. **Status Assignment**: All imported practices are set to "pending-invite" status

### Components
- `CSVUploadModal.tsx` - File upload interface
- `CSVValidationModal.tsx` - Validation results and error display
- `ImportSuccessModal.tsx` - Import confirmation
- `PracticeManagementPage.tsx` (lines 116-284) - CSV parsing and validation logic

### Data Structure
CSV must include columns:
- Practice Name, Practice Code, Address, City, Country
- Manager Name, Manager Email, Manager Phone
- Dentist 1-10 Name, Email, Phone, Performer Code
- Staff 1-10 Name, Email, Phone (optional)

---

## 2. Manual Practice Addition Workflow

### Purpose
Add individual practices through a step-by-step form wizard.

### Flow
1. **Initiate**: User clicks "Add Practice" button
2. **Step 1 - Basic Information**:
   - Practice Name (required)
   - Practice Code (required)
   - Address, City, Country (optional)
3. **Step 2 - Managers**:
   - Add minimum 1 manager (required)
   - Each manager: Name, Email, Phone
   - Can add multiple managers dynamically
4. **Step 3 - Dentists**:
   - Add minimum 1 dentist (required)
   - Each dentist: Name, Email, Phone, Performer Code
   - Can add multiple dentists dynamically
5. **Step 4 - Staff** (optional):
   - Add staff members
   - Each staff: Name, Email, Phone
6. **Submit**: Practice is created with "pending-invite" status

### Components
- `AddPracticeModal.tsx` - Multi-step wizard modal
- Validation enforces minimum requirements at each step

---

## 3. Practice Invitation Workflow

### Purpose
Send customizable email invitations to practice team members.

### Flow Types

#### A. Single Practice Invitation
1. User clicks "Invite" button on a pending-invite practice
2. Full-screen invite page opens with pre-populated data:
   - Recipients list (all managers and dentists from practice)
   - Practice code pre-filled
   - Default email subject and body
3. User can customize:
   - Add/remove recipients manually
   - Edit practice code
   - Customize email subject and body
   - Add CC recipients
   - Use rich text editor toolbar for formatting
4. Click "Send Invite" button
5. Practice status changes to "invited"

#### B. Bulk Practice Invitation
1. User selects multiple practices using checkboxes
2. Clicks "Invite X Practices" from bulk actions bar
3. Same full-screen page opens with:
   - All recipients from all selected practices
   - Header shows count: "Invite X Clinics"
   - All managers and dentists listed as recipients
4. User customizes email and sends
5. All selected practices update to "invited" status

#### C. Resend Invitation
1. For practices with "invited" status
2. Click "Resend" button (available in both grid and table view)
3. Opens same invite page for re-customization
4. Sends reminder invitation

### Components
- `InviteClinicPage.tsx` - Full-screen customizable invite interface
- Grid layout (12 columns):
  - Clinic Name (3 cols)
  - Email (4 cols)
  - Practice Code (3 cols)
  - Add Member button (2 cols)
- Rich text editor toolbar for email body formatting
- Recipient tags with remove option

---

## 4. Practice Status Management

### Status Types
1. **pending-invite** (Orange/Yellow)
   - New practices awaiting invitation
   - Action: "Invite" button available

2. **invited** (Blue)
   - Invitation sent, awaiting acceptance
   - Action: "Resend" button available

3. **active** (Green)
   - Practice is onboarded and active
   - Actions: "View Details" + "Message" buttons

4. **inactive** (Orange)
   - Practice is inactive but can be managed
   - Action: "View Details" button

### Status Workflow
```
CSV Import/Manual Add → pending-invite → invited → active
                                                   ↓
                                              inactive
```

---

## 5. Practice Filtering and Search

### Filter Options

#### A. Search
- Real-time search across:
  - Practice name
  - Practice code
  - Manager emails
- Search input with instant filtering

#### B. Status Filter (Clickable Stat Cards)
- 5 stat cards at top of page:
  1. **Total Practices** - Shows all practices
  2. **Active** - Green card, filters active only
  3. **Inactive** - Orange card, filters inactive only
  4. **Pending Invite** - Yellow card, filters pending only
  5. **Invited** - Blue card, filters invited only
- Cards are clickable buttons
- Active card shows ring highlight
- Cards display count for each status

#### C. City Filter
- Dropdown filter
- Automatically populated from existing practice cities
- "All Cities" option to clear filter

#### D. Clear Filters
- "Clear Filters" button appears when any filter is active
- Resets all filters to default state

### Components
- `SearchInput.tsx` - Search functionality
- `DropdownFilter.tsx` - Status and city filters
- Stat cards (lines 455-476 in PracticeManagementPage.tsx)

---

## 6. View Mode Toggle

### Purpose
Switch between different visualization modes for practices.

### Modes

#### A. Grid View (Default)
- 4-column responsive grid
- Compact card design with:
  - Practice icon with gradient background
  - Practice name and code
  - Status badge
  - Manager and dentist count
  - Action buttons based on status
  - Selection checkbox (top-right)
- Hover effect with shadow

#### B. Table View
- Traditional table layout with columns:
  - Checkbox
  - Practice Name (with city/country)
  - Practice Code
  - Manager (name and email)
  - Dentists (count)
  - Status
  - Actions
- Select all checkbox in header
- Indeterminate state for partial selection

### Toggle
- Icon button in search bar
- Grid icon when in table mode
- List icon when in grid mode
- Gradient button (purple-blue)

### Components
- `ClinicsGrid.tsx` - Grid view component
- `ClinicsTable.tsx` - Table view component

---

## 7. Bulk Selection and Actions

### Purpose
Perform actions on multiple practices simultaneously.

### Flow
1. **Selection**:
   - Click checkboxes on individual practices
   - Or use "Select All" in table view
   - Works in both grid and table views

2. **Bulk Actions Bar**:
   - Appears when 1+ practices selected
   - Shows count: "X practice(s) selected"
   - Available actions:
     - **Invite X Practices** - Only shown if selected practices include pending-invite or invited status
     - **Clear Selection** - Deselects all

3. **Execute Bulk Action**:
   - Click "Invite X Practices"
   - Opens full-screen invite page with all recipients
   - Send invitation updates all selected practices

### Components
- Bulk actions bar (lines 478-508 in PracticeManagementPage.tsx)
- Selection state management with `selectedIds` array
- Checkbox styling with custom CSS (white background, blue checkmark)

---

## 8. Pagination

### Purpose
Handle large lists of practices efficiently.

### Features
- Items per page selector (10, 25, 50, 100)
- Page navigation (Previous/Next, direct page numbers)
- Shows current range (e.g., "Showing 1-10 of 45")
- Resets to page 1 when changing items per page
- Only shows when totalPages > 1

### Components
- `Pagination.tsx`
- Integrated with filtered results

---

## 9. Practice Details Management

### Purpose
View and manage individual practice information.

### Access Points
- "View Details" button for active practices
- "View Details" button for inactive practices
- Three-dot menu icon (all practices)

### Available For
- Active status
- Inactive status
- All other statuses via three-dot menu

### Future Implementation
Currently triggers console log, intended to open detailed practice view/edit page.

---

## 10. Messaging Workflow

### Purpose
Send messages to active practice teams.

### Access
- "Message" button available only for active practices
- Shown in both grid and table views
- Icon: MessageSquare (chat bubble)

### Future Implementation
Currently triggers console log, intended to open messaging interface.

---

## Design System

### Color Palette
- **Primary Gradient**: `#4D8EF7` to `#A59DFF` (horizontal)
- **Sidebar Gradient**: `#F7E2F8` to `#AEE3E6` (vertical, 50% opacity)
- **Background**: `#F8F9FC`
- **Text Primary**: `#030213`
- **Text Secondary**: `#717182`
- **Border**: `#E0E0E6`

### Status Colors
- **Active**: `#2E7D32` on `#E8F5E9` background
- **Inactive**: `#E65100` on `#FFF3E0` background
- **Pending Invite**: `#F57C00` on `#FFF9E6` background
- **Invited**: `#1565C0` on `#E3F2FD` background

### Custom Styling
- Checkboxes: White background with grey outline, blue checkmark when checked
- Buttons: Gradient primary, outline secondary
- Cards: Rounded corners, subtle shadows on hover
- Icons: Lucide React icon set

---

## Technical Implementation

### State Management
- React `useState` for local component state
- `useMemo` for computed values (stats, filtered lists)
- Props drilling for data flow

### Data Model
```typescript
interface Practice {
  id: string;
  name: string;
  practiceCode: string;
  address?: string;
  city?: string;
  country?: string;
  status: 'active' | 'inactive' | 'pending-invite' | 'invited';
  managers: Manager[];
  dentists: Dentist[];
  staff?: Staff[];
  invitedAt?: string;
}

interface Manager {
  name: string;
  email: string;
  phone?: string;
}

interface Dentist {
  name: string;
  email: string;
  phone?: string;
  performerCode?: string;
}

interface Staff {
  name: string;
  email: string;
  phone?: string;
}
```

### Key Files
- `/src/app/pages/PracticeManagementPage.tsx` - Main orchestration
- `/src/app/components/InviteClinicPage.tsx` - Full-screen invite interface
- `/src/app/components/AddPracticeModal.tsx` - Manual add wizard
- `/src/app/components/ClinicsGrid.tsx` - Grid view
- `/src/app/components/ClinicsTable.tsx` - Table view
- `/src/app/components/StatusBadge.tsx` - Status indicators
- `/src/app/data/clinicsData.ts` - Data models and mock data
- `/src/styles/globals.css` - Custom checkbox styling

---

## User Experience Enhancements

### Responsive Design
- Grid adjusts columns based on screen size (1 col mobile → 4 cols desktop)
- Table scrolls horizontally on small screens
- Forms adapt to mobile viewport

### Loading States
- Loading spinner during data operations
- Disabled states on buttons during processing
- Simulated delays for invitation sending (1.5s)

### Empty States
- "No clinics" state when list is empty
- "No results" state when filters return nothing
- Clear call-to-action buttons

### Validation Feedback
- Real-time form validation
- Row-level error reporting in CSV import
- Required field indicators
- Email format validation

### Success Feedback
- Success modals for import completion
- Status updates after invitation sent
- Visual confirmation (checkmarks, status changes)

---

## Future Enhancements (Not Yet Implemented)

1. **Practice Details Page**: Full CRUD operations for practice data
2. **Messaging System**: In-app messaging to practice teams
3. **Email Templates**: Saved templates for invitations
4. **Activity Log**: Track all actions on practices
5. **Export Functionality**: Export filtered practice lists to CSV
6. **Advanced Filters**: Date ranges, multiple status selection
7. **Practice Analytics**: Dashboard with charts and metrics
8. **Bulk Edit**: Edit multiple practices at once
9. **Archive Function**: Soft delete for practices
10. **Integration**: Connect with external practice management systems

---

## Last Updated
May 7, 2026

## Version
1.0
