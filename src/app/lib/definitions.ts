export type CourseId = string;

export type Course = {
  id: CourseId;
  title: string;
  description: string;
  actionLabel?: string;
  practicePath?: string;
};

export type PracticeSentence = {
  id: number;
  text: string;
  translation: string;
  audioSrc?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  student_id?: string;
  gender?: string;
  age?: number;
  consent?: boolean;
};

// User-created course types
export type UserCourse = {
  id: string;
  userId: string;
  title: string;
  description: string;
  maxSentences: number;
  introSkipSeconds?: number;
  status: 'processing' | 'completed' | 'failed';
  originalAudioUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type CourseSentence = {
  id: string;
  courseId: string;
  sentenceId: number;
  text: string;
  audioUrl?: string;
  startTime?: number;
  endTime?: number;
  createdAt: string;
};

export type AudioProcessingJob = {
  id: string;
  userId: string;
  courseId: string;
  audioUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

// API Request/Response types
export type CreateCourseRequest = {
  tempId: string;
  title: string;
  description: string;
  maxSentences: number;
  introSkipSeconds?: number;
};

export type CreateCourseResponse = {
  success: boolean;
  courseId?: string;
  jobId?: string;
  error?: string;
};

export type CourseStatusResponse = {
  success: boolean;
  status?: 'processing' | 'completed' | 'failed';
  progress?: number;
  errorMessage?: string;
  processingMessage?: string;
  sentences?: CourseSentence[];
  error?: string;
};

export type UploadAudioResponse = {
  success: boolean;
  tempId?: string;
  audioUrl?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
};