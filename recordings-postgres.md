## 目前已預備的後端接軌項目（簡述）

- API 端點（已就緒）：
  - `POST /api/audio/upload`（`src/app/api/audio/upload/route.ts`）
  - 已接 `auth()` 驗證，未登入回 401。
  - 接受 `multipart/form-data`：`audio`(File)、`sentenceId`、`slotIndex`、`duration`(可選)。
  - 內建檔案驗證 `validateAudioFile`（型別白名單、大小上限、非空）。
  - 依 `slotIndex` 自動判斷 `label`（正式/測試），產生語意化檔名。
  - 目前回傳 stub：`{ success, recordingId, audioUrl, duration }`，並保留 DB/檔案儲存 TODO 插入點。

- 槽位語意（已定義）：
  - `src/types/audio.ts`：`OFFICIAL_SLOT = 3`、`TEST_SLOTS = [0,1,2]`、`getSlotLabel(slotIndex)` → `official | test`。

- 檔名策略（已內建）：
  - `src/app/lib/audio.ts`：`generateLabeledAudioFilename(userId, sentenceId, slotIndex, label)`
  - 格式：`{userId}_{sentenceId}_{label}-{slotIndex}_{timestamp}.webm`

- 後續接點（已標示）：
  - DB：在 `route.ts` 已以 `TODO` 標出「INSERT/UPSERT 到 PostgreSQL」位置。
  - 檔案儲存：可在同檔案將 `File` 轉成 `Buffer`，寫入本機或上傳雲端（S3/GCS），再把實際 `audioUrl` 寫入 DB。


