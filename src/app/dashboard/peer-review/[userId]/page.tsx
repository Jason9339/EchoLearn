'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronRightIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

interface Course {
  courseId: string;
  courseName: string;
  recordingCount: number;
  ratedByMeCount: number;
}

export default function UserCoursesPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/peer-review/${userId}/courses`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }

        const data = await response.json();
        if (data.success) {
          setUserName(data.userName);
          setUserEmail(data.userEmail);
          setCourses(data.courses);
        } else {
          throw new Error(data.error || 'Failed to fetch courses');
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
        setError(err instanceof Error ? err.message : 'Failed to load courses');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [userId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-12">
      {/* Header with Back Button */}
      <header className="rounded-xl bg-white p-6 shadow-sm">
        <Link
          href="/dashboard/peer-review"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 transition hover:text-[#476EAE]"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          返回使用者列表
        </Link>

        <div className="flex items-center gap-4">
          {/* User Avatar */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#476EAE]/10 text-[#476EAE]">
            <UserIcon className="h-8 w-8" />
          </div>

          {/* User Info */}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{userName}</h1>
            <p className="text-sm text-gray-600">{userEmail}</p>
            <p className="mt-1 text-sm text-gray-500">選擇課程開始評分</p>
          </div>
        </div>
      </header>

      {/* Course List */}
      <div className="rounded-xl bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#476EAE]"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            <p>錯誤：{error}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <BookOpenIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2">此使用者尚未完成任何錄音</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {courses.map((course) => {
              const progressPercentage = course.recordingCount > 0
                ? Math.round((course.ratedByMeCount / course.recordingCount) * 100)
                : 0;
              const isCompleted = course.ratedByMeCount === course.recordingCount && course.recordingCount > 0;

              return (
                <li key={course.courseId}>
                  <Link
                    href={`/dashboard/peer-review/${userId}/${course.courseId}`}
                    className="flex items-center justify-between p-4 transition hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      {/* Course Icon */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                        isCompleted
                          ? 'bg-[#A7E399]/20 text-[#41A67E]'
                          : 'bg-[#476EAE]/10 text-[#476EAE]'
                      }`}>
                        <BookOpenIcon className="h-6 w-6" />
                      </div>

                      {/* Course Info */}
                      <div>
                        <h3 className="font-medium text-gray-900">{course.courseName}</h3>
                        <p className="text-sm text-gray-500">
                          {course.recordingCount} 個錄音
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Progress */}
                      <div className="text-right">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#A7E399]/20 px-3 py-1 text-sm font-medium text-[#41A67E]">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            已完成
                          </span>
                        ) : (
                          <>
                            <p className="text-sm text-gray-600">
                              已評分 <span className="font-semibold text-[#476EAE]">{course.ratedByMeCount}</span> / {course.recordingCount}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-2 w-24 rounded-full bg-gray-200">
                                <div
                                  className="h-2 rounded-full bg-[#476EAE]"
                                  style={{ width: `${progressPercentage}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-500">{progressPercentage}%</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Arrow */}
                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Overall Progress */}
      {!isLoading && !error && courses.length > 0 && (
        <div className="rounded-xl bg-[#476EAE]/5 p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">整體進度</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#476EAE]">{courses.length}</p>
              <p className="text-sm text-gray-600">個課程</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#476EAE]">
                {courses.reduce((sum, course) => sum + course.recordingCount, 0)}
              </p>
              <p className="text-sm text-gray-600">總錄音數</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#476EAE]">
                {courses.reduce((sum, course) => sum + course.ratedByMeCount, 0)}
              </p>
              <p className="text-sm text-gray-600">你已評分</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
