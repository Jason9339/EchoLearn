'use client';

import Link from 'next/link';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayIcon, MicrophoneIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

import { courses, defaultPracticeCourseId, practiceSentences } from '@/app/lib/placeholder-data';
import type { PracticeSentence } from '@/app/lib/definitions';
import type { RecordingState } from '@/types/audio';
import RecordingButton from '@/components/RecordingButton';
import AudioPlayer from '@/components/AudioPlayer';

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
  const [playedSentences, setPlayedSentences] = useState<Set<number>>(new Set());
  // Control collapse state for legacy three-button section per sentence
  const [collapsedSentences, setCollapsedSentences] = useState<Record<number, boolean>>({});
  
  // Use refs to store MediaRecorder instances and cleanup functions
  const mediaRecordersRef = useRef<Record<string, MediaRecorder>>({});
  const cleanupFunctionsRef = useRef<Record<string, () => void>>({});
  
  // Waveform visualization refs for the single recording bar (slotIndex 3)
  const waveformCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const audioContextsRef = useRef<Record<string, AudioContext>>({});
  const analysersRef = useRef<Record<string, AnalyserNode>>({});
  const animationFrameIdsRef = useRef<Record<string, number>>({});
  const playbackSourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});

  const currentCourse = courses.find((course) => course.id === courseId);
  const sentences: PracticeSentence[] = practiceSentences[courseId] ?? [];

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

  // Initialize recording state for a sentence slot
  const initializeRecordingState = useCallback((): RecordingState => {
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
    return recordingStates[sentenceId]?.[slotIndex] || initializeRecordingState();
  }, [recordingStates, initializeRecordingState]);

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
        
        // Stop waveform animation and close AudioContext for slot 3
        if (slotIndex === 3) {
          const rafId = animationFrameIdsRef.current[recorderKey];
          if (rafId) {
            cancelAnimationFrame(rafId);
            delete animationFrameIdsRef.current[recorderKey];
          }
          const ctx = audioContextsRef.current[recorderKey];
          if (ctx) {
            ctx.close().catch(() => undefined);
            delete audioContextsRef.current[recorderKey];
          }
          if (analysersRef.current[recorderKey]) {
            delete analysersRef.current[recorderKey];
          }
          const canvas = waveformCanvasRefs.current[recorderKey];
          if (canvas) {
            const g = canvas.getContext('2d');
            if (g) {
              g.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        }
        delete mediaRecordersRef.current[recorderKey];
        delete cleanupFunctionsRef.current[recorderKey];
      };
      
      // Store cleanup function
      cleanupFunctionsRef.current[recorderKey] = cleanup;

      // Initialize live waveform visualization for the single recording bar (slotIndex 3)
      if (slotIndex === 3) {
        try {
          const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error('AudioContext not supported');
          }
          const audioContext = new AudioContextClass();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);

          audioContextsRef.current[recorderKey] = audioContext;
          analysersRef.current[recorderKey] = analyser;

          const buffer = new Uint8Array(analyser.frequencyBinCount);

          const draw = () => {
            const cv = waveformCanvasRefs.current[recorderKey];
            const an = analysersRef.current[recorderKey];
            if (!cv || !an) return;
            const ctx2d = cv.getContext('2d');
            if (!ctx2d) return;
            const w = cv.width;
            const h = cv.height;

            // background
            ctx2d.fillStyle = '#f8fafc';
            ctx2d.fillRect(0, 0, w, h);

            // grid baseline
            ctx2d.strokeStyle = '#e5e7eb';
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(0, h / 2);
            ctx2d.lineTo(w, h / 2);
            ctx2d.stroke();

            // get data and compute bars along time (fixed 10s)
            an.getByteTimeDomainData(buffer);
            // compute instantaneous amplitude
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) {
              const v = (buffer[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buffer.length); // 0..1

            const elapsed = Math.min(Date.now() - startTime, 10000);
            const x = Math.floor((elapsed / 10000) * w);
            const barHeight = Math.max(2, Math.floor(rms * h));
            const y = Math.floor(h / 2 - barHeight / 2);

            // draw progressive bar (we do not clear previous, so it builds over time)
            ctx2d.fillStyle = '#0ea5e9';
            ctx2d.fillRect(x, y, 2, barHeight);

            const rafId = requestAnimationFrame(draw);
            animationFrameIdsRef.current[recorderKey] = rafId;
          };
          // kick off animation
          draw();
        } catch (e) {
          console.error('Waveform initialization failed', e);
        }
      }
      
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

    // Special handling for single-bar (slot 3): visualize during playback
    if (slotIndex === 3) {
      const playKey = `${sentenceId}-${slotIndex}-play`;
      // Clean up any previous playback session
      try {
        const prevRaf = animationFrameIdsRef.current[playKey];
        if (prevRaf) cancelAnimationFrame(prevRaf);
        const prevCtx = audioContextsRef.current[playKey];
        if (prevCtx) await prevCtx.close();
        const prevSrc = playbackSourcesRef.current[playKey];
        if (prevSrc) prevSrc.stop();
      } catch {}

      try {
        setPlayingAudio({ sentenceId, slotIndex });

        // Build AudioContext graph
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('AudioContext not supported');
        }
        const audioContext = new AudioContextClass();
        const response = await fetch(recordingState.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        audioContextsRef.current[playKey] = audioContext;
        analysersRef.current[playKey] = analyser;
        playbackSourcesRef.current[playKey] = source;

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const startTime = audioContext.currentTime;
        const durationSec = Math.min(10, audioBuffer.duration);

        const draw = () => {
          const cv = waveformCanvasRefs.current[`${sentenceId}-3`];
          const an = analysersRef.current[playKey];
          if (!cv || !an) return;
          const g = cv.getContext('2d');
          if (!g) return;

          const w = cv.width;
          const h = cv.height;
          g.fillStyle = '#f8fafc';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#e5e7eb';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(0, h / 2);
          g.lineTo(w, h / 2);
          g.stroke();

          // Progress position based on currentTime
          const elapsed = audioContext.currentTime - startTime;
          const progress = Math.min(elapsed / durationSec, 1);
          const x = Math.floor(progress * w);

          // Instantaneous amplitude bar
          an.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length);
          const barHeight = Math.max(2, Math.floor(rms * h));
          const y = Math.floor(h / 2 - barHeight / 2);

          g.fillStyle = '#0ea5e9';
          g.fillRect(0, y, x, barHeight); // fill up to progress

          if (progress < 1) {
            const raf = requestAnimationFrame(draw);
            animationFrameIdsRef.current[playKey] = raf;
          }
        };

        source.start(0);
        draw();

        source.onended = () => {
          setPlayingAudio(null);
          const raf = animationFrameIdsRef.current[playKey];
          if (raf) cancelAnimationFrame(raf);
          delete animationFrameIdsRef.current[playKey];
          if (audioContextsRef.current[playKey]) {
            audioContextsRef.current[playKey].close().catch(() => undefined);
            delete audioContextsRef.current[playKey];
          }
          delete analysersRef.current[playKey];
          delete playbackSourcesRef.current[playKey];
        };
      } catch (e) {
        console.error('Playback with visualization failed:', e);
        updateRecordingState(sentenceId, slotIndex, { error: 'PLAYBACK_ERROR' });
        setPlayingAudio(null);
      }
      return;
    }

    // Default playback for other slots
    const audio = new Audio(recordingState.audioUrl);
    setPlayingAudio({ sentenceId, slotIndex });
    audio.play().catch(error => {
      console.error('Failed to play audio:', error);
      updateRecordingState(sentenceId, slotIndex, { error: 'PLAYBACK_ERROR' });
      setPlayingAudio(null);
    });
    audio.onended = () => setPlayingAudio(null);
  }, [getRecordingState, updateRecordingState]);

  const handlePauseRecording = useCallback((sentenceId: number, slotIndex: number) => {
    if (slotIndex === 3) {
      const playKey = `${sentenceId}-${slotIndex}-play`;
      const src = playbackSourcesRef.current[playKey];
      if (src) {
        try { src.stop(); } catch {}
        delete playbackSourcesRef.current[playKey];
      }
      const raf = animationFrameIdsRef.current[playKey];
      if (raf) {
        cancelAnimationFrame(raf);
        delete animationFrameIdsRef.current[playKey];
      }
      const ctx = audioContextsRef.current[playKey];
      if (ctx) {
        ctx.close().catch(() => undefined);
        delete audioContextsRef.current[playKey];
      }
      delete analysersRef.current[playKey];
    }
    setPlayingAudio(null);
  }, []);

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

              {/* Single Recording Bar (Production Version) */}
              <div className="relative mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3">
                {/* Collapse toggle button (^ / v) placed here; it controls legacy section below */}
                <button
                  type="button"
                  onClick={() => setCollapsedSentences(prev => ({ ...prev, [sentence.id]: !prev[sentence.id] }))}
                  className="absolute right-2 top-2 text-gray-500 hover:text-gray-700 text-xs"
                  aria-label={collapsedSentences[sentence.id] ? '展開' : '收合'}
                  title={collapsedSentences[sentence.id] ? '展開舊的錄音練習' : '收合舊的錄音練習'}
                >
                  {collapsedSentences[sentence.id] ? 'v' : '^'}
                </button>

                <div className="flex items-center gap-4">
                  {/* Left: Single Recording Button (uses slotIndex 3 to avoid conflict) */}
                  <div className="flex items-center gap-3">
                    <RecordingButton
                      slotIndex={3}
                      sentenceId={sentence.id}
                      recordingState={getRecordingState(sentence.id, 3)}
                      onStartRecording={() => handleStartRecording(sentence.id, 3)}
                      onStopRecording={() => handleStopRecording(sentence.id, 3)}
                      onPlayRecording={() => handlePlayRecording(sentence.id, 3)}
                      hasPlayedOriginal={playedSentences.has(sentence.id)}
                      showDetails={false}
                    />
                  </div>

                  {/* Right: Waveform container placeholder (to be implemented in step 2) */}
                  <div className="flex-1">
                    <canvas
                      ref={(el) => { waveformCanvasRefs.current[`${sentence.id}-3`] = el; }}
                      className="w-full rounded-md ring-1 ring-inset ring-gray-200 bg-gray-50"
                      style={{ height: '80px' }}
                      width={800}
                      height={80}
                    />
                    <div className="mt-2">
                      <AudioPlayer
                        audioUrl={getRecordingState(sentence.id, 3).audioUrl}
                        isPlaying={playingAudio?.sentenceId === sentence.id && playingAudio?.slotIndex === 3}
                        onPlay={() => handlePlayRecording(sentence.id, 3)}
                        onPause={() => handlePauseRecording(sentence.id, 3)}
                        className="text-xs"
                        durationOverrideSeconds={10}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recording Section (legacy three-button block). To hide permanently, comment out this entire <div> ... </div> block. */}
              <div className={`border-t pt-6 ${collapsedSentences[sentence.id] ? 'hidden' : ''}`}>
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
