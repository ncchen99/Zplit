# Cloudflare Workers Setup

This directory contains two workers:

- `workers/upload`: verifies Firebase ID token and uploads image files to Cloudflare R2.
- `workers/turnstile`: verifies Cloudflare Turnstile token for anonymous login.

## 1. Prerequisites

- Cloudflare account
- `wrangler` CLI installed
- R2 bucket created (for upload worker)
- Firebase project (to verify ID token)
- Turnstile site/secret key pair

## 2. Configure Upload Worker

Path: `workers/upload/wrangler.toml`

Required values:

- `R2_BUCKET` binding in `[[r2_buckets]]`
- `R2_PUBLIC_URL` in `[vars]`
- `FIREBASE_API_KEY` in `[vars]`

Example:

```toml
name = "zplit-upload"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "<your-r2-bucket-name>"

[vars]
R2_PUBLIC_URL = "https://<your-r2-public-domain>"
FIREBASE_API_KEY = "<your-firebase-web-api-key>"
```

## 3. Configure Turnstile Worker

Path: `workers/turnstile/wrangler.toml`

Set secret as Worker secret:

```bash
cd workers/turnstile
wrangler secret put TURNSTILE_SECRET_KEY
```

Also set your frontend env:

- `VITE_TURNSTILE_SITE_KEY`
- `VITE_TURNSTILE_WORKER_URL`

## 4. Local Development

Upload worker:

```bash
cd workers/upload
wrangler dev
```

Turnstile worker:

```bash
cd workers/turnstile
wrangler dev
```

## 5. Deploy

Upload worker:

```bash
cd workers/upload
wrangler deploy
```

Turnstile worker:

```bash
cd workers/turnstile
wrangler deploy
```

## 6. Basic Verification Checklist

- Upload endpoint returns `401` with missing/invalid bearer token.
- Upload endpoint returns `400` for unsupported file type or > 5MB file.
- Upload endpoint returns `200` with uploaded `url` for valid image.
- Turnstile endpoint returns `403` for invalid token.
- Turnstile endpoint returns `200` and `{ "verified": true }` for valid token.
