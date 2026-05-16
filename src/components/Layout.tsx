import { useState } from 'react';
import { ChefHat, Coffee, Croissant, UtensilsCrossed, CreditCard, BarChart3, Menu, X, BookOpen } from 'lucide-react';

export type Page = 'waiter' | 'cafe' | 'pentri' | 'restoran' | 'cashier' | 'reports' | 'menu-management';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

const navItems: { page: Page; label: string; icon: React.ReactNode; color: string }[] = [
  { page: 'waiter', label: 'Pelayan', icon: <UtensilsCrossed size={18} />, color: 'text-slate-600' },
  { page: 'cafe', label: 'Dapur Cafe', icon: <Coffee size={18} />, color: 'text-amber-600' },
  { page: 'pentri', label: 'Dapur Pentri', icon: <Croissant size={18} />, color: 'text-emerald-600' },
  { page: 'restoran', label: 'Dapur Restoran', icon: <ChefHat size={18} />, color: 'text-blue-600' },
  { page: 'cashier', label: 'Kasir', icon: <CreditCard size={18} />, color: 'text-rose-600' },
  { page: 'reports', label: 'Laporan', icon: <BarChart3 size={18} />, color: 'text-violet-600' },
  { page: 'menu-management', label: 'Kelola Menu', icon: <BookOpen size={18} />, color: 'text-teal-600' },
];

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:flex-shrink-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <ChefHat size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">RestoOrder</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => { onNavigate(item.page); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentPage === item.page
                  ? 'bg-orange-50 text-orange-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={currentPage === item.page ? 'text-orange-600' : item.color}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">Sistem Order Restoran v1.0</p>
        </div>
      </aside>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-gray-200 gap-3">
          <button onClick={() => setMobileOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
              <ChefHat size={15} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">RestoOrder</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
