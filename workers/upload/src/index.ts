export interface Env {
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_URL: string;
  FIREBASE_API_KEY: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'MISSING_TOKEN', '未提供認證 Token');
    }

    const idToken = authHeader.slice(7);
    const uid = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY);
    if (!uid) {
      return errorResponse(401, 'INVALID_TOKEN', 'Token 驗證失敗');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return errorResponse(400, 'NO_FILE', '未提供檔案');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return errorResponse(400, 'INVALID_FILE_TYPE', '不支援的圖片格式');
    }

    if (file.size > 5 * 1024 * 1024) {
      return errorResponse(400, 'FILE_TOO_LARGE', '圖片不可超過 5MB');
    }

    const ext = file.type.split('/')[1] ?? 'bin';
    const key = `uploads/${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    await env.R2_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const url = `${env.R2_PUBLIC_URL}/${key}`;
    return new Response(JSON.stringify({ url }), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  },
};

async function verifyFirebaseToken(token: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { users?: { localId: string }[] };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
