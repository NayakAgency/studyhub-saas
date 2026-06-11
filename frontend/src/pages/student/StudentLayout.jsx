import { Outlet, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore.js';
import { api } from '../../lib/api.js';
import { NumberBadge } from '../../components/ui/Badge.jsx';
import { useStudentWebSocket } from '../../lib/hooks/useWebSocket.js';
import {
  LayoutDashboard, User, Armchair, BookOpen, CreditCard,
  MessageSquare, Bell, BadgeCheck, Library, LogOut, Menu, X, Lightbulb,
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

const buildNav = (slug) => [
  { path: `/${slug}/dashboard`,     label: 'Home',          icon: LayoutDashboard },
  { path: `/${slug}/profile`,       label: 'Profile',       icon: User },
  { path: `/${slug}/seat`,          label: 'My Seat',       icon: Armchair },
  { path: `/${slug}/membership`,    label: 'Membership',    icon: BookOpen },
  { path: `/${slug}/fees`,          label: 'Fees',          icon: CreditCard },
  { path: `/${slug}/complaints`,    label: 'Complaints',    icon: MessageSquare },
  { path: `/${slug}/suggestions`,   label: 'Suggestions',   icon: Lightbulb },
  { path: `/${slug}/notifications`, label: 'Notifications', icon: Bell, badge: true },
  { path: `/${slug}/id-card`,       label: 'ID Card',       icon: BadgeCheck },
  { path: `/${slug}/resources`,     label: 'Resources',     icon: Library },
];

export default function StudentLayout() {
  const { slug } = useParams();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['student', 'notifications', 'count'],
    queryFn: () => api.get('/student/notifications', { params: { limit: 1 } }).then((r) => r.data),
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const unread = notifData?.unreadCount || 0;
  const navItems = buildNav(slug);
  const mobileItems = navItems.slice(0, 5);

  // Real-time WebSocket — auto-invalidates queries on events
  useStudentWebSocket();

  const handleLogout = async () => {
    await logout();
    navigate(`/${slug}/login`);
  };

  const NavItem = ({ item, onClick }) => (
    <NavLink
      to={item.path}
      end={item.path.endsWith('dashboard')}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group',
        isActive
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      {({ isActive }) => (
        <>
          <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600')} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && unread > 0 && <NumberBadge count={unread} />}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen flex-shrink-0">
        <div className="h-14 border-b border-gray-100 flex items-center px-4">
          <p className="text-sm font-bold text-gray-900 font-display">Student Portal</p>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-700">
                {user?.fullName?.[0]?.toUpperCase() || 'S'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-400 truncate">Student</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed left-0 top-0 bottom-0 w-60 bg-white z-50 flex flex-col shadow-xl md:hidden"
            >
              <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4">
                <p className="text-sm font-bold text-gray-900 font-display">Menu</p>
                <button onClick={() => setMobileOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => (
                  <NavItem key={item.path} item={item} onClick={() => setMobileOpen(false)} />
                ))}
              </nav>
              <div className="border-t border-gray-100 p-3">
                <button onClick={handleLogout} className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <LogOut className="h-4 w-4" /><span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold text-gray-900 font-display">Student Portal</p>
          <div className="ml-auto relative">
            <NavLink to={`/${slug}/notifications`} className="text-gray-500 hover:text-gray-700">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
        <div className="grid grid-cols-5 h-14">
          {mobileItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path.endsWith('dashboard')}
              className={({ isActive }) => cn(
                'flex flex-col items-center justify-center gap-0.5 relative',
                isActive ? 'text-primary-600' : 'text-gray-400',
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge && unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                    {unread > 9 ? '9' : unread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
