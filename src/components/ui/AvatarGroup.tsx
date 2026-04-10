import { UserAvatar } from "@/components/ui/UserAvatar";

interface AvatarGroupItem {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface AvatarGroupProps {
  items: AvatarGroupItem[];
  max?: number;
  size?: "w-6" | "w-7" | "w-8";
}

export function AvatarGroup({
  items,
  max = 4,
  size = "w-6",
}: AvatarGroupProps) {
  if (items.length === 0) return null;

  const shown = items.slice(0, max);
  const remaining = items.length - shown.length;

  return (
    <div className="avatar-group -space-x-3">
      {shown.map((item) => (
        <UserAvatar
          key={item.id}
          src={item.avatarUrl}
          name={item.name}
          size={size}
          textSize="text-[10px]"
          bgClass="bg-base-300 text-base-content/50"
        />
      ))}
      {remaining > 0 && (
        <div className="avatar placeholder flex-shrink-0">
          <div
            className={`${size} rounded-full bg-base-300 text-base-content/50 overflow-hidden flex items-center justify-center`}
          >
            <span className="text-[10px] font-semibold leading-none select-none">
              +{remaining}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
