/**
 * Reusable avatar component that properly handles text initials
 * when no avatar image is available, preventing text overflow.
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
}

export function UserAvatar({
  src,
  name,
  size = "w-10",
  textSize = "text-[17px]",
  bgClass = "bg-base-300 text-base-content",
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = name?.charAt(0) || "?";
  const showImage = src && !imgError;

  return (
    <div className="avatar placeholder flex-shrink-0">
      <div
        className={`${size} rounded-full ${bgClass} overflow-hidden flex items-center justify-center`}
      >
        {showImage ? (
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className={`${textSize} text-base-content/60 font-semibold leading-none select-none`}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}
