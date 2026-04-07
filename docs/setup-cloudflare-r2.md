# Cloudflare R2 + Worker 設定教學

## 架構說明

```
前端 → Cloudflare Worker → R2 Bucket
         ↑
   Firebase ID Token 驗證
```

前端不直接持有 R2 存取金鑰，所有上傳皆透過 Worker 中繼，並驗證 Firebase ID Token 後才執行。

---

## 第一部分：建立 R2 Bucket

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左側選單選擇 **R2 Object Storage**
3. 點擊「Create bucket」
4. Bucket 名稱輸入：`zplit-media`
5. 位置選擇：**APAC**（亞太地區，台灣最近）
6. 點擊「Create bucket」

### 設定公開存取（Public Access）

1. 進入 `zplit-media` bucket 設定
2. 選擇「Settings」分頁
3. 在「Public access」區塊，點擊「Allow Access」
4. 複製產生的公開 URL（格式如：`https://pub-xxxxxxxx.r2.dev`）
5. 記下此 URL，等等要填入 Worker 環境變數

---

## 第二部分：建立上傳 Worker

### 建立 Worker 專案

在專案根目錄，執行：

```bash
npm install -D wrangler
npx wrangler login
npx wrangler init workers/upload
```

選項：
- 「Would you like to use TypeScript?」→ Yes
- 「Deploy your application?」→ No

### Worker 程式碼

開啟 `workers/upload/src/index.ts`，貼上以下內容：

```typescript
export interface Env {
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_URL: string;
  FIREBASE_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS 前置請求處理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    }

    // 驗證 Firebase ID Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'MISSING_TOKEN', '未提供認證 Token');
    }
    const idToken = authHeader.slice(7);
    const uid = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY);
    if (!uid) {
      return errorResponse(401, 'INVALID_TOKEN', 'Token 驗證失敗');
    }

    // 解析上傳檔案
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return errorResponse(400, 'NO_FILE', '未提供檔案');
    }

    // 檔案類型白名單
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse(400, 'INVALID_FILE_TYPE', '不支援的圖片格式');
    }

    // 5MB 大小限制
    if (file.size > 5 * 1024 * 1024) {
      return errorResponse(400, 'FILE_TOO_LARGE', '圖片不可超過 5MB');
    }

    // 上傳至 R2
    const ext = file.type.split('/')[1];
    const key = `uploads/${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    await env.R2_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

async function verifyFirebaseToken(token: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { users?: { localId: string }[] };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

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

開啟 `workers/upload/wrangler.toml`，設定如下：

```toml
name = "zplit-upload"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "zplit-media"

[vars]
R2_PUBLIC_URL = "填入你的 R2 Public URL"
```

### 設定 Secrets（不可寫入 wrangler.toml）

```bash
# 設定 Firebase API Key（不明碼）
npx wrangler secret put FIREBASE_API_KEY
# 輸入你的 Firebase API Key 後按 Enter
```

### 部署 Worker

```bash
cd workers/upload
npx wrangler deploy
```

部署成功後，複製 Worker URL（格式：`https://zplit-upload.your-account.workers.dev`）

---

## 第三部分：前端整合

### 填入 .env.local

```env
VITE_UPLOAD_WORKER_URL=https://zplit-upload.your-account.workers.dev
```

### 圖片上傳 Service（已預留骨架）

`src/services/uploadService.ts`：

```typescript
import { auth } from '@/lib/firebase';
import { ZplitError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export async function uploadImage(file: File): Promise<string> {
  const workerUrl = import.meta.env.VITE_UPLOAD_WORKER_URL;
  if (!workerUrl) {
    throw new ZplitError('UPLOAD_FAILED', 'Upload Worker URL 未設定');
  }

  // 取得最新 Firebase ID Token
  const user = auth.currentUser;
  if (!user) throw new ZplitError('AUTH_TOKEN_MISSING', '使用者未登入');
  const idToken = await user.getIdToken(true);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });

    if (!res.ok) {
      const { error } = await res.json() as { error: { code: string; message: string } };
      logger.error('upload', error.message, { code: error.code });
      throw new ZplitError('UPLOAD_FAILED', error.message);
    }

    const { url } = await res.json() as { url: string };
    logger.info('upload', '圖片上傳成功', { url });
    return url;
  } catch (err) {
    if (err instanceof ZplitError) throw err;
    throw new ZplitError('UPLOAD_FAILED', '圖片上傳失敗', err);
  }
}
```

---

## 驗證流程

1. 登入 Zplit 後，嘗試上傳大頭貼
2. 前往 Cloudflare Dashboard → R2 → `zplit-media` bucket
3. 應可看到 `uploads/{uid}/` 目錄下有圖片檔案
4. 點擊圖片，確認公開 URL 可正常存取
