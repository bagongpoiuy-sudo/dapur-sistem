import { useState } from 'react';
import Layout, { Page } from './components/Layout';
import WaiterPage from './pages/WaiterPage';
import KitchenPage from './pages/KitchenPage';
import CashierPage from './pages/CashierPage';
import ReportsPage from './pages/ReportsPage';
import MenuManagementPage from './pages/MenuManagementPage';

export default function App() {
  const [page, setPage] = useState<Page>('waiter');

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'waiter' && <WaiterPage />}
      {page === 'cafe' && <KitchenPage kitchen="cafe" />}
      {page === 'pentri' && <KitchenPage kitchen="pentri" />}
      {page === 'restoran' && <KitchenPage kitchen="restoran" />}
      {page === 'cashier' && <CashierPage />}
      {page === 'reports' && <ReportsPage />}
      {page === 'menu-management' && <MenuManagementPage />}
    </Layout>
  );
}
