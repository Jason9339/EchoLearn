/**
 * Audio recording related type definitions
 * @file types/audio.ts
 */

export interface RecordingState {
  /** Whether currently recording */
  isRecording: boolean;
  /** Audio blob data */
  audioBlob: Blob | null;
  /** Recording duration in milliseconds */
  duration: number;
  /** Audio URL for playback */
  audioUrl: string | null;
  /** Whether uploading to server */
  isUploading: boolean;
  /** Whether a delete request is in progress */
  isDeleting: boolean;
  /** Error message if any */
  error: string | null;
  /** File size in bytes (if known) */
  fileSize: number | null;
  /** Server recording ID if persisted */
  recordingId: string | null;
}

export interface UseAudioRecorderReturn {
  /** Current recording state */
  recordingState: RecordingState;
  /** Start recording function */
  startRecording: () => Promise<void>;
  /** Stop recording function */
  stopRecording: () => void;
  /** Play recording function */
  playRecording: () => void;
  /** Upload recording to server */
  uploadRecording: (sentenceId: number, slotIndex: number) => Promise<string>;
  /** Clear current recording */
  clearRecording: () => void;
}

/** Maximum duration for a single recording (milliseconds) */
export const MAX_RECORDING_DURATION_MS = 15_000;

export interface AudioPlayerProps {
  /** Audio URL to play */
  audioUrl: string | null;
  /** Whether currently playing */
  isPlaying: boolean;
  /** Play callback */
  onPlay: () => void;
  /** Pause callback */
  onPause: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Optional: override the right-side duration display in seconds */
  durationOverrideSeconds?: number;
}

export type ButtonState = 
  | 'idle'        // Gray - not recorded
  | 'ready'       // Blue - ready to record
  | 'recording'   // Red - recording
  | 'recorded'    // Green - recorded
  | 'uploading'   // Blue - uploading
  | 'disabled';    // Gray - disabled

export interface RecordingButtonProps {
  /** Slot index (0, 1, 2) */
  slotIndex: number;
  /** Sentence ID */
  sentenceId: number;
  /** Current recording state */
  recordingState: RecordingState;
  /** Start recording callback */
  onStartRecording: () => void;
  /** Stop recording callback */
  onStopRecording: () => void;
  /** Play recording callback */
  onPlayRecording: () => void;
  /** Upload recording callback */
  onUploadRecording?: () => void;
  /** Delete recording callback */
  onDeleteRecording?: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Whether the sentence has been played */
  hasPlayedOriginal?: boolean;
  /** Whether to show playback section and duration/size info */
  showDetails?: boolean;
  /** Whether this recording is currently playing */
  isPlaying?: boolean;
  /** Callback when playback should stop */
  onStopPlayback?: () => void;
}

// API related types
export interface UploadRequest {
  audio: File;
  sentenceId: string;
  slotIndex: number;
}

export interface UploadResponse {
  success: boolean;
  recordingId: string;
  audioUrl: string;
  duration: number;
  error?: string;
}

export interface RecordingsResponse {
  recordings: Array<{
    id: string;
    slotIndex: number;
    audioUrl: string;
    duration: number;
    createdAt: string;
  }>;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
}

/**
 * Recording slot semantics
 * - OFFICIAL_SLOT: the single official submission slot (index 3)
 * - TEST_SLOTS: three testing slots (indexes 0,1,2)
 */
export const OFFICIAL_SLOT: number = 3;
export const TEST_SLOTS: readonly number[] = [0, 1, 2] as const;

/** Label for slot semantics */
export type SlotLabel = 'official' | 'test';

/**
 * Get semantic label for a given slot index.
 * @param slotIndex Slot index
 * @returns 'official' for OFFICIAL_SLOT; otherwise 'test'
 */
export function getSlotLabel(slotIndex: number): SlotLabel {
  return slotIndex === OFFICIAL_SLOT ? 'official' : 'test';
}
