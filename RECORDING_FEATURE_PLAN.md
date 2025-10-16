# EchoLearn 錄音功能實現規劃

## 📋 專案概述

本文件詳細規劃了 EchoLearn 學習平台的錄音功能實現，包括前端組件、後端 API、資料庫設計和部署考量。

## 🎯 功能需求

### 核心功能
- ✅ 每個練習句子提供 **3 個錄音槽位**
- ✅ 每次錄音 **最多 10 秒**，自動停止
- ✅ 支援 **重複錄音** 覆蓋之前的錄音
- ✅ 錄音完成後可 **立即播放**
- ✅ 按鈕狀態視覺回饋（灰色禁用、紅色錄音中、綠色已錄音）

### 技術限制
- 🎤 使用瀏覽器原生 `MediaRecorder` API
- 📁 音頻格式：WebM（瀏覽器原生支援）
- 📊 檔案大小：約 100-500KB per 10秒錄音
- 🔒 需要麥克風權限授權

## 🏗️ 技術架構

### 前端技術棧
```typescript
// 現有技術棧
- React 19 + TypeScript
- Next.js 15 App Router
- Tailwind CSS 4
- Heroicons (圖標)
- NextAuth.js (認證)

// 新增音頻相關
- MediaRecorder API
- Audio API
- File API
```

### 後端技術棧
```typescript
// 現有技術棧
- Next.js API Routes
- PostgreSQL
- NextAuth.js

// 新增功能
- 檔案上傳處理
- 音頻檔案儲存
- 音頻串流播放
```

## 📊 資料庫設計

### recordings 表結構
```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  sentence_id INTEGER NOT NULL,
  slot_index INTEGER NOT NULL CHECK (slot_index IN (0, 1, 2)),
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL, -- 毫秒
  file_size INTEGER NOT NULL, -- 位元組
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 確保每個使用者每個句子的每個槽位只有一個錄音
  UNIQUE(user_id, sentence_id, slot_index)
);

-- 索引優化查詢性能
CREATE INDEX idx_recordings_user_sentence ON recordings(user_id, sentence_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at);
```

### 資料關聯
```typescript
// 與現有表的關聯
recordings.user_id → users.id
recordings.sentence_id → practice_sentences.id (假設的句子表)
```

## 🎨 前端組件設計

### 1. useAudioRecorder Hook
```typescript
// src/hooks/useAudioRecorder.ts
interface RecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  duration: number;
  audioUrl: string | null;
  isUploading: boolean;
  error: string | null;
}

interface UseAudioRecorderReturn {
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playRecording: () => void;
  uploadRecording: (sentenceId: number, slotIndex: number) => Promise<string>;
  clearRecording: () => void;
}
```

### 2. AudioPlayer 組件
```typescript
// src/components/AudioPlayer.tsx
interface AudioPlayerProps {
  audioUrl: string | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  className?: string;
}
```

### 3. RecordingButton 組件
```typescript
// src/components/RecordingButton.tsx
type ButtonState = 
  | 'idle'        // 灰色 - 未錄音
  | 'recording'   // 紅色 - 錄音中
  | 'recorded'   // 綠色 - 已錄音
  | 'uploading'   // 藍色 - 上傳中
  | 'disabled';   // 灰色 - 禁用

interface RecordingButtonProps {
  slotIndex: number;
  sentenceId: number;
  recordingState: RecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayRecording: () => void;
  disabled?: boolean;
}
```

### 4. 修改 PracticePage
```typescript
// src/app/dashboard/course/practice/page.tsx
// 每個句子顯示 3 個錄音按鈕
const [recordingStates, setRecordingStates] = useState<Record<number, RecordingState[]>>({});

// 狀態管理結構
type SentenceRecordingStates = {
  [sentenceId: number]: {
    [slotIndex: number]: RecordingState;
  };
};
```

## 🔌 API 接口設計

### 1. 音頻上傳接口
```typescript
// POST /api/audio/upload
interface UploadRequest {
  audio: File; // FormData
  sentenceId: string;
  slotIndex: number;
}

interface UploadResponse {
  success: boolean;
  recordingId: string;
  audioUrl: string;
  duration: number;
  error?: string;
}

// 實現位置: src/app/api/audio/upload/route.ts
```

### 2. 音頻播放接口
```typescript
// GET /api/audio/[recordingId]/route.ts
// 返回音頻檔案流，支援 Range requests
// Headers: 
//   Content-Type: audio/webm
//   Accept-Ranges: bytes
//   Cache-Control: public, max-age=31536000
```

