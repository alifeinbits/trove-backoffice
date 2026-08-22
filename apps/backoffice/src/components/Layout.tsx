import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutGrid, Layers, Users, Mail, FileText, CreditCard,
  Receipt, Scale, Clock, Settings, Shield, Building2,
  FileCheck, ScrollText, Bell, ClipboardCheck, CheckCircle2,
  Landmark, ChevronDown, Loader2, LogOut,
  BarChart3, AlertTriangle, Bot, BookOpen, Download,
  Warehouse, Car, Globe, Key, Activity,
} from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { useState, ReactNode } from 'react';
import { useCurrentRole } from './RoleContext';
import { useAuth, logout } from 'zitejs/auth';
import { Avatar, AvatarFallback } from '@project/components/ui/avatar';

type NavItem = { to: string; icon: React.ElementType; label: string };
type NavSection = {
  label: string;
  icon?: React.ElementType;
  items: NavItem[];
  collapsible?: boolean;
  access?: string;
};

const troveNavSections: NavSection[] = [
  {
    label: 'Dashboard',
    items: [
      { to: '/overview', icon: LayoutGrid, label: 'Overview' },
    ],
  },
  {
    label: 'Maker',
    icon: ClipboardCheck,
    collapsible: true,
    access: 'maker',
    items: [
      { to: '/entity-review', icon: Users, label: 'Entity Review' },
      { to: '/limits', icon: CreditCard, label: 'Limit Assessment' },
      { to: '/financing', icon: FileText, label: 'Financing Assessment' },
    ],
  },
  {
    label: 'Checker',
    icon: CheckCircle2,
    collapsible: true,
    access: 'checker',
    items: [
      { to: '/checker/entities', icon: Shield, label: 'Entity Verification' },
      { to: '/checker/limits', icon: CreditCard, label: 'Limit Approval' },
      { to: '/checker/financing', icon: FileText, label: 'Financing Approval' },
      { to: '/invoices', icon: FileCheck, label: 'Invoice Verification' },
    ],
  },
  {
    label: 'FI Operations',
    icon: Landmark,
    collapsible: true,
    access: 'fi',
    items: [
      { to: '/fi/entity-screening', icon: Shield, label: 'Entity Screening' },
      { to: '/fi/limits', icon: CreditCard, label: 'Limit Approval' },
      { to: '/fi/financing', icon: FileText, label: 'Financing Approval' },
      { to: '/fi/loans', icon: Landmark, label: 'Loan Book' },
      { to: '/fi/ledger', icon: BookOpen, label: 'Ledger & Accounting' },
      { to: '/fi/reminders', icon: Bell, label: 'Reminders' },
    ],
  },
  {
    label: 'Management',
    access: 'management',
    items: [
      { to: '/programs', icon: Layers, label: 'Programs' },
      { to: '/financial-institutions', icon: Building2, label: 'Financial Institutions' },
      { to: '/invite-entities', icon: Mail, label: 'Invitations' },
      { to: '/onboardings', icon: Shield, label: 'Onboardings' },
      { to: '/offer-letters', icon: ScrollText, label: 'Offer Letters' },
      { to: '/warehouse-receipts', icon: Warehouse, label: 'Warehouse Receipts' },
      { to: '/asset-schedules', icon: Car, label: 'Asset Schedules' },
      { to: '/partners', icon: Globe, label: 'API Partners' },
    ],
  },
  {
    label: 'Finance',
    access: 'finance',
    items: [
      { to: '/transactions', icon: Receipt, label: 'Transactions' },
    ],
  },
  {
    label: 'Risk',
    access: 'risk',
    items: [
      { to: '/credit-scores', icon: BarChart3, label: 'Credit Scores' },
      { to: '/risk-alerts', icon: AlertTriangle, label: 'Risk Alerts' },
      { to: '/compliance', icon: Scale, label: 'Compliance' },
      { to: '/overdue-loans', icon: Clock, label: 'Overdue Loans' },
      { to: '/ai-assistant', icon: Bot, label: 'AI Assistant' },
    ],
  },
];

