import { PlayIcon } from '@heroicons/react/24/outline';

export default function CourseCard({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel?: string;
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
      {actionLabel && (
        <button className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-700">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
