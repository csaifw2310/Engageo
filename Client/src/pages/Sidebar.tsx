import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  FileText,
  Megaphone,
  MessageSquare,
  BarChart3,
  CreditCard,
  Settings,
  MessageCircle,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '../store/AppStore';

const tenantLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/groups', icon: FolderOpen, label: 'Groups' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/plans', icon: FileText, label: 'Plans' },
  { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { to: '/admin/payments', icon: DollarSign, label: 'Payments' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
];

function NavLinks({ links, onClose }: { links: typeof tenantLinks; onClose?: () => void }) {
  return (
    <nav className="flex-1 py-2 px-2 overflow-y-auto">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/dashboard' || link.to === '/admin'}
          onClick={onClose}
          className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
        >
          <link.icon className="w-4 h-4" />
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const links = user?.role === 'admin' ? adminLinks : tenantLinks;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 border-r border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl z-50 hidden md:flex flex-col">
      <div className="h-13 flex items-center px-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-zinc-950" />
          </div>
          <span className="font-semibold text-sm">Engageo</span>
        </div>
      </div>

      <NavLinks links={links} />
    </aside>
  );
}

export function MobileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const links = user?.role === 'admin' ? adminLinks : tenantLinks;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden" onClick={onClose} />
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800 z-50 md:hidden flex flex-col">
        <div className="h-13 flex items-center px-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-zinc-950" />
            </div>
            <span className="font-semibold text-sm">Engageo</span>
          </div>
        </div>
        <NavLinks links={links} onClose={onClose} />
      </aside>
    </>
  );
}
