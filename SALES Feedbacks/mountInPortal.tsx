// ─── Growth Team Feedback, mounted in the main portal ────────────────────────
// src/app/App.tsx pulls these in so everything the Growth folder adds runs on
// the normal dev server (npm run dev, port 5173): the extra portal-select card,
// /growth, and the public review / upload / intake links. The standalone
// sandbox (SALES Feedbacks/main.tsx, port 5180) still works the same way.
import { ReactNode, useEffect } from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { useAuth } from '../src/app/context/AuthContext';
import LabPrescriptionInboxApp from './lab-prescription-inbox/LabPrescriptionInboxApp';
import DesignReviewPage from './design-studio/review/DesignReviewPage';
import PublicIntakePage from './intake-form/PublicIntakePage';
import PortalSelectWithGrowth from './growth-portal/PortalSelectWithGrowth';
import { GROWTH_BASE, leaveGrowth } from './growthIsolation';
import './lab-prescription-inbox/sandbox.css';

// Opened anywhere but Growth Team Feedback: make sure its cases aren't in the
// shared list the real portals read (growthIsolation.ts).
if (typeof window !== 'undefined' && !window.location.pathname.startsWith(GROWTH_BASE)) leaveGrowth();

/** Signed out (e.g. after Log out): back to the portal select screen. */
function RequireSignIn({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// A few unchanged portal components link to /lab/... (e.g. the scanner and
// email notices on Cases). Clicked inside Growth Team Feedback, they should
// stay in it rather than jump into the real Lab portal.
let lastPath = typeof window !== 'undefined' ? window.location.pathname : '/';

/** Render once above <Routes>: remembers where the user came from. */
export function GrowthPathTracker() {
  const { pathname } = useLocation();
  useEffect(() => { lastPath = pathname; }, [pathname]);
  return null;
}

/** Wraps the real /lab route: a /lab link clicked from inside /growth is sent back into /growth. */
export function GrowthLabGuard({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  if (lastPath.startsWith(GROWTH_BASE)) return <Navigate to={`${GROWTH_BASE}${pathname.slice(4)}${search}`} replace />;
  return <>{children}</>;
}

export { PortalSelectWithGrowth };

/** Route elements for App's <Routes>. */
export const growthRoutes = (
  <>
    {/* Design Studio: the dentist's review link. Public, no sign-in. */}
    <Route path="/review/:token/*" element={<DesignReviewPage />} />
    {/* Clinician upload link + the lab's website intake form. Public too. */}
    <Route path="/intake/:slug" element={<PublicIntakePage />} />
    {/* Growth Team Feedback: the Lab portal with the Sales Feedbacks features. */}
    <Route path={`${GROWTH_BASE}/*`} element={<RequireSignIn><LabPrescriptionInboxApp /></RequireSignIn>} />
  </>
);
