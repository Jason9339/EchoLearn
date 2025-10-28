'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { CourseStatusResponse } from '@/app/lib/definitions';

export default function ProcessingPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [status, setStatus] = useState<'processing' | 'completed' | 'failed' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sentenceCount, setSentenceCount] = useState(0);

  useEffect(() => {
    if (!courseId) return;

    // Poll for status updates
    const pollInterval = setInterval(checkStatus, 2000); // Check every 2 seconds
    
    // Initial check
    checkStatus();

    return () => clearInterval(pollInterval);
  }, [courseId]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/status`);
      const result: CourseStatusResponse = await response.json();

      if (result.success) {
        setStatus(result.status || 'processing');
        setProgress(result.progress || 0);
        setError(result.errorMessage || null);
        setSentenceCount(result.sentences?.length || 0);

        // If completed, redirect to course page after a short delay
        if (result.status === 'completed') {
          setTimeout(() => {
            router.push('/dashboard/course');
          }, 3000);
        }
      } else {
        setError(result.error || 'Failed to fetch status');
      }
    } catch (error) {
      console.error('Status check error:', error);
      setError('無法獲取處理狀態');
    }
  };

  const handleCancel = async () => {
    // TODO: Implement cancel processing
    router.push('/dashboard/course');
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-16 w-16 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-16 w-16 text-red-500" />;
      default:
        return (
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">{progress}%</span>
            </div>
          </div>
        );
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return '處理完成！';
      case 'failed':
        return '處理失敗';
      default:
        return '正在處理您的課程...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'completed':
        return `已成功生成 ${sentenceCount} 個句子，即將跳轉到課程頁面`;
      case 'failed':
        return error || '處理過程中發生錯誤，請重試';
      default:
        if (progress < 30) {
          return '正在分析音檔...';
        } else if (progress < 60) {
          return '正在識別語音內容...';
        } else if (progress < 90) {
          return '正在生成句子...';
        } else {
          return '即將完成...';
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {getStatusText()}
        </h1>
        <p className="text-gray-600">
          課程 ID: {courseId}
        </p>
      </div>

      {/* Status Display */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-6">
        <div className="text-center">
          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>

          {/* Progress Bar (only show when processing) */}
          {status === 'processing' && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-gray-600">{progress}% 完成</p>
            </div>
          )}

          {/* Status Description */}
          <div className="mb-6">
            <p className="text-lg text-gray-900 mb-2">
              {getStatusDescription()}
            </p>
            
            {status === 'processing' && sentenceCount > 0 && (
              <p className="text-sm text-gray-600">
                已生成 {sentenceCount} 個句子
              </p>
            )}
          </div>

          {/* Error Message */}
          {status === 'failed' && error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {status === 'completed' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center justify-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <p className="text-sm text-green-600">
                  課程創建成功！3 秒後自動跳轉...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Processing Steps */}
      {status === 'processing' && (
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-blue-900 mb-4">處理步驟</h3>
          <div className="space-y-3">
            <div className={`flex items-center ${progress >= 10 ? 'text-blue-700' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full mr-3 ${progress >= 10 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <span className="text-sm">上傳音檔</span>
            </div>
            <div className={`flex items-center ${progress >= 30 ? 'text-blue-700' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full mr-3 ${progress >= 30 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <span className="text-sm">分析音檔內容</span>
            </div>
            <div className={`flex items-center ${progress >= 60 ? 'text-blue-700' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full mr-3 ${progress >= 60 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <span className="text-sm">識別語音並分割句子</span>
            </div>
            <div className={`flex items-center ${progress >= 90 ? 'text-blue-700' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full mr-3 ${progress >= 90 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <span className="text-sm">生成課程內容</span>
            </div>
            <div className={`flex items-center ${progress >= 100 ? 'text-blue-700' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 rounded-full mr-3 ${progress >= 100 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <span className="text-sm">完成</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        {status === 'processing' && (
          <button
            onClick={handleCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            取消處理
          </button>
        )}
        
        {status === 'failed' && (
          <>
            <Link
              href="/dashboard/course"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              返回課程頁面
            </Link>
            <Link
              href="/dashboard/course/upload"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              重新上傳
            </Link>
          </>
        )}
        
        {status === 'completed' && (
          <Link
            href="/dashboard/course"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            查看課程
          </Link>
        )}
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">💡 小提示</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 處理時間取決於音檔長度和複雜度</li>
          <li>• 您可以關閉此頁面，稍後在課程頁面查看結果</li>
          <li>• 處理完成後會自動跳轉到課程頁面</li>
        </ul>
      </div>
    </div>
  );
}
