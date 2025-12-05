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
const SENTENCES_PER_PAGE_OPTIONS = [10]; // Fixed to 10 sentences per page

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
  const { data: session, status: sessionStatus } = useSession();
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

  // Load existing AI scores from database
  const loadExistingScores = useCallback(async () => {
    if (!session?.user?.id || sessionStatus !== 'authenticated') {
      console.log('[Load Scores] Skipping - user not authenticated');
      return;
    }

    const currentCourseId = isCustomCourse ? selectedCourseId : courseId;

    if (!currentCourseId) {
      console.log('[Load Scores] Skipping - no course ID available yet');
      return;
    }

    try {
      console.log('[Load Scores] Fetching scores for:', {
        userId: session.user.id,
        currentCourseId,
        isCustomCourse,
        selectedCourseId
      });

      const url = `/api/worker/audio/scores?user_id=${encodeURIComponent(session.user.id)}&course_id=${encodeURIComponent(currentCourseId)}`;
      console.log('[Load Scores] Request URL:', url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Load Scores] Failed to fetch scores:', response.status, errorText);
        return;
      }

      const result = await response.json();

      if (result.success && result.scores) {
        console.log('[Load Scores] Loaded scores:', result.scores);

        // Update recording states with loaded scores
        Object.entries(result.scores).forEach(([sentenceIdStr, slots]) => {
          const sentenceId = parseInt(sentenceIdStr);

          Object.entries(slots as Record<string, number>).forEach(([slotIndexStr, score]) => {
            const slotIndex = parseInt(slotIndexStr);

            updateRecordingState(sentenceId, slotIndex, {
              score: score as number,
            });
          });
        });

        console.log('[Load Scores] Scores loaded successfully');
      }
    } catch (error) {
      console.error('[Load Scores] Error loading scores:', error);
    }
  }, [session, sessionStatus, isCustomCourse, selectedCourseId, courseId, updateRecordingState]);

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

    // Load AI scores from database
    loadExistingScores();

    return () => {
      controller.abort();
    };
  }, [sessionStatus, updateRecordingState, loadExistingScores, isCustomCourse, selectedCourseId, courseId]);

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

      // 2. Create FormData and append files and metadata
      const formData = new FormData();
      formData.append('reference_audio', refBlob, 'reference.wav');
      formData.append('test_audio', testBlob, 'test.wav');

      // Add metadata for caching scores in database
      console.log('[AI Scoring] Session check:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id,
        userId: session?.user?.id,
        sessionStatus: sessionStatus
      });

      if (session?.user?.id) {
        const metadata = {
          user_id: session.user.id,
          course_id: isCustomCourse ? selectedCourseId : courseId,
          sentence_id: String(sentenceId),
          slot_index: String(slotIndex),
        };

        console.log('[AI Scoring] Sending metadata:', metadata);

        formData.append('user_id', metadata.user_id);
        formData.append('course_id', metadata.course_id);
        formData.append('sentence_id', metadata.sentence_id);
        formData.append('slot_index', metadata.slot_index);
      } else {
        console.warn('[AI Scoring] No session user ID - scores will not be cached');
        console.warn('[AI Scoring] Please ensure you are logged in');
      }

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

      if (result.success && result.rating !== undefined) {
        // 4. Use the model's predicted rating (1-5, rounded to 1 decimal place)
        const finalScore = Math.round(result.rating * 10) / 10;

        updateRecordingState(sentenceId, slotIndex, {
          isScoring: false,
          score: finalScore,
        });

        // Log whether score was cached or newly computed
        const cacheStatus = result.cached ? '(cached)' : '(computed)';
        console.log(`[AI Scoring] Sentence ${sentenceId}, Slot ${slotIndex}: ${finalScore}/5.0 ${cacheStatus}`);
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
  }, [getRecordingState, updateRecordingState, sentences, session, isCustomCourse, selectedCourseId, courseId]);

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

      // 同時刪除資料庫中的 AI 評分
      if (session?.user?.id) {
        const currentCourseId = isCustomCourse ? selectedCourseId : courseId;
        if (currentCourseId) {
          try {
            await fetch('/api/worker/audio/score', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: session.user.id,
                course_id: currentCourseId,
                sentence_id: sentenceId,
                slot_index: slotIndex,
              }),
            });
            console.log('[Delete Score] AI score deleted from database');
          } catch (error) {
            console.error('[Delete Score] Failed to delete AI score:', error);
            // 不中斷流程，即使刪除評分失敗也繼續
          }
        }
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
  }, [getRecordingState, sessionStatus, updateRecordingState, session, isCustomCourse, selectedCourseId, courseId]);

  // Show loading state for custom courses
  if (loading && isCustomCourse) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6 px-4 py-4 sm:py-6 lg:py-8">
          <div className="fixed inset-0 z-40 bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-xl">
              <div className="h-8 w-8 border-2 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm sm:text-base font-medium text-slate-900">
                  載入自訂課程中…
                </p>
                <p className="text-xs sm:text-sm text-slate-500">
                  可能需要幾秒鐘，請稍候。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6 px-4 py-4 sm:py-6 lg:py-8">
      <header className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center justify-center rounded-md bg-slate-100 border border-slate-200 h-9 w-9 shadow-sm shrink-0">
              <span className="text-sm font-bold tracking-tight text-sky-600">
                SP
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {currentCourse?.title ?? fallbackCourseTitle}
                </h1>
                {isCustomCourse && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[0.7rem] font-medium text-slate-600">
                      自訂課程
                    </span>
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-slate-500">
                {currentCourse?.description ?? defaultCourseDescription}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/course"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> 返回課程列表
          </Link>
        </div>
      </header>

      {/* Instructions */}
      <section className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-sky-100 shadow-sm shrink-0">
            <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-sky-900">
              使用說明
            </h2>
            <p className="text-sm sm:text-base text-sky-800/80">
              每一句都依照下面步驟來練習：
            </p>
          </div>
        </div>

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mt-1">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-[0.7rem] font-bold text-sky-700">
              1
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm sm:text-base font-medium text-slate-800">
                先聽原音
              </p>
              <p className="text-xs sm:text-sm text-slate-500">
                按下「播放原音」按鈕，熟悉標準發音節奏。
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-[0.7rem] font-bold text-sky-700">
              2
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm sm:text-base font-medium text-slate-800">
                再錄音
              </p>
              <p className="text-xs sm:text-sm text-slate-500">
                按下紅色錄音鍵開始，說完再按一次停止。
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-[0.7rem] font-bold text-sky-700">
              3
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm sm:text-base font-medium text-slate-800">
                最多錄 {maxRecordingSeconds} 秒
              </p>
              <p className="text-xs sm:text-sm text-slate-500">
                倒數結束會自動停止，建議一句話一次就好。
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-[0.7rem] font-bold text-sky-700">
              4
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm sm:text-base font-medium text-slate-800">
                錄完記得上傳
              </p>
              <p className="text-xs sm:text-sm text-slate-500">
                按「上傳錄音」，成功後才能請 AI 幫你評分。
              </p>
            </div>
          </li>
        </ol>
      </section>

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

            const slotIndex = 0;
            const recordingState = getRecordingState(sentence.id, slotIndex);
            const hasUploaded = recordingState.audioUrl && !recordingState.audioBlob;

            return (
              <article
                key={sentence.id}
                className={`rounded-xl border p-4 sm:p-5 flex flex-col gap-4 shadow-sm ${
                  hasUploaded
                    ? 'border-emerald-200 bg-white ring-1 ring-emerald-500/10'
                    : 'border-slate-200 bg-white'
                }`}
              >
              {/* Sentence Content */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] font-bold shrink-0 ${
                    hasUploaded
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {sentence.id}
                  </span>
                  <div className="flex flex-col gap-1 flex-1 min-w-0 max-w-4xl">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">{sentence.text}</h3>
                    {sentence.translation && (
                      <p className="text-sm sm:text-base text-slate-500">{sentence.translation}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-7 sm:ml-0 shrink-0">
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
                        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                      >
                        <PlayIcon className="w-3.5 h-3.5 fill-slate-400 text-slate-400" />
                        播放原音
                      </button>
                    )}
                </div>
              </div>

              {/* Recording Section */}
              <div className={`flex flex-col gap-3 rounded-lg border p-3 sm:p-4 ${
                hasUploaded
                  ? 'border-emerald-100 bg-emerald-50/30'
                  : recordingState.audioBlob
                  ? 'border-amber-100 bg-amber-50'
                  : 'border-slate-200 bg-slate-50/50'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-slate-700">
                      錄音
                    </span>
                    <span className="text-[0.7rem] sm:text-xs text-slate-400">
                      最多 {maxRecordingSeconds} 秒
                    </span>
                  </div>
                  <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    hasUploaded
                      ? 'bg-emerald-50 border border-emerald-100'
                      : recordingState.audioBlob
                      ? 'bg-amber-50 border border-amber-100'
                      : 'bg-slate-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      hasUploaded
                        ? 'bg-emerald-500'
                        : recordingState.audioBlob
                        ? 'bg-amber-500'
                        : 'bg-slate-500'
                    }`}></span>
                    <span className={`text-[0.7rem] font-medium ${
                      hasUploaded
                        ? 'text-emerald-700'
                        : recordingState.audioBlob
                        ? 'text-amber-700'
                        : 'text-slate-600'
                    }`}>
                      {hasUploaded
                        ? '上傳完成，可以請 AI 評分'
                        : recordingState.audioBlob
                        ? '已錄音，尚未上傳'
                        : '尚未錄音'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    showDetails={false}
                  />

                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {/* Play Recording Button */}
                      {(recordingState.audioBlob || recordingState.audioUrl) && !recordingState.isRecording && (
                        <button
                          type="button"
                          onClick={() => handlePlayRecording(sentence.id, slotIndex)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                          播放錄音
                        </button>
                      )}

                      {/* Upload Button */}
                      {recordingState.audioBlob && !hasUploaded && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUploadRecording(sentence.id, slotIndex)}
                            disabled={recordingState.isUploading}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs sm:text-sm font-medium shadow-sm ${
                              recordingState.isUploading
                                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {recordingState.isUploading ? '上傳中...' : '上傳錄音'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecording(sentence.id, slotIndex)}
                            disabled={recordingState.isDeleting || recordingState.isUploading}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            {recordingState.isDeleting ? '刪除中...' : '刪除'}
                          </button>
                        </>
                      )}

                      {/* Re-upload Button */}
                      {hasUploaded && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRecording(sentence.id, slotIndex)}
                          disabled={recordingState.isDeleting}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          重新錄製
                        </button>
                      )}

                      {/* AI Scoring Button */}
                      {hasUploaded && (
                        <button
                          type="button"
                          onClick={() => handleStartScoring(sentence.id, slotIndex)}
                          disabled={recordingState.isScoring}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs sm:text-sm font-medium shadow-sm ${
                            recordingState.isScoring
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                          </svg>
                          {recordingState.isScoring ? '評分中...' : (recordingState.score !== null && recordingState.score !== undefined ? '重新 AI 評分' : '開始 AI 評分')}
                        </button>
                      )}
                    </div>

                    {/* Score Display */}
                    {recordingState.score !== null && recordingState.score !== undefined && (
                      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 border border-emerald-100 shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-emerald-600">
                            {recordingState.score}
                            <span className="text-[0.65rem] text-emerald-400 font-normal">
                              /5
                            </span>
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-xs sm:text-sm font-bold text-emerald-700">
                              AI 評分：{recordingState.score?.toFixed(1)} / 5.0
                            </span>
                            <span className="text-[0.7rem] text-emerald-600">
                              {recordingState.score >= 4 ? '發音清楚，語調自然。' :
                               recordingState.score >= 3 ? '發音不錯，可以更流暢。' :
                               recordingState.score >= 2 ? '繼續練習，會更進步。' :
                               '多聽多練，加油！'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600">
                            {recordingState.score >= 4
                              ? '表現優秀！繼續保持，可以挑戰更難的句子。'
                              : recordingState.score >= 3
                              ? '不錯的表現，再多練習幾次會更好。'
                              : recordingState.score >= 2
                              ? '有進步空間，建議多聽原音並模仿語調。'
                              : '建議多聽幾次原音，注意發音和語調。'
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
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
  currentPage,
  totalPages,
  onPageChange,
  showingFrom,
  showingTo,
  totalItems,
  className = '',
}: SentencePaginationControlsProps) {
  const disablePrev = currentPage <= 1 || totalItems === 0;
  const disableNext = currentPage >= totalPages || totalItems === 0;

  return (
    <section className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base">
        <span className="text-xs sm:text-sm text-slate-600">
          共 {totalItems} 句，目前顯示第 {totalItems === 0 ? 0 : showingFrom}–{showingTo} 句
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm sm:text-base">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={disablePrev}
          className={`inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 shadow-sm ${
            disablePrev
              ? 'text-slate-400 cursor-not-allowed opacity-50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
          aria-label="第一頁"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disablePrev}
          className={`inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 shadow-sm ${
            disablePrev
              ? 'text-slate-400 cursor-not-allowed opacity-50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
          aria-label="上一頁"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
          <span className="text-xs sm:text-sm text-slate-500">
            第
          </span>
          <input
            type="number"
            value={totalItems === 0 ? 0 : currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value, 10);
              if (!isNaN(page) && page >= 1 && page <= totalPages) {
                onPageChange(page);
              }
            }}
            className="w-10 bg-transparent border-0 text-center text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-0 font-medium"
            min="1"
            max={totalPages}
          />
          <span className="text-xs sm:text-sm text-slate-400">
            / {totalPages}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disableNext}
          className={`inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 shadow-sm ${
            disableNext
              ? 'text-slate-400 cursor-not-allowed opacity-50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
          aria-label="下一頁"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={disableNext}
          className={`inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 shadow-sm ${
            disableNext
              ? 'text-slate-400 cursor-not-allowed opacity-50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
          aria-label="最後一頁"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </section>
  );
}
