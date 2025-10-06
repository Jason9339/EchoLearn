import NavLinks from '@/app/ui/dashboard/nav-links';
import { signOut } from '@/auth';
import { PowerIcon } from '@heroicons/react/24/outline';

export default function SideNav() {
  return (
    <aside className="flex h-full flex-col bg-white px-3 py-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
          EchoLearn
        </p>
      </div>
      <nav className="flex grow flex-col gap-2">
        <NavLinks />
        <form
          className="mt-auto"
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button className="flex h-[48px] w-full items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:justify-start md:p-2 md:px-3">
            <PowerIcon className="w-6" />
            <div className="hidden md:block">Sign Out</div>
          </button>
        </form>
      </nav>
    </aside>
  );
}
