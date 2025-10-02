import NavLinks from '@/app/ui/dashboard/nav-links';

export default function SideNav() {
  return (
    <aside className="flex h-full flex-col gap-4 bg-white px-3 py-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">EchoLearn</p>
      </div>
      <nav className="flex flex-col gap-2">
        <NavLinks />
      </nav>
    </aside>
  );
}
