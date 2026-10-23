// ─── New Case Flow · portal frame ────────────────────────────────────────────
// The clinic portal shell around the flow's screens. Walkthroughs never stop at
// the login page, so this signs in with the demo account if needed. "Lab Work"
// stays inside the flow; every other sidebar item opens the real portal page.

import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';

export default function FlowFrame({ children, collapsed }: { children: ReactNode; collapsed?: boolean }) {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo'); }, [user, login]);
  if (!user) return null;
  return (
    <Layout
      portal="clinic"
      activePage="cases"
      defaultCollapsed={collapsed}
      onNavigate={page => navigate(page === 'cases' ? '/flows/new-case/cases' : page === 'overview' ? '/clinic' : `/clinic/${page}`)}
    >
      {children}
    </Layout>
  );
}
