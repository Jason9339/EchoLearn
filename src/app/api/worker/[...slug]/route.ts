// ✅ 檔案路徑: src/app/api/worker/[...slug]/route.ts
import { NextResponse } from 'next/server';

// 告訴 Next.js 這是一個「動態」路由，永遠不要快取
export const dynamic = 'force-dynamic';

const API_URL = process.env.BACKEND_API_URL;

async function handler(
    request: Request, 
    { params }: { params: Promise<{ slug: string[] }> }
) {


    // --- 2. 檢查 Vercel 環境變數 ---
    if (!API_URL) {
        console.error("[PROXY] 錯誤：BACKEND_API_URL 環境變數未設定。");
        return NextResponse.json({ success: false, error: "伺服器設定錯誤" }, { status: 500 });
    }

    // --- 3. 組合目標 URL ---
    // (現在 'params' 應該會有值了)
    const param = await params;
    const path = param.slug.join('/');

    // 從請求 URL 中提取查詢參數
    const url = new URL(request.url);
    const queryString = url.search; // 包含 '?' 的完整查詢字串

    const targetUrl = `${API_URL}/worker/${path}${queryString}`; // (Python 前綴是 /worker)

    console.log(`[PROXY] 正在代理: ${request.method} ${targetUrl}`);

    try {
        // --- 4. 轉發請求至 Python 後端 ---
        const backendResponse = await fetch(targetUrl, {
            method: request.method,
            headers: {
                'Content-Type': request.headers.get('Content-Type') || 'application/json',
                'Accept': request.headers.get('Accept') || '*/*',
            },
            body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
            // @ts-expect-error: duplex is required for Node.js fetch streaming
            duplex: 'half'
        });

        console.log(`[PROXY] 後端回應狀態: ${backendResponse.status}`);

        // --- 6. 直接轉發後端的回應 ---
        const responseBody = await backendResponse.text();
        const responseHeaders = new Headers();
        const contentType = backendResponse.headers.get('Content-Type');
        if (contentType) {
            responseHeaders.set('Content-Type', contentType);
        }

        if (!backendResponse.ok) {
            console.error(`[PROXY] 後端回傳錯誤 (${backendResponse.status}): ${responseBody}`);
        }

        return new Response(responseBody, {
            status: backendResponse.status,
            headers: responseHeaders
        });

    } catch (error) {
        // --- 7. 捕獲「連線失敗」的錯誤 (例如 Tunnel 沒開) ---
        console.error(`[PROXY] 代理請求至 ${targetUrl} 失敗:`, error);
        return NextResponse.json(
            { success: false, error: '後端代理連線失敗', details: (error as Error).message },
            { status: 502 }
        );
    }
}

// 將同一個 handler 導向到所有 HTTP 方法
export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
