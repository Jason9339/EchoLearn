'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import { PlayIcon, MicrophoneIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { courses, defaultPracticeCourseId, practiceSentences } from '@/app/lib/placeholder-data';
import type { PracticeSentence } from '@/app/lib/definitions';

const courseId = defaultPracticeCourseId;
const fallbackCourseTitle = '口說練習';

export default function PracticePage() {
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentCourse = courses.find((course) => course.id === courseId);
  const sentences: PracticeSentence[] = practiceSentences[courseId] ?? [];

  const handlePlay = (sentence: PracticeSentence) => {
    if (typeof window === 'undefined') return;

    if (sentence.audioSrc && audioRef.current) {
      audioRef.current.src = sentence.audioSrc;
      console.log(audioRef.current.src);
      audioRef.current.play();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sentence.text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRecordToggle = (id: number) => {
    setRecordingId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:py-12">
      <audio ref={audioRef} />
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
          {currentCourse?.description ?? '逐句練習：點擊播放聽一次，再點錄音模仿。'}。
        </p>
      </header>

      <section className="space-y-4">
        {sentences.map((sentence) => {
          const isRecording = recordingId === sentence.id;

          return (
            <article
              key={sentence.id}
              className="rounded-xl border bg-white p-5 shadow-sm transition hover:border-sky-200"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl space-y-2">
                  <p className="text-base font-medium text-gray-900">{sentence.text}</p>
                  <p className="text-sm text-gray-500">{sentence.translation}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePlay(sentence)}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                  >
                    <PlayIcon className="h-5 w-5" /> 播放
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecordToggle(sentence.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      isRecording
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <MicrophoneIcon className="h-5 w-5" /> {isRecording ? '停止錄音' : '錄音'}
                  </button>
                </div>
              </div>
              {isRecording && (
                <p className="mt-3 text-xs text-rose-600">
                  目前為錄音示意狀態。串接真實錄音功能後會自動儲存使用者語音。
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
