'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon, UserIcon, ChevronRightIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

interface User {
  id: string;
  name: string;
  email: string;
  recordingCount: number;
  ratedByMeCount: number;
}

export default function PeerReviewPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/peer-review/users', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        if (data.success) {
          setUsers(data.users);
          setFilteredUsers(data.users);
        } else {
          throw new Error(data.error || 'Failed to fetch users');
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        user =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-12">
      {/* Header */}
      <header className="rounded-xl bg-white p-6 shadow-sm">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 transition hover:text-[#476EAE]"
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          返回主頁
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">團體評分</h1>
        <p className="mt-2 text-sm text-gray-600">
          選擇一位使用者來評分他們的錄音作品
        </p>
      </header>

      {/* Search Bar */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋使用者姓名或電子郵件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-[#476EAE] focus:outline-none focus:ring-2 focus:ring-[#476EAE]/20"
          />
        </div>
      </div>

      {/* User List */}
      <div className="rounded-xl bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#476EAE]"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            <p>錯誤：{error}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <UserIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2">沒有找到使用者</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredUsers.map((user) => {
              const progressPercentage = user.recordingCount > 0
                ? Math.round((user.ratedByMeCount / user.recordingCount) * 100)
                : 0;

              return (
                <li key={user.id}>
                  <Link
                    href={`/dashboard/peer-review/${user.id}`}
                    className="flex items-center justify-between p-4 transition hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#476EAE]/10 text-[#476EAE]">
                        <UserIcon className="h-6 w-6" />
                      </div>

                      {/* User Info */}
                      <div>
                        <h3 className="font-medium text-gray-900">{user.name}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Statistics */}
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          已評分 <span className="font-semibold text-[#476EAE]">{user.ratedByMeCount}</span> / {user.recordingCount}
                        </p>
                        {user.recordingCount > 0 && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-[#476EAE]"
                                style={{ width: `${progressPercentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{progressPercentage}%</span>
                          </div>
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

      {/* Stats Summary */}
      {!isLoading && !error && filteredUsers.length > 0 && (
        <div className="rounded-xl bg-[#476EAE]/5 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#476EAE]">{filteredUsers.length}</p>
              <p className="text-sm text-gray-600">位使用者</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#476EAE]">
                {filteredUsers.reduce((sum, user) => sum + user.recordingCount, 0)}
              </p>
              <p className="text-sm text-gray-600">總錄音數</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#476EAE]">
                {filteredUsers.reduce((sum, user) => sum + user.ratedByMeCount, 0)}
              </p>
              <p className="text-sm text-gray-600">你已評分</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
