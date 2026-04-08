import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/store/groupStore';
import { getUserGroups } from '@/services/groupService';
import { logger } from '@/utils/logger';
import { PlusIcon, MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { GroupListItem } from '@/components/ui/GroupListItem';

export function GroupListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      try {
        const myGroups = await getUserGroups(user.uid);
        setGroups(myGroups);
      } catch (err) {
        logger.error('groupList.fetch', '載入群組失敗', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [user]);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  // TODO: categorize into in-progress vs settled based on settlement data
  const inProgress = filtered;
  const settled: Group[] = [];

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('group.list.title')}</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/groups/new')}
        >
          <PlusIcon className="h-4 w-4" />
          {t('common.button.add')}
        </button>
      </div>

      {/* Search */}
      <div className="mt-4">
        <label className="input w-full flex items-center gap-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-base-content/40" />
          <input
            type="text"
            className="grow"
            placeholder={t('group.list.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="mt-8 text-center text-base-content/40">
          <p>{t('group.list.noResults')}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-16 text-center text-base-content/40">
          <UserGroupIcon className="mx-auto mb-3 h-12 w-12" />
          <p>{t('group.list.noGroups')}</p>
          <p className="text-sm mt-1">{t('group.list.noGroupsHint')}</p>
        </div>
      ) : (
        <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                {t('group.list.inProgress')}（{inProgress.length}）
              </h2>
              <div className="mt-2 flex flex-col md:gap-2">
                {inProgress.map((g) => (
                  <GroupListItem
                    key={g.groupId}
                    group={g}
                    onClick={() => navigate(`/groups/${g.groupId}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Settled */}
          {settled.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                {t('group.list.settled')}（{settled.length}）
              </h2>
              <div className="mt-2 flex flex-col md:gap-2">
                {settled.map((g) => (
                  <GroupListItem
                    key={g.groupId}
                    group={g}
                    settled
                    onClick={() => navigate(`/groups/${g.groupId}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
