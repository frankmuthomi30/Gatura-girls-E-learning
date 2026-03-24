'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  LogOut,
  Home,
  BookOpen,
  MessageCircle,
  FileText,
  Settings,
  Bell,
  Monitor,
  Users,
  Briefcase,
  Layers,
  Database
} from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { AnimatedPage } from '@/components/ui/animated-page';

const ThemeToggle = dynamic(
  () => import('@/components/ThemeToggle').then((module) => module.ThemeToggle),
  { ssr: false }
);

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const studentNav: NavItem[] = [
  { label: 'Home', href: '/student', icon: <Home className="h-5 w-5" /> },
  { label: 'Assignments', href: '/student/assignments', icon: <BookOpen className="h-5 w-5" /> },
  { label: 'Announcements', href: '/student/announcements', icon: <Bell className="h-5 w-5" /> },
  { label: 'Grade Chat', href: '/student/chat', icon: <MessageCircle className="h-5 w-5" /> },
  { label: 'Grades', href: '/student/grades', icon: <FileText className="h-5 w-5" /> },
  { label: 'Settings', href: '/student/settings', icon: <Settings className="h-5 w-5" /> },
];

const teacherNav: NavItem[] = [
  { label: 'Dashboard', href: '/teacher', icon: <Home className="h-5 w-5" /> },
  { label: 'Assignments', href: '/teacher/assignments', icon: <BookOpen className="h-5 w-5" /> },
  { label: 'Submissions', href: '/teacher/submissions', icon: <FileText className="h-5 w-5" /> },
  { label: 'Announcements', href: '/teacher/announcements', icon: <Bell className="h-5 w-5" /> },
  { label: 'Grade Chats', href: '/teacher/chat', icon: <MessageCircle className="h-5 w-5" /> },
  { label: 'Live Monitor', href: '/teacher/monitoring', icon: <Monitor className="h-5 w-5" /> },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <Home className="h-5 w-5" /> },
  { label: 'Students', href: '/admin/students', icon: <Users className="h-5 w-5" /> },
  { label: 'Teachers', href: '/admin/teachers', icon: <Briefcase className="h-5 w-5" /> },
  { label: 'Subjects', href: '/admin/subjects', icon: <Layers className="h-5 w-5" /> },
  { label: 'Reports', href: '/admin/reports', icon: <FileText className="h-5 w-5" /> },
  { label: 'Grade Chats', href: '/admin/chat', icon: <MessageCircle className="h-5 w-5" /> },
  { label: 'Cleanup', href: '/admin/cleanup', icon: <Database className="h-5 w-5" /> },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'student': return studentNav;
    case 'teacher': return teacherNav;
    case 'admin': return adminNav;
  }
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
};

const roleIcons: Record<UserRole, string> = {
  admin: '🛡️',
  teacher: '📚',
  student: '🎓',
};

export function AppShell({
  children,
  role,
  userName,
}: {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = getNavItems(role);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className={"theme-" + role + " min-h-screen relative overflow-x-hidden flex flex-col lg:flex-row"}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[var(--page-gradient)]" />

      {/* Mobile header */}
      <header
        className="lg:hidden mx-3 mt-3 rounded-2xl border border-border px-4 py-3 flex items-center justify-between sticky top-3 z-30 shadow-lg shadow-black/5 bg-background/80 backdrop-blur-xl"
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-full text-foreground hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{roleIcons[role]}</span>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Gatura Girls</p>
            <p className="font-semibold text-sm text-foreground">{roleLabels[role]} Hub</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-[100dvh] w-72 border-r z-50 flex flex-col bg-background/95 backdrop-blur-xl shrink-0 transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        {/* Mobile close button inside sidebar */}
        <button
          className="lg:hidden absolute top-4 right-4 p-2 rounded-full bg-background border hover:bg-muted text-foreground"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Sidebar header */}
        <div className="p-6 border-b border-border">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="rounded-3xl p-5 text-white relative overflow-hidden shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-dark)) 100%)',
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_50%)]" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white/20 text-2xl border border-white/20 backdrop-blur-md shadow-inner">
                {roleIcons[role]}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-semibold mb-1">{roleLabels[role]}</p>
                <p className="font-bold text-base truncate tracking-tight">{userName}</p>
                <p className="text-xs text-white/80 mt-0.5 truncate">GGS Learning Portal</p>
              </div>
            </div>
          </motion.div>

          <div
            className="mt-6 flex items-center justify-between rounded-xl border border-border px-4 py-3 bg-muted/30"
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Appearance</p>
              <p className="text-sm text-foreground font-medium mt-0.5">Switch theme</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <nav className="p-4 space-y-1 f-scrollbar flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
                (item.href !== `/${role}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="block relative"
              >
                <motion.div
                  whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all relative z-10 ${
                    isActive
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary rounded-xl shadow-md"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <span className={isActive ? "text-primary-foreground" : ""}>{item.icon}</span>
                  {item.label}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <motion.button
            whileHover={{ backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-muted-foreground w-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </motion.button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:pl-72 min-w-0 min-h-screen relative z-10 w-full">
        <AnimatedPage>
          <div className="p-4 lg:p-8 max-w-7xl mx-auto pt-8">
            {children}
          </div>
        </AnimatedPage>
      </main>
    </div>
  );
}
