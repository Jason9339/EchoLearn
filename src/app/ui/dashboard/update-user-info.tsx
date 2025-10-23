"use client";

import { useState } from 'react';
import { Button } from '@/app/ui/button';
import { updateUser } from '@/app/lib/actions';
import type { User } from '@/app/lib/definitions';

export default function UpdateUserInfo({ user }: { user: User }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name || '',
    student_id: user.student_id || '',
    gender: user.gender || 'prefer_not_to_say',
    age: user.age || 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await updateUser(user.id, formData);
      setIsEditing(false);
      // Re-render or show a success message
    } catch (error) {
      console.error('Failed to update user:', error);
      // Handle error state
    }
  };

  if (!isEditing) {
    return (
      <Button onClick={() => setIsEditing(true)} className="mt-6">
        編輯個人資料
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            姓名
          </label>
          <input
            type="text"
            name="name"
            id="name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="student_id" className="block text-sm font-medium text-gray-700">
            學號
          </label>
          <input
            type="text"
            name="student_id"
            id="student_id"
            value={formData.student_id}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
            性別
          </label>
          <select
            name="gender"
            id="gender"
            value={formData.gender}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">其他</option>
            <option value="prefer_not_to_say">不願透露</option>
          </select>
        </div>
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700">
            年齡
          </label>
          <input
            type="number"
            name="age"
            id="age"
            value={formData.age}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-x-4">
        <Button type="button" onClick={() => setIsEditing(false)} variant="ghost">
          取消
        </Button>
        <Button type="submit">
          儲存
        </Button>
      </div>
    </form>
  );
}
