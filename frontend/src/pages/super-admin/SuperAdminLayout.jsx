import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore.js';
import useUIStore from '../../store/uiStore.js';
import { cn } from '../../lib/utils.js';
import { api } from '../../lib/api.js';
import { LayoutDashboard, Building2, CreditCard, BarChart3, HeadphonesIcon, Settings, LogOut, Shield, ChevronLeft, ChevronRight, PackageOpen, Inbox, Menu, X } from 'lucide-react';

export default function SuperAdminLayout() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleCollapsed } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch pending requests count for badge
  const { data: inquiriesData } = useQuery({
    queryKey: ['super-admin', 'inquiries', 'new'],
    queryFn: () => api.get('/super-admin/inquiries', { params: { status: 'new', limit: 1 } }).then(r => r.data),
    refetchInterval: 30_000,
  });
  const pendingCount = inquiriesData?.pagination?.total || 0;

  const NAV_ITEMS = [
    { to: '/super-admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/super-admin/tenants',   icon: Building2,       label: 'Study Halls' },
    { to: '/super-admin/requests',  icon: Inbox,           label: 'Requests', badge: pendingCount },
    { to: '/super-admin/billing',   icon: CreditCard,      label: 'Billing'     },
    { to: '/super-admin/analytics', icon: BarChart3,       label: 'Analytics'   },
    { to: '/super-admin/plans',     icon: PackageOpen,     label: 'SaaS Plans'  },
    { to: '/super-admin/support',   icon: HeadphonesIcon,  label: 'Support'     },
    { to: '/super-admin/settings',  icon: Settings,        label: 'Settings'    },
  ];

  const handleLogout = async () => { await logout(); navigate('/super-admin/login'); };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800 flex-shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <Shield className="h-4 w-4 text-white" />
        </div>
        {!sidebarCollapsed && <span className="text-sm font-bold text-white font-display">Super Admin</span>}
        <button onClick={toggleCollapsed} className="ml-auto text-gray-500 hover:text-gray-300 flex-shrink-0 hidden md:flex">
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button onClick={() => setMobileOpen(false)} className="ml-auto text-gray-500 hover:text-gray-300 flex-shrink-0 md:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group',
              isActive ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            )}>
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary-400' : 'text-gray-500 group-hover:text-gray-300')} />
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center gap-2 mb-2 px-2">
          <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{user?.fullName?.[0] || 'S'}</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-200 truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors">
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 220 }}
        transition={{ duration: 0.2 }}
        className="hidden md:flex flex-col h-screen bg-gray-900 border-r border-gray-800 flex-shrink-0 overflow-hidden"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed left-0 top-0 bottom-0 w-60 bg-gray-900 z-50 flex flex-col md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-gray-200">
            <Menu className="h-5 w-5" />
          </button>
          <div className="h-6 w-6 rounded bg-primary-600 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white font-display">Super Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
