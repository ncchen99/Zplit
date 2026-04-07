export interface Env {
  TURNSTILE_SECRET_KEY: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    }

    const body = (await request.json()) as { token?: string };
    const token = body?.token;

    if (!token) {
      return errorResponse(400, 'MISSING_TOKEN', '未提供 Turnstile Token');
    }

    const outcome = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get('CF-Connecting-IP') ?? undefined,
      }),
    });

    const result = (await outcome.json()) as {
      success: boolean;
      'error-codes'?: string[];
    };

    if (!result.success) {
      console.error('Turnstile 驗證失敗', result['error-codes']);
      return errorResponse(403, 'TURNSTILE_FAILED', '人機驗證未通過');
    }

    return new Response(JSON.stringify({ verified: true }), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  },
};

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
