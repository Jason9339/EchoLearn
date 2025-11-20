'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, MusicalNoteIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import type { CreateCourseRequest, CreateCourseResponse } from '@/app/lib/definitions';

interface AudioInfo {
  audioUrl: string;
  fileName: string;
  fileSize: number;
}

export default function CreateCoursePage() {
  const router = useRouter();
  const params = useParams();
  const tempId = params.tempId as string;
  const audioRef = useRef<HTMLAudioElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxSentences: 10,
    introSkipSeconds: 0,
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(true);

  const maxSentencesOptions = [5, 10, 15, 20, 25, 30];

  // Fetch audio info when component mounts
  useEffect(() => {
    fetchAudioInfo();
  }, [tempId]);

  const fetchAudioInfo = async () => {
    try {
      setAudioLoading(true);
      const response = await fetch(`/api/courses/temp-upload/${tempId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAudioInfo({
            audioUrl: data.audioUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
          });
        } else {
          setError('無法獲取音檔資訊');
        }
      } else {
        setError('音檔不存在或已過期');
      }
    } catch (error) {
      console.error('Failed to fetch audio info:', error);
      setError('獲取音檔資訊時發生錯誤');
    } finally {
      setAudioLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !audioInfo) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMaxSentencesChange = (value: number) => {
    setFormData(prev => ({
      ...prev,
      maxSentences: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('請輸入課程名稱');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const requestData: CreateCourseRequest = {
        tempId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        maxSentences: formData.maxSentences,
        introSkipSeconds: formData.introSkipSeconds,
      };

      const response = await fetch('/api/courses/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result: CreateCourseResponse = await response.json();

      if (result.success && result.courseId) {
        // Navigate to processing page
        router.push(`/dashboard/course/processing/${result.courseId}`);
      } else {
        setError(result.error || '創建課程失敗，請重試。');
      }
    } catch (error) {
      console.error('Create course error:', error);
      setError('創建課程過程中發生錯誤，請重試。');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/course/upload"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          返回上傳頁面
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">設定課程</h1>
        <p className="mt-2 text-gray-600">
          設定您的課程資訊，系統將自動處理音檔並生成句子
        </p>
      </div>

      {/* Audio Preview */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">音檔預覽</h2>
        
        {audioLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">載入音檔資訊中...</span>
          </div>
        ) : audioInfo ? (
          <>
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg mb-4">
              <MusicalNoteIcon className="h-8 w-8 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{audioInfo.fileName}</p>
                <p className="text-sm text-gray-500">
                  大小: {formatFileSize(audioInfo.fileSize)} | ID: {tempId}
                </p>
              </div>
              <button
                onClick={handlePlayPause}
                disabled={!audioInfo.audioUrl}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <PauseIcon className="h-5 w-5" />
                ) : (
                  <PlayIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            
            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={audioInfo.audioUrl}
              onEnded={handleAudioEnded}
              onError={() => {
                setError('音檔播放失敗');
                setIsPlaying(false);
              }}
              preload="metadata"
            />
          </>
        ) : (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              {error || '無法載入音檔資訊'}
            </p>
          </div>
        )}
      </div>

      {/* Course Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">課程設定</h2>
        
        {/* Course Title */}
        <div className="mb-6">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            課程名稱 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="輸入課程名稱"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Course Description */}
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            課程描述
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="輸入課程描述（可選）"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Intro Skip Seconds */}
        <div className="mb-6">
          <label htmlFor="introSkipSeconds" className="block text-sm font-medium text-gray-700 mb-2">
            跳過前奏秒數
          </label>
          <input
            type="number"
            id="introSkipSeconds"
            name="introSkipSeconds"
            value={formData.introSkipSeconds}
            onChange={handleInputChange}
            min="0"
            max="60"
            step="1"
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-2 text-sm text-gray-500">
            如果音檔開頭有前奏或空白，請輸入需要跳過的秒數（0-60秒）
          </p>
        </div>

        {/* Max Sentences */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            最大句數
          </label>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {maxSentencesOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleMaxSentencesChange(option)}
                className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                  formData.maxSentences === option
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            系統將從您的音檔中最多生成 {formData.maxSentences} 個句子
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Processing Info */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">處理說明</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 音檔處理可能需要幾分鐘時間</li>
            <li>• 系統會自動識別語音並分割成句子</li>
            <li>• 處理完成後您可以開始練習</li>
            <li>• 您可以在處理過程中查看進度</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Link
            href="/dashboard/course/upload"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            返回
          </Link>
          
          <button
            type="submit"
            disabled={creating || !formData.title.trim()}
            className={`px-6 py-2 rounded-md font-medium ${
              !creating && formData.title.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {creating ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                創建中...
              </div>
            ) : (
              '創建課程'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
