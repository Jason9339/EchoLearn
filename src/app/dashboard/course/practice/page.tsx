'use client';

import Link from 'next/link';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';

import { courses, defaultPracticeCourseId, practiceSentences } from '@/app/lib/placeholder-data';
import type { PracticeSentence } from '@/app/lib/definitions';
import type { RecordingState } from '@/types/audio';
import RecordingButton from '@/components/RecordingButton';

const courseId = defaultPracticeCourseId;
const fallbackCourseTitle = '口說練習';

// Type for managing recording states for each sentence and slot
type SentenceRecordingStates = {
  [sentenceId: number]: {
    [slotIndex: number]: RecordingState;
  };
};

export default function PracticePage() {
  const { status: sessionStatus } = useSession();
  const [recordingStates, setRecordingStates] = useState<SentenceRecordingStates>({});
  const [playedSentences, setPlayedSentences] = useState<Set<number>>(new Set());

  // Use refs to store MediaRecorder instances and cleanup functions
  const mediaRecordersRef = useRef<Record<string, MediaRecorder>>({});
  const cleanupFunctionsRef = useRef<Record<string, () => void>>({});

  const currentCourse = courses.find((course) => course.id === courseId);
  const sentences: PracticeSentence[] = practiceSentences[courseId] ?? [];

  // Initialize recording state for a sentence slot
  const initializeRecordingState = useCallback((): RecordingState => {
    return {
      isRecording: false,
      audioBlob: null,
      duration: 0,
      audioUrl: null,
      isUploading: false,
      error: null,
      fileSize: null,
    };
  }, []);

  // Update recording state for a specific sentence and slot
  const updateRecordingState = useCallback((sentenceId: number, slotIndex: number, updates: Partial<RecordingState>) => {
    console.log('updateRecordingState called:', { sentenceId, slotIndex, updates });
    setRecordingStates(prev => {
      const currentState = prev[sentenceId]?.[slotIndex] || initializeRecordingState();
      const newState = {
        ...prev,
        [sentenceId]: {
          ...prev[sentenceId],
          [slotIndex]: {
            ...currentState,
            ...updates,
          },
        },
      };
      console.log('New recording state:', newState);
      return newState;
    });
  }, [initializeRecordingState]);

  // Load existing recordings on mount
  useEffect(() => {
    if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
      return;
    }

    const controller = new AbortController();

    const loadRecordings = async () => {
      try {
        const response = await fetch('/api/audio/recordings', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          if (response.status !== 401) {
            console.error('Failed to load recordings:', response.status, errorText);
          }
          // Don't block the app if recordings can't be loaded
          return;
        }

        const data = await response.json();
        console.log('Loaded recordings:', data);
        if (data.success && data.recordings && data.recordings.length > 0) {
          // Set existing recordings to state
          data.recordings.forEach((rec: {
            id: string;
            sentenceId: number;
            slotIndex: number;
            audioUrl: string;
            duration: number;
            fileSize: number;
            createdAt: string;
          }) => {
            updateRecordingState(rec.sentenceId, rec.slotIndex, {
              audioBlob: null, // We don't have the blob, but we have the URL
              audioUrl: rec.audioUrl,
              duration: rec.duration,
              isRecording: false,
              isUploading: false,
              error: null,
              fileSize: rec.fileSize ?? null,
            });
          });
        }
      } catch (error) {
        // Ignore AbortError when component unmounts
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error loading recordings:', error);
      }
    };

    loadRecordings();

    return () => {
      controller.abort();
    };
  }, [sessionStatus, updateRecordingState]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Clean up all active MediaRecorders
      Object.values(mediaRecordersRef.current).forEach(recorder => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      });
      
      // Call all cleanup functions
      Object.values(cleanupFunctionsRef.current).forEach(cleanup => {
        cleanup();
      });
      
      // Clear refs
      mediaRecordersRef.current = {};
      cleanupFunctionsRef.current = {};
    };
  }, []);

  // Get recording state for a specific sentence and slot
  const getRecordingState = useCallback((sentenceId: number, slotIndex: number): RecordingState => {
    return recordingStates[sentenceId]?.[slotIndex] || initializeRecordingState();
  }, [recordingStates, initializeRecordingState]);

  // Handle audio playback
  const handlePlay = (sentence: PracticeSentence) => {
    if (typeof window === 'undefined') return;

    // Immediately mark sentence as played when user clicks play button
    setPlayedSentences(prev => new Set(prev).add(sentence.id));

    // Play the actual audio file
    if (sentence.audioSrc) {
      const audio = new Audio(sentence.audioSrc);
      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
      });
    }
  };

  // Handle recording start for a specific slot
  const handleStartRecording = useCallback(async (sentenceId: number, slotIndex: number) => {
    console.log('handleStartRecording called:', { sentenceId, slotIndex, playedSentences: Array.from(playedSentences) });
    
    // Check if the sentence has been played first
    if (!playedSentences.has(sentenceId)) {
      console.log('Sentence not played yet, showing warning');
      // Show warning message
      updateRecordingState(sentenceId, slotIndex, {
        error: 'PLAY_FIRST',
      });
      
      // Clear warning after 3 seconds
      setTimeout(() => {
        updateRecordingState(sentenceId, slotIndex, {
          error: null,
        });
      }, 3000);
      
      return;
    }

    try {
      console.log('Starting recording process...');

      // Update state to recording
      updateRecordingState(sentenceId, slotIndex, {
        isRecording: true,
        error: null,
        duration: 0,
      });

      console.log('Requesting microphone access...');
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      
      console.log('Microphone access granted, creating MediaRecorder...');

      // Check supported MIME types
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];
      
      let selectedMimeType = 'audio/webm;codecs=opus';
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log('Using MIME type:', selectedMimeType);
          break;
        }
      }
      
      if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
        console.error('No supported MIME type found');
        throw new Error('Browser does not support any audio recording format');
      }

      // Create MediaRecorder
      console.log('Creating MediaRecorder with mimeType:', selectedMimeType);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });
      
      console.log('MediaRecorder created successfully, state:', mediaRecorder.state);

      const chunks: Blob[] = [];
      const startTime = Date.now();

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available event:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const recordingDuration = Date.now() - startTime;

        console.log('Audio blob created:', audioBlob.size, 'bytes');

        updateRecordingState(sentenceId, slotIndex, {
          isRecording: false,
          audioBlob,
          audioUrl,
          duration: recordingDuration,
          fileSize: audioBlob.size,
        });

        // Call cleanup function
        const cleanup = cleanupFunctionsRef.current[recorderKey];
        if (cleanup) {
          cleanup();
        }

        console.log('Recording completed successfully');
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        updateRecordingState(sentenceId, slotIndex, {
          error: 'RECORDING_ERROR',
          isRecording: false,
        });
        
        // Call cleanup function
        const cleanup = cleanupFunctionsRef.current[recorderKey];
        if (cleanup) {
          cleanup();
        }
      };

      // Start recording
      console.log('Starting MediaRecorder...');
      mediaRecorder.start(100);
      console.log('MediaRecorder started, state:', mediaRecorder.state);
      
      // Store MediaRecorder reference using ref
      const recorderKey = `${sentenceId}-${slotIndex}`;
      console.log('Storing MediaRecorder with key:', recorderKey);
      mediaRecordersRef.current[recorderKey] = mediaRecorder;
      
      // Update duration every 100ms
      const durationInterval = setInterval(() => {
        const currentDuration = Date.now() - startTime;
        updateRecordingState(sentenceId, slotIndex, {
          duration: currentDuration,
        });
      }, 100);

      // Auto-stop after 10 seconds
      const autoStopTimeout = setTimeout(() => {
        console.log('Auto-stop timeout reached, stopping recording...');
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
        clearInterval(durationInterval);
      }, 10000);

      // Create cleanup function
      const cleanup = () => {
        clearInterval(durationInterval);
        clearTimeout(autoStopTimeout);
        stream.getTracks().forEach(track => track.stop());
        delete mediaRecordersRef.current[recorderKey];
        delete cleanupFunctionsRef.current[recorderKey];
      };

      // Store cleanup function
      cleanupFunctionsRef.current[recorderKey] = cleanup;

      console.log('Recording setup completed successfully');

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

      updateRecordingState(sentenceId, slotIndex, {
        error: errorMessage,
        isRecording: false,
      });
    }
  }, [updateRecordingState, playedSentences]);

  // Handle recording stop for a specific slot
  const handleStopRecording = useCallback((sentenceId: number, slotIndex: number) => {
    const recorderKey = `${sentenceId}-${slotIndex}`;
    const mediaRecorder = mediaRecordersRef.current[recorderKey];
    
    console.log('handleStopRecording called:', { sentenceId, slotIndex, recorderKey, mediaRecorderState: mediaRecorder?.state });
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('Stopping MediaRecorder...');
      // Stop the MediaRecorder
      mediaRecorder.stop();
      
      // Call cleanup function
      const cleanup = cleanupFunctionsRef.current[recorderKey];
      if (cleanup) {
        cleanup();
      }
    } else {
      console.log('No active MediaRecorder found or not in recording state');
    }
  }, []);

  // Handle audio playback for a specific slot
  const handlePlayRecording = useCallback(async (sentenceId: number, slotIndex: number) => {
    const recordingState = getRecordingState(sentenceId, slotIndex);
    if (!recordingState.audioUrl) return;

    const audio = new Audio(recordingState.audioUrl);
    audio.play().catch(error => {
      console.error('Failed to play audio:', error);
      updateRecordingState(sentenceId, slotIndex, { error: 'PLAYBACK_ERROR' });
    });
  }, [getRecordingState, updateRecordingState]);

  // Handle upload to server
  const handleUploadRecording = useCallback(async (sentenceId: number, slotIndex: number) => {
    const recordingState = getRecordingState(sentenceId, slotIndex);
    if (!recordingState.audioBlob) return;

    if (sessionStatus !== 'authenticated') {
      updateRecordingState(sentenceId, slotIndex, {
        error: 'NOT_AUTHENTICATED',
      });
      return;
    }

    try {
      updateRecordingState(sentenceId, slotIndex, {
        isUploading: true,
        error: null,
      });

      const formData = new FormData();
      formData.append('audio', recordingState.audioBlob, 'recording.webm');
      formData.append('sentenceId', String(sentenceId));
      formData.append('slotIndex', String(slotIndex));
      formData.append('duration', String(recordingState.duration));

      const response = await fetch('/api/audio/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error('Upload failed: unauthorized');
          throw new Error('未登入或登入逾時，請重新登入後再試一次');
        }

        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Upload failed:', response.status, errorData);
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);

      if (recordingState.audioBlob && recordingState.audioUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(recordingState.audioUrl);
      }

      updateRecordingState(sentenceId, slotIndex, {
        isUploading: false,
        audioUrl: result?.audioUrl ?? recordingState.audioUrl,
        audioBlob: null,
        fileSize: recordingState.audioBlob
          ? recordingState.audioBlob.size
          : recordingState.fileSize,
        duration: typeof result?.duration === 'number' ? result.duration : recordingState.duration,
      });
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'UPLOAD_ERROR';
      updateRecordingState(sentenceId, slotIndex, {
        isUploading: false,
        error: errorMessage,
      });
    }
  }, [getRecordingState, updateRecordingState, sessionStatus]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-12">
      <header className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              {currentCourse ? currentCourse.title : 'EchoLearn'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              {currentCourse?.title ?? fallbackCourseTitle}
            </h1>
          </div>
          <Link
            href="/dashboard/course"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
          >
            <ArrowUturnLeftIcon className="h-4 w-4" /> 返回課程列表
          </Link>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          {currentCourse?.description ?? '逐句練習：點擊播放聽一次，再點錄音模仿。每個句子可以錄製 3 次，每次最多 10 秒。'}
        </p>
      </header>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">使用說明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 點擊「播放原音」聆聽標準發音</li>
          <li>• 每個句子可以錄製 3 次，每次最多 10 秒</li>
          <li>• 點擊圓形按鈕開始錄音，再點擊停止錄音</li>
          <li>• 圓形按鈕背景動畫顯示剩餘時間</li>
          <li>• 錄音完成後可以立即播放聽取</li>
          <li>• 可以重新錄音覆蓋之前的錄音</li>
          <li className="font-semibold text-blue-900">• ⚠️ 錄音完成後記得按「上傳」按鈕才會儲存到系統</li>
        </ul>
      </div>

      <section className="space-y-6">
        {sentences.map((sentence) => {
          const hasAnyRecording = [0, 1, 2].some(slotIndex => {
            const state = getRecordingState(sentence.id, slotIndex);
            return Boolean(state.audioBlob || state.audioUrl);
          });

          return (
            <article
              key={sentence.id}
              className="rounded-xl border bg-white p-6 shadow-sm transition hover:border-sky-200"
            >
              {/* Sentence Content */}
              <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-lg font-medium text-gray-900">{sentence.text}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Future Feature: Square Recording Button - Currently Disabled */}
                    {/*
                    {(() => {
                      const recordingState = getRecordingState(sentence.id, 3);
                      const isRecording = recordingState.isRecording;
                      const isUploading = recordingState.isUploading;
                      const hasRecording = recordingState.audioBlob;

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (isRecording) {
                                handleStopRecording(sentence.id, 3);
                              } else {
                                handleStartRecording(sentence.id, 3);
                              }
                            }}
                            disabled={isUploading}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                              isRecording
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-green-600 hover:bg-green-700'
                            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isRecording ? (
                              <>
                                <StopIcon className="h-5 w-5" /> 停止錄音
                              </>
                            ) : (
                              <>
                                <MicrophoneIcon className="h-5 w-5" /> {hasRecording ? '重新錄音' : '開始錄音'}
                              </>
                            )}
                          </button>

                          {hasRecording && !isRecording && (
                            <button
                              type="button"
                              onClick={() => handleUploadRecording(sentence.id, 3)}
                              disabled={isUploading}
                              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                                isUploading
                                  ? 'bg-gray-400 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {isUploading ? (
                                <>
                                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  上傳中...
                                </>
                              ) : (
                                <>
                                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                  </svg>
                                  確認上傳
                                </>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                    */}
                    {/* Play Original Audio Button */}
                    <button
                      type="button"
                      onClick={() => handlePlay(sentence)}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                    >
                      <PlayIcon className="h-5 w-5" /> 播放原音
                    </button>
                  </div>
                </div>
              </div>

              {/* Recording Section - Three recording attempts */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-medium text-gray-900">錄音練習</h3>
                  {hasAnyRecording && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      ✓ 已錄音
                    </span>
                  )}
                </div>

                {/* Three Recording Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[0, 1, 2].map((slotIndex) => {
                    const recordingState = getRecordingState(sentence.id, slotIndex);

                    return (
                      <div key={slotIndex} className="space-y-3">
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-700">
                            錄音 {slotIndex + 1}
                          </span>
                        </div>

                        <RecordingButton
                          slotIndex={slotIndex}
                          sentenceId={sentence.id}
                          recordingState={recordingState}
                          onStartRecording={() => handleStartRecording(sentence.id, slotIndex)}
                          onStopRecording={() => handleStopRecording(sentence.id, slotIndex)}
                          onPlayRecording={() => handlePlayRecording(sentence.id, slotIndex)}
                          onUploadRecording={() => handleUploadRecording(sentence.id, slotIndex)}
                          hasPlayedOriginal={playedSentences.has(sentence.id)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Progress Indicator */}
                <div className="mt-4 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((slotIndex) => {
                        const slotState = getRecordingState(sentence.id, slotIndex);
                        const hasRecording = Boolean(slotState.audioBlob || slotState.audioUrl);
                        return (
                          <div
                            key={slotIndex}
                            className={`w-2 h-2 rounded-full ${
                              hasRecording ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span>
                      {[0, 1, 2].filter(slotIndex => {
                        const state = getRecordingState(sentence.id, slotIndex);
                        return Boolean(state.audioBlob || state.audioUrl);
                      }).length} / 3 完成
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
