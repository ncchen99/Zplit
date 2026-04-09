import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

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
  tone?: 'default' | 'primary';
  children: ReactNode;
}

export function HeaderIconButton({
  onClick,
  disabled,
  loading,
  tone = 'default',
  children,
}: HeaderIconButtonProps) {
  return (
    <button
      className={`btn btn-ghost btn-sm btn-circle disabled:opacity-30 disabled:cursor-not-allowed ${
        tone === 'primary' ? 'text-primary' : ''
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? <span className="loading loading-spinner loading-xs" /> : children}
    </button>
  );
}

export function PageHeader({ title, onBack, rightAction, sticky = false }: PageHeaderProps) {
  return (
    <div
      className={`flex items-center px-4 pt-4 pb-2 ${
        sticky ? 'sticky top-0 bg-base-100 z-10' : ''
      }`}
    >
      <button
        className="btn btn-ghost btn-sm btn-circle -ml-2 text-base-content/60 hover:text-base-content"
        onClick={onBack}
        aria-label="Back"
      >
        <ChevronLeftIcon className="h-6 w-6" />
      </button>

      <h1 className="flex-1 truncate px-2 text-center text-lg font-bold">{title}</h1>

      <div className="-mr-2 flex min-w-9 justify-end">
        {rightAction ?? <span className="h-9 w-9" aria-hidden="true" />}
      </div>
    </div>
  );
}