'use client';

import { useState } from 'react';

export default function TestAudioPreviewPage() {
  const [tempId, setTempId] = useState('');
  const [audioInfo, setAudioInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testFetch = async () => {
    if (!tempId.trim()) {
      setError('請輸入 tempId');
      return;
    }

    setLoading(true);
    setError(null);
    setAudioInfo(null);

    try {
      const response = await fetch(`/api/courses/temp-upload/${tempId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAudioInfo(data);
      } else {
        setError(data.error || '獲取失敗');
      }
    } catch (err) {
      setError('網路錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">音檔預覽測試</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          輸入 tempId:
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={tempId}
            onChange={(e) => setTempId(e.target.value)}
            placeholder="例如: abc123-def456-ghi789"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={testFetch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '測試中...' : '測試'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {audioInfo && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="font-medium text-green-800 mb-2">音檔資訊：</h3>
          <p><strong>檔名:</strong> {audioInfo.fileName}</p>
          <p><strong>大小:</strong> {audioInfo.fileSize} bytes</p>
          <p><strong>URL:</strong> <a href={audioInfo.audioUrl} target="_blank" className="text-blue-600 underline">{audioInfo.audioUrl}</a></p>
          
          <div className="mt-4">
            <audio controls src={audioInfo.audioUrl} className="w-full">
              您的瀏覽器不支援音檔播放
            </audio>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        <p><strong>使用說明:</strong></p>
        <ol className="list-decimal list-inside space-y-1">
          <li>先到 /dashboard/course/upload 上傳音檔</li>
          <li>上傳後會跳轉到 create 頁面，URL 中包含 tempId</li>
          <li>複製 tempId 到上面的輸入框測試</li>
        </ol>
      </div>
    </div>
  );
}