const partnerNavSections: NavSection[] = [
  {
    label: 'Dashboard',
    items: [
      { to: '/partner/dashboard', icon: LayoutGrid, label: 'Overview' },
    ],
  },
  {
    label: 'My Data',
    access: 'partner',
    items: [
      { to: '/partner/entities', icon: Users, label: 'My Entities' },
      { to: '/partner/programs', icon: Layers, label: 'My Programs' },
      { to: '/partner/invoices', icon: FileCheck, label: 'My Invoices' },
      { to: '/partner/financing', icon: FileText, label: 'Financing Requests' },
      { to: '/partner/loans', icon: Landmark, label: 'Loans' },
      { to: '/partner/transactions', icon: Receipt, label: 'Transactions' },
    ],
  },
  {
    label: 'Developer',
    access: 'partner',
    items: [
      { to: '/partner/api-keys', icon: Key, label: 'API Keys' },
      { to: '/partner/activity', icon: Activity, label: 'API Activity' },
    ],
  },
];

function CollapsibleSection({ section }: { section: NavSection }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          {section.icon && <section.icon className="w-3 h-3" />}
          {section.label}
        </div>
        <ChevronDown className={cn('w-3 h-3 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && section.items.map((item) => <SidebarLink key={item.to} item={item} />)}
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all mx-1',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )
      }
    >
      <item.icon className="w-4 h-4" />
      {item.label}
    </NavLink>
  );
}

type AccessSection = 'maker' | 'checker' | 'fi' | 'management' | 'finance' | 'risk' | 'partner';

export function RoleGuard({ section, children }: { section: AccessSection; children: ReactNode }) {
  const { canAccess, loading } = useCurrentRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccess(section)) {
    return <Navigate to="/overview" replace />;
  }

  return <>{children}</>;
}

export default function Layout() {
  const { canAccess, loading, role, isPartner, partnerName } = useCurrentRole();
  const { user } = useAuth();

  const navSections = isPartner ? partnerNavSections : troveNavSections;

  const visibleSections = navSections.filter((s) => {
    if (!s.access) return true;
    if (loading) return true;
    return canAccess(s.access as AccessSection);
  });

  const initials = user ? (user.name || user.email).slice(0, 2).toUpperCase() : '??';

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-[236px] border-r border-sidebar-border bg-sidebar-background flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-sidebar-primary-foreground">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/>
              <path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/>
              <path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/>
            </svg>
          </div>
          <div>
            {isPartner ? (
              <>
                <span className="font-extrabold text-sm text-sidebar-primary-foreground tracking-tight truncate max-w-[140px] block">
                  {partnerName || 'Partner'}
                </span>
                <span className="text-[10px] text-sidebar-foreground/40 font-medium uppercase tracking-widest">portal</span>
              </>
            ) : (
              <>
                <span className="font-extrabold text-sm text-sidebar-primary-foreground tracking-tight">trove</span>
                <span className="text-[10px] text-sidebar-foreground/40 ml-1 font-medium uppercase tracking-widest">ops</span>
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {visibleSections.map((section) =>
            section.collapsible ? (
              <CollapsibleSection key={section.label} section={section} />
            ) : (
              <div key={section.label} className="mb-0.5">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.label}
                </p>
                {section.items.map((item) => <SidebarLink key={item.to} item={item} />)}
              </div>
            )
          )}
        </nav>

        {/* Bottom — notifications, settings, user */}
        <div className="border-t border-sidebar-border p-2 space-y-0.5">
          {!isPartner && (
            <>
              <SidebarLink item={{ to: '/notifications', icon: Bell, label: 'Notifications' }} />
              <SidebarLink item={{ to: '/operations-guide', icon: BookOpen, label: 'Operations Guide' }} />
              <SidebarLink item={{ to: '/data-export', icon: Download, label: 'Data Export' }} />
              <SidebarLink item={{ to: '/settings', icon: Settings, label: 'Settings' }} />
            </>
          )}

          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-lg bg-sidebar-accent/50">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{user.name || user.email}</p>
                {role && (
                  <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider font-medium">{role}</p>
                )}
              </div>
              <button
                onClick={() => logout()}
                className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
