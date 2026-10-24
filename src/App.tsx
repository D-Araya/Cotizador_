import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  Link,
} from 'react-router-dom';
import { User as UserType } from './modules/types.ts';
import { AppLayout } from './ui/layouts/AppLayout.tsx';
import { ProtectedRoute } from './ui/components/ProtectedRoute.tsx';
import {
  apiRequest,
  setAuthToken,
  setActiveApiUser,
  getActiveApiUser,
  getAuthToken,
  clearClientSession,
  api,
} from './ui/api.ts';
import { TableSkeleton } from './ui/components/Skeleton.tsx';
import { ThemeSelector } from './ui/theme.tsx';

// Lazy-loaded routes for code-splitting
const LoginPage = lazy(() =>
  import('./ui/pages/LoginPage.tsx').then((m) => ({ default: m.LoginPage }))
);
const DashboardPage = lazy(() =>
  import('./ui/pages/internal/DashboardPage.tsx').then((m) => ({ default: m.DashboardPage }))
);
const QuotationsPage = lazy(() =>
  import('./ui/pages/internal/QuotationsPage.tsx').then((m) => ({ default: m.QuotationsPage }))
);
const CustomersPage = lazy(() =>
  import('./ui/pages/internal/CustomersPage.tsx').then((m) => ({ default: m.CustomersPage }))
);
const CatalogPage = lazy(() =>
  import('./ui/pages/internal/CatalogPage.tsx').then((m) => ({ default: m.CatalogPage }))
);
const InvoicesPage = lazy(() =>
  import('./ui/pages/internal/InvoicesPage.tsx').then((m) => ({ default: m.InvoicesPage }))
);
const OperationsPage = lazy(() =>
  import('./ui/pages/internal/OperationsPage.tsx').then((m) => ({ default: m.OperationsPage }))
);
const TeamPage = lazy(() =>
  import('./ui/pages/internal/TeamPage.tsx').then((m) => ({ default: m.TeamPage }))
);
const AuditPage = lazy(() =>
  import('./ui/pages/internal/AuditPage.tsx').then((m) => ({ default: m.AuditPage }))
);
const CompanyPage = lazy(() =>
  import('./ui/pages/internal/CompanyPage.tsx').then((m) => ({ default: m.CompanyPage }))
);
const OutboxPage = lazy(() =>
  import('./ui/pages/internal/OutboxPage.tsx').then((m) => ({ default: m.OutboxPage }))
);
const ClientPortal = lazy(() =>
  import('./ui/components/ClientPortal.tsx').then((m) => ({ default: m.ClientPortal }))
);
const PublicQuotationView = lazy(() =>
  import('./ui/components/PublicQuotationView.tsx').then((m) => ({
    default: m.PublicQuotationView,
  }))
);

function PublicQuotationWrapper() {
  const { token } = useParams<{ token: string }>();
  return <PublicQuotationView token={token} />;
}

