import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-sky-50 text-gray-800 p-8">
      {/* Logo / 專案名稱 */}
      <h1 className="text-4xl font-bold text-sky-700 mb-4 tracking-tight">
        EchoLearn
      </h1>
      

      {/* 登入按鈕 */}
      <Link
        href="/login"
        className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold px-8 py-3 transition-colors"
      >
        Log In
      </Link>

      {/* Footer */}
      <footer className="absolute bottom-4 text-sm text-gray-400">
        © {new Date().getFullYear()} EchoLearn · All rights reserved
      </footer>
    </main>
  );
}
