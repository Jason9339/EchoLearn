'use client';

import { useState } from 'react';

export default function DebugStoragePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tempId, setTempId] = useState('');

  const checkDatabase = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/check-database');
      const data = await response.json();
      setResult({ type: 'database', ...data });
    } catch (error) {
      setResult({ type: 'database', error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const listAllUploads = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/list-storage');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const checkSpecificTempId = async () => {
    if (!tempId.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/courses/temp-upload/${tempId}`);
      const data = await response.json();
      setResult({ tempId, ...data });
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">系統調試工具</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={checkDatabase}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 mr-4"
        >
          {loading ? '載入中...' : '檢查資料庫'}
        </button>
        
        <button
          onClick={listAllUploads}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '載入中...' : '列出所有上傳檔案'}
        </button>

        <div className="flex space-x-2">
          <input
            type="text"
            value={tempId}
            onChange={(e) => setTempId(e.target.value)}
            placeholder="輸入 tempId 檢查特定檔案"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={checkSpecificTempId}
            disabled={loading || !tempId.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            檢查
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-gray-100 p-4 rounded-md">
          <h3 className="font-medium mb-2">結果：</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
