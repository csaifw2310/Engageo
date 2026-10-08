import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, MobileSidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';

export function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <TopNavigation onMenuClick={() => setMobileSidebarOpen(true)} />
      {/* pt-14 matches TopNavigation's h-14 exactly — header height and
          content top-padding must always stay in sync, otherwise page
          content gets clipped under the fixed header (this was the bug:
          h-13 / pt-13 aren't valid Tailwind classes, so both silently
          resolved to 0). */}
      <main className="pt-14 md:pl-56 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}