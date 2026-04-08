import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/store/groupStore';
import { logger } from '@/utils/logger';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

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
        const q = query(
          collection(db, 'groups'),
          where(`memberUids.${user.uid}`, '==', true)
        );
        const snap = await getDocs(q);
        const myGroups = snap.docs.map((d) => ({
          ...d.data(),
          groupId: d.id,
        })) as Group[];
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
        <div className="mt-8 text-center text-base-content/40">
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
              <div className="mt-2 flex flex-col gap-2">
                {inProgress.map((g) => (
                  <GroupCard
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
              <div className="mt-2 flex flex-col gap-2">
                {settled.map((g) => (
                  <GroupCard
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

function GroupCard({
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
      className="card bg-base-200 cursor-pointer transition-colors active:bg-base-300"
      onClick={onClick}
    >
      <div className="card-body p-3">
        <div className="flex items-center gap-3">
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
    </div>
  );
}
