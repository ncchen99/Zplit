import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowLeft as ArrowLeftIcon } from "lucide-react";

interface PageHeaderProps {
  title: ReactNode;
  onBack: () => void;
  rightAction?: ReactNode;
  sticky?: boolean;
}

interface HeaderIconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "default" | "primary";
  children: ReactNode;
}

export function HeaderIconButton({
  onClick,
  disabled,
  loading,
  tone = "default",
  children,
}: HeaderIconButtonProps) {
  const toneClass =
    tone === "primary" ? "text-base-content/50" : "text-base-content/50";

  return (
    <button
      className={`btn btn-ghost btn-sm btn-circle ${toneClass} hover:text-base-content/50 [&>svg]:h-5 [&>svg]:w-5 disabled:opacity-30 disabled:cursor-not-allowed`}
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        children
      )}
    </button>
  );
}

export function PageHeader({
  title,
  onBack,
  rightAction,
  sticky = true,
}: PageHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel: 1px tall, -1px margin so it doesn't affect layout.
          When it scrolls out of view, isScrolled becomes true. */}
      <div ref={sentinelRef} className="h-px -mb-px" aria-hidden="true" />
      <div className={`relative z-10 ${sticky ? "sticky top-0" : ""}`}>
        <div className="flex items-center px-4 pt-4 pb-2 bg-base-100">
          <div className="flex w-10 justify-start">
            <button
              className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content/50 [&>svg]:h-5 [&>svg]:w-5"
              onClick={onBack}
              aria-label="Back"
            >
              <ArrowLeftIcon />
            </button>
          </div>

          <h1 className="flex-1 truncate px-2 text-center text-lg font-bold">
            {title}
          </h1>

          <div className="flex w-10 justify-end">
            {rightAction ?? <span className="h-9 w-9" aria-hidden="true" />}
          </div>
        </div>
        {/* Gradient fade below header, only visible after scrolling */}
        <div
          className={`absolute left-0 right-0 h-4 bg-gradient-to-b from-base-100 to-transparent pointer-events-none transition-opacity duration-200 ${isScrolled ? "opacity-100" : "opacity-0"}`}
        />
      </div>
    </>
  );
}
