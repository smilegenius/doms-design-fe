import React, { ReactNode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, DEMO_ACCOUNT_EMAIL, useAuth } from '../src/app/context/AuthContext';
import { ToastProvider } from '../src/app/context/ToastContext';
import { SupplierFieldsProvider } from '../src/app/context/SupplierFieldsContext';
import { CaseScoringProvider } from '../src/app/context/CaseScoringContext';
import LabPrescriptionInboxApp from './lab-prescription-inbox/LabPrescriptionInboxApp';
import DesignReviewPage from './design-studio/review/DesignReviewPage';
import PublicUploadPage from './upload-links/PublicUploadPage';
import PublicIntakePage from './intake-form/PublicIntakePage';
import '../src/styles/index.css';
import './lab-prescription-inbox/sandbox.css';

// Same provider stack as src/main.tsx + src/app/App.tsx, so the reused portal
// pages behave exactly as they do in the live lab portal.

/** The sandbox has no login route — sign in with the prototype's demo account. */
function DemoSignIn({ children }: { children: ReactNode }) {
  const { user, login } = useAuth();
  useEffect(() => { if (!user) login(DEMO_ACCOUNT_EMAIL, ''); }, [user, login]);
  return user ? <>{children}</> : null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SupplierFieldsProvider>
            <CaseScoringProvider>
              <Routes>
                {/* Design Studio — the dentist's review link. Public: no sign-in. */}
                <Route path="/review/:token/*" element={<DesignReviewPage />} />
                {/* Clinician upload link + the lab's website intake form. Public too. */}
                <Route path="/upload/:token" element={<PublicUploadPage />} />
                <Route path="/intake/:slug" element={<PublicIntakePage />} />
                <Route path="*" element={
                  <DemoSignIn>
                    <Routes>
                      <Route path="/lab/*" element={<LabPrescriptionInboxApp />} />
                      <Route path="*" element={<Navigate to="/lab/cases" replace />} />
                    </Routes>
                  </DemoSignIn>
                } />
              </Routes>
            </CaseScoringProvider>
          </SupplierFieldsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
