import { auth } from "@/lib/firebase";
import { ZplitError } from "@/utils/errors";
import { logger } from "@/utils/logger";

const MAX_IMAGE_DIMENSION = 1920;
const WEBP_QUALITY = 0.95;
const JPEG_QUALITY = 0.9;

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ZplitError("UPLOAD_FAILED", "圖片讀取失敗"));
    };
    image.src = objectUrl;
  });
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ZplitError("UPLOAD_FAILED", "圖片壓縮失敗"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

// HEIF/HEIC 的 ftyp brand（檔頭第 8–12 byte）。
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);

async function isHeif(file: File): Promise<boolean> {
  if (/\.(heic|heif)$/i.test(file.name)) return true;
  const header = await file.slice(4, 12).arrayBuffer();
  const text = new TextDecoder("ascii").decode(header);
  return text.startsWith("ftyp") && HEIF_BRANDS.has(text.slice(4));
}

/**
 * Safari 能直接解 HEIC，但 Chrome（包含 Android 上的 Chrome，三星等手機
 * 預設存 HEIF）不行。原生解不開又是 HEIF 時，才載入 libheif（WASM，約
 * 3MB，獨立 chunk，不進 SW 預先快取）來解碼。
 */
async function decodeImage(
  file: File,
  heif: boolean,
): Promise<HTMLImageElement | ImageBitmap> {
  try {
    return await loadImage(file);
  } catch (err) {
    if (!heif) throw err;
  }
  try {
    const { heicTo } = await import("heic-to");
    return await heicTo({ blob: file, type: "bitmap" });
  } catch (err) {
    logger.error("upload", "HEIF 解碼失敗", { err });
    throw new ZplitError("UPLOAD_FAILED", "圖片讀取失敗", err);
  }
}

async function compressImageForUpload(file: File): Promise<File> {
  // 有些 Android 選到的 HEIF 沒有 MIME type，所以也看檔頭。
  const heif = await isHeif(file);
  if (!file.type.startsWith("image/") && !heif) {
    throw new ZplitError("UPLOAD_TYPE_INVALID", "僅支援圖片檔案上傳");
  }

  const image = await decodeImage(file, heif);
  const maxSide = Math.max(image.width, image.height);
  const scale = maxSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxSide : 1;
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ZplitError("UPLOAD_FAILED", "無法處理圖片格式");
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  if ("close" in image) image.close();
  // Safari（iOS 上所有瀏覽器都是 WebKit）不支援把 canvas 編碼成 WebP，
  // toBlob 會默默改回 PNG。照片存成 PNG 動輒 5MB 以上，會被 worker 以
  // FILE_TOO_LARGE 擋掉，所以拿到的不是 WebP 就改用 JPEG（到處都支援）。
  let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
  if (blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
  }
  const ext = blob.type === "image/webp" ? "webp" : "jpg";

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export async function uploadImage(file: File): Promise<string> {
  const workerUrl = import.meta.env.VITE_UPLOAD_WORKER_URL;
  if (!workerUrl) {
    throw new ZplitError("UPLOAD_FAILED", "Upload Worker URL 未設定");
  }

  const user = auth.currentUser;
  if (!user) {
    throw new ZplitError("AUTH_TOKEN_MISSING", "使用者未登入");
  }

  const processedFile = await compressImageForUpload(file);

  const idToken = await user.getIdToken(true);
  const formData = new FormData();
  formData.append("file", processedFile);

  try {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });

    if (!res.ok) {
      const { error } = (await res.json()) as {
        error: { code: string; message: string };
      };
      logger.error("upload", error.message, { code: error.code });
      throw new ZplitError("UPLOAD_FAILED", error.message);
    }

    const { url } = (await res.json()) as { url: string };
    logger.info("upload", "圖片上傳成功", { url });
    return url;
  } catch (err) {
    if (err instanceof ZplitError) throw err;
    throw new ZplitError("UPLOAD_FAILED", "圖片上傳失敗", err);
  }
}
