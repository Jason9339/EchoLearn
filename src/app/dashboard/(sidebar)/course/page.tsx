import { courses } from '@/app/lib/placeholder-data';
import CourseCard from '@/app/ui/dashboard/cards';

export default function CourseListPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          title={course.title}
          description={course.description}
          actionLabel={course.actionLabel}
          actionHref={course.practicePath}
        />
      ))}
    </div>
  );
}