### 3. 錄音查詢接口
```typescript
// GET /api/practice/[sentenceId]/recordings/route.ts
interface RecordingsResponse {
  recordings: Array<{
    id: string;
    slotIndex: number;
    audioUrl: string;
    duration: number;
    createdAt: string;
  }>;
}
```

### 4. 錄音刪除接口
```typescript
// DELETE /api/audio/[recordingId]/route.ts
interface DeleteResponse {
  success: boolean;
  error?: string;
}
```

## 🎨 UI/UX 設計規範

### 按鈕狀態樣式
```typescript
const buttonStyles = {
  idle: 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-gray-200',
  recording: 'bg-red-500 text-white hover:bg-red-600 border-red-500',
  recorded: 'bg-green-500 text-white hover:bg-green-600 border-green-500',
  uploading: 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500',
  disabled: 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100'
};
```

### 錄音進度顯示
```typescript
// 錄音中顯示倒數計時
{isRecording && (
  <div className="text-red-600 text-sm font-medium">
    🎤 錄音中... {Math.max(0, 10 - Math.floor(duration / 1000))}s
  </div>
)}

// 上傳中顯示進度
{isUploading && (
  <div className="text-blue-600 text-sm font-medium">
    ⬆️ 上傳中...
  </div>
)}
```

### 錯誤狀態處理
```typescript
// 麥克風權限被拒絕
{error === 'PERMISSION_DENIED' && (
  <div className="text-red-600 text-sm">
    ❌ 需要麥克風權限才能錄音
  </div>
)}

// 網路錯誤
{error === 'UPLOAD_FAILED' && (
  <div className="text-red-600 text-sm">
    ❌ 上傳失敗，請重試
  </div>
)}
```

## 🚀 實現順序

### 第一階段：核心錄音功能
1. ✅ 實現 `useAudioRecorder` Hook
   - MediaRecorder API 整合
   - 10秒自動停止機制
   - 錯誤處理和權限管理

2. ✅ 創建 `AudioPlayer` 組件
   - 音頻播放控制
   - 播放進度顯示
   - 播放/暫停狀態管理

### 第二階段：UI 整合
3. ✅ 修改 `PracticePage` 為三個按鈕設計
   - 狀態管理重構
   - 按鈕佈局調整
   - 視覺回饋實現

4. ✅ 實現 `RecordingButton` 組件
   - 多狀態按鈕設計
   - 點擊行為處理
   - 禁用狀態管理

### 第三階段：後端整合
5. ✅ 實現後端 API 接口
   - 檔案上傳處理
   - 音頻串流播放
   - 資料庫操作

6. ✅ 整合上傳和狀態管理
   - 前端上傳邏輯
   - 狀態同步
   - 錯誤處理

### 第四階段：優化和測試
7. ✅ 添加錯誤處理和使用者回饋
   - 權限錯誤處理
   - 網路錯誤重試
   - 使用者提示訊息

8. ✅ 性能優化和測試
   - 記憶體洩漏檢查
   - 音頻檔案壓縮
   - 跨瀏覽器測試

## 🔒 安全考量

### 身份驗證
```typescript
// 所有 API 都需要驗證使用者身份
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

### 檔案安全
```typescript
// 檔案類型驗證
const allowedMimeTypes = ['audio/webm', 'audio/webm;codecs=opus'];
if (!allowedMimeTypes.includes(file.type)) {
  throw new Error('Invalid file type');
}

// 檔案大小限制 (500KB)
const maxSize = 500 * 1024;
if (file.size > maxSize) {
  throw new Error('File too large');
}
```

### 路徑安全
```typescript
// 防止路徑遍歷攻擊
const safeFileName = `${userId}_${sentenceId}_${slotIndex}_${timestamp}.webm`;
const filePath = path.join(uploadDir, safeFileName);
```

## 📁 檔案結構

```
src/
├── hooks/
│   └── useAudioRecorder.ts          # 錄音 Hook
├── components/
│   ├── AudioPlayer.tsx              # 音頻播放組件
│   └── RecordingButton.tsx          # 錄音按鈕組件
├── app/
│   ├── api/
│   │   └── audio/
│   │       ├── upload/route.ts      # 上傳接口
│   │       └── [id]/route.ts        # 播放/刪除接口
│   ├── dashboard/course/practice/
│   │   └── page.tsx                 # 修改後的練習頁面
│   └── lib/
│       ├── audio.ts                 # 音頻相關工具函數
│       └── definitions.ts           # 新增錄音相關類型
└── types/
    └── audio.ts                     # 音頻相關類型定義
