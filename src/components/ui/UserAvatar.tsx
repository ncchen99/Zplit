/**
 * Reusable avatar component that properly handles text initials
 * when no avatar image is available, preventing text overflow.
 */

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
  size = 'w-10',
  textSize = 'text-sm',
  bgClass = 'bg-neutral text-neutral-content',
}: UserAvatarProps) {
  const initial = name?.charAt(0) || '?';

  return (
    <div className="avatar placeholder flex-shrink-0">
      <div className={`${size} rounded-full ${bgClass} overflow-hidden`}>
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className={`${textSize} leading-none select-none`}>{initial}</span>
        )}
      </div>
    </div>
  );
}
