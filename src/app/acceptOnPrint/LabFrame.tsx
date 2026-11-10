// ─── Accept case on print · lab portal frame ─────────────────────────────────
// The lab portal shell around the flow's Case Details. Walkthroughs never stop at
// the login page, so this signs in with the demo account if needed. Every sidebar
// item, Cases included, opens the real lab portal page.

import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import { ensureDemo } from './store';

export const WALKTHROUGH_PATH = '/flows/accept-on-print';
export const casePath = (id: string) => `/flows/accept-on-print/case/${id}`;

export default function LabFrame({ children }: { children: ReactNode }) {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo'); }, [user, login]);
  useEffect(() => { ensureDemo(); }, []);
  if (!user) return null;
  return (
    <Layout
      portal="lab"
      activePage="cases"
      onNavigate={page => navigate(page === 'overview' ? '/lab' : `/lab/${page}`)}
    >
      {children}
    </Layout>
  );
}
