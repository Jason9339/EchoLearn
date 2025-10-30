"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Carousel from "@/components/Carousel";

export default function Page() {
  const [courseTutorialImages, setCourseTutorialImages] = useState<string[]>([]);
  const [recordingTutorialImages, setRecordingTutorialImages] = useState<string[]>([]);
  const [peerReviewTutorialImages, setPeerReviewTutorialImages] = useState<string[]>([]);
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
        setPeerReviewTutorialImages(data.peerReviewTutorialImages);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-gray-600">
        載入教學圖片中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-red-600">
        載入教學圖片失敗: {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard</h1>
      <p className="text-lg text-gray-700 mb-8">
        歡迎來到 EchoLearn！以下是詳細的錄音與評分教學，幫助您快速上手。
      </p>

      <div className="space-y-8 text-gray-700">
        <div>
          <h3 className="text-xl font-semibold mb-3 text-sky-700">
            🎯 我們的目標
          </h3>
          <p>
            歡迎您！為了打造更強大的語言學習模型，我們需要搜集大量的語音樣本及其評分。您的每一次錄音，都是對這個專案最直接的貢獻。
          </p>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 text-sky-700">
            🗺️ 網頁操作教學
          </h3>
          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-lg mb-2">
                步驟一：從 Dashboard 前往課程
              </h4>
              <p className="mb-3">
                登入後，您會看見 Dashboard。請在左側的導覽列中選擇一個您想參加的{" "}
                <span className="font-semibold text-sky-600">Course</span>
                ，並點擊進入{" "}
                <span className="font-semibold text-sky-600">Practice</span>{" "}
                頁面開始錄音。
              </p>
              <div className="bg-gray-100 p-3 rounded-lg flex justify-center">
                {courseTutorialImages.length > 0 ? (
                  <Carousel images={courseTutorialImages} altPrefix="進入課程教學" />
                ) : (
                  <div className="text-center text-gray-500">無課程教學圖片</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 text-sky-700">
            🎙️ 錄音操作教學與規則
          </h3>
          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-lg mb-2">錄音步驟</h4>
              <p className="mb-3">
                在 Practice
                頁面，您會看到一個需要朗讀的句子。點擊「播放原音」聆聽標準發音，然後點擊「麥克風」按鈕開始錄音。在瀏覽器跳出授權請求時，請點擊「允許」。授權後錄音將自動開始，念完後再次點擊按鈕即可結束。
              </p>
              <div className="bg-gray-100 p-3 rounded-lg flex justify-center">
                {recordingTutorialImages.length > 0 ? (
                  <Carousel images={recordingTutorialImages} altPrefix="錄音步驟教學" />
                ) : (
                  <div className="text-center text-gray-500">無錄音步驟教學圖片</div>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-2">錄音規則</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>點擊「播放原音」聆聽標準發音</li>
                <li>每個句子可以錄製 3 次，每次最多約 10-15 秒 (實際秒數依課程設定)</li>
                <li>點擊圓形按鈕開始錄音，再點擊停止錄音</li>
                <li>圓形按鈕背景動畫會顯示剩餘時間</li>
                <li>錄音完成後可以立即播放聽取自己的錄音</li>
                <li>可以重新錄音覆蓋之前的錄音</li>
                <li className="font-semibold text-blue-900">⚠️ 錄音完成後記得按「上傳」按鈕才會儲存到系統！</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3 text-sky-700">
            ⭐ 評分標準與流程
          </h3>
          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-lg mb-2">評分標準</h4>
              <p className="mb-3">
                評分是根據您錄製的音檔與「原始音檔」進行比對。請根據以下四個面向給予 1-5 分的評比：
              </p>
              <ul className="space-y-2 list-disc list-inside bg-sky-50 p-4 rounded-lg">
                <li>
                  <span className="font-bold">語調 (Tone)：</span>
                  是否自然、符合語氣。
                </li>
                <li>
                  <span className="font-bold">語速 (Speed)：</span>
                  是否流暢、與原始音檔速度相符。
                </li>
                <li>
                  <span className="font-bold">咬字 (Articulation)：</span>
                  每個字的發音是否清晰。
                </li>
                <li>
                  <span className="font-bold">發音 (Pronunciation)：</span>
                  單字或音節的發音是否正確。
                </li>
              </ul>
              <p className="mt-3 text-sm text-gray-600">
                <span className="font-bold">評分範例：</span>
                1分 (極差) 到 5分 (極佳)。例如：5分代表發音標準、語調自然、吐字清晰，就像母語人士一樣流暢。
              </p>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-2">評分流程</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <span className="font-bold">自評：</span>
                  在您完成錄音並上傳後，可以在錄音按鈕下方看到評分條。請根據上述標準，為自己的錄音給予評分。
                </li>
                <li>
                  <span className="font-bold">為他人評分 (同儕審核)：</span>
                  您可以前往 Dashboard 中的「同儕審核 (Peer Review)」頁面，聆聽其他使用者的錄音並給予評分。這有助於您提升聽力與辨音能力，同時也幫助其他學習者。
                </li>
              </ul>
              <div className="bg-gray-100 p-3 rounded-lg flex justify-center">
                {peerReviewTutorialImages.length > 0 ? (
                  <Carousel images={peerReviewTutorialImages} altPrefix="同儕審核頁面截圖" />
                ) : (
                  <div className="text-center text-gray-500">無課程教學圖片</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
