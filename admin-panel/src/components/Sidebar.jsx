import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Building2, ShieldCheck, Car, ClipboardList,
  MessageSquare, Bell, BarChart3, FileText, Activity, Database,
  Settings, UserCircle, LogOut, Menu, X, ChevronDown, Home,
  Cloud, Lock, Monitor,
} from 'lucide-react';

const adminNavItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  // { to: '/admin/home-management', icon: Home, label: 'Home Management' },
  { to: '/admin/rides', icon: Car, label: 'Ride Management' },
  { to: '/admin/requests', icon: ClipboardList, label: 'Ride Requests' },
  { to: '/admin/chats', icon: MessageSquare, label: 'Chat Moderation' },
  { to: '/admin/reports', icon: FileText, label: 'Reports' },
  { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
  // { to: '/admin/activity-logs', icon: Activity, label: 'Activity Logs' },
];

const superAdminNavItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/domains', icon: Building2, label: 'Domains' },
  { to: '/admin/admins', icon: ShieldCheck, label: 'Admins' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/home-management', icon: Home, label: 'Home Management' },
  { to: '/admin/rides', icon: Car, label: 'Ride Management' },
  { to: '/admin/requests', icon: ClipboardList, label: 'Ride Requests' },
  { to: '/admin/chats', icon: MessageSquare, label: 'Chat' },
  { to: '/admin/reports', icon: FileText, label: 'Reports' },
  { to: '/admin/notifications', icon: Bell, label: 'Announcements' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/storage', icon: Cloud, label: 'Storage' },
  { to: '/admin/security', icon: Lock, label: 'Security' },
  { to: '/admin/database', icon: Database, label: 'Database' },
  { to: '/admin/api-monitor', icon: Monitor, label: 'API Monitor' },
  { to: '/admin/activity-logs', icon: Activity, label: 'Activity Logs' },
  { to: '/admin/settings', icon: Settings, label: 'System Settings' },
];

export default function Sidebar() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const navItems = isSuperAdmin ? superAdminNavItems : adminNavItems;

  const handleLogout = async () => {
    await logout();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Car className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold">RideShare</h1>
            <p className="text-[10px] text-muted-foreground">Admin Panel</p>
          </div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive || location.pathname.startsWith(item.to + '/')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      <div className="border-t border-border p-3">
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium truncate">{admin?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {admin?.role === 'SUPER_ADMIN' ? 'Super Admin' : `Admin - ${admin?.domain || 'No Domain'}`}
              </p>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', profileOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded-lg glass shadow-xl"
              >
                <NavLink
                  to="/admin/profile"
                  onClick={() => { setProfileOpen(false); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <UserCircle className="w-4 h-4" />
                  Profile
                </NavLink>
                {/* <NavLink
                  to="/admin/settings"
                  onClick={() => { setProfileOpen(false); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </NavLink> */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-background border border-border shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 glass border-r border-border lg:hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 glass border-r border-border">
        {sidebarContent}
      </aside>
    </>
  );
}