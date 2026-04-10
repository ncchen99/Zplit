import { auth } from "@/lib/firebase";
import { ZplitError } from "@/utils/errors";
import { logger } from "@/utils/logger";

const MAX_IMAGE_DIMENSION = 1920;
const WEBP_QUALITY = 0.95;

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

function toWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ZplitError("UPLOAD_FAILED", "圖片壓縮失敗"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new ZplitError("UPLOAD_TYPE_INVALID", "僅支援圖片檔案上傳");
  }

  const image = await loadImage(file);
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
  const webpBlob = await toWebpBlob(canvas, WEBP_QUALITY);

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([webpBlob], `${baseName}.webp`, {
    type: "image/webp",
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
