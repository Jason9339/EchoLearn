import Link from 'next/link';
import { PlayIcon } from '@heroicons/react/24/outline';

export default function CourseCard({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm border hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-center gap-2">
        <PlayIcon className="h-6 w-6 text-sky-600" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-gray-600">{description}</p>

      {/* Action */}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex w-full justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          {actionLabel}
        </Link>
      ) : (
        actionLabel && (
          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-600"
            disabled
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
