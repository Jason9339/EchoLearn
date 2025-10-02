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
};
