'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CloudArrowUpIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import type { UploadAudioResponse } from '@/app/lib/definitions';

export default function UploadAudioPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSizeBytes = 50 * 1024 * 1024; // 50MB
  const acceptedFormats = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mpeg', 'audio/x-wav'];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    setError(null);

    // Validate file type
    if (!acceptedFormats.includes(file.type)) {
      setError('不支援的音檔格式。請上傳 MP3、WAV 或 M4A 檔案。');
      return;
    }

    // Validate file size
    if (file.size > maxSizeBytes) {
      setError(`檔案大小超過限制。最大允許 ${Math.floor(maxSizeBytes / 1024 / 1024)}MB。`);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);

      const response = await fetch('/api/courses/upload-audio', {
        method: 'POST',
        body: formData,
      });

      const result: UploadAudioResponse = await response.json();

      if (result.success && result.tempId) {
        // Navigate to course creation page with tempId
        router.push(`/dashboard/course/create/${result.tempId}`);
      } else {
        setError(result.error || '上傳失敗，請重試。');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('上傳過程中發生錯誤，請重試。');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/course"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          返回課程頁面
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">上傳音檔</h1>
        <p className="mt-2 text-gray-600">
          上傳您的音檔來創建個人化的影子跟讀課程
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <CloudArrowUpIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              拖拽音檔到這裡
            </h3>
            <p className="text-gray-600 mb-4">或點擊選擇檔案</p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              選擇檔案
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a"
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            <div className="mt-4 text-sm text-gray-500">
              <p>支援格式：MP3, WAV, M4A</p>
              <p>最大大小：{Math.floor(maxSizeBytes / 1024 / 1024)}MB</p>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <MusicalNoteIcon className="h-10 w-10 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </h3>
                <div className="mt-1 text-sm text-gray-500 space-y-1">
                  <p>大小: {formatFileSize(selectedFile.size)}</p>
                  <p>類型: {selectedFile.type}</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">移除檔案</span>
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3">使用說明</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>• 上傳清晰的音檔以獲得最佳的句子分割效果</li>
          <li>• 建議音檔長度在 1-10 分鐘之間</li>
          <li>• 系統會自動識別語音並分割成句子</li>
          <li>• 您可以設定最多生成 30 個句子</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Link
          href="/dashboard/course"
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          取消
        </Link>
        
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className={`px-6 py-2 rounded-md font-medium ${
            selectedFile && !uploading
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {uploading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              上傳中...
            </div>
          ) : (
            '下一步'
          )}
        </button>
      </div>
    </div>
  );
}
