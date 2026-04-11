import { useEffect, useMemo, useState } from "react";
import { ChevronDown as ChevronDownIcon } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

export interface ActionSheetSelectOption {
  value: string;
  label: string;
  avatarUrl?: string | null;
}

interface ActionSheetSelectProps {
  value: string;
  options: ActionSheetSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  showAvatar?: boolean;
  triggerClassName?: string;
}

function resolveOptionClass(isActive: boolean): string {
  if (isActive) {
    return "join-item btn btn-active h-12 border-base-300 bg-base-300 text-base-content font-semibold hover:border-base-300 hover:bg-base-300 hover:text-base-content";
  }
  return "join-item btn btn-white-soft h-12 text-base-content/70 font-medium hover:text-base-content";
}

export function ActionSheetSelect({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  showAvatar = true,
  triggerClassName,
}: ActionSheetSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        className={`input w-full h-12 px-3 flex items-center justify-between ${triggerClassName ?? ""}`}
        onClick={() => setOpen(true)}
      >
        {selectedOption ? (
          <span className="flex items-center gap-2 min-w-0">
            {showAvatar ? (
              <UserAvatar
                src={selectedOption.avatarUrl}
                name={selectedOption.label}
                size="w-7"
                textSize="text-xs"
              />
            ) : null}
            <span className="truncate text-base-content">{selectedOption.label}</span>
          </span>
        ) : (
          <span className="text-base-content/50">{placeholder ?? "Select"}</span>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-base-content/50"
        />
      </button>

      {open && (
        <div className="modal modal-open z-50">
          <div className="modal-box w-full max-w-72 p-0 shadow-2xl rounded-2xl">
            <div className="join join-vertical w-full overflow-hidden rounded-2xl bg-base-100">
              {options.map((option) => {
                const isActive = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${resolveOptionClass(isActive)} btn-block justify-start px-3`}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {showAvatar ? (
                        <UserAvatar
                          src={option.avatarUrl}
                          name={option.label}
                          size="w-8"
                          textSize="text-sm"
                          bgClass={
                            isActive
                              ? "bg-base-content text-base-100"
                              : "bg-base-300 text-base-content"
                          }
                          initialTextClass={
                            isActive ? "text-base-100" : "text-base-content/60"
                          }
                        />
                      ) : null}
                      <span className="truncate">{option.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            aria-label="close"
            className="modal-backdrop"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}