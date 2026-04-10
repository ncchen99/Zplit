import { auth } from "@/lib/firebase";
import { ZplitError } from "@/utils/errors";
import { logger } from "@/utils/logger";

export async function uploadImage(file: File): Promise<string> {
  const workerUrl = import.meta.env.VITE_UPLOAD_WORKER_URL;
  if (!workerUrl) {
    throw new ZplitError("UPLOAD_FAILED", "Upload Worker URL 未設定");
  }

  const user = auth.currentUser;
  if (!user) {
    throw new ZplitError("AUTH_TOKEN_MISSING", "使用者未登入");
  }

  const idToken = await user.getIdToken(true);
  const formData = new FormData();
  formData.append("file", file);

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
