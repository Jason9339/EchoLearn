'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { PlayIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { courses, defaultPracticeCourseId, practiceSentences } from '@/app/lib/placeholder-data';
import type { PracticeSentence } from '@/app/lib/definitions';
import type { RecordingState } from '@/types/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
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
  const [recordingStates, setRecordingStates] = useState<SentenceRecordingStates>({});
  const [playingAudio, setPlayingAudio] = useState<{ sentenceId: number; slotIndex: number } | null>(null);
  const [mediaRecorders, setMediaRecorders] = useState<Record<string, MediaRecorder>>({});
  const [playedSentences, setPlayedSentences] = useState<Set<number>>(new Set());

  const currentCourse = courses.find((course) => course.id === courseId);
  const sentences: PracticeSentence[] = practiceSentences[courseId] ?? [];

  // Initialize recording state for a sentence slot
  const initializeRecordingState = useCallback((sentenceId: number, slotIndex: number): RecordingState => {
    return {
      isRecording: false,
      audioBlob: null,
      duration: 0,
      audioUrl: null,
      isUploading: false,
      error: null,
    };
  }, []);

  // Get recording state for a specific sentence and slot
  const getRecordingState = useCallback((sentenceId: number, slotIndex: number): RecordingState => {
    return recordingStates[sentenceId]?.[slotIndex] || initializeRecordingState(sentenceId, slotIndex);
  }, [recordingStates, initializeRecordingState]);

  // Update recording state for a specific sentence and slot
  const updateRecordingState = useCallback((sentenceId: number, slotIndex: number, updates: Partial<RecordingState>) => {
    console.log('updateRecordingState called:', { sentenceId, slotIndex, updates });
    setRecordingStates(prev => {
      const newState = {
        ...prev,
        [sentenceId]: {
          ...prev[sentenceId],
          [slotIndex]: {
            ...getRecordingState(sentenceId, slotIndex),
            ...updates,
          },
        },
      };
      console.log('New recording state:', newState);
      return newState;
    });
  }, [getRecordingState]);

  // Handle TTS playback
  const handlePlay = (sentence: PracticeSentence) => {
    if (typeof window === 'undefined') return;

    // Immediately mark sentence as played when user clicks play button
    setPlayedSentences(prev => new Set(prev).add(sentence.id));

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sentence.text);
      window.speechSynthesis.speak(utterance);
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
      
      // Stop any currently playing audio
      setPlayingAudio(null);
      
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
        
        console.log('Audio blob created:', audioBlob.size, 'bytes');
        
        updateRecordingState(sentenceId, slotIndex, {
          isRecording: false,
          audioBlob,
          audioUrl,
          duration: Date.now() - startTime,
        });

        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        console.log('Recording completed successfully');
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        updateRecordingState(sentenceId, slotIndex, {
          error: 'RECORDING_ERROR',
          isRecording: false,
        });
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording
      console.log('Starting MediaRecorder...');
      mediaRecorder.start(100);
      console.log('MediaRecorder started, state:', mediaRecorder.state);
      
      // Store MediaRecorder reference
      const recorderKey = `${sentenceId}-${slotIndex}`;
      console.log('Storing MediaRecorder with key:', recorderKey);
      setMediaRecorders(prev => ({
        ...prev,
        [recorderKey]: mediaRecorder
      }));
      
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

      // Store references for cleanup
      (mediaRecorder as any)._durationInterval = durationInterval;
      (mediaRecorder as any)._autoStopTimeout = autoStopTimeout;
      
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
    const mediaRecorder = mediaRecorders[recorderKey];
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Stop the MediaRecorder
      mediaRecorder.stop();
      
      // Clean up duration interval
      const durationInterval = (mediaRecorder as any)._durationInterval;
      if (durationInterval) {
        clearInterval(durationInterval);
      }
      
      // Clean up auto-stop timeout
      const autoStopTimeout = (mediaRecorder as any)._autoStopTimeout;
      if (autoStopTimeout) {
        clearTimeout(autoStopTimeout);
      }
      
      // Remove from state
      setMediaRecorders(prev => {
        const newRecorders = { ...prev };
        delete newRecorders[recorderKey];
        return newRecorders;
      });
    }
  }, [mediaRecorders]);

  // Handle audio playback for a specific slot
  const handlePlayRecording = useCallback((sentenceId: number, slotIndex: number) => {
    const recordingState = getRecordingState(sentenceId, slotIndex);
    
    if (recordingState.audioUrl) {
      setPlayingAudio({ sentenceId, slotIndex });
      
      const audio = new Audio(recordingState.audioUrl);
      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
        updateRecordingState(sentenceId, slotIndex, {
          error: 'PLAYBACK_ERROR',
        });
        setPlayingAudio(null);
      });

      // Handle audio end
      audio.onended = () => {
        setPlayingAudio(null);
      };
    }
  }, [getRecordingState, updateRecordingState]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-12">
      <header className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              {currentCourse ? `${currentCourse.title} · 假資料 Demo` : 'EchoLearn · 假資料 Demo'}
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

      <section className="space-y-6">
        {sentences.map((sentence) => {
          const hasAnyRecording = [0, 1, 2].some(slotIndex => 
            getRecordingState(sentence.id, slotIndex).audioBlob
          );

          return (
            <article
              key={sentence.id}
              className="rounded-xl border bg-white p-6 shadow-sm transition hover:border-sky-200"
            >
              {/* Sentence Content */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <p className="text-lg font-medium text-gray-900">{sentence.text}</p>
                    <p className="text-sm text-gray-500">{sentence.translation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePlay(sentence)}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                  >
                    <PlayIcon className="h-5 w-5" /> 播放原音
                  </button>
                </div>
              </div>

              {/* Recording Section */}
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
                    const isPlaying = playingAudio?.sentenceId === sentence.id && 
                                   playingAudio?.slotIndex === slotIndex;

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
                        const hasRecording = getRecordingState(sentence.id, slotIndex).audioBlob;
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
                      {[0, 1, 2].filter(slotIndex => 
                        getRecordingState(sentence.id, slotIndex).audioBlob
                      ).length} / 3 完成
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

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
        </ul>
      </div>
    </div>
  );
}
