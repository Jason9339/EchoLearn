'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { courses } from '@/app/lib/placeholder-data';
import CourseCard from '@/app/ui/dashboard/cards';
import type { UserCourse } from '@/app/lib/definitions';
import { PlusIcon, TrashIcon, XMarkIcon, ExclamationTriangleIcon, ArrowPathIcon, FolderPlusIcon, ArrowRightIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function CourseListPage() {
  const { data: session } = useSession();
  const [customCourses, setCustomCourses] = useState<UserCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    courseId: string;
    courseTitle: string;
  }>({ isOpen: false, courseId: '', courseTitle: '' });
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchUserCourses();
    }
  }, [session]);

  const fetchUserCourses = async () => {
    try {
      const response = await fetch('/api/courses/user');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCustomCourses(data.courses.custom || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700';
      case 'processing':
        return 'inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700';
      case 'failed':
        return 'inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700';
      default:
        return 'inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '處理中';
      case 'failed':
        return '失敗';
      default:
        return '未知';
    }
  };

  const handleDeleteClick = (courseId: string, courseTitle: string) => {
    setDeleteConfirm({
      isOpen: true,
      courseId,
      courseTitle,
    });
  };

  const handleDeleteConfirm = async () => {
    const { courseId } = deleteConfirm;
    if (!courseId) return;

    try {
      setDeleting(courseId);
      
      const response = await fetch(`/api/courses/${courseId}/delete`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Remove the course from the local state
        setCustomCourses(prev => prev.filter(course => course.id !== courseId));
        
        // Show success message (you could add a toast notification here)
        console.log('Course deleted successfully:', result.message);
        
        // Close the confirmation dialog
        setDeleteConfirm({ isOpen: false, courseId: '', courseTitle: '' });
      } else {
        console.error('Failed to delete course:', result.error);
        alert(`刪除失敗：${result.error}`);
      }
    } catch (error) {
      console.error('Delete course error:', error);
      alert('刪除時發生網路錯誤，請稍後再試。');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, courseId: '', courseTitle: '' });
  };

  return (
    <div className="space-y-12">
      {/* Built-in Courses */}
      <section className="space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">官方課程</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              title={course.title}
              description={course.description}
              actionLabel={course.actionLabel}
              actionHref={course.practicePath}
              icon={course.id === 'business-english' ? 'briefcase' : 'book'}
            />
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px w-full bg-gray-100"></div>

      {/* Custom Courses */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">我的自訂課程</h2>
            <p className="text-sm text-gray-500">管理您上傳的教材與學習進度。</p>
          </div>
          <button
            disabled
            className="group inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
            title="功能暫時停用"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            創建新課程（暫時停用）
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
            <p className="mt-3 text-sm text-gray-500">正在同步資料...</p>
          </div>
        ) : customCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <FolderPlusIcon className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-gray-900">尚無自訂課程</h3>
            <p className="mt-1 text-sm text-gray-500">上傳您的第一個音頻或影片檔案開始學習。</p>
            <div className="mt-6">
              <button
                disabled
                className="inline-flex items-center rounded-lg bg-gray-400 px-4 py-2 text-sm font-medium text-white cursor-not-allowed opacity-60"
                title="功能暫時停用"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                創建第一個課程（暫時停用）
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {customCourses.map((course) => (
              <div
                key={course.id}
                className={`group relative flex items-center justify-between rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-sm ${
                  course.status === 'failed'
                    ? 'border-red-100 hover:border-red-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Left side - Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="space-y-1">
                    <h3 className="truncate text-base font-medium text-gray-900">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{course.maxSentences || 0} 句</span>
                      <span>•</span>
                      <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-gray-500">
                    {course.description || '無描述'}
                  </p>

                  <div className="mt-3">
                    <span className={getStatusColor(course.status)}>
                      {course.status === 'processing' && (
                        <ArrowPathIcon className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {getStatusText(course.status)}
                    </span>
                  </div>
                </div>

                {/* Right side - Action Icons */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {course.status === 'completed' && (
                    <Link
                      href={`/dashboard/course/practice?courseId=${course.id}&custom=true`}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gray-400 text-gray-700 transition-colors hover:border-gray-600 hover:bg-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      title="開始練習"
                    >
                      <ArrowRightIcon className="h-6 w-6" />
                    </Link>
                  )}

                  {course.status === 'processing' && (
                    <Link
                      href={`/dashboard/course/processing/${course.id}`}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gray-400 text-gray-700 transition-colors hover:border-gray-600 hover:bg-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      title="查看進度"
                    >
                      <ArrowRightIcon className="h-6 w-6" />
                    </Link>
                  )}

                  {course.status === 'failed' && (
                    <div
                      className="inline-flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gray-300 text-gray-400 cursor-not-allowed"
                      title="處理失敗"
                    >
                      <XCircleIcon className="h-6 w-6" />
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteClick(course.id, course.title)}
                    disabled={deleting === course.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-300 text-gray-400 transition-colors hover:border-red-500 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="刪除課程"
                  >
                    {deleting === course.id ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <TrashIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4 transition-opacity duration-200"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleDeleteCancel();
          }}
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl bg-white p-6 shadow-2xl ring-1 ring-gray-900/5 transform transition-all duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-50 text-red-600">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </div>
              <button
                onClick={handleDeleteCancel}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <h3 className="text-base font-semibold leading-6 text-gray-900">刪除課程</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                您確定要刪除 <span className="font-medium text-gray-900">{deleteConfirm.courseTitle}</span> 嗎？此操作無法復原。
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={deleting !== null}
                className="inline-flex justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting !== null}
                className="inline-flex justify-center items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting === deleteConfirm.courseId ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                    刪除中...
                  </>
                ) : (
                  '確認刪除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
