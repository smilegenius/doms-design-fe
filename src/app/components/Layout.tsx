import { ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft as ChevronLeftIcon, PanelLeftClose, PanelLeftOpen, LogOut, MessageSquare, Bell, User as UserIcon, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from './PageLoader';
import { MOCK_NOTIFICATIONS } from '../pages/NotificationsPage';

function NotificationsPopover({ onClose: _onClose, onViewAll }: { onClose: () => void; onViewAll: () => void }) {
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const items = MOCK_NOTIFICATIONS.filter(n => tab === 'all' || !n.read).slice(0, 4);
  return (
    <div className="absolute right-0 top-full mt-2 w-[380px] bg-white border border-[#E0E0E6] rounded-xl shadow-lg overflow-hidden z-50">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EFF6]">
        <h3 className="text-base font-semibold text-[#030213]">Notifications</h3>
        <button className="text-xs font-medium text-[#4D8EF7] hover:text-[#3578E5]">Mark all as read</button>
      </div>
      <div className="flex items-center gap-6 px-5 pt-3 border-b border-[#F0EFF6]">
        <button
          onClick={() => setTab('all')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'all' ? 'text-[#030213] border-[#030213]' : 'text-[#717182] border-transparent hover:text-[#030213]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setTab('unread')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'unread' ? 'text-[#030213] border-[#030213]' : 'text-[#717182] border-transparent hover:text-[#030213]'
          }`}
        >
          Unread
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#717182]">No notifications</p>
        ) : (
          items.map(n => (
            <div key={n.id} className="px-5 py-3.5 border-b border-[#F0EFF6] last:border-b-0 flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#F3F3F5] flex items-center justify-center text-[10px] font-semibold text-[#5A5568]">
                  R
                </div>
                {!n.read && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4183D]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#030213] mb-0.5">{n.title}</p>
                <p className="text-xs text-[#717182] leading-relaxed line-clamp-3">{n.body}</p>
                <p className="text-[10px] text-[#A0A0B0] mt-1.5">{n.timestamp}</p>
              </div>
            </div>
          ))
        )}
      </div>
      <button
        onClick={onViewAll}
        className="w-full px-5 py-3 text-sm font-medium text-[#030213] border-t border-[#F0EFF6] hover:bg-[#F8F9FC] transition-colors"
      >
        View all notification
      </button>
    </div>
  );
}
import ClinicsIcon from './icons/ClinicsIcon';
import StaffIcon from './icons/StaffIcon';
import OverviewIcon from './icons/OverviewIcon';
import CasesIcon from './icons/CasesIcon';
import {
  FilledPackage, FilledFileText, FilledBarChart,
  FilledSliders, FilledGear,
} from './icons/FilledNavIcons';

interface LayoutProps {
  children: ReactNode;
  activePage?: string;
  onNavigate?: (page: string) => void;
  // Which portal context this Layout is being used in. Controls which nav
  // items show in the sidebar. Defaults to 'supplier' (dental group portal).
  // 'clinic' shows only Overview + Cases — used by the Clinic Portal which
  // doesn't expose the network / spending modules. 'lab' is the manufacturing
  // lab's view — incoming cases from its clinic/dental-group clients, plus the
  // Case Scoring configuration.
  portal?: 'supplier' | 'clinic' | 'lab';
}

// Flat sidebar — Spending parent removed; all items live at one level.
// Order matches the latest design: Overview · Suppliers · Cases · Invoices ·
// Analytics · Configuration · Practises · Staff.
const supplierNavItems = [
  { id: 'overview',             label: 'Overview',      icon: OverviewIcon,    isCustom: true  },
  { id: 'suppliers',            label: 'Suppliers',     icon: FilledPackage,   isCustom: false },
  { id: 'cases',                label: 'Cases',         icon: CasesIcon,       isCustom: true  },
  { id: 'invoices',             label: 'Invoices',      icon: FilledFileText,  isCustom: false },
  { id: 'spend-analytics',      label: 'Analytics',     icon: FilledBarChart,  isCustom: false },
  { id: 'spend-settings',       label: 'Configuration', icon: FilledSliders,   isCustom: false },
  { id: 'practice-management',  label: 'Practises',     icon: ClinicsIcon,     isCustom: true  },
  { id: 'staff',                label: 'Staff',         icon: StaffIcon,       isCustom: true  },
];

const clinicNavItems = [
  { id: 'overview',  label: 'Overview',  icon: OverviewIcon,    isCustom: true  },
  { id: 'cases',     label: 'Cases',     icon: CasesIcon,       isCustom: true  },
  // Invoices reuses the supplier-portal InvoicesPage as-is; statuses will be
  // customised for the clinic context later.
  { id: 'invoices',  label: 'Invoices',  icon: FilledFileText,  isCustom: false },
  // Practice-scoped Analytics: spend, invoices and lab cases (no group-HQ /
  // AP-automation surfaces — see ClinicAnalyticsPage).
  { id: 'analytics', label: 'Analytics', icon: FilledBarChart,  isCustom: false },
  // Clinic-scope Suppliers: add from Global Registry, from Dental Group, or
  // create new (manual entries land as Pending review for DSO + admin sign-off).
  { id: 'suppliers', label: 'Suppliers', icon: FilledPackage,   isCustom: false },
];

// Lab Portal — the manufacturing lab's view. Cases flow IN from its clients
// (clinics + dental groups); Configuration is where the lab sets up case
// scoring (weighted prescription fields per service type).
const labNavItems = [
  { id: 'overview',      label: 'Overview',      icon: OverviewIcon,    isCustom: true  },
  { id: 'cases',         label: 'Cases',         icon: CasesIcon,       isCustom: true  },
  { id: 'invoices',      label: 'Invoices',      icon: FilledFileText,  isCustom: false },
  { id: 'analytics',     label: 'Analytics',     icon: FilledBarChart,  isCustom: false },
  { id: 'configuration', label: 'Configuration', icon: FilledSliders,   isCustom: false },
];

export default function Layout({ children, activePage = 'overview', onNavigate, portal = 'supplier' }: LayoutProps) {
  const mainNavItems = portal === 'clinic' ? clinicNavItems : portal === 'lab' ? labNavItems : supplierNavItems;
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const isFirstRender = useRef(true);

  // Global page loader on tab change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setNavLoading(true);
    const t = setTimeout(() => setNavLoading(false), 500);
    return () => clearTimeout(t);
  }, [activePage]);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  // Close notif menu on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notif-menu]')) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notifOpen]);

  function handleNav(id: string) {
    onNavigate?.(id);
    // Auto-close mobile drawer on navigation
    setMobileOpen(false);
  }

  const navBtn = (isActive: boolean, extraCls = '') =>
    `w-full flex items-center rounded-lg text-left transition-colors relative ${
      collapsed ? 'justify-center px-2 py-2.5 mb-0.5' : 'gap-3 px-4 py-2.5 mb-0.5'
    } ${isActive ? 'bg-white/30 text-[#030213]' : 'text-[#5A5568] hover:bg-white/20'} ${extraCls}`;

  return (
    <div className="flex h-screen bg-[#F8F9FC]">

      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`flex flex-col transition-transform lg:transition-all duration-200 ease-in-out bg-white
          fixed inset-y-0 left-0 z-50 lg:static lg:inset-auto lg:flex-shrink-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-16' : 'w-[240px] lg:w-[200px]'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#F7E2F8] to-[#AEE3E6] opacity-50" />
        {/* Floating collapse/expand toggle — sits on the sidebar's right edge */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex absolute top-6 -right-3 z-30 w-6 h-6 items-center justify-center rounded-full bg-white border border-[#E0E0E6] shadow-sm hover:shadow-md hover:border-[#4D8EF7] text-[#717182] hover:text-[#4D8EF7] transition-all"
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeftIcon className="w-3.5 h-3.5" />}
        </button>
        <div className="relative z-10 flex flex-col h-full">

          {/* Logo */}
          <div className={`flex items-center transition-all duration-200 ${collapsed ? 'justify-center p-4' : 'p-6 pb-6'}`}>
            {collapsed ? (
              <svg width="32" height="32" viewBox="0 0 227 227" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <g clipPath="url(#sgfav_clip)">
                  <g filter="url(#sgfav_shadow)">
                    <path d="M184.134 6.03516H42.8637C22.5233 6.03516 6.03516 22.5068 6.03516 42.8267V184.171C6.03516 212.93 14.0759 220.963 42.8637 220.963H184.134C209.985 220.963 220.963 212.93 220.963 184.171V42.8267C220.963 22.5068 204.475 6.03516 184.134 6.03516Z" fill="black"/>
                  </g>
                  <path d="M184.292 181.083C186.829 176.422 183.025 178.072 180.806 179.479C144.19 202.702 111.958 187.686 105.864 185.566C102.89 184.532 102.89 184.532 102.89 184.532C109.054 191.713 122.667 199.056 143.997 198.152C167.092 197.174 181.12 186.908 184.292 181.083Z" fill="url(#sgfav_grad)"/>
                  <path d="M191.647 176.431C190.032 176.431 188.703 175.964 187.662 175.031C186.657 174.061 186.154 172.876 186.154 171.476C186.154 170.04 186.657 168.837 187.662 167.868C188.703 166.898 190.032 166.414 191.647 166.414C193.227 166.414 194.52 166.898 195.525 167.868C196.566 168.837 197.087 170.04 197.087 171.476C197.087 172.876 196.566 174.061 195.525 175.031C194.52 175.964 193.227 176.431 191.647 176.431Z" fill="white"/>
                  <path d="M134.181 70.5C139.205 70.5 143.59 71.4201 147.337 73.2603C151.169 75.1006 154.107 77.5159 156.15 80.5062V71.4201H177.992V135.483C177.992 141.387 176.672 146.716 174.032 151.47C171.478 156.301 167.518 160.134 162.153 162.971C156.874 165.808 150.275 167.227 142.356 167.227C131.797 167.227 123.239 164.965 116.682 160.441C110.125 155.994 106.379 149.936 105.442 142.269H127.028C127.709 144.722 129.327 146.639 131.882 148.02C134.436 149.476 137.587 150.205 141.334 150.205C145.847 150.205 149.423 149.016 152.063 146.639C154.788 144.339 156.15 140.62 156.15 135.483V126.397C154.021 129.387 151.084 131.841 147.337 133.758C143.59 135.598 139.205 136.518 134.181 136.518C128.305 136.518 122.983 135.176 118.215 132.493C113.446 129.732 109.657 125.86 106.847 120.876C104.122 115.816 102.76 109.988 102.76 103.394C102.76 96.7999 104.122 91.0109 106.847 86.0269C109.657 81.043 113.446 77.2092 118.215 74.5255C122.983 71.8418 128.305 70.5 134.181 70.5ZM156.15 103.509C156.15 98.6018 154.618 94.7297 151.552 91.8926C148.572 89.0556 144.91 87.6371 140.567 87.6371C136.225 87.6371 132.52 89.0556 129.455 91.8926C126.475 94.653 124.985 98.4868 124.985 103.394C124.985 108.301 126.475 112.212 129.455 115.126C132.52 117.963 136.225 119.381 140.567 119.381C144.91 119.381 148.572 117.963 151.552 115.126C154.618 112.288 156.15 108.416 156.15 103.509Z" fill="white"/>
                  <path d="M72.589 145.732C66.0916 145.732 60.3062 144.64 55.2329 142.455C50.1596 140.271 46.1543 137.3 43.2172 133.543C40.28 129.698 38.6334 125.417 38.2773 120.698H60.8403C61.1073 123.232 62.3089 125.286 64.445 126.859C66.5811 128.431 69.2068 129.218 72.322 129.218C75.1702 129.218 77.3508 128.693 78.8639 127.645C80.466 126.509 81.2671 125.067 81.2671 123.32C81.2671 121.223 80.1545 119.694 77.9294 118.732C75.7042 117.684 72.0995 116.548 67.1152 115.325C61.7748 114.101 57.3246 112.834 53.7643 111.524C50.2041 110.126 47.1334 107.985 44.5522 105.101C41.9711 102.131 40.6805 98.155 40.6805 93.1745C40.6805 88.9803 41.8376 85.1794 44.1517 81.7717C46.5549 78.2766 50.0261 75.5242 54.5654 73.5145C59.1937 71.5048 64.6675 70.5 70.9869 70.5C80.3325 70.5 87.6755 72.7718 93.0158 77.3154C98.4452 81.8591 101.56 87.8881 102.361 95.4026H81.2671C80.9111 92.8686 79.754 90.859 77.7959 89.3735C75.9267 87.8881 73.4346 87.1454 70.3194 87.1454C67.6492 87.1454 65.6021 87.6697 64.178 88.7182C62.7539 89.6794 62.0419 91.0337 62.0419 92.7813C62.0419 94.8783 63.1544 96.4511 65.3796 97.4996C67.6937 98.5482 71.2539 99.5967 76.0603 100.645C81.5786 102.043 86.0734 103.441 89.5446 104.839C93.0158 106.15 96.042 108.334 98.6232 111.393C101.293 114.364 102.673 118.383 102.762 123.451C102.762 127.732 101.516 131.577 99.0237 134.985C96.6206 138.305 93.1048 140.926 88.4765 142.849C83.9373 144.771 78.6414 145.732 72.589 145.732Z" fill="white"/>
                </g>
                <defs>
                  <filter id="sgfav_shadow" x="2.228" y="6.035" width="222.543" height="222.541" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                    <feOffset dy="3.808"/>
                    <feGaussianBlur stdDeviation="1.904"/>
                    <feComposite in2="hardAlpha" operator="out"/>
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
                  </filter>
                  <linearGradient id="sgfav_grad" x1="185.49" y1="187.175" x2="103.15" y2="190.664" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4D8EF7"/>
                    <stop offset="1" stopColor="#A59DFF"/>
                  </linearGradient>
                  <clipPath id="sgfav_clip">
                    <rect width="227" height="227" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            ) : (
              <svg width="171" height="40" viewBox="0 0 171 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
                <path d="M165.562 29.1068C166.989 26.0695 164.967 27.0625 163.778 27.9386C144.154 42.3949 126.639 31.467 123.506 29.8808C121.977 29.1068 121.977 29.1068 121.977 29.1068C125.035 34.0716 131.977 39.3547 143.129 39.3547C155.204 39.3547 163.778 32.9034 165.562 29.1068Z" fill="url(#sg_grad_l)"/>
                <path d="M166.72 25.7229C167.182 26.1365 167.77 26.3433 168.486 26.3433C169.186 26.3433 169.759 26.1365 170.204 25.7229C170.666 25.2933 170.896 24.7684 170.896 24.1479C170.896 23.5116 170.666 22.9866 170.204 22.573C169.759 22.1435 169.186 21.9287 168.486 21.9287C167.77 21.9287 167.182 22.1435 166.72 22.573C166.275 22.9866 166.052 23.5116 166.052 24.1479C166.052 24.7684 166.275 25.2933 166.72 25.7229Z" fill="#434343"/>
                <path d="M7.16303 27.1983C5.9568 27.1983 4.88276 26.9917 3.94091 26.5786C2.99906 26.1656 2.25549 25.6037 1.71021 24.8932C1.16492 24.1662 0.859234 23.3565 0.793139 22.4642H4.9819C5.03147 22.9434 5.25454 23.3317 5.65111 23.6292C6.04768 23.9266 6.53513 24.0753 7.11346 24.0753C7.64222 24.0753 8.04705 23.9762 8.32796 23.7779C8.62538 23.5631 8.7741 23.2904 8.7741 22.9599C8.7741 22.5634 8.56755 22.2742 8.15446 22.0925C7.74136 21.8942 7.07215 21.6794 6.14682 21.448C5.1554 21.2167 4.32922 20.9771 3.66827 20.7292C3.00732 20.4649 2.43725 20.06 1.95806 19.5148C1.47887 18.9529 1.23928 18.2011 1.23928 17.2593C1.23928 16.4661 1.45409 15.7473 1.8837 15.1029C2.32985 14.442 2.97427 13.9215 3.81698 13.5414C4.67621 13.1614 5.69242 12.9714 6.86561 12.9714C8.6006 12.9714 9.96381 13.401 10.9552 14.2602C11.9632 15.1194 12.5415 16.2596 12.6902 17.6806H8.7741C8.708 17.2014 8.49319 16.8214 8.12967 16.5405C7.78267 16.2596 7.32001 16.1191 6.74168 16.1191C6.24597 16.1191 5.86592 16.2183 5.60154 16.4166C5.33716 16.5983 5.20497 16.8544 5.20497 17.1849C5.20497 17.5815 5.41152 17.8789 5.82461 18.0772C6.25423 18.2755 6.91518 18.4738 7.80746 18.672C8.83193 18.9364 9.66638 19.2008 10.3108 19.4652C10.9552 19.713 11.517 20.1261 11.9962 20.7045C12.4919 21.2663 12.7481 22.0264 12.7646 22.9847C12.7646 23.7944 12.5332 24.5214 12.0706 25.1659C11.6244 25.7938 10.9718 26.2895 10.1125 26.653C9.26981 27.0165 8.28665 27.1983 7.16303 27.1983ZM33.0049 13.0209C34.7234 13.0209 36.0866 13.5414 37.0945 14.5824C38.119 15.6234 38.6312 17.0692 38.6312 18.9199V27H34.4177V19.49C34.4177 18.5977 33.9389 17.912 33.6989 17.4328C33.2362 16.9371 32.5918 16.6892 31.7656 16.6892C30.9394 16.6892 30.2868 16.9371 29.8076 17.4328C29.3449 17.912 29.1136 18.5977 29.1136 19.49V27H24.9V19.49C24.9 18.5977 24.6604 17.912 24.1812 17.4328C23.7186 16.9371 23.0742 16.6892 22.248 16.6892C21.4218 16.6892 20.7691 16.9371 20.2899 17.4328C19.8272 17.912 19.5959 18.5977 19.5959 19.49V27H15.3576V13.1696H19.5959V14.9046C20.0255 14.3263 20.5873 13.8719 21.2813 13.5414C21.9753 13.1944 22.7602 13.0209 23.636 13.0209C24.677 13.0209 25.6023 13.244 26.4119 13.6901C27.2381 14.1363 27.8826 14.7724 28.3452 15.5986C28.8244 14.8385 29.4771 14.2189 30.3033 13.7397C31.1295 13.2605 32.03 13.0209 33.0049 13.0209ZM43.727 11.7321C42.9834 11.7321 42.3721 11.5173 41.8929 11.0877C41.4302 10.6415 41.1989 10.0962 41.1989 9.45181C41.1989 8.79086 41.4302 8.24557 41.8929 7.81596C42.3721 7.36982 42.9834 7.14675 43.727 7.14675C44.454 7.14675 45.0489 7.36982 45.5116 7.81596C45.9907 8.24557 46.2303 8.79086 46.2303 9.45181C46.2303 10.0962 45.9907 10.6415 45.5116 11.0877C45.0489 11.5173 44.454 11.7321 43.727 11.7321ZM45.8338 13.1696V27H41.5954V13.1696H45.8338ZM53.1436 8.65867V27H48.9052V8.65867H53.1436ZM69.2523 19.8618C69.2523 20.2583 69.2275 20.6714 69.1779 21.101H59.5859C59.652 21.9603 59.9246 22.6212 60.4038 23.0839C60.8995 23.53 61.5026 23.7531 62.2132 23.7531C63.2707 23.7531 64.006 23.3069 64.4191 22.4147H68.9301C68.6987 23.3235 68.2774 24.1414 67.666 24.8684C67.0711 25.5955 66.3193 26.1656 65.4105 26.5786C64.5017 26.9917 63.4855 27.1983 62.3619 27.1983C61.0069 27.1983 59.8007 26.9091 58.7432 26.3308C57.6857 25.7525 56.8595 24.9263 56.2646 23.8522C55.6698 22.7782 55.3723 21.5224 55.3723 20.0848C55.3723 18.6473 55.6615 17.3915 56.2398 16.3174C56.8347 15.2434 57.6609 14.4172 58.7184 13.8389C59.7759 13.2605 60.9904 12.9714 62.3619 12.9714C63.7003 12.9714 64.89 13.2523 65.931 13.8141C66.972 14.3759 67.7817 15.1773 68.36 16.2183C68.9548 17.2593 69.2523 18.4738 69.2523 19.8618ZM64.9148 18.7464C64.9148 18.0194 64.6669 17.441 64.1712 17.0114C63.6755 16.5818 63.0559 16.367 62.3123 16.367C61.6018 16.367 60.9987 16.5735 60.503 16.9866C60.0238 17.3997 59.7263 17.9863 59.6107 18.7464H64.9148ZM81.9952 12.9714C82.9701 12.9714 83.821 13.1696 84.5481 13.5662C85.2916 13.9628 85.8617 14.4833 86.2583 15.1277V13.1696H90.4966V26.9752C90.4966 28.2475 90.2405 29.3959 89.7283 30.4204C89.2326 31.4614 88.4642 32.2876 87.4232 32.899C86.3987 33.5103 85.1181 33.816 83.5814 33.816C81.5325 33.816 79.8719 33.3286 78.5995 32.3537C77.3272 31.3953 76.6002 30.0899 76.4184 28.4376H80.6072C80.7394 28.9663 81.0533 29.3794 81.549 29.6768C82.0447 29.9908 82.6561 30.1478 83.3832 30.1478C84.2589 30.1478 84.9529 29.8917 85.4651 29.3794C85.9939 28.8837 86.2583 28.0823 86.2583 26.9752V25.0172C85.8452 25.6616 85.2751 26.1903 84.5481 26.6034C83.821 27 82.9701 27.1983 81.9952 27.1983C80.855 27.1983 79.8223 26.9091 78.897 26.3308C77.9716 25.7359 77.2363 24.9015 76.691 23.8274C76.1623 22.7369 75.8979 21.4811 75.8979 20.06C75.8979 18.639 76.1623 17.3915 76.691 16.3174C77.2363 15.2434 77.9716 14.4172 78.897 13.8389C79.8223 13.2605 80.855 12.9714 81.9952 12.9714ZM86.2583 20.0848C86.2583 19.0273 85.9609 18.1929 85.366 17.5815C84.7877 16.9701 84.0772 16.6644 83.2344 16.6644C82.3917 16.6644 81.6729 16.9701 81.0781 17.5815C80.4998 18.1763 80.2106 19.0025 80.2106 20.06C80.2106 21.1176 80.4998 21.9603 81.0781 22.5882C81.6729 23.1995 82.3917 23.5052 83.2344 23.5052C84.0772 23.5052 84.7877 23.1995 85.366 22.5882C85.9609 21.9768 86.2583 21.1423 86.2583 20.0848ZM106.6 19.8618C106.6 20.2583 106.575 20.6714 106.526 21.101H96.9337C96.9998 21.9603 97.2724 22.6212 97.7516 23.0839C98.2473 23.53 98.8505 23.7531 99.561 23.7531C100.618 23.7531 101.354 23.3069 101.767 22.4147H106.278C106.047 23.3235 105.625 24.1414 105.014 24.8684C104.419 25.5955 103.667 26.1656 102.758 26.5786C101.85 26.9917 100.833 27.1983 99.7097 27.1983C98.3547 27.1983 97.1485 26.9091 96.091 26.3308C95.0335 25.7525 94.2073 24.9263 93.6124 23.8522C93.0176 22.7782 92.7202 21.5224 92.7202 20.0848C92.7202 18.6473 93.0093 17.3915 93.5877 16.3174C94.1825 15.2434 95.0087 14.4172 96.0662 13.8389C97.1237 13.2605 98.3382 12.9714 99.7097 12.9714C101.048 12.9714 102.238 13.2523 103.279 13.8141C104.32 14.3759 105.129 15.1773 105.708 16.2183C106.303 17.2593 106.6 18.4738 106.6 19.8618ZM102.263 18.7464C102.263 18.0194 102.015 17.441 101.519 17.0114C101.023 16.5818 100.404 16.367 99.6601 16.367C98.9496 16.367 98.3465 16.5735 97.8508 16.9866C97.3716 17.3997 97.0742 17.9863 96.9585 18.7464H102.263ZM117.263 13.0209C118.882 13.0209 120.171 13.5497 121.13 14.6072C122.105 15.6482 122.592 17.0858 122.592 18.9199V27H118.378V19.49C118.378 18.5646 118.139 17.8459 117.66 17.3336C117.18 16.8214 116.536 16.5653 115.726 16.5653C114.917 16.5653 114.272 16.8214 113.793 17.3336C113.314 17.8459 113.074 18.5646 113.074 19.49V27H108.836V13.1696H113.074V15.0038C113.504 14.3924 114.082 13.9132 114.809 13.5662C115.536 13.2027 116.354 13.0209 117.263 13.0209ZM127.669 11.7321C126.925 11.7321 126.314 11.5173 125.835 11.0877C125.372 10.6415 125.141 10.0962 125.141 9.45181C125.141 8.79086 125.372 8.24557 125.835 7.81596C126.314 7.36982 126.925 7.14675 127.669 7.14675C128.396 7.14675 128.991 7.36982 129.453 7.81596C129.933 8.24557 130.172 8.79086 130.172 9.45181C130.172 10.0962 129.933 10.6415 129.453 11.0877C128.991 11.5173 128.396 11.7321 127.669 11.7321ZM129.776 13.1696V27H125.537V13.1696H129.776ZM146.504 13.1696V27H142.266V25.1163C141.836 25.7277 141.249 26.2234 140.506 26.6034C139.779 26.967 138.969 27.1487 138.077 27.1487C137.019 27.1487 136.086 26.9174 135.276 26.4547C134.466 25.9755 133.838 25.2898 133.392 24.3975C132.946 23.5052 132.723 22.456 132.723 21.2497V13.1696H136.937V20.6797C136.937 21.605 137.176 22.3238 137.655 22.836C138.135 23.3483 138.779 23.6044 139.589 23.6044C140.415 23.6044 141.068 23.3483 141.547 22.836C142.026 22.3238 142.266 21.605 142.266 20.6797V13.1696H146.504ZM155.175 27.1983C153.968 27.1983 152.894 26.9917 151.952 26.5786C151.011 26.1656 150.267 25.6037 149.722 24.8932C149.176 24.1662 148.871 23.3565 148.805 22.4642H152.993C153.043 22.9434 153.266 23.3317 153.663 23.6292C154.059 23.9266 154.547 24.0753 155.125 24.0753C155.654 24.0753 156.059 23.9762 156.34 23.7779C156.637 23.5631 156.786 23.2904 156.786 22.9599C156.786 22.5634 156.579 22.2742 156.166 22.0925C155.753 21.8942 155.084 21.6794 154.158 21.448C153.167 21.2167 152.341 20.9771 151.68 20.7292C151.019 20.4649 150.449 20.06 149.97 19.5148C149.49 18.9529 149.251 18.2011 149.251 17.2593C149.251 16.4661 149.466 15.7473 149.895 15.1029C150.341 14.442 150.986 13.9215 151.829 13.5414C152.688 13.1614 153.704 12.9714 154.877 12.9714C156.612 12.9714 157.975 13.401 158.967 14.2602C159.975 15.1194 160.553 16.2596 160.702 17.6806H156.786C156.72 17.2014 156.505 16.8214 156.141 16.5405C155.794 16.2596 155.332 16.1191 154.753 16.1191C154.258 16.1191 153.877 16.2183 153.613 16.4166C153.349 16.5983 153.217 16.8544 153.217 17.1849C153.217 17.5815 153.423 17.8789 153.836 18.0772C154.266 18.2755 154.927 18.4738 155.819 18.672C156.843 18.9364 157.678 19.2008 158.322 19.4652C158.967 19.713 159.529 20.1261 160.008 20.7045C160.504 21.2663 160.76 22.0264 160.776 22.9847C160.776 23.7944 160.545 24.5214 160.082 25.1659C159.636 25.7938 158.983 26.2895 158.124 26.653C157.281 27.0165 156.298 27.1983 155.175 27.1983Z" fill="#3C3C3C"/>
                <defs>
                  <linearGradient id="sg_grad_l" x1="166.052" y1="33.2046" x2="121.977" y2="33.2046" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4D8EF7"/>
                    <stop offset="1" stopColor="#A59DFF"/>
                  </linearGradient>
                </defs>
              </svg>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 overflow-y-auto">

            {/* Main items */}
            {mainNavItems.map(({ id, label, icon: Icon, isCustom }) => {
              const isActive = id === activePage;
              return (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  title={collapsed ? label : undefined}
                  className={navBtn(isActive)}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF] rounded-r" />}
                  {isCustom ? <Icon /> : <Icon className="w-5 h-5 flex-shrink-0" />}
                  {!collapsed && <span className="text-sm font-medium">{label}</span>}
                </button>
              );
            })}

            {/* Spending parent removed — Suppliers / Invoices / Analytics /
                Configuration now live at the top level in supplierNavItems. */}
          </nav>

          {/* Bottom actions */}
          <div className="p-3 border-t border-[#D4CEE1] space-y-0.5">

            {/* Collapse toggle moved to a floating chevron on the sidebar edge — see <aside> above */}

            {/* Settings */}
            <button
              onClick={() => handleNav('settings')}
              title={collapsed ? 'Settings' : undefined}
              className={`w-full flex items-center rounded-lg text-left text-[#5A5568] hover:bg-white/20 transition-colors ${
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5'
              }`}
            >
              <FilledGear className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">Settings</span>}
            </button>

          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top header */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-[#F0EFF6] flex items-center gap-1 px-4 sm:px-6 z-30">
          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC] rounded-lg transition-colors"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onNavigate?.('messages')}
            title="Messages"
            className="relative p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC] rounded-lg transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4D8EF7]" />
          </button>

          {/* Notifications */}
          <div className="relative" data-notif-menu>
            <button
              onClick={() => setNotifOpen(o => !o)}
              title="Notifications"
              className="relative p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC] rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4183D]" />
            </button>
            {notifOpen && (
              <NotificationsPopover
                onClose={() => setNotifOpen(false)}
                onViewAll={() => { setNotifOpen(false); onNavigate?.('notifications'); }}
              />
            )}
          </div>

          {/* User menu */}
          <div className="relative ml-1" data-user-menu>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-[#F8F9FC] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center text-white text-xs font-semibold">
                {(user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E0E0E6] rounded-xl shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#F0EFF6]">
                  <p className="text-xs text-[#A0A0B0]">Signed in as</p>
                  <p className="text-sm font-medium text-[#030213] truncate">{user?.email || 'User'}</p>
                </div>
                {/* Settings removed from the user menu — already lives in the
                    sidebar (Configuration item + bottom Settings button). */}
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/portal-select'); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Switch portal
                </button>
                <div className="border-t border-[#F0EFF6]" />
                <button
                  onClick={() => { setUserMenuOpen(false); setShowLogoutConfirm(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#C62828] hover:bg-[#FFF8F8] transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page body — keyed by active page so reveal animation replays on nav */}
        <div className="flex-1 overflow-auto relative">
          <div key={activePage} className="reveal">
            {children}
          </div>
        </div>

        {/* Global page loader */}
        {navLoading && <PageLoader />}
      </main>

      {/* Logout confirm */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#FFEBEE] flex items-center justify-center mb-4">
              <LogOut className="w-6 h-6 text-[#C62828]" />
            </div>
            <h3 className="text-base font-semibold text-[#030213] mb-1">Log out?</h3>
            <p className="text-sm text-[#717182] mb-6">You'll be returned to the login screen.</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A] rounded-lg hover:bg-[#FFCDD2] transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