function SuspenseFallback() {
  return (
    <div className="p-6 space-y-4">
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}

function AppRoutes() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    return getActiveApiUser() as UserType | null;
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  const navigate = useNavigate();
  const location = useLocation();

  // On mount: check system status, magic link token, and verify cached session
  useEffect(() => {
    apiRequest<{ isDemoMode: boolean }>('/api/v1/system/status')
      .then((res) => {
        if (res.data?.isDemoMode !== undefined) {
          setIsDemoMode(res.data.isDemoMode);
        }
      })
      .catch(() => {});

    // Check magicToken in query params
    const urlParams = new URLSearchParams(window.location.search);
    const magicToken = urlParams.get('magicToken');
    if (magicToken) {
      handleMagicLogin(magicToken);
      return;
    }

    // Verify stored session with backend
    const token = getAuthToken();
    const cachedUser = getActiveApiUser();
    if (token && cachedUser) {
      if (cachedUser.role === 'CUSTOMER_CONTACT') {
        apiRequest<{ user: UserType }>('/api/v1/portal/me')
          .then((res) => {
            if (res.data?.user) {
              setCurrentUser(res.data.user);
              setActiveApiUser(res.data.user);
            } else if (res.status === 401 || res.status === 403) {
              clearClientSession();
              setCurrentUser(null);
            }
          })
          .catch(() => {});
      } else {
        apiRequest<{ user: UserType }>('/api/v1/auth/me')
          .then((res) => {
            if (res.data?.user) {
              setCurrentUser(res.data.user);
              setActiveApiUser(res.data.user);
            } else if (res.status === 401 || res.status === 403) {
              clearClientSession();
              setCurrentUser(null);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  async function handleLogin(email: string, password = 'admin123') {
    setLoginLoading(true);
    setLoginError(null);

    const res = await apiRequest<{ user: UserType; token: string; role: string; redirectTo: string }>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    setLoginLoading(false);
    if (res.error) {
      setLoginError(res.error.detail || 'Credenciales inválidas');
      return;
    }

    if (res.data?.user && res.data?.token) {
      setAuthToken(res.data.token);
      setActiveApiUser(res.data.user);
      setCurrentUser(res.data.user);

      const targetPath = (location.state as any)?.from?.pathname;
      if (targetPath) {
        navigate(targetPath, { replace: true });
      } else if (res.data.user.role === 'CUSTOMER_CONTACT') {
        navigate('/portal/dashboard', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }

  async function handleMagicLogin(token: string) {
    setLoginLoading(true);
    setLoginError(null);
    const res = await apiRequest<{ user: UserType; token: string; role: string }>(
      '/api/v1/auth/magic-login',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      }
    );
    setLoginLoading(false);
    if (res.data?.user && res.data?.token) {
      setAuthToken(res.data.token);
      setActiveApiUser(res.data.user);
      setCurrentUser(res.data.user);
      navigate('/portal/dashboard', { replace: true });
    } else {
      setLoginError(res.error?.detail || 'Enlace mágico no válido o expirado.');
    }
  }

  async function handleSwitchUser(email: string) {
    setLoginLoading(true);
    setLoginError(null);
    const res = await apiRequest<{ user: UserType; token: string; role: string; redirectTo: string }>(
      '/api/v1/auth/switch-user',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
    setLoginLoading(false);
    if (res.data?.user && res.data?.token) {
      setAuthToken(res.data.token);
      setActiveApiUser(res.data.user);
      setCurrentUser(res.data.user);
      if (res.data.user.role === 'CUSTOMER_CONTACT') {
        navigate('/portal/dashboard', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    } else {
      handleLogin(email, 'admin123');
    }
  }

  async function handleLogout() {
    try {
      await api.post('/api/v1/auth/logout', {});
    } catch {
      // Ignore network errors on logout
    }
    clearClientSession();
    setCurrentUser(null);
    navigate('/login', { replace: true });
  }

  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        {/* Public Quotation View */}
        <Route path="/q/:token" element={<PublicQuotationWrapper />} />

        {/* Login Page */}
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate
                to={currentUser.role === 'CUSTOMER_CONTACT' ? '/portal/dashboard' : '/app/dashboard'}
                replace
              />
            ) : (
              <LoginPage
                onLogin={handleLogin}
                onMagicLogin={handleMagicLogin}
                isDemoMode={isDemoMode}
                loginError={loginError}
                loading={loginLoading}
              />
            )
          }
        />

        {/* Customer Portal */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute user={currentUser} redirectTo="/login">
              <ClientPortal
                user={currentUser!}
                onLogout={handleLogout}
                onOpenPublicLink={(tok) => navigate(`/q/${tok}`)}
                onSwitchUser={handleSwitchUser}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portal/:tab"
          element={
            <ProtectedRoute user={currentUser} redirectTo="/login">
              <ClientPortal
                user={currentUser!}
                onLogout={handleLogout}
                onOpenPublicLink={(tok) => navigate(`/q/${tok}`)}
                onSwitchUser={handleSwitchUser}
              />
            </ProtectedRoute>
          }
        />

        {/* Internal Staff App */}
        <Route
          path="/app"
          element={
            <ProtectedRoute user={currentUser} redirectTo="/login">
              <AppLayout
                user={currentUser!}
                onLogout={handleLogout}
                onOpenPublicLink={(tok) => navigate(`/q/${tok}`)}
                onSwitchUser={handleSwitchUser}
                isDemoMode={isDemoMode}
              />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="quotations"
            element={
              <ProtectedRoute user={currentUser} permission="quotations:read_own">
                <QuotationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="customers"
            element={
              <ProtectedRoute user={currentUser} permission="customers:create">
                <CustomersPage />
              </ProtectedRoute>
            }
          />
          <Route path="catalog" element={<CatalogPage />} />
          <Route
            path="invoices"
            element={
              <ProtectedRoute user={currentUser} permission="invoices:read_own">
                <InvoicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations"
            element={
              <ProtectedRoute user={currentUser} permission="operations:read_own">
                <OperationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="team"
            element={
              <ProtectedRoute user={currentUser} permission="users:manage" redirectTo="/app/dashboard">
                <TeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="audit"
            element={
              <ProtectedRoute user={currentUser} permission="audit:read_own">
                <AuditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="company"
            element={
              <ProtectedRoute user={currentUser} permission="company:read">
                <CompanyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="outbox"
            element={
              <ProtectedRoute user={currentUser} permission="outbox:read_own">
                <OutboxPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Root Redirect */}
        <Route
          path="/"
          element={
            currentUser ? (
              currentUser.role === 'CUSTOMER_CONTACT' ? (
                <Navigate to="/portal/dashboard" replace />
              ) : (
                <Navigate to="/app/dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
