import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminSidebar from '../../components/admin/AdminSidebar.jsx';
import { api } from '../../lib/api.js';
import useAuthStore from '../../store/authStore.js';
import { useAdminWebSocket, useWsStatus } from '../../lib/hooks/useWebSocket.js';
import { Bell, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { NumberBadge } from '../../components/ui/Badge.jsx';
import { cn } from '../../lib/utils.js';

export default function AdminLayout() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Real-time WebSocket — auto-invalidates queries on events
  useAdminWebSocket();
  const wsStatus = useWsStatus();

  // Check if setup is complete
  const { data: setupStatus } = useQuery({
    queryKey: ['admin', 'setup-status'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
    retry: false,
  });

  // Dashboard stats for sidebar badges
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => api.get('/admin/dashboard/stats').then((r) => r.data),
    refetchInterval: 60_000,
  });

  // Contact inquiries unread count
  const { data: inquiriesData } = useQuery({
    queryKey: ['admin', 'contact-inquiries'],
    queryFn: () => api.get('/admin/contact-inquiries').then((r) => r.data),
    refetchInterval: 120_000,
  });

  // Check if first-time setup needed
  useEffect(() => {
    if (setupStatus && !setupStatus.settings) {
      navigate('/admin/setup');
    }
  }, [setupStatus, navigate]);

  const badges = {
    pendingApps:        statsData?.stats?.pendingApplications || 0,
    openComplaints:     statsData?.stats?.openComplaints || 0,
    pendingSeatChanges: statsData?.stats?.pendingSeatChanges || 0,
    contactUnread:      inquiriesData?.unreadCount || 0,
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <AdminSidebar badges={badges} />

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ duration: 0.2 }}
              className="fixed left-0 top-0 bottom-0 w-60 z-50 md:hidden"
            >
              <AdminSidebar badges={badges} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            className="md:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {/* Platform announcements indicator */}
          <div className="text-sm text-gray-500 hidden sm:block">
            {user?.tenant?.hall_name}
          </div>

          {/* WS status dot */}
          <div
            title={wsStatus === 'open' ? 'Live updates active' : 'Connecting…'}
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              wsStatus === 'open' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            )}
          />

          {/* Notification bell placeholder */}
          <button className="relative text-gray-500 hover:text-gray-700 transition-colors">
            <Bell className="h-5 w-5" />
            {badges.pendingApps > 0 && (
              <NumberBadge count={badges.pendingApps} className="absolute -top-1.5 -right-1.5 h-4 w-4 text-[10px]" />
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
        <div className="grid grid-cols-5 h-14">
          {[
            { to: '/admin/dashboard', label: 'Home', icon: '⊞' },
            { to: '/admin/students', label: 'Students', icon: '👥' },
            { to: '/admin/seats', label: 'Seats', icon: '🪑' },
            { to: '/admin/fees', label: 'Fees', icon: '💳' },
            { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 text-xs font-medium',
                location.pathname.startsWith(item.to) ? 'text-primary-600' : 'text-gray-500'
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
