import type { ReactNode } from 'react';
import SideNav from '@/app/ui/dashboard/sidenav';

export default function DashboardWithNavLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none border-b border-slate-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <SideNav />
      </div>
      <main className="flex-grow p-6 md:overflow-y-auto md:p-12">{children}</main>
    </div>
  );
}
