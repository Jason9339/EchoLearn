'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RecordingState, UseAudioRecorderReturn } from '@/types/audio';
import { MAX_RECORDING_DURATION_MS } from '@/types/audio';

/**
 * Custom hook for managing audio recording functionality
 * Handles MediaRecorder API, 15-second auto-stop, and error management
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    audioBlob: null,
    duration: 0,
    audioUrl: null,
    isUploading: false,
    isDeleting: false,
    error: null,
    fileSize: null,
    recordingId: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clean up resources and clear timeouts
   */
  const cleanup = useCallback(() => {
    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Clear auto-stop timeout
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear chunks
    chunksRef.current = [];
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    try {
      setRecordingState(prev => ({
        ...prev,
        error: null,
        isRecording: false,
      }));

      // Request microphone access
      const baseConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 44100,
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: baseConstraints,
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.applyConstraints(baseConstraints).catch(() => {
          // Ignore constraint errors and use the acquired track settings
        });
      }

      streamRef.current = stream;

      // Create MediaRecorder with WebM format
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop event
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setRecordingState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob,
          audioUrl,
          duration: Date.now() - startTimeRef.current,
          fileSize: audioBlob.size,
          isDeleting: false,
        }));

        cleanup();
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setRecordingState(prev => ({
          ...prev,
          error: 'RECORDING_ERROR',
          isRecording: false,
        }));
        cleanup();
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();

      // Update recording state
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        duration: 0,
        fileSize: null,
      }));

      // Start duration tracking
      durationIntervalRef.current = setInterval(() => {
        const currentDuration = Date.now() - startTimeRef.current;
        setRecordingState(prev => ({
          ...prev,
          duration: currentDuration,
          fileSize: prev.fileSize,
        }));
      }, 100);

      // Auto-stop after configured duration
      autoStopTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_DURATION_MS);

    } catch (error) {
      console.error('Failed to start recording:', error);
      
      let errorMessage = 'UNKNOWN_ERROR';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'PERMISSION_DENIED';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'NO_MICROPHONE';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'NOT_SUPPORTED';
        }
      }

      setRecordingState(prev => ({
        ...prev,
        error: errorMessage,
        isRecording: false,
      }));

      cleanup();
    }
  }, [cleanup]);

  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /**
   * Play the recorded audio
   */
  const playRecording = useCallback(() => {
    if (recordingState.audioUrl) {
      const audio = new Audio(recordingState.audioUrl);
      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
        setRecordingState(prev => ({
          ...prev,
          error: 'PLAYBACK_ERROR',
        }));
      });
    }
  }, [recordingState.audioUrl]);

  /**
   * Upload recording to server
   */
  const uploadRecording = useCallback(async (sentenceId: number, slotIndex: number): Promise<string> => {
    if (!recordingState.audioBlob) {
      throw new Error('No audio data to upload');
    }

    setRecordingState(prev => ({
      ...prev,
      isUploading: true,
      error: null,
    }));

    try {
      const formData = new FormData();
      formData.append('audio', recordingState.audioBlob, `recording_${sentenceId}_${slotIndex}.webm`);
      formData.append('sentenceId', sentenceId.toString());
      formData.append('slotIndex', slotIndex.toString());

      const response = await fetch('/api/audio/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setRecordingState(prev => ({
        ...prev,
        isUploading: false,
        recordingId: typeof result?.recordingId === 'string'
          ? result.recordingId
          : prev.recordingId,
        isDeleting: false,
      }));

      return result.recordingId;

    } catch (error) {
      console.error('Upload failed:', error);
      
      setRecordingState(prev => ({
        ...prev,
        isUploading: false,
        error: 'UPLOAD_FAILED',
        isDeleting: false,
      }));

      throw error;
    }
  }, [recordingState.audioBlob]);

  /**
   * Clear current recording
   */
  const clearRecording = useCallback(() => {
    // Revoke object URL to free memory
    if (recordingState.audioUrl) {
      URL.revokeObjectURL(recordingState.audioUrl);
    }

    setRecordingState({
      isRecording: false,
      audioBlob: null,
      duration: 0,
      audioUrl: null,
      isUploading: false,
      isDeleting: false,
      error: null,
      fileSize: null,
      recordingId: null,
    });

    cleanup();
  }, [recordingState.audioUrl, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (recordingState.audioUrl) {
        URL.revokeObjectURL(recordingState.audioUrl);
      }
    };
  }, [cleanup, recordingState.audioUrl]);

  return {
    recordingState,
    startRecording,
    stopRecording,
    playRecording,
    uploadRecording,
    clearRecording,
  };
}