```

## 🧪 測試策略

### 單元測試
```typescript
// useAudioRecorder Hook 測試
describe('useAudioRecorder', () => {
  it('should start recording when startRecording is called', () => {
    // 測試錄音開始邏輯
  });
  
  it('should stop recording after 10 seconds', () => {
    // 測試自動停止機制
  });
});
```

### 整合測試
```typescript
// API 接口測試
describe('/api/audio/upload', () => {
  it('should upload audio file successfully', () => {
    // 測試上傳功能
  });
  
  it('should reject invalid file types', () => {
    // 測試檔案驗證
  });
});
```

### E2E 測試
```typescript
// 完整錄音流程測試
describe('Recording Flow', () => {
  it('should complete full recording workflow', () => {
    // 1. 點擊錄音按鈕
    // 2. 授權麥克風
    // 3. 錄音 10 秒
    // 4. 自動上傳
    // 5. 播放錄音
  });
});
```

## 📈 性能優化

### 前端優化
```typescript
// 使用 useCallback 避免不必要的重新渲染
const handleStartRecording = useCallback(async () => {
  // 錄音邏輯
}, [dependencies]);

// 使用 useMemo 快取音頻 URL
const audioUrl = useMemo(() => {
  return recordingState.audioBlob ? URL.createObjectURL(recordingState.audioBlob) : null;
}, [recordingState.audioBlob]);
```

### 後端優化
```typescript
// 音頻檔案壓縮
import ffmpeg from 'fluent-ffmpeg';

const compressAudio = async (inputPath: string, outputPath: string) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate(64) // 降低位元率
      .audioChannels(1)  // 單聲道
      .format('webm')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
};
```

## 🚀 部署考量

### 檔案儲存策略
```typescript
// 選項 1: 本地儲存
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'audio');

// 選項 2: 雲端儲存 (推薦)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

### CDN 配置
```typescript
// 音頻檔案 CDN 配置
const audioUrl = `https://cdn.echolearn.com/audio/${recordingId}.webm`;

// 快取策略
const cacheHeaders = {
  'Cache-Control': 'public, max-age=31536000', // 1年
  'ETag': fileHash,
};
```

## 📝 環境變數

```bash
# .env.local
# 音頻檔案儲存
AUDIO_UPLOAD_DIR=./public/uploads/audio
MAX_AUDIO_SIZE=524288  # 500KB

# AWS S3 (可選)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=echolearn-audio

# 資料庫
POSTGRES_URL=postgresql://...
```

## 🔄 版本控制

### Git 分支策略
```bash
# 功能分支
feature/audio-recording-hook
feature/audio-player-component
feature/recording-buttons-ui
feature/audio-upload-api
feature/audio-integration

# 合併到主分支
main ← feature/audio-recording-hook
main ← feature/audio-player-component
# ...
```

### 提交訊息規範
```
feat(audio): implement useAudioRecorder hook
fix(audio): fix 10-second auto-stop mechanism
docs(audio): add audio recording API documentation
test(audio): add unit tests for AudioPlayer component
```

## 📊 監控和日誌

### 錯誤監控
```typescript
// 錄音錯誤追蹤
const trackRecordingError = (error: Error, context: string) => {
  console.error(`[Recording Error] ${context}:`, error);
  // 發送到錯誤監控服務 (如 Sentry)
};
```

### 性能監控
```typescript
// 上傳時間追蹤
const trackUploadTime = (startTime: number, fileSize: number) => {
  const duration = Date.now() - startTime;
  const speed = fileSize / duration; // bytes/ms
  
  console.log(`[Upload Performance] Duration: ${duration}ms, Speed: ${speed} bytes/ms`);
};
```

## 🎯 成功指標

### 技術指標
- ✅ 錄音成功率 > 95%
- ✅ 上傳成功率 > 98%
- ✅ 音頻播放延遲 < 500ms
- ✅ 檔案大小控制在 500KB 以內

### 使用者體驗指標
- ✅ 麥克風權限授權率 > 90%
- ✅ 錄音完成率 > 85%
- ✅ 使用者滿意度 > 4.0/5.0

---

## 📞 聯絡資訊

如有任何問題或建議，請聯繫開發團隊。

**最後更新**: 2024年12月
**版本**: v1.0.0
