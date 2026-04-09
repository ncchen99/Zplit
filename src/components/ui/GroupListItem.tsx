import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import type { Group } from '@/store/groupStore';

export function GroupListItem({
  group,
  settled,
  onClick,
}: {
  group: Group;
  settled?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-3 py-3 cursor-pointer active:bg-base-200/50 transition-colors border-b border-base-200 last:border-b-0 md:mx-0 md:card md:bg-base-200 md:rounded-xl md:px-0 md:py-0 md:mb-2 md:border-0 md:active:bg-base-300"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 w-full md:card-body md:p-3">
        {group.coverUrl ? (
          <img
            src={group.coverUrl}
            alt=""
            className="h-12 w-16 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-bold text-lg">
            {group.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{group.name}</h3>
          <p className="text-xs text-base-content/50">
            {t('common.members_count', { count: group.members?.length ?? 0 })}
          </p>
        </div>
        {settled && (
          <span className="inline-flex items-center gap-1 text-xs text-base-content/40">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            {t('personal.settled')}
          </span>
        )}
      </div>
    </div>
  );
}
