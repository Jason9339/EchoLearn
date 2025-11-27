import Link from 'next/link';
import { BookOpenIcon, BriefcaseIcon, ArrowRightIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function CourseCard({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: string;
}) {
  const IconComponent = icon === 'briefcase' ? BriefcaseIcon : BookOpenIcon;

  return (
    <div className="group relative flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:border-gray-300 hover:shadow-sm">
      {/* Left side - Content */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Icon */}
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-gray-900">
          <IconComponent className="h-5 w-5" />
        </div>

        {/* Title */}
        <h3 className="text-base font-medium text-gray-900">{title}</h3>

        {/* Description */}
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{description}</p>
      </div>

      {/* Right side - Action Icon */}
      <div className="flex-shrink-0">
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gray-400 text-gray-700 transition-colors hover:border-gray-600 hover:bg-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            title={actionLabel}
          >
            <ArrowRightIcon className="h-6 w-6" />
          </Link>
        ) : (
          actionLabel && (
            <div
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gray-300 text-gray-400 cursor-not-allowed"
              title={actionLabel}
            >
              <LockClosedIcon className="h-6 w-6" />
            </div>
          )
        )}
      </div>
    </div>
  );
}
