'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { courses } from '@/app/lib/placeholder-data';
import CourseCard from '@/app/ui/dashboard/cards';
import type { UserCourse } from '@/app/lib/definitions';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

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
        return 'text-green-600 bg-green-100';
      case 'processing':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '處理中';
      case 'failed':
        return '處理失敗';
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
    <div className="space-y-8">
      {/* Built-in Courses */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">官方課程</h2>
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
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200"></div>

      {/* Custom Courses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">我的自訂課程</h2>
          <Link
            href="/dashboard/course/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            創建新課程
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">載入中...</p>
          </div>
        ) : customCourses.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-4">您還沒有創建任何自訂課程</p>
            <Link
              href="/dashboard/course/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              創建第一個課程
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {course.title}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(course.status)}`}
                  >
                    {getStatusText(course.status)}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {course.description || '無描述'}
                </p>
                
                <div className="text-xs text-gray-500 mb-4">
                  最大句數: {course.maxSentences} | 創建時間: {new Date(course.createdAt).toLocaleDateString()}
                </div>

                       <div className="flex space-x-2">
                         <div className="flex-1">
                           {course.status === 'completed' && (
                             <Link
                               href={`/dashboard/course/practice?courseId=${course.id}&custom=true`}
                               className="block w-full bg-blue-600 text-white text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                             >
                               開始練習
                             </Link>
                           )}

                           {course.status === 'processing' && (
                             <Link
                               href={`/dashboard/course/processing/${course.id}`}
                               className="block w-full bg-blue-100 text-blue-700 text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                             >
                               查看進度
                             </Link>
                           )}

                           {course.status === 'failed' && (
                             <button className="w-full bg-red-100 text-red-700 text-center py-2 px-4 rounded-md text-sm font-medium cursor-not-allowed">
                               處理失敗
                             </button>
                           )}
                         </div>

                         {/* Delete Button */}
                         <button
                           onClick={() => handleDeleteClick(course.id, course.title)}
                           disabled={deleting === course.id}
                           className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                           title="刪除課程"
                         >
                           {deleting === course.id ? (
                             <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                           ) : (
                             <TrashIcon className="h-5 w-5" />
                           )}
                         </button>
                       </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              確定要刪除課程嗎？
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              您即將刪除課程「<strong>{deleteConfirm.courseTitle}</strong>」。
              <br />
              <span className="text-red-600 font-medium">
                此操作將永久刪除課程內容、錄音資料和相關檔案，且無法復原。
              </span>
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting !== null}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {deleting === deleteConfirm.courseId ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    刪除中...
                  </>
                ) : (
                  '確定刪除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
