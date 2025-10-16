import type { Course, PracticeSentence } from '@/app/lib/definitions';

export const courses: Course[] = [
  {
    id: 'shadowing-101-male',
    title: 'Shadowing 101-Male',
    description: '基礎影子跟讀課程，從簡單句子開始。',
    actionLabel: '開始練習',
    practicePath: '/dashboard/course/practice',
  },
  {
    id: 'shadowing-101-female',
    title: 'Shadowing 101-Female',
    description: '基礎影子跟讀課程，從簡單句子開始。',
    actionLabel: '開始練習',
    practicePath: '/dashboard/course/practice',
  },

  {
    id: 'daily-practice',
    title: 'Daily Practice',
    description: '每日口說練習，提升流利度。',
    actionLabel: '開始練習',
    practicePath: '/dashboard/course/practice',
  },
  {
    id: 'advanced-mimic',
    title: 'Advanced Mimic',
    description: '挑戰進階的長篇對話與演講。',
    actionLabel: '開始挑戰',
  },
];

export const practiceSentences: Record<string, PracticeSentence[]> = {
  'shadowing-101': [
    {
      id: 1,
      text: 'Good morning, everyone. Today we will practice shadowing.',
      translation: '各位早安，今天我們要練習影子跟讀。',
    },
    {
      id: 2,
      text: 'Listen carefully and repeat each sentence out loud.',
      translation: '請仔細聆聽，並出聲重複每個句子。',
    },
    {
      id: 3,
      text: 'Try to match the rhythm, intonation, and emotion.',
      translation: '試著模仿節奏、語調以及情緒。',
    },
  ],
  'daily-practice': [
    {
      id: 1,
      text: 'Take a deep breath and relax your shoulders before you speak.',
      translation: '開口前先深呼吸，放鬆肩膀。',
    },
    {
      id: 2,
      text: 'Focus on clarity rather than speed during the first round.',
      translation: '第一輪練習時，專注在清晰度而不是速度。',
    },
  ],
};

export const defaultPracticeCourseId = 'shadowing-101';
