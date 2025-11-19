'use client';

import { useState } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface TutorialStep {
  image: string;
  description: string;
}

interface LoginTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginTutorialModal({ isOpen, onClose }: LoginTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // 教學步驟配置
  const tutorialSteps: TutorialStep[] = [
    {
      image: '/login-tutorial-images/login-tutorial-step1.png',
      description: '步驟 1：若尚未擁有帳號，請先創建'
    },
    {
      image: '/login-tutorial-images/login-tutorial-step2.png',
      description: '步驟 2：輸入您的電子郵件地址'
    },
    {
      image: '/login-tutorial-images/login-tutorial-step3.png',
      description: '步驟 3：輸入您的密碼'
    },
    {
      image: '/login-tutorial-images/login-tutorial-step4.png',
      description: '步驟 4：點擊"Log in"按鈕完成登入'
    }
  ];

  const handlePrevious = () => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : tutorialSteps.length - 1));
  };

  const handleNext = () => {
    setCurrentStep((prev) => (prev < tutorialSteps.length - 1 ? prev + 1 : 0));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="關閉教學"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        {/* 標題 */}
        <h2 className="mb-6 text-2xl font-bold text-gray-900">登入教學</h2>

        {/* 圖片顯示區域 */}
        <div className="mb-4 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
          <img
            src={tutorialSteps[currentStep].image}
            alt={`教學步驟 ${currentStep + 1}`}
            className="max-w-full max-h-96 object-contain"
            onError={(e) => {
              // 圖片載入失敗時顯示佔位符
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="%239ca3af"%3E請放置圖片於 /public/images/%3C/text%3E%3C/svg%3E';
            }}
          />
        </div>

        {/* 說明文字 */}
        <p className="mb-6 text-center text-lg text-gray-700">
          {tutorialSteps[currentStep].description}
        </p>

        {/* 導航按鈕和步驟指示器 */}
        <div className="flex items-center justify-between">
          {/* 上一步按鈕 */}
          <button
            onClick={handlePrevious}
            className="flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5" />
            上一步
          </button>

          {/* 步驟指示器 */}
          <div className="flex gap-2">
            {tutorialSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-blue-600 w-8'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`前往步驟 ${index + 1}`}
              />
            ))}
          </div>

          {/* 下一步按鈕 */}
          <button
            onClick={handleNext}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            下一步
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 步驟計數 */}
        <p className="mt-4 text-center text-sm text-gray-500">
          {currentStep + 1} / {tutorialSteps.length}
        </p>
      </div>
    </div>
  );
}
