import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-sky-50 text-gray-800 p-8">
      {/* Logo / 專案名稱 */}
      <h1 className="text-4xl font-bold text-sky-700 mb-4 tracking-tight">
        EchoLearn
      </h1>

      {/* 圖片 */}
      <div className="mb-8">
        <Image
          src="/image.png"
          alt="EchoLearn"
          width={200}
          height={150}
          priority
        />
      </div>

      {/* 按鈕群組 */}
      {isLoggedIn ? (
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold px-8 py-3 transition-colors"
          >
            前往 Dashboard
          </Link>
        </div>
      ) : (
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold px-8 py-3 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-white hover:bg-gray-50 text-sky-600 font-semibold px-8 py-3 border-2 border-sky-600 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      )}

      {/* Footer */}
      <footer className="absolute bottom-4 text-sm text-gray-400">
        © {new Date().getFullYear()} EchoLearn · All rights reserved
      </footer>
    </main>
  );
}
