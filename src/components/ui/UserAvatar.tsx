/**
 * Reusable avatar component that properly handles text initials
 * when no avatar image is available, preventing text overflow.
 *
 * 圖片快取交給瀏覽器的 HTTP cache：上傳的圖片（R2）帶
 * `max-age=31536000, immutable`，Google 帳號頭貼帶 `max-age=86400`，
 * 兩邊都不需要再自己抄一份。之前那層 blob 快取反而有害——它在 <img>
 * 之外又發一次 fetch()，而 r2.dev 不回 CORS 標頭，那個 fetch 對上傳的
 * 圖片永遠失敗，等於每次掛載都白打一個請求。
 */
import { useState } from "react";

interface UserAvatarProps {
  src: string | null | undefined;
  name: string;
  /** Tailwind width class, e.g. "w-10", "w-14" */
  size?: string;
  /** Text size class for the initial, e.g. "text-sm", "text-lg" */
  textSize?: string;
  /** Background class for placeholder */
  bgClass?: string;
  /** Text color class for placeholder initial */
  initialTextClass?: string;
}

export function UserAvatar({
  src,
  name,
  size = "w-10",
  textSize = "text-[17px]",
  bgClass = "bg-base-300 text-base-content",
  initialTextClass = "text-base-content/60",
}: UserAvatarProps) {
  // 記住「哪一張」載入失敗，而不是一個布林值：同一個元件換人時，
  // 新的網址自然不等於失敗的那張，不必另外重設
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initial = name?.charAt(0) || "?";
  const showImage = src && failedSrc !== src;

  return (
    <div className="avatar placeholder flex-shrink-0">
      <div
        className={`${size} rounded-full ${bgClass} overflow-hidden flex items-center justify-center`}
      >
        {showImage ? (
          <img
            src={src}
            alt=""
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setFailedSrc(src)}
          />
        ) : (
          <span
            className={`${textSize} ${initialTextClass} font-semibold leading-none select-none`}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}
