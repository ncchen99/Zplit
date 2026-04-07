# Cloudflare Turnstile 設定教學

## 說明

Cloudflare Turnstile 是一個取代傳統 CAPTCHA 的人機驗證服務。Zplit 在「匿名登入」時使用，避免機器人大量建立匿名帳號。

**驗證流程：**

```
使用者點擊「匿名登入」
    ↓
前端顯示 Turnstile Widget（人機驗證）
    ↓
使用者通過驗證，前端取得 token
    ↓
前端將 token 送往 Cloudflare Worker 後端驗證
    ↓
驗證通過 → 前端執行 Firebase signInAnonymously()
```

---

## 第一部分：取得 Turnstile 金鑰

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左側選單選擇 **Turnstile**
3. 點擊「Add site」
4. 填入以下資訊：
   - **Site name**：`Zplit`
   - **Domain**：`localhost`（開發用）；正式部署後另加正式網域
   - **Widget type**：選擇 **Managed**（推薦，使用者幾乎感受不到驗證）
5. 點擊「Create」

取得兩組金鑰：
- **Site Key**：前端使用（可公開）
- **Secret Key**：後端使用（絕對不可公開）

---

## 第二部分：建立 Turnstile Worker

### 建立 Worker 專案

在專案根目錄，執行：

```bash
npx wrangler init workers/turnstile
```

選項：
- 「Would you like to use TypeScript?」→ Yes
- 「Deploy your application?」→ No

### Worker 程式碼

建立 `workers/turnstile/src/index.ts`：

```typescript
export interface Env {
  TURNSTILE_SECRET_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS 前置請求處理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    }

    const body = await request.json() as { token?: string };
    const token = body?.token;

    if (!token) {
      return errorResponse(400, 'MISSING_TOKEN', '未提供 Turnstile Token');
    }

    // 呼叫 Cloudflare Turnstile 驗證 API
    const outcome = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: request.headers.get('CF-Connecting-IP') ?? undefined,
        }),
      }
    );

    const result = await outcome.json() as { success: boolean; 'error-codes'?: string[] };

    if (!result.success) {
      console.error('Turnstile 驗證失敗', result['error-codes']);
      return errorResponse(403, 'TURNSTILE_FAILED', '人機驗證未通過');
    }

    return new Response(JSON.stringify({ verified: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

### wrangler.toml 設定

建立 `workers/turnstile/wrangler.toml`：

```toml
name = "zplit-turnstile"
main = "src/index.ts"
compatibility_date = "2024-01-01"
```

### 設定 Secret Key

```bash
cd workers/turnstile
npx wrangler secret put TURNSTILE_SECRET_KEY
# 貼上 Secret Key 後按 Enter
```

### 部署 Worker

```bash
npx wrangler deploy
```

複製部署後的 Worker URL（格式：`https://zplit-turnstile.your-account.workers.dev`）

---

## 第三部分：前端整合

### 安裝 Turnstile React 套件

```bash
npm install @marsidev/react-turnstile
```

### 填入 .env.local

```env
VITE_TURNSTILE_SITE_KEY=填入你的 Turnstile Site Key
VITE_TURNSTILE_WORKER_URL=https://zplit-turnstile.your-account.workers.dev
```

### 更新匿名登入流程

修改 `src/pages/auth/LoginPage.tsx`，加入 Turnstile 驗證：

```tsx
import { Turnstile } from '@marsidev/react-turnstile';
import { useState } from 'react';

// 在元件內新增狀態
const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
const [showTurnstile, setShowTurnstile] = useState(false);

// 驗證 Turnstile token
const verifyTurnstile = async (token: string): Promise<boolean> => {
  const workerUrl = import.meta.env.VITE_TURNSTILE_WORKER_URL;
  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return res.ok;
};

// 修改 handleAnonymousLogin
const handleAnonymousLogin = async () => {
  if (!turnstileToken) {
    setShowTurnstile(true); // 顯示驗證 Widget
    return;
  }

  try {
    const verified = await verifyTurnstile(turnstileToken);
    if (!verified) {
      showToast('人機驗證失敗，請再試一次', 'error');
      setTurnstileToken(null);
      return;
    }
    await signInAnonymously(auth);
  } catch (err) {
    showToast(t('common.error'), 'error');
  }
};

// 在 JSX 中加入 Turnstile Widget
{showTurnstile && (
  <Turnstile
    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
    onSuccess={(token) => {
      setTurnstileToken(token);
      setShowTurnstile(false);
      // 自動繼續登入流程
      handleAnonymousLogin();
    }}
    onError={() => showToast('驗證元件載入失敗', 'error')}
    options={{ theme: 'auto' }}
  />
)}
```

---

## 測試驗證

### 開發環境測試金鑰

Cloudflare 提供永遠通過的測試 Site Key，可用於本地開發：

| 情境 | Site Key | Secret Key |
|------|----------|------------|
| 永遠通過 | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| 永遠失敗 | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |
| 強制互動 | `3x00000000000000000000FF` | `3x0000000000000000000000000000000AA` |

開發時在 `.env.local` 使用測試金鑰，正式部署再換成真實金鑰。

### 驗證步驟

1. 啟動 dev server
2. 點擊「匿名登入」
3. 應出現 Turnstile Widget（開發用測試金鑰會立即通過）
4. 通過後應成功登入並進入 Onboarding 頁面
