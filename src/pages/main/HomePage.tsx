import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/store/groupStore';
import { logger } from '@/utils/logger';
import { Cog8ToothIcon, BellIcon } from '@heroicons/react/24/outline';

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      try {
        const q = query(collection(db, 'groups'));
        const snap = await getDocs(q);
        const allGroups = snap.docs.map((d) => {
          const data = d.data();
          return { ...data, groupId: d.id } as Group;
        });
        const myGroups = allGroups.filter((g) =>
          g.members?.some((m) => m.userId === user.uid)
        );
        setGroups(myGroups);
      } catch (err) {
        logger.error('home.fetchGroups', '載入群組失敗', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [user]);

  const topGroups = groups.slice(0, 3);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Zplit Logo" className="w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight text-primary">Zplit</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm btn-circle">
            <BellIcon className="h-5 w-5" />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => navigate('/settings')}
          >
            <div className="avatar placeholder">
              <div className="w-8 rounded-full bg-neutral text-neutral-content">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <span className="text-xs">{user?.displayName?.charAt(0) ?? '?'}</span>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Welcome */}
      <div className="mt-4">
        <p className="text-lg font-semibold">
          {t('home.welcome', { name: user?.displayName ?? '' })}
        </p>
        <p className="text-sm text-base-content/50">
          {groups.length > 0
            ? t('home.pendingCount', { count: groups.length })
            : t('home.noPending')}
        </p>
      </div>

      {/* My Groups Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
            {t('home.groups')}
          </h2>
          {groups.length > 0 && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => navigate('/groups')}
            >
              {t('common.viewAll')} &gt;
            </button>
          )}
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : topGroups.length === 0 ? (
          <div className="mt-6 text-center text-base-content/40">
            <p>{t('home.noGroups')}</p>
            <p className="text-sm mt-1">{t('home.noGroupsHint')}</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {topGroups.map((g) => (
              <div
                key={g.groupId}
                className="card bg-base-200 cursor-pointer transition-colors active:bg-base-300"
                onClick={() => navigate(`/groups/${g.groupId}`)}
              >
                <div className="card-body p-3">
                  <div className="flex items-center gap-3">
                    {g.coverUrl ? (
                      <img
                        src={g.coverUrl}
                        alt=""
                        className="h-12 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-bold text-lg">
                        {g.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{g.name}</h3>
                      <p className="text-xs text-base-content/50">
                        {t('common.members_count', { count: g.members?.length ?? 0 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personal Lending Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
            {t('home.personal')}
          </h2>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => navigate('/personal')}
          >
            {t('common.viewAll')} &gt;
          </button>
        </div>

        <div className="mt-3 text-center text-base-content/40 py-4">
          <p className="text-sm">{t('home.noContacts')}</p>
        </div>
      </div>
    </div>
  );
}
