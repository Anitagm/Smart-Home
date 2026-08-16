import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ToastProvider } from './hooks/useToast.jsx';
import { NotificationsProvider } from './hooks/useNotifications.jsx';
import AppLayout from './layout/AppLayout.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import RouteLoading from './components/RouteLoading.jsx';

// Route-level code splitting: each page ships in its own chunk instead of
// one large bundle, so the initial load only pays for the Dashboard.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const AutomationsPage = lazy(() => import('./pages/AutomationsPage.jsx'));
const EnergyPage = lazy(() => import('./pages/EnergyPage.jsx'));
const AIManagerPage = lazy(() => import('./pages/AIManagerPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <NotificationsProvider>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="map" element={<MapPage />} />
                <Route path="automations" element={<AutomationsPage />} />
                <Route path="energy" element={<EnergyPage />} />
                <Route path="ai-manager" element={<AIManagerPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </NotificationsProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
