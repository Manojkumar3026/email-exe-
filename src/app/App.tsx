import AppShell from './layouts/AppShell';
import Toaster from '../components/ui/Toaster';
import { useRoute } from './router';
import DashboardPage from './pages/DashboardPage';
import SendersPage from './pages/SendersPage';
import NewslettersPage from './pages/NewslettersPage';
import StorageAnalyzerPage from './pages/StorageAnalyzerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [route, navigate] = useRoute();

  return (
    <AppShell route={route} onNavigate={navigate}>
      {route === 'dashboard' && <DashboardPage />}
      {route === 'senders' && <SendersPage />}
      {route === 'newsletters' && <NewslettersPage />}
      {route === 'storage' && <StorageAnalyzerPage />}
      {route === 'analytics' && <AnalyticsPage />}
      {route === 'accounts' && <AccountsPage />}
      {route === 'settings' && <SettingsPage />}
      <Toaster />
    </AppShell>
  );
}
