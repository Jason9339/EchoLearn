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
