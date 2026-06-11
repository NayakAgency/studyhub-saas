import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils.js';
import { NumberBadge } from '../ui/Badge.jsx';
import useAuthStore from '../../store/authStore.js';
import useUIStore from '../../store/uiStore.js';
import {
  LayoutDashboard, Users, Armchair, BookOpen, CreditCard, RefreshCw,
  CalendarCheck, MessageSquare, Megaphone, Library, Clock, BarChart3,
  Settings, LogOut, ChevronLeft, ChevronRight, GraduationCap,
  FileText, Inbox, Mail, TrendingUp, Banknote, GalleryHorizontal, Lightbulb,
  HelpCircle, ArrowLeftRight,
} from 'lucide-react';

const navItems = [
  { to: '/admin/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/students',          icon: Users,           label: 'Students' },
  { to: '/admin/applications',      icon: Inbox,           label: 'Applications',  badge: 'pendingApps' },
  { to: '/admin/seats',             icon: Armchair,        label: 'Seats' },
  { to: '/admin/plans',             icon: BookOpen,        label: 'Plans' },
  { to: '/admin/fees',              icon: CreditCard,      label: 'Fees' },
  { to: '/admin/payments',          icon: Banknote,        label: 'Payments' },
  { to: '/admin/renewals',          icon: RefreshCw,       label: 'Renewals' },
  { to: '/admin/bookings',          icon: CalendarCheck,   label: 'Bookings' },
  { to: '/admin/seat-changes',      icon: ArrowLeftRight,  label: 'Seat Changes',  badge: 'pendingSeatChanges' },
  { to: '/admin/complaints',        icon: MessageSquare,   label: 'Complaints',    badge: 'openComplaints' },
  { to: '/admin/suggestions',       icon: Lightbulb,       label: 'Suggestions' },
  { to: '/admin/announcements',     icon: Megaphone,       label: 'Announcements' },
  { to: '/admin/resources',         icon: Library,         label: 'Resources' },
  { to: '/admin/waiting-list',      icon: Clock,           label: 'Waiting List' },
  { to: '/admin/contact-inquiries', icon: Mail,            label: 'Inquiries',     badge: 'contactUnread' },
  { to: '/admin/gallery',          icon: GalleryHorizontal, label: 'Gallery' },
  { to: '/admin/faqs',              icon: HelpCircle,      label: 'FAQs' },
  { to: '/admin/analytics',         icon: TrendingUp,      label: 'Analytics' },
  { to: '/admin/reports',           icon: BarChart3,       label: 'Reports' },
  { to: '/admin/settings',          icon: Settings,        label: 'Settings' },
];

export default function AdminSidebar({ badges = {} }) {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleCollapsed } = useUIStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="hidden md:flex flex-col h-screen bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 flex-shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="h-4 w-4 text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-sm font-bold text-gray-900 font-display truncate"
            >
              {user?.tenant?.hall_name || 'StudyHub'}
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={toggleCollapsed}
          className="ml-auto text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group relative',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600')} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 truncate"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {badge && badges[badge] > 0 && (
                  <NumberBadge
                    count={badges[badge]}
                    className={sidebarCollapsed ? 'absolute -top-1 -right-1' : ''}
                  />
                )}
                {/* Tooltip when collapsed */}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md
                    opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary-700">
              {user?.fullName?.[0] || 'A'}
            </span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{user?.fullName}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{user?.adminRole || 'Admin'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-gray-600
            hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  );
}
