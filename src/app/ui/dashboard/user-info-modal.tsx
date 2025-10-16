
"use client";

import { useState, useTransition } from "react";
import { updateUserInfo } from "@/app/lib/actions";

export default function UserInfoModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const studentId = formData.get("studentId") as string;
    const gender = formData.get("gender") as string;
    const age = parseInt(formData.get("age") as string);
    const consent = formData.get("consent") === "on";

    startTransition(async () => {
      const result = await updateUserInfo(studentId, gender, age, consent);
      if (result.message === "User information saved successfully") {
        setIsOpen(false);
        // Reload page to refresh user data
        window.location.reload();
      } else {
        setError(result.message || "提交失敗，請重試");
        console.error(result.message);
      }
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-bold">請填寫個人詳細資訊</h2>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">
              學號 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="studentId"
              name="studentId"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
              性別 <span className="text-red-500">*</span>
            </label>
            <select
              id="gender"
              name="gender"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">請選擇</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">其他</option>
              <option value="prefer_not_to_say">不願透露</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="age" className="block text-sm font-medium text-gray-700">
              年齡 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="age"
              name="age"
              min="1"
              max="120"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div className="mb-4 rounded-md bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-800">資料使用聲明</h3>
            <div className="mb-3 text-xs text-gray-600 space-y-1">
              <p>本網站收集您的個人資訊將用於以下目的：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>進行學校專題實驗與分析</li>
                <li>改善教學內容與學習體驗</li>
              </ul>
              <p className="mt-2">
                我們承諾保護您的隱私，所有資料將以匿名方式進行分析，不會對外公開您的個人身份資訊。
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex h-5 items-center">
                <input
                  id="consent"
                  name="consent"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="consent" className="font-medium text-gray-700">
                  我已閱讀並同意上述資料使用聲明 <span className="text-red-500">*</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isPending}
            >
              {isPending ? "提交中..." : "提交"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
