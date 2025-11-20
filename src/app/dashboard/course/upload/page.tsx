'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CloudArrowUpIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import type { UploadAudioResponse } from '@/app/lib/definitions';

export default function UploadAudioPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioWasTrimmed, setAudioWasTrimmed] = useState(false);
  const [openAIConfigured, setOpenAIConfigured] = useState<boolean | null>(null);

  const maxSizeBytes = 100 * 1024 * 1024; // 100MB
  const maxDurationSeconds = 10 * 60; // 10 minutes
  const acceptedFormats = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mpeg', 'audio/x-wav'];

  // Check OpenAI configuration on mount
  useEffect(() => {
    fetch('/api/system/openai-status')
      .then(res => res.json())
      .then(data => setOpenAIConfigured(data.configured))
      .catch(err => {
        console.error('Failed to check OpenAI status:', err);
        setOpenAIConfigured(null);
      });
  }, []);

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

  const handleFileSelect = async (file: File) => {
    setError(null);
    setAudioWasTrimmed(false);
    setAudioDuration(null);

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

    // Process audio file - check duration and trim if necessary
    setProcessingAudio(true);
    try {
      const processedFile = await processAudioFile(file);
      setSelectedFile(processedFile.file);
      setAudioDuration(processedFile.duration);
      setAudioWasTrimmed(processedFile.wasTrimmed);

      if (processedFile.wasTrimmed) {
        setError(null); // Clear any previous errors
      }
    } catch (err) {
      console.error('Error processing audio file:', err);
      setError('處理音檔時發生錯誤，請重試。');
    } finally {
      setProcessingAudio(false);
    }
  };

  const processAudioFile = async (file: File): Promise<{
    file: File;
    duration: number;
    wasTrimmed: boolean;
  }> => {
    return new Promise((resolve, reject) => {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', async () => {
        const duration = audio.duration;
        console.log('Audio duration:', duration, 'seconds');

        // If duration is within limit, return original file
        if (duration <= maxDurationSeconds) {
          URL.revokeObjectURL(audioUrl);
          resolve({
            file,
            duration,
            wasTrimmed: false,
          });
          return;
        }

        // Duration exceeds limit - need to trim
        try {
          const trimmedFile = await trimAudioFile(file, maxDurationSeconds);
          URL.revokeObjectURL(audioUrl);
          resolve({
            file: trimmedFile,
            duration: maxDurationSeconds,
            wasTrimmed: true,
          });
        } catch (error) {
          URL.revokeObjectURL(audioUrl);
          reject(error);
        }
      });

      audio.addEventListener('error', (e) => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error('無法載入音檔'));
      });
    });
  };

  const trimAudioFile = async (file: File, maxDuration: number): Promise<File> => {
    // Use Web Audio API to trim the audio
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const sampleRate = audioBuffer.sampleRate;
      const numberOfChannels = audioBuffer.numberOfChannels;
      const maxSamples = Math.floor(maxDuration * sampleRate);

      // Create a new buffer with trimmed length
      const trimmedBuffer = audioContext.createBuffer(
        numberOfChannels,
        maxSamples,
        sampleRate
      );

      // Copy audio data for each channel
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const trimmedData = trimmedBuffer.getChannelData(channel);
        for (let i = 0; i < maxSamples; i++) {
          trimmedData[i] = sourceData[i];
        }
      }

      // Convert AudioBuffer to WAV file
      const wavBlob = audioBufferToWav(trimmedBuffer);
      const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      return new File([wavBlob], `${originalName}_trimmed.wav`, { type: 'audio/wav' });
    } finally {
      audioContext.close();
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = interleave(buffer);
    const dataLength = data.length * bytesPerSample;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // Data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    floatTo16BitPCM(view, 44, data);

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const interleave = (buffer: AudioBuffer): Float32Array => {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels;
    const result = new Float32Array(length);

    let offset = 0;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        result[offset++] = buffer.getChannelData(channel)[i];
      }
    }

    return result;
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const floatTo16BitPCM = (view: DataView, offset: number, input: Float32Array) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
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

      {/* OpenAI Not Configured Warning */}
      {openAIConfigured === false && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800 mb-1">測試模式</h4>
              <p className="text-sm text-yellow-700">
                OpenAI API 未配置，將使用測試資料生成課程。若要使用真實的語音識別功能，請設定 OpenAI API 金鑰。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {processingAudio && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-sm text-blue-800">正在處理音檔...</p>
          </div>
        </div>
      )}

      {/* Trim Warning */}
      {audioWasTrimmed && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800 mb-1">音檔已自動裁切</h4>
              <p className="text-sm text-yellow-700">
                您上傳的音檔超過 10 分鐘，已自動裁切至前 10 分鐘。
                {audioDuration && ` 裁切後長度：${formatDuration(Math.floor(audioDuration))}`}
              </p>
            </div>
          </div>
        </div>
      )}

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
              <p>最長時間：10 分鐘（超過會自動裁切）</p>
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
                  {audioDuration && (
                    <p>長度: {formatDuration(Math.floor(audioDuration))}</p>
                  )}
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
          <li>• <strong>音檔長度限制為 10 分鐘</strong>，超過的部分會自動裁切</li>
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
          disabled={!selectedFile || uploading || processingAudio}
          className={`px-6 py-2 rounded-md font-medium ${
            selectedFile && !uploading && !processingAudio
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {uploading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              上傳中...
            </div>
          ) : processingAudio ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
              處理中...
            </div>
          ) : (
            '下一步'
          )}
        </button>
      </div>
    </div>
  );
}
