# Dental SaaS — Supplier Portal · Codebase Handoff

**Extracted from:** `Update_Product_Design_System.make` (v45 — "Merge header and simplify")  
**Extracted:** 2026-05-12  
**Source:** Figma Make export · 45 versions · 593 messages

---

## Quick Start

```bash
npm install
npm run dev
```

Stack: React 18 + TypeScript + Vite + Tailwind CSS + lucide-react

---

## Project Structure

```
src/
├── main.tsx                        # Entry point
├── styles/index.css                # Global styles + Tailwind
└── app/
    ├── App.tsx                     # Root — page routing + modal state
    ├── data/
    │   └── clinicsData.ts          # All mock data + TypeScript interfaces
    ├── pages/
    │   ├── PracticeManagementPage.tsx   # ⭐ Main listing (grid + table, filters, bulk actions)
    │   ├── PracticeDetailPage.tsx       # ⭐ Practice detail view (v45 — simplified header)
    │   ├── StaffManagementPage.tsx      # ⭐ Staff listing (mirrors Practice pattern)
    │   └── ClinicsPage.tsx             # Legacy — superseded by PracticeManagementPage
    └── components/
        ├── Layout.tsx                   # Sidebar nav + page shell
        ├── StatusBadge.tsx              # Active / Invited / Pending Invite / Inactive pills
        ├── Button.tsx                   # Primary (gradient) + Secondary variants
        ├── SearchInput.tsx              # Search bar with filter button
        ├── DropdownFilter.tsx           # Status / City filter dropdowns
        ├── FilterDrawer.tsx             # Slide-in advanced filter panel
        ├── ClinicsGrid.tsx              # Practice card grid view
        ├── ClinicsTable.tsx             # Practice table view
        ├── StaffGrid.tsx                # Staff card grid view
        ├── StaffTable.tsx               # Staff table view
        ├── Pagination.tsx               # Page controls
        ├── EmptyState.tsx               # Zero-results empty state
        ├── LoadingState.tsx             # Loading spinner
        ├── SkeletonLoader.tsx           # Skeleton placeholders (grid + table)
        ├── Modal.tsx                    # Base modal shell
        ├── AddPracticeModal.tsx         # Add new practice form
        ├── AddStaffModal.tsx            # Add new staff form
        ├── InviteModal.tsx              # Send invite modal (practices + staff)
        ├── InvitePracticeModal.tsx      # Single practice invite
        ├── BulkInviteModal.tsx          # Bulk invite for selected practices
        ├── InviteClinicPage.tsx         # Full-page invite flow
        ├── StaffDetailModal.tsx         # Staff member detail modal
        ├── CSVUploadModal.tsx           # CSV import step 1 — upload
        ├── CSVValidationModal.tsx       # CSV import step 2 — validation errors
        ├── ImportSuccessModal.tsx       # CSV import step 3 — success
        └── icons/                       # Custom SVG icon components
            ├── BillingIcon.tsx
            ├── CasesIcon.tsx
            ├── ClinicsIcon.tsx
            ├── OverviewIcon.tsx
            └── StaffIcon.tsx
```

---

## App.tsx — Navigation & State Architecture

The root `App.tsx` owns all cross-page state:

| State | Type | Purpose |
|-------|------|---------|
| `activePage` | `'practice-management' \| 'staff' \| 'practice-detail'` | Current page |
| `selectedPractice` | `Practice \| null` | Practice being viewed in detail |
| `inviteModalOpen` | `boolean` | Global invite modal visibility |
| `inviteData` | `{ practices, staff }` | Data passed to invite modal |
| `staffDetailModal` | `StaffMember \| null` | Staff member in detail modal |

Callbacks passed down to pages:
- `onShowInviteModal(practices, staff?)` — open invite modal with context
- `onShowPracticeDetail(practice)` — navigate to detail page
- `onShowStaffDetail(staff)` — open staff detail modal

---

## Data Layer (`clinicsData.ts`)

### Core interfaces
```ts
Practice { id, name, practiceCode, address, city, country, status, managers[], dentists[], staff[] }
StaffMember { id, practiceId, practiceName, name, staffType, email, status, ... }
Manager { name, email, phone? }
Dentist { name, email, phone?, performerCode? }
```

### Status values
```ts
'active' | 'inactive' | 'pending-invite' | 'invited'
```

### Mock data exports
```ts
mockPractices  // Array<Practice> — ~50 generated practices
mockStaffMembers  // Array<StaffMember>
```

---

## Design System Tokens

