"use client";

import { useState, useEffect } from "react";
import TutorialStepper, { TutorialStep } from "@/components/TutorialStepper";
import {
  BookOpenIcon,
  PlayIcon,
  MicrophoneIcon,
  CloudArrowUpIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export default function Page() {
  const [courseTutorialImages, setCourseTutorialImages] = useState<string[]>([]);
  const [recordingTutorialImages, setRecordingTutorialImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch("/api/tutorial-images");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setCourseTutorialImages(data.courseTutorialImages);
        setRecordingTutorialImages(data.recordingTutorialImages);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  const tutorialSteps: TutorialStep[] = [
    {
      id: "intro",
      title: "歡迎使用 EchoLearn",
      description:
        "EchoLearn 是一個語音練習平台，透過「影子跟讀」的方式幫助您練習語言發音。聆聽標準發音，錄製您的聲音，AI 會即時給您評分回饋。",
      details: [
        "支援多種語言的發音練習",
        "AI 自動評分",
        "可上傳自己的音檔建立課程",
      ],
      icon: (
        <svg className="w-6 h-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      highlight: "快速上手",
    },
    {
      id: "select-course",
      title: "步驟一：選擇課程",
      description:
        "點擊左側選單的「Course」進入課程頁面。您可以選擇官方課程，或上傳自己的音檔建立自訂課程。選好課程後，點擊「開始練習」進入練習頁面。",
      details: [
        "官方課程：預設的標準發音練習",
        "自訂課程：上傳 MP3 或影片，系統自動切分句子",
        "每個課程包含多個練習句子",
      ],
      images: courseTutorialImages,
      icon: <BookOpenIcon className="w-6 h-6 text-sky-600" />,
    },
    {
      id: "listen",
      title: "步驟二：聆聽原音",
      description:
        "進入練習頁面後，每個句子旁邊都有「播放原音」按鈕。請先點擊聆聽標準發音，熟悉語調和節奏後再開始錄音。",
      details: [
        "可以重複播放，直到熟悉為止",
        "注意語調、節奏和發音細節",
        "必須先播放原音，才能開始錄音",
      ],
      images: recordingTutorialImages.slice(0, 1),
      icon: <PlayIcon className="w-6 h-6 text-sky-600" />,
    },
    {
      id: "record",
      title: "步驟三：錄製練習",
      description:
        "點擊紅色麥克風按鈕開始錄音。瀏覽器會請求麥克風權限，請點擊「允許」。跟著原音模仿發音，錄完後再次點擊按鈕停止。",
      details: [
        "每個句子錄製一次，每次最多 15 秒",
        "圓形按鈕會顯示錄音倒數計時",
        "錄完後可以播放確認效果",
        "不滿意可以重新錄製",
      ],
      images: recordingTutorialImages.slice(1, 3),
      icon: <MicrophoneIcon className="w-6 h-6 text-sky-600" />,
      highlight: "重要步驟",
    },
    {
      id: "upload",
      title: "步驟四：上傳錄音",
      description:
        "錄音完成後，請點擊「上傳錄音」按鈕將錄音儲存到系統。上傳成功後，錄音區塊會顯示綠色的「上傳完成」狀態。",
      details: [
        "未上傳的錄音不會被儲存",
        "上傳成功後才能請 AI 評分",
        "可以刪除後重新錄製",
      ],
      images: recordingTutorialImages.slice(3),
      icon: <CloudArrowUpIcon className="w-6 h-6 text-sky-600" />,
    },
    {
      id: "ai-score",
      title: "步驟五：AI 評分",
      description:
        "上傳成功後，點擊「開始 AI 評分」按鈕。AI 會分析您的錄音與原音的相似度，並給予 1-5 分的評分。",
      details: [
        "音素相似度 (PER)：發音的音素是否正確",
        "聲學特徵 (PPG)：整體音色和發音品質",
        "發音質量 (GOP)：每個音素的發音準確度",
        "語調相似度 (GPE)：音高變化是否與原音一致",
        "節奏相似度 (FFE/Energy)：語速和音量變化",
        "發聲特性 (VDE)：濁音/清音的判斷正確性",
      ],
      icon: <SparklesIcon className="w-6 h-6 text-sky-600" />,
      highlight: "AI 驅動",
    },
    {
      id: "tips",
      title: "練習小技巧",
      description:
        "掌握以下技巧，讓您的練習更有效率！",
      details: [
        "找一個安靜的環境錄音，減少背景噪音",
        "多聽幾次原音再開始錄製",
        "注意語調和節奏，不只是發音正確",
        "根據 AI 評分的回饋，針對弱點反覆練習",
        "每天練習一點，效果比一次練很久更好",
      ],
      icon: (
        <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500">載入教學內容中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">載入教學圖片失敗: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">使用教學</h1>
        <p className="text-gray-600">
          跟著步驟學習如何使用 EchoLearn 練習發音
        </p>
      </div>

      <TutorialStepper steps={tutorialSteps} />

      {/* Quick Start Card */}
      <div className="mt-8 bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">準備好開始練習了嗎？</h3>
            <p className="text-sky-100">選擇一個課程，開始您的發音練習之旅！</p>
          </div>
          <a
            href="/dashboard/course"
            className="flex-shrink-0 inline-flex items-center gap-2 bg-white text-sky-600 px-5 py-3 rounded-xl font-semibold hover:bg-sky-50 transition-colors"
          >
            前往課程
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
