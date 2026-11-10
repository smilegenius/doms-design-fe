import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../src/app/context/AuthContext';
import App from '../src/app/App';
import { ToastProvider } from '../src/app/context/ToastContext';
import { SupplierFieldsProvider } from '../src/app/context/SupplierFieldsContext';
import { CaseScoringProvider } from '../src/app/context/CaseScoringContext';
import { growthRoutes, PortalSelectWithGrowth } from './mountInPortal';
import { GROWTH_BASE, leaveGrowth } from './growthIsolation';
import '../src/styles/index.css';
import './lab-prescription-inbox/sandbox.css';

// Same provider stack as src/main.tsx + src/app/App.tsx, so the reused portal
// pages behave exactly as they do in the live lab portal.

// Opened anywhere but Growth Team Feedback: make sure its cases aren't in the
// shared list the real portals read (growthIsolation.ts).
if (!window.location.pathname.startsWith(GROWTH_BASE)) leaveGrowth();

// A few unchanged portal components link to /lab/... (e.g. the scanner and
// email notices on Cases). Clicked inside Growth Team Feedback, they should
// stay in it rather than jump into the real Lab portal.
let lastPath = window.location.pathname;
function TrackPath() {
  const { pathname } = useLocation();
  useEffect(() => { lastPath = pathname; }, [pathname]);
  return null;
}
function RealApp() {
  const { pathname, search } = useLocation();
  if (pathname.startsWith('/lab') && lastPath.startsWith(GROWTH_BASE)) {
    return <Navigate to={`${GROWTH_BASE}${pathname.slice(4)}${search}`} replace />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SupplierFieldsProvider>
            <CaseScoringProvider>
              <TrackPath />
              <Routes>
                {/* Growth Team Feedback and its public pages (review, LabLink, partner links):
                    the same routes the main portal mounts (mountInPortal.tsx). */}
                {growthRoutes}
                {/* Portal select, with the Growth Team Feedback card added. */}
                <Route path="/" element={<PortalSelectWithGrowth />} />
                <Route path="/portal-select" element={<PortalSelectWithGrowth />} />
                {/* Everything else is the real, unchanged app: login and every other
                    portal, including the real Lab portal at /lab. */}
                <Route path="*" element={<RealApp />} />
              </Routes>
            </CaseScoringProvider>
          </SupplierFieldsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
