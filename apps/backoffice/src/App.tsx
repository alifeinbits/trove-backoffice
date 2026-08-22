import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@project/components/ui/sonner';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { RoleProvider, useCurrentRole } from './components/RoleContext';
import Layout, { RoleGuard } from './components/Layout';

// Lazy-loaded pages
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const ProgramsPage = lazy(() => import('./pages/ProgramsPage'));
const ProgramDetailPage = lazy(() => import('./pages/ProgramDetailPage'));
const EntityReviewPage = lazy(() => import('./pages/EntityReviewPage'));
const EntityDetailPage = lazy(() => import('./pages/EntityDetailPage'));
const InviteEntitiesPage = lazy(() => import('./pages/InviteEntitiesPage'));
const FinancingPage = lazy(() => import('./pages/FinancingPage'));
const LimitsPage = lazy(() => import('./pages/LimitsPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage'));
const OnboardingsPage = lazy(() => import('./pages/OnboardingsPage'));
const OnboardingDetailPage = lazy(() => import('./pages/OnboardingDetailPage'));
const OfferLettersPage = lazy(() => import('./pages/OfferLettersPage'));
const FinancialInstitutionsPage = lazy(() => import('./pages/FinancialInstitutionsPage'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));
const OverdueLoansPage = lazy(() => import('./pages/OverdueLoansPage'));
const LoanDetailPage = lazy(() => import('./pages/LoanDetailPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CreditScoresPage = lazy(() => import('./pages/CreditScoresPage'));
const RiskAlertsPage = lazy(() => import('./pages/RiskAlertsPage'));
const AiAssistantPage = lazy(() => import('./pages/AiAssistantPage'));
const CheckerEntitiesPage = lazy(() => import('./pages/CheckerEntitiesPage'));
const CheckerLimitsPage = lazy(() => import('./pages/CheckerLimitsPage'));
const CheckerFinancingPage = lazy(() => import('./pages/CheckerFinancingPage'));
const FiLimitsPage = lazy(() => import('./pages/FiLimitsPage'));
const FiFinancingPage = lazy(() => import('./pages/FiFinancingPage'));
const FiLoansPage = lazy(() => import('./pages/FiLoansPage'));
const FiLedgerPage = lazy(() => import('./pages/FiLedgerPage'));
const FiRemindersPage = lazy(() => import('./pages/FiRemindersPage'));
const FiEntityScreeningPage = lazy(() => import('./pages/FiEntityScreeningPage'));
const OperationsGuidePage = lazy(() => import('./pages/OperationsGuidePage'));
const DataExportPage = lazy(() => import('./pages/DataExportPage'));
const FinancingDetailPage = lazy(() => import('./pages/FinancingDetailPage'));
const WarehouseReceiptsPage = lazy(() => import('./pages/WarehouseReceiptsPage'));
const AssetSchedulesPage = lazy(() => import('./pages/AssetSchedulesPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const PartnerDetailPage = lazy(() => import('./pages/PartnerDetailPage'));
const PartnerDashboardPage = lazy(() => import('./pages/PartnerDashboardPage'));
const PartnerEntitiesPage = lazy(() => import('./pages/PartnerEntitiesPage'));
const PartnerApiKeysPage = lazy(() => import('./pages/PartnerApiKeysPage'));
const PartnerActivityPage = lazy(() => import('./pages/PartnerActivityPage'));
const PartnerProgramsPage = lazy(() => import('./pages/PartnerProgramsPage'));
const PartnerInvoicesPage = lazy(() => import('./pages/PartnerInvoicesPage'));
const PartnerFinancingPage = lazy(() => import('./pages/PartnerFinancingPage'));
const PartnerLoansPage = lazy(() => import('./pages/PartnerLoansPage'));
const PartnerTransactionsPage = lazy(() => import('./pages/PartnerTransactionsPage'));
const ReconciliationPage = lazy(() => import('./pages/ReconciliationPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
          <div className="w-4 h-4 rounded bg-primary/30" />
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function PendingApprovalScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-amber-600">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/>
              <path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/>
              <path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Account Pending Approval</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Your account has been created successfully. A Super Admin needs to assign you a role before you can access the backoffice. Please check back shortly.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Check Again
            </button>
            <button
              onClick={() => logout()}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function AppContent() {
  const { loading: roleLoading, pending, isPartner } = useCurrentRole();

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md animate-pulse">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary-foreground">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/>
              <path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/>
              <path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/>
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (pending) {
    return <PendingApprovalScreen />;
  }

  return (
    <>
      <Toaster />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to={isPartner ? "/partner/dashboard" : "/overview"} replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            {/* Partner white-label routes */}
            <Route path="/partner/dashboard" element={<RoleGuard section="partner"><PartnerDashboardPage /></RoleGuard>} />
            <Route path="/partner/entities" element={<RoleGuard section="partner"><PartnerEntitiesPage /></RoleGuard>} />
            <Route path="/partner/api-keys" element={<RoleGuard section="partner"><PartnerApiKeysPage /></RoleGuard>} />
            <Route path="/partner/activity" element={<RoleGuard section="partner"><PartnerActivityPage /></RoleGuard>} />
            <Route path="/partner/programs" element={<RoleGuard section="partner"><PartnerProgramsPage /></RoleGuard>} />
            <Route path="/partner/invoices" element={<RoleGuard section="partner"><PartnerInvoicesPage /></RoleGuard>} />
            <Route path="/partner/financing" element={<RoleGuard section="partner"><PartnerFinancingPage /></RoleGuard>} />
            <Route path="/partner/loans" element={<RoleGuard section="partner"><PartnerLoansPage /></RoleGuard>} />
            <Route path="/partner/transactions" element={<RoleGuard section="partner"><PartnerTransactionsPage /></RoleGuard>} />
            <Route path="/entity-review" element={<RoleGuard section="maker"><EntityReviewPage /></RoleGuard>} />
            <Route path="/entities/:id" element={<EntityDetailPage />} />
            <Route path="/limits" element={<RoleGuard section="maker"><LimitsPage /></RoleGuard>} />
            <Route path="/financing" element={<RoleGuard section="maker"><FinancingPage /></RoleGuard>} />
            <Route path="/financing/:id" element={<FinancingDetailPage />} />
            <Route path="/checker/entities" element={<RoleGuard section="checker"><CheckerEntitiesPage /></RoleGuard>} />
            <Route path="/checker/limits" element={<RoleGuard section="checker"><CheckerLimitsPage /></RoleGuard>} />
            <Route path="/checker/financing" element={<RoleGuard section="checker"><CheckerFinancingPage /></RoleGuard>} />
            <Route path="/fi/entity-screening" element={<RoleGuard section="fi"><FiEntityScreeningPage /></RoleGuard>} />
            <Route path="/fi/limits" element={<RoleGuard section="fi"><FiLimitsPage /></RoleGuard>} />
            <Route path="/fi/financing" element={<RoleGuard section="fi"><FiFinancingPage /></RoleGuard>} />
            <Route path="/fi/loans" element={<RoleGuard section="fi"><FiLoansPage /></RoleGuard>} />
            <Route path="/fi/ledger" element={<RoleGuard section="fi"><FiLedgerPage /></RoleGuard>} />
            <Route path="/fi/reminders" element={<RoleGuard section="fi"><FiRemindersPage /></RoleGuard>} />
            <Route path="/programs" element={<RoleGuard section="management"><ProgramsPage /></RoleGuard>} />
            <Route path="/programs/:id" element={<RoleGuard section="management"><ProgramDetailPage /></RoleGuard>} />
            <Route path="/invite-entities" element={<RoleGuard section="management"><InviteEntitiesPage /></RoleGuard>} />
            <Route path="/onboardings" element={<RoleGuard section="management"><OnboardingsPage /></RoleGuard>} />
            <Route path="/onboardings/:id" element={<RoleGuard section="management"><OnboardingDetailPage /></RoleGuard>} />
            <Route path="/offer-letters" element={<RoleGuard section="management"><OfferLettersPage /></RoleGuard>} />
            <Route path="/warehouse-receipts" element={<RoleGuard section="management"><WarehouseReceiptsPage /></RoleGuard>} />
            <Route path="/asset-schedules" element={<RoleGuard section="management"><AssetSchedulesPage /></RoleGuard>} />
            <Route path="/partners" element={<RoleGuard section="management"><PartnersPage /></RoleGuard>} />
            <Route path="/partners/:id" element={<RoleGuard section="management"><PartnerDetailPage /></RoleGuard>} />
            <Route path="/financial-institutions" element={<RoleGuard section="management"><FinancialInstitutionsPage /></RoleGuard>} />
            <Route path="/invoices" element={<RoleGuard section="checker"><InvoicesPage /></RoleGuard>} />
            <Route path="/invoices/:id" element={<RoleGuard section="checker"><InvoiceDetailPage /></RoleGuard>} />
            <Route path="/transactions" element={<RoleGuard section="finance"><TransactionsPage /></RoleGuard>} />
            <Route path="/credit-scores" element={<RoleGuard section="risk"><CreditScoresPage /></RoleGuard>} />
            <Route path="/risk-alerts" element={<RoleGuard section="risk"><RiskAlertsPage /></RoleGuard>} />
            <Route path="/ai-assistant" element={<RoleGuard section="risk"><AiAssistantPage /></RoleGuard>} />
            <Route path="/compliance" element={<RoleGuard section="risk"><CompliancePage /></RoleGuard>} />
            <Route path="/overdue-loans" element={<RoleGuard section="risk"><OverdueLoansPage /></RoleGuard>} />
            <Route path="/loans/:id" element={<LoanDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/operations-guide" element={<OperationsGuidePage />} />
            <Route path="/data-export" element={<DataExportPage />} />
            <Route path="/reconciliation" element={<RoleGuard section="finance"><ReconciliationPage /></RoleGuard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      loginWithRedirect();
    }
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md animate-pulse">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary-foreground">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/>
              <path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/>
              <path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/>
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Signing in…</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <RoleProvider>
        <AppContent />
      </RoleProvider>
    </BrowserRouter>
  );
}

