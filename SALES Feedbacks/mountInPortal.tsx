// ─── Growth Team Feedback, mounted in the main portal ────────────────────────
// src/app/App.tsx pulls these in so everything the Growth folder adds runs on
// the normal dev server (npm run dev, port 5173) and the deployed site: the
// extra portal-select card, /growth, and the public pages dentists and
// partners open (review, LabLink, partner links). The standalone sandbox
// (SALES Feedbacks/main.tsx, port 5180) uses the same routes, so the two
// can't drift apart: any public page added to Growth goes in `growthRoutes`.
import { ReactNode, useEffect } from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { useAuth } from '../src/app/context/AuthContext';
import LabPrescriptionInboxApp from './lab-prescription-inbox/LabPrescriptionInboxApp';
import DesignReviewPage from './design-studio/review/DesignReviewPage';
import PublicIntakePage from './intake-form/PublicIntakePage';
import PartnerPage from './cad-integration/public/PartnerPage';
import PortalSelectWithGrowth from './growth-portal/PortalSelectWithGrowth';
import { GROWTH_BASE, leaveGrowth } from './growthIsolation';
import './lab-prescription-inbox/sandbox.css';

// Opened anywhere but Growth Team Feedback: make sure its cases aren't in the
// shared list the real portals read (growthIsolation.ts).
if (typeof window !== 'undefined' && !window.location.pathname.startsWith(GROWTH_BASE)) leaveGrowth();

/** Signed out (a new tab, or after Log out): sign in, then come back to the
 *  exact page that was asked for (What's new links, shared links) rather than
 *  the portal select screen. The login page honours ?next=. */
function RequireSignIn({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  if (!user) return <Navigate to={`/login?portal=lab&next=${encodeURIComponent(pathname + search)}`} replace />;
  return <>{children}</>;
}

/** /intake/ was LabLink's first address: old links and embed codes redirect. */
function LegacyIntakeRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/intake\//, '/lablink/')}${search}`} replace />;
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

/** Route elements for App's <Routes> (and the standalone sandbox). */
export const growthRoutes = (
  <>
    {/* Design Studio: the dentist's review link. Public, no sign-in. */}
    <Route path="/review/:token/*" element={<DesignReviewPage />} />
    {/* LabLink: the lab's public form (new cases, or files for an existing case). Public too. */}
    <Route path="/lablink/:slug" element={<PublicIntakePage />} />
    <Route path="/intake/:slug" element={<LegacyIntakeRedirect />} />
    {/* CAD integration: an outside design or milling partner's link. Public, no account. */}
    <Route path="/partner/:token" element={<PartnerPage />} />
    {/* Growth Team Feedback: the Lab portal with the Sales Feedbacks features. */}
    <Route path={`${GROWTH_BASE}/*`} element={<RequireSignIn><LabPrescriptionInboxApp /></RequireSignIn>} />
  </>
);
