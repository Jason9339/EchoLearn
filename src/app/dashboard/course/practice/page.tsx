'use client';

import Link from 'next/link';

import { Suspense, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PlayIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import { courses, defaultPracticeCourseId, practiceSentences } from '@/app/lib/placeholder-data';
import type { PracticeSentence } from '@/app/lib/definitions';
import type { RecordingState } from '@/types/audio';
import { MAX_RECORDING_DURATION_MS } from '@/types/audio';
import RecordingButton from '@/components/RecordingButton';

const fallbackCourseTitle = '口說練習';
const DEFAULT_SENTENCES_PER_PAGE = 10;
const SENTENCES_PER_PAGE_OPTIONS = [6, 10, 15, 20];

// Type for managing recording states for each sentence and slot
type SentenceRecordingStates = {
  [sentenceId: number]: {
    [slotIndex: number]: RecordingState;
  };
};

// Note: SentenceRatings type removed - ratings functionality disabled for application mode

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-10 text-sm text-gray-500">練習內容載入中…</div>}>
      <PracticePageContent />
    </Suspense>
  );
}

function PracticePageContent() {
  const { status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedCourseId = searchParams.get('courseId') ?? defaultPracticeCourseId;
  const isCustomCourse = searchParams.get('custom') === 'true';
  const courseId = practiceSentences[selectedCourseId] ? selectedCourseId : defaultPracticeCourseId;
  const [recordingStates, setRecordingStates] = useState<SentenceRecordingStates>({});
  const [playedSentences, setPlayedSentences] = useState<Set<number>>(new Set());
  interface CustomCourseData { id: string; title: string; description: string }
  const [customCourseData, setCustomCourseData] = useState<CustomCourseData | null>(null);
  const [customSentences, setCustomSentences] = useState<PracticeSentence[]>([]);
  const [loading, setLoading] = useState(isCustomCourse);

  // Use refs to store MediaRecorder instances and cleanup functions
  const mediaRecordersRef = useRef<Record<string, MediaRecorder>>({});
  const cleanupFunctionsRef = useRef<Record<string, () => void>>({});

    // 用來避免多個音檔同時播放
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 課程資訊：custom 課程用 customCourseData，其他用預設 courses
  const currentCourse = isCustomCourse
    ? customCourseData
    : courses.find((course) => course.id === courseId);

  // 句子來源：custom 課程用 customSentences，其它用 practiceSentences
  const sentences: PracticeSentence[] = useMemo(
    () => (isCustomCourse ? customSentences : (practiceSentences[courseId] ?? [])),
    [isCustomCourse, customSentences, courseId],
  );

  const totalSentences = sentences.length;

  const rawPerPageParam = searchParams.get('perPage');
  const parsedPerPage = rawPerPageParam ? parseInt(rawPerPageParam, 10) : NaN;
  const sentencesPerPage = SENTENCES_PER_PAGE_OPTIONS.includes(parsedPerPage)
    ? parsedPerPage
    : DEFAULT_SENTENCES_PER_PAGE;

  const totalPages = Math.max(1, Math.ceil(totalSentences / sentencesPerPage) || 1);

  const rawPageParam = parseInt(searchParams.get('page') ?? '1', 10);
  const normalizedPage = Number.isNaN(rawPageParam) ? 1 : rawPageParam;
  const currentPage = Math.min(Math.max(normalizedPage, 1), totalPages);

  const pageStartIndex = (currentPage - 1) * sentencesPerPage;
  const showingFrom = totalSentences === 0 ? 0 : pageStartIndex + 1;
  const showingTo =
    totalSentences === 0 ? 0 : Math.min(pageStartIndex + sentencesPerPage, totalSentences);

  const paginatedSentences = useMemo(
    () => sentences.slice(pageStartIndex, pageStartIndex + sentencesPerPage),
    [sentences, pageStartIndex, sentencesPerPage],
  );

  const maxRecordingSeconds = Math.floor(MAX_RECORDING_DURATION_MS / 1000);
  const defaultCourseDescription = `逐句練習：點擊播放聽一次，再點錄音模仿。每個句子可以錄製 3 次，每次最多 ${maxRecordingSeconds} 秒。`;

  const fetchCustomCourseData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[fetchCustomCourseData] Fetching data for course:', selectedCourseId);

      const [detailsResponse, statusResponse] = await Promise.all([
        fetch(`/api/courses/${selectedCourseId}/details`),
        fetch(`/api/courses/${selectedCourseId}/status`),
      ]);

      console.log('[fetchCustomCourseData] Response status:', {
        details: detailsResponse.status,
        status: statusResponse.status,
      });

      if (detailsResponse.ok && statusResponse.ok) {
        const detailsData = await detailsResponse.json();
        const statusData = await statusResponse.json();

        console.log('[fetchCustomCourseData] Data received:', {
          detailsSuccess: detailsData.success,
          statusSuccess: statusData.success,
          courseStatus: statusData.status,
          sentencesCount: statusData.sentences?.length,
        });

        if (detailsData.success && statusData.success && statusData.status === 'completed') {
          setCustomCourseData({
            id: selectedCourseId,
            title: detailsData.course.title,
            description:
              detailsData.course.description ||
              `您的自訂影子跟讀課程，包含 ${statusData.sentences?.length || 0} 個句子。`,
          });

          interface CourseSentenceApi {
            sentenceId: number;
            text: string;
            audioUrl?: string;
          }

          const practiceFormat: PracticeSentence[] =
            (statusData.sentences as CourseSentenceApi[] | undefined)?.map((sentence) => ({
              id: sentence.sentenceId,
              text: sentence.text,
              translation: '',
              audioSrc: sentence.audioUrl || '',
            })) || [];

          setCustomSentences(practiceFormat);
          console.log('[fetchCustomCourseData] Course data loaded successfully');
        } else {
          console.error('[fetchCustomCourseData] Course not ready:', {
            detailsSuccess: detailsData.success,
            statusSuccess: statusData.success,
            status: statusData.status,
          });
          // 使用 router 而不是 window.location.href
          router.push('/dashboard/course');
        }
      } else {
        console.error('[fetchCustomCourseData] API request failed:', {
          detailsStatus: detailsResponse.status,
          statusStatus: statusResponse.status,
        });

        // 嘗試讀取錯誤訊息
        try {
          const detailsError = await detailsResponse.json();
          const statusError = await statusResponse.json();
          console.error('[fetchCustomCourseData] Error details:', { detailsError, statusError });
        } catch (e) {
          // 忽略 JSON 解析錯誤
        }

        router.push('/dashboard/course');
      }
    } catch (error) {
      console.error('[fetchCustomCourseData] Exception:', error);
      router.push('/dashboard/course');
    } finally {
      setLoading(false);
      console.log('[fetchCustomCourseData] Loading set to false');
    }
  }, [selectedCourseId, router]);

  // custom 課程：去打 /api/courses/:id/details + /status
  useEffect(() => {
    if (isCustomCourse && selectedCourseId) {
      fetchCustomCourseData();
    } else if (!isCustomCourse) {
      // 如果不是自訂課程，確保 loading 設為 false
      setLoading(false);
    }
  }, [isCustomCourse, selectedCourseId, fetchCustomCourseData]);

  // 分頁參數寫回網址 ?page=&perPage=
  const updateQueryParams = useCallback((updates: { page?: number; perPage?: number }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.page !== undefined) {
      if (updates.page <= 1) {
        params.delete('page');
      } else {
        params.set('page', updates.page.toString());
      }
    }

    if (updates.perPage !== undefined) {
      if (updates.perPage === DEFAULT_SENTENCES_PER_PAGE) {
        params.delete('perPage');
      } else {
        params.set('perPage', updates.perPage.toString());
      }
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // 保持網址上的 page/perPage 跟現在 state 同步
  useEffect(() => {
    const updates: { page?: number; perPage?: number } = {};

    const pageParamInUrl = searchParams.get('page');
    const desiredPageParam = currentPage === 1 ? null : currentPage.toString();
    if (pageParamInUrl !== desiredPageParam) {
      updates.page = currentPage;
    }

    const perPageParamInUrl = searchParams.get('perPage');
    const desiredPerPageParam =
      sentencesPerPage === DEFAULT_SENTENCES_PER_PAGE ? null : sentencesPerPage.toString();
    if (perPageParamInUrl !== desiredPerPageParam) {
      updates.perPage = sentencesPerPage;
    }

    if (Object.keys(updates).length > 0) {
      updateQueryParams(updates);
    }
  }, [currentPage, sentencesPerPage, searchParams, updateQueryParams]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const clampedPage = Math.min(Math.max(nextPage, 1), totalPages);
      updateQueryParams({ page: clampedPage });
    },
    [totalPages, updateQueryParams],
  );

  const handlePageSizeChange = useCallback(
    (nextSize: number) => {
      const safeSize = SENTENCES_PER_PAGE_OPTIONS.includes(nextSize)
        ? nextSize
        : DEFAULT_SENTENCES_PER_PAGE;
      updateQueryParams({ perPage: safeSize, page: 1 });
    },
    [updateQueryParams],
  );


  useEffect(() => {
    Object.values(mediaRecordersRef.current).forEach(recorder => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    });
    Object.values(cleanupFunctionsRef.current).forEach(cleanup => cleanup());

    // Stop any currently playing audio when switching courses
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    mediaRecordersRef.current = {};
    cleanupFunctionsRef.current = {};
    setRecordingStates({});
    setPlayedSentences(new Set<number>());
  }, [isCustomCourse ? selectedCourseId : courseId]);

  // Initialize recording state for a sentence slot
  const initializeRecordingState = useCallback((): RecordingState => {
    return {
      isRecording: false,
      audioBlob: null,
      duration: 0,
      audioUrl: null,
      isUploading: false,
      isDeleting: false,
      error: null,
      fileSize: null,
      recordingId: null,
    };
  }, []);

  // Update recording state for a specific sentence and slot
  const updateRecordingState = useCallback((sentenceId: number, slotIndex: number, updates: Partial<RecordingState>) => {
    // console.log('updateRecordingState called:', { sentenceId, slotIndex, updates });
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
      // console.log('New recording state:', newState);
      return newState;
    });
  }, [initializeRecordingState]);

  // Load existing recordings and ratings on mount
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
        // console.log('Loaded recordings:', data);
        if (data.success && data.recordings && data.recordings.length > 0) {
          // Set existing recordings to state
          data.recordings.forEach((rec: {
            id: string;
            courseId: string;
            sentenceId: number;
            slotIndex: number;
            audioUrl: string;
            duration: number;
            fileSize: number;
            createdAt: string;
          }) => {
            if (rec.courseId !== (isCustomCourse ? selectedCourseId : courseId)) return;
            updateRecordingState(rec.sentenceId, rec.slotIndex, {
              audioBlob: null, // We don't have the blob, but we have the URL
              audioUrl: rec.audioUrl,
              duration: rec.duration,
              isRecording: false,
              isUploading: false,
              isDeleting: false,
              error: null,
              fileSize: rec.fileSize ?? null,
              recordingId: rec.id,
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
    // Note: Ratings functionality removed for application mode

    return () => {
      controller.abort();
    };
  }, [sessionStatus, updateRecordingState, isCustomCourse ? selectedCourseId : courseId]);

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

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

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

    // Stop any currently playing audio to prevent overlapping
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    // Immediately mark sentence as played when user clicks play button
    setPlayedSentences(prev => new Set(prev).add(sentence.id));

    // Play the actual audio file
    if (sentence.audioSrc) {
      const audio = new Audio(sentence.audioSrc);
      currentAudioRef.current = audio;

      // Clear ref when audio finishes or encounters an error
      audio.onended = () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      };

      audio.onerror = () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      };

      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      });
    }
  };

  // Handle recording start for a specific slot
  const handleStartRecording = useCallback(async (sentenceId: number, slotIndex: number) => {
    // console.log('handleStartRecording called:', { sentenceId, slotIndex, playedSentences: Array.from(playedSentences) });
    
    // Check if the sentence has been played first
    if (!playedSentences.has(sentenceId)) {
      // console.log('Sentence not played yet, showing warning');
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
      // console.log('Starting recording process...');

      // Update state to recording
      updateRecordingState(sentenceId, slotIndex, {
        isRecording: true,
        error: null,
        duration: 0,
        isDeleting: false,
      });

      // console.log('Requesting microphone access...');
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
          // Ignore constraint errors; fall back to original track settings
        });
      }
      
      // console.log('Microphone access granted, creating MediaRecorder...');

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
          // console.log('Using MIME type:', selectedMimeType);
          break;
        }
      }
      
      if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
        console.error('No supported MIME type found');
        throw new Error('Browser does not support any audio recording format');
      }

      // Create MediaRecorder
      // console.log('Creating MediaRecorder with mimeType:', selectedMimeType);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });
      
      // console.log('MediaRecorder created successfully, state:', mediaRecorder.state);

      const chunks: Blob[] = [];
      const startTime = Date.now();

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        // console.log('Data available event:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        // console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const recordingDuration = Date.now() - startTime;

        // console.log('Audio blob created:', audioBlob.size, 'bytes');

        updateRecordingState(sentenceId, slotIndex, {
          isRecording: false,
          audioBlob,
          audioUrl,
          duration: recordingDuration,
          fileSize: audioBlob.size,
          isDeleting: false,
        });

        // Call cleanup function
        const cleanup = cleanupFunctionsRef.current[recorderKey];
        if (cleanup) {
          cleanup();
        }

        // console.log('Recording completed successfully');
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        updateRecordingState(sentenceId, slotIndex, {
          error: 'RECORDING_ERROR',
          isRecording: false,
          isDeleting: false,
        });
        
        // Call cleanup function
        const cleanup = cleanupFunctionsRef.current[recorderKey];
        if (cleanup) {
          cleanup();
        }
      };

      // Start recording
      // console.log('Starting MediaRecorder...');
      mediaRecorder.start(100);
      // console.log('MediaRecorder started, state:', mediaRecorder.state);
      
      // Store MediaRecorder reference using ref
      const recorderKey = `${sentenceId}-${slotIndex}`;
      // console.log('Storing MediaRecorder with key:', recorderKey);
      mediaRecordersRef.current[recorderKey] = mediaRecorder;
      
      // Update duration every 100ms
      const durationInterval = setInterval(() => {
        const currentDuration = Date.now() - startTime;
        updateRecordingState(sentenceId, slotIndex, {
          duration: currentDuration,
        });
      }, 100);

      // Auto-stop after configured duration
      const autoStopTimeout = setTimeout(() => {
        // console.log('Auto-stop timeout reached, stopping recording...');
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
        clearInterval(durationInterval);
      }, MAX_RECORDING_DURATION_MS);

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

      // console.log('Recording setup completed successfully');

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
    
    // console.log('handleStopRecording called:', { sentenceId, slotIndex, recorderKey, mediaRecorderState: mediaRecorder?.state });
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // console.log('Stopping MediaRecorder...');
      // Stop the MediaRecorder
      mediaRecorder.stop();
      
      // Call cleanup function
      const cleanup = cleanupFunctionsRef.current[recorderKey];
      if (cleanup) {
        cleanup();
      }
    } else {
      // console.log('No active MediaRecorder found or not in recording state');
    }
  }, []);

  // Handle audio playback for a specific slot
  const handlePlayRecording = useCallback(async (sentenceId: number, slotIndex: number) => {
    const recordingState = getRecordingState(sentenceId, slotIndex);
    if (!recordingState.audioUrl) return;

    // Stop any currently playing audio to prevent overlapping
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    const audio = new Audio(recordingState.audioUrl);
    currentAudioRef.current = audio;

    // Clear ref when audio finishes or encounters an error
    audio.onended = () => {
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
    };

    audio.onerror = () => {
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
    };

    audio.play().catch(error => {
      console.error('Failed to play audio:', error);
      updateRecordingState(sentenceId, slotIndex, { error: 'PLAYBACK_ERROR' });
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
    });
  }, [getRecordingState, updateRecordingState]);

  // Handle AI scoring
  const handleStartScoring = useCallback(async (sentenceId: number, slotIndex: number) => {
    const recordingState = getRecordingState(sentenceId, slotIndex);
    const sentence = sentences.find(s => s.id === sentenceId);

    if (!recordingState.audioUrl || !recordingState.recordingId) {
      console.error("User recording not found or not uploaded.");
      updateRecordingState(sentenceId, slotIndex, { error: 'RECORDING_MISSING' });
      return;
    }
    if (!sentence || !sentence.audioSrc) {
      console.error("Reference sentence or audio source not found.");
      updateRecordingState(sentenceId, slotIndex, { error: 'REFERENCE_AUDIO_MISSING' });
      return;
    }

    try {
      // Set scoring state
      updateRecordingState(sentenceId, slotIndex, {
        isScoring: true,
        score: null,
        error: null,
      });

      // 1. Fetch audio data for both reference and test recordings
      const [refResponse, testResponse] = await Promise.all([
        fetch(sentence.audioSrc),
        fetch(recordingState.audioUrl)
      ]);

      if (!refResponse.ok || !testResponse.ok) {
        throw new Error('Failed to fetch audio files for scoring.');
      }

      const [refBlob, testBlob] = await Promise.all([
        refResponse.blob(),
        testResponse.blob()
      ]);

      // 2. Create FormData and append files
      const formData = new FormData();
      formData.append('reference_audio', refBlob, 'reference.wav');
      formData.append('test_audio', testBlob, 'test.wav');

      // 3. Call the backend API via the Next.js proxy
      const apiResponse = await fetch('/api/worker/audio/score', {
        method: 'POST',
        body: formData,
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('AI scoring API failed:', errorText);
        throw new Error(`API Error: ${apiResponse.statusText}`);
      }

      const result = await apiResponse.json();

      if (result.success && result.scores) {
        // 4. Process scores and calculate a final score (0-5)
        const { PER, PPG, GOP, WER } = result.scores;
        // Simple average of key metrics, scaled to 5.
        const avgScore = (PER + PPG + GOP + WER) / 4;
        const finalScore = Math.round(avgScore * 5);

        updateRecordingState(sentenceId, slotIndex, {
          isScoring: false,
          score: finalScore,
        });
        console.log(`[AI Scoring] Sentence ${sentenceId}, Slot ${slotIndex}: ${finalScore}/5`, result.scores);
      } else {
        throw new Error(result.error || 'Scoring failed, invalid response from server.');
      }

    } catch (error) {
      console.error('AI scoring failed:', error);
      updateRecordingState(sentenceId, slotIndex, {
        isScoring: false,
        error: 'SCORING_ERROR',
      });
    }
  }, [getRecordingState, updateRecordingState, sentences]);

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
        isDeleting: false,
      });

      const formData = new FormData();
      formData.append('audio', recordingState.audioBlob, 'recording.webm');
      formData.append('courseId', isCustomCourse ? selectedCourseId : courseId);
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
      // console.log('Upload successful:', result);

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
        isDeleting: false,
        recordingId: typeof result?.recordingId === 'string'
          ? result.recordingId
          : recordingState.recordingId,
      });
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'UPLOAD_ERROR';
      updateRecordingState(sentenceId, slotIndex, {
        isUploading: false,
        error: errorMessage,
        isDeleting: false,
      });
    }
  }, [isCustomCourse ? selectedCourseId : courseId, getRecordingState, updateRecordingState, sessionStatus]);

  const handleDeleteRecording = useCallback(async (sentenceId: number, slotIndex: number) => {
    const recordingState = getRecordingState(sentenceId, slotIndex);

    if (recordingState.isDeleting) {
      return;
    }

    if (!recordingState.recordingId) {
      if (recordingState.audioUrl && recordingState.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(recordingState.audioUrl);
      }
      updateRecordingState(sentenceId, slotIndex, {
        isRecording: false,
        audioBlob: null,
        audioUrl: null,
        duration: 0,
        isUploading: false,
        isDeleting: false,
        error: null,
        fileSize: null,
        recordingId: null,
        score: null,
        isScoring: false,
      });
      return;
    }

    if (sessionStatus !== 'authenticated') {
      updateRecordingState(sentenceId, slotIndex, {
        error: 'NOT_AUTHENTICATED',
      });
      return;
    }

    try {
      updateRecordingState(sentenceId, slotIndex, {
        isDeleting: true,
        error: null,
      });

      const response = await fetch('/api/audio/recordings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          recordingId: recordingState.recordingId,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const errorCode = response.status === 401 ? 'NOT_AUTHENTICATED' : (errorPayload.error || 'DELETE_FAILED');
        throw new Error(typeof errorCode === 'string' ? errorCode : 'DELETE_FAILED');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'DELETE_FAILED');
      }

      if (recordingState.audioUrl && recordingState.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(recordingState.audioUrl);
      }

      updateRecordingState(sentenceId, slotIndex, {
        isRecording: false,
        audioBlob: null,
        audioUrl: null,
        duration: 0,
        isUploading: false,
        isDeleting: false,
        error: null,
        fileSize: null,
        recordingId: null,
        score: null,
        isScoring: false,
      });
    } catch (error) {
      console.error('Delete recording failed:', error);
      const errorCode = error instanceof Error ? error.message : 'DELETE_FAILED';
      updateRecordingState(sentenceId, slotIndex, {
        isDeleting: false,
        error: errorCode,
      });
    }
  }, [getRecordingState, sessionStatus, updateRecordingState]);

  // Show loading state for custom courses
  if (loading && isCustomCourse) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-12">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">載入自訂課程中...</span>
        </div>
      </div>
    );
  }

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
          {currentCourse?.description ?? defaultCourseDescription}
        </p>
      </header>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">使用說明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 點擊「播放原音」聆聽標準發音</li>
          <li>• 每個句子最多錄製 {maxRecordingSeconds} 秒</li>
          <li>• 點擊圓形按鈕開始錄音，再點擊停止錄音</li>
          <li>• 圓形按鈕背景動畫顯示剩餘時間</li>
          <li>• 錄音完成後可以立即播放聽取</li>
          <li className="font-semibold text-blue-900">• ⚠️ 錄音完成後記得按「上傳」按鈕才會儲存到系統</li>
          <li className="font-semibold text-green-800">• 🎯 上傳後點擊「開始 AI 評分」獲取發音評分</li>
        </ul>
      </div>

      <section className="space-y-6">
        <SentencePaginationControls
          idSuffix="top"
          currentPage={currentPage}
          totalPages={totalPages}
          perPage={sentencesPerPage}
          perPageOptions={SENTENCES_PER_PAGE_OPTIONS}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          showingFrom={showingFrom}
          showingTo={showingTo}
          totalItems={totalSentences}
        />

        {paginatedSentences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white/70 p-8 text-center text-sm text-gray-500">
            目前沒有可顯示的練習句子。
          </div>
        ) : (
          paginatedSentences.map((sentence) => {
            const hasAnyRecording = [0, 1, 2].some(slotIndex => {
              const state = getRecordingState(sentence.id, slotIndex);
              return Boolean(state.audioBlob || state.audioUrl);
            });

            return (
              <article
                key={sentence.id}
                className="rounded-xl border bg-white p-6 shadow-sm transition hover:border-[#476EAE]/30"
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
                    {sentence.audioSrc && (
                      <button
                        type="button"
                        onClick={() => handlePlay(sentence)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#476EAE] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#5A85C9]"
                      >
                        <PlayIcon className="h-5 w-5" /> 播放原音
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Recording Section - Single recording button */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-medium text-gray-900">錄音練習</h3>
                  {hasAnyRecording && (
                    <span className="text-xs text-[#476EAE] bg-[#476EAE]/10 px-2 py-1 rounded-full font-medium">
                      ✓ 已錄音
                    </span>
                  )}
                </div>

                {/* Single Recording Button */}
                <div className="flex flex-col items-center gap-4">
                  {(() => {
                    const slotIndex = 0; // Use only slot 0 for single recording
                    const recordingState = getRecordingState(sentence.id, slotIndex);
                    const hasUploaded = recordingState.audioUrl && !recordingState.audioBlob;

                    return (
                      <>
                        <RecordingButton
                          slotIndex={slotIndex}
                          sentenceId={sentence.id}
                          recordingState={recordingState}
                          onStartRecording={() => handleStartRecording(sentence.id, slotIndex)}
                          onStopRecording={() => handleStopRecording(sentence.id, slotIndex)}
                          onPlayRecording={() => handlePlayRecording(sentence.id, slotIndex)}
                          onUploadRecording={() => handleUploadRecording(sentence.id, slotIndex)}
                          onDeleteRecording={() => handleDeleteRecording(sentence.id, slotIndex)}
                          hasPlayedOriginal={playedSentences.has(sentence.id)}
                        />

                        {/* AI Scoring Button - shown after recording is uploaded */}
                        {hasUploaded && (
                          <button
                            type="button"
                            onClick={() => handleStartScoring(sentence.id, slotIndex)}
                            disabled={recordingState.isScoring}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {recordingState.isScoring ? (
                              <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                評分中...
                              </>
                            ) : (
                              <>
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                </svg>
                                開始 AI 評分
                              </>
                            )}
                          </button>
                        )}

                        {/* Score Display */}
                        {recordingState.score !== null && recordingState.score !== undefined && (
                          <div className="w-full max-w-md p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl">
                            <div className="text-center">
                              <p className="text-sm text-gray-600 mb-2">AI 評分結果</p>
                              <div className="flex items-center justify-center gap-3">
                                <div className="text-5xl font-bold text-blue-600">
                                  {recordingState.score}
                                </div>
                                <div className="text-2xl text-gray-400">/</div>
                                <div className="text-3xl font-semibold text-gray-600">5</div>
                              </div>
                              <p className="text-xs text-gray-500 mt-3">
                                {recordingState.score >= 4 ? '🌟 優秀！' :
                                 recordingState.score >= 3 ? '👍 良好！' :
                                 recordingState.score >= 2 ? '💪 不錯，繼續加油！' :
                                 '📚 多練習會更好！'}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              </article>
            );
          })
        )}

        {totalPages > 1 && paginatedSentences.length > 0 && (
          <SentencePaginationControls
            idSuffix="bottom"
            currentPage={currentPage}
            totalPages={totalPages}
            perPage={sentencesPerPage}
            perPageOptions={SENTENCES_PER_PAGE_OPTIONS}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            showingFrom={showingFrom}
            showingTo={showingTo}
            totalItems={totalSentences}
            className="mt-2"
          />
        )}
      </section>
    </div>
  );
}

type SentencePaginationControlsProps = {
  idSuffix: string;
  currentPage: number;
  totalPages: number;
  perPage: number;
  perPageOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  showingFrom: number;
  showingTo: number;
  totalItems: number;
  className?: string;
};

function SentencePaginationControls({
  idSuffix,
  currentPage,
  totalPages,
  perPage,
  perPageOptions,
  onPageChange,
  onPageSizeChange,
  showingFrom,
  showingTo,
  totalItems,
  className = '',
}: SentencePaginationControlsProps) {
  const selectId = `sentences-per-page-${idSuffix}`;
  const disablePrev = currentPage <= 1 || totalItems === 0;
  const disableNext = currentPage >= totalPages || totalItems === 0;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white/80 px-4 py-3 text-sm shadow-sm ${className}`}
    >
      <div>
        <p className="text-xs text-gray-500">目前顯示</p>
        <p className="text-sm font-semibold text-gray-900">
          {totalItems === 0 ? '尚無句子' : `${showingFrom} - ${showingTo} / ${totalItems} 句`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={selectId} className="text-sm text-gray-600">
          每頁顯示
        </label>
        <select
          id={selectId}
          value={perPage}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#476EAE] focus:outline-none focus:ring-2 focus:ring-[#476EAE]/20"
        >
          {perPageOptions.map((option) => (
            <option key={option} value={option}>
              {option} 句
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disablePrev}
          className={`rounded-lg border px-3 py-1.5 font-medium transition ${
            disablePrev
              ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
              : 'border-[#476EAE]/40 bg-white text-[#476EAE] hover:bg-[#476EAE]/10'
          }`}
        >
          上一頁
        </button>
        <span className="text-sm text-gray-600">
          第 {totalItems === 0 ? 0 : currentPage} / {totalPages} 頁
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disableNext}
          className={`rounded-lg border px-3 py-1.5 font-medium transition ${
            disableNext
              ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
              : 'border-[#476EAE]/40 bg-white text-[#476EAE] hover:bg-[#476EAE]/10'
          }`}
        >
          下一頁
        </button>
      </div>
    </div>
  );
}