| Token | Value |
|-------|-------|
| Background | `#F8F9FC` |
| Surface | `#FFFFFF` |
| Border | `#E0E0E6` |
| Text primary | `#030213` |
| Text secondary | `#717182` |
| Text muted | `#8B8B9E` |
| Brand gradient | `linear-gradient(90deg, #4D8EF7, #A59DFF)` |
| Sidebar gradient | `from-[#F7E2F8] to-[#AEE3E6]` |
| Status active | `bg-[#E8F5E9] text-[#2E7D32]` |
| Status invited | `bg-[#E3F2FD] text-[#1565C0]` |
| Status pending | `bg-[#FFF9E6] text-[#F57C00]` |
| Status inactive | `bg-[#FFF3E0] text-[#E65100]` |
| Font | Inter (400, 500, 600) |
| Monospace | Consolas (practice codes) |
| Border radius | `10px` cards, `9999px` badges |
| Sidebar width | `200px` |

---

## Known Fragile Areas

> These have broken multiple times during the 45-version iteration. Handle with care.

| Area | Risk | Rule |
|------|------|------|
| Checkbox selection | High | `e.stopPropagation()` required — checkbox click must NOT trigger row navigation |
| Row click → detail | High | Only fires when checkbox area is NOT clicked |
| Bulk action bar | Medium | Appears when `selectedIds.length > 0` — don't remove this check |
| Icon right-alignment | Low | Fixed in v41-42 — `mr-3` on icon containers in cards |
| Table hover arrows | Medium | Requires `z-index` layering — appear on row hover only |

---

## Component Patterns

### PracticeCard / StaffCard (in Grid components)
- Fixed height cards with logo area, status badge, metadata, action buttons
- Checkbox in top-right corner (stopPropagation required)
- Row click → `onShowDetail()` callback
- Checkbox click → toggle `selectedIds`

### Bulk Action Bar
- Appears at bottom when `selectedIds.length > 0`
- Shows selected count + "Send Invitation" / "Deselect All" actions
- Lives inside `PracticeManagementPage` and `StaffManagementPage`

### Status Badge
```tsx
<StatusBadge status="active" />  // or 'inactive' | 'invited' | 'pending-invite'
```

### Primary Button
```tsx
<Button variant="primary">Add Practice</Button>  // gradient bg
<Button variant="secondary">Cancel</Button>       // outlined
```

---

## Pages: Current State

### PracticeManagementPage (804 lines)
- Grid / Table toggle
- Search + Status filter + City filter + Country filter
- FilterDrawer for advanced filters
- Pagination (20 per page default)
- Bulk selection + bulk invite
- Add Practice modal (3-step form)
- CSV import flow (upload → validate → success)
- Single practice invite modal
- Click-through to PracticeDetailPage

### PracticeDetailPage (497 lines — v45)
- Practice header (name, code, status badge, back button)
- Stats row
- Tabs: Overview / Dentists / Staff / Activity
- Manager info card
- Contact details section
- Dentists list with status badges

### StaffManagementPage (489 lines)
- Mirrors Practice module pattern
- Grid / Table toggle
- Search + filters + pagination
- Staff detail modal
- Add staff modal
- Invite staff flow

---

## Navigation Stubs (no content yet)
- Overview
- Cases  
- Billing
- Dentists (nav item)
- Patients (nav item)

---

## Recommended Next Steps (by priority)

### 1. Stabilize (immediate)
- [ ] Verify checkbox vs row-click behavior in both Grid and Table views
- [ ] Test bulk action bar appears/disappears correctly
- [ ] Verify invite modal works end-to-end (single + bulk)
- [ ] Check PracticeDetailPage tabs render correctly
- [ ] Add `src/app/components/icons/DentistsIcon.tsx` (missing for nav)

### 2. Extract design tokens (consistency)
- [ ] Create `src/app/tokens.ts` with all color/spacing constants
- [ ] Replace hardcoded hex values with token references

### 3. Add missing project config
- [ ] Add `src/app/components/icons/DentistsIcon.tsx`
- [ ] Add `src/app/components/icons/PatientsIcon.tsx`
- [ ] Add `src/app/components/icons/SettingsIcon.tsx`

### 4. Scalability
- [ ] Convert absolute Figma-output layouts to flex/grid
- [ ] Add `src/app/components/DataTable.tsx` — shared table primitive
- [ ] Add `src/app/components/Toast.tsx` — notification system
- [ ] Add mock data `src/app/data/staffData.ts` — separate from clinicsData

---

## Version History Summary

| v | Title | Key change |
|---|-------|-----------|
| 1–10 | Initial build | System setup, Clinics listing |
| 11–30 | Core modules | Grid/table, filters, CSV import |
| 31–42 | Polish | Hover states, spacing fixes, icon alignment |
| 43 | Invite flows | InviteModal, BulkInviteModal, detail page |
| 44 | Fix interactions | Checkbox/row separation, bulk actions |
| **45** | **Merge header** | **PracticeDetailPage header simplified (current)** |

