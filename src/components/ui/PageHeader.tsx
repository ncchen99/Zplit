import type { ReactNode } from "react";
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
  sticky = false,
}: PageHeaderProps) {
  return (
    <div
      className={`flex items-center px-4 pt-4 pb-2 ${
        sticky ? "sticky top-0 bg-base-100 z-10" : ""
      }`}
    >
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
  );
}
