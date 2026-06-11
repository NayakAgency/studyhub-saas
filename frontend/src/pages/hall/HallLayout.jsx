import { Outlet, NavLink, Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api.js';
import { GraduationCap, Menu, X, Phone, Mail, MapPin } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { cn } from '../../lib/utils.js';

const NAV_LINKS = [
  { to: '', label: 'Home', end: true },
  { to: 'about', label: 'About' },
  { to: 'facilities', label: 'Facilities' },
  { to: 'plans', label: 'Plans' },
  { to: 'seats', label: 'Seat Map' },
  { to: 'gallery', label: 'Gallery' },
  { to: 'contact', label: 'Contact' },
];

export default function HallLayout() {
  const { slug } = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: hall } = useQuery({
    queryKey: ['public', 'hall', slug],
    queryFn: () => api.get(`/public/${slug}`).then((r) => r.data),
    retry: false,
  });

  const tenant = hall?.tenant;
  const themeColor = tenant?.theme_color || '#2563EB';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link to={`/${slug}`} className="flex items-center gap-2.5 flex-shrink-0">
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt={tenant.hall_name} className="h-9 w-9 rounded-lg object-contain" />
              : <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: themeColor }}><GraduationCap className="h-5 w-5 text-white" /></div>
            }
            <span className="text-base font-bold text-gray-900 font-display hidden sm:block truncate max-w-[160px]">{tenant?.hall_name}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink key={to} to={`/${slug}/${to}`} end={end}
                className={({ isActive }) => cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}
                style={({ isActive }) => isActive ? { backgroundColor: themeColor } : {}}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <Link to={`/${slug}/login`} className="hidden sm:block">
              <Button variant="secondary" size="sm">Login</Button>
            </Link>
            <Link to={`/${slug}/register`}>
              <Button size="sm" style={{ backgroundColor: themeColor, borderColor: themeColor }}>Register</Button>
            </Link>
            <button className="md:hidden p-2 text-gray-500 hover:text-gray-700" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.2 }}
              className="fixed right-0 top-0 bottom-0 w-64 bg-white z-50 shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
                <span className="font-bold text-gray-900 font-display">{tenant?.hall_name}</span>
                <button onClick={() => setMobileOpen(false)}><X className="h-5 w-5 text-gray-500" /></button>
              </div>
              <nav className="flex-1 py-4 px-3 space-y-1">
                {NAV_LINKS.map(({ to, label, end }) => (
                  <NavLink key={to} to={`/${slug}/${to}`} end={end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => cn('block px-4 py-2.5 rounded-xl text-sm font-medium',
                      isActive ? 'text-white' : 'text-gray-700 hover:bg-gray-100')}
                    style={({ isActive }) => isActive ? { backgroundColor: themeColor } : {}}>
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="p-4 border-t border-gray-100 space-y-2">
                <Link to={`/${slug}/login`} onClick={() => setMobileOpen(false)}>
                  <Button variant="secondary" className="w-full">Student Login</Button>
                </Link>
                <Link to={`/${slug}/register`} onClick={() => setMobileOpen(false)}>
                  <Button className="w-full" style={{ backgroundColor: themeColor }}>Register Now</Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: themeColor }}>
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <p className="text-white font-bold font-display">{tenant?.hall_name}</p>
              </div>
              {tenant?.address && <p className="text-sm">{tenant.address}</p>}
            </div>
            <div>
              <p className="text-white text-sm font-semibold mb-3">Quick Links</p>
              <div className="space-y-1">
                {NAV_LINKS.map(({ to, label }) => (
                  <Link key={to} to={`/${slug}/${to}`} className="block text-sm hover:text-white transition-colors">{label}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-white text-sm font-semibold mb-3">Contact</p>
              <div className="space-y-2 text-sm">
                {tenant?.owner_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{tenant.owner_phone}</div>}
                {tenant?.owner_email && <div className="flex items-center gap-2"><Mail className="h-4 w-4" />{tenant.owner_email}</div>}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs">
            <p>Powered by <span className="text-white font-semibold">StudyHub</span> — Built by NayakWorks</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
