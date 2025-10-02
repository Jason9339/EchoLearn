import CourseCard from '@/app/ui/dashboard/cards';

export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <CourseCard
        title="Shadowing 101"
        description="基礎影子跟讀課程，從簡單句子開始。"
        actionLabel="開始練習"
      />
      <CourseCard
        title="Daily Practice"
        description="每日口說練習，提升流利度。"
        actionLabel="開始練習"
      />
      <CourseCard
        title="Advanced Mimic"
        description="挑戰進階的長篇對話與演講。"
        actionLabel="開始挑戰"
      />
    </div>
  );
}
