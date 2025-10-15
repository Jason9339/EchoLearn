
"use client";

import { useState, useTransition } from "react";
import { updateUserInfo } from "@/app/lib/actions";

export default function UserInfoModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const studentId = formData.get("studentId") as string;
    const consent = formData.get("consent") === "on";

    startTransition(async () => {
      const result = await updateUserInfo(studentId, consent);
      if (result.message === "User information saved successfully") {
        setIsOpen(false);
      } else {
        console.error(result.message);
      }
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">請填寫個人詳細資訊</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">
              學號
            </label>
            <input
              type="text"
              id="studentId"
              name="studentId"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
          <div className="mb-4 flex items-start">
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
                我同意收集和使用我的數據
              </label>
            </div>
          </div>
          <div className="mt-6">
            <button
              type="submit"
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              disabled={isPending}
            >
              {isPending ? "Submitting..." : "提交"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
