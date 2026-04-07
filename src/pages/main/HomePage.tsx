import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Group } from '@/store/groupStore';
import { logger } from '@/utils/logger';

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
        // Query groups where user is a member
        const q = query(collection(db, 'groups'));
        const snap = await getDocs(q);
        const allGroups = snap.docs.map((d) => {
          const data = d.data();
          return { ...data, groupId: d.id } as Group;
        });
        // Filter client-side for groups where user is a member
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

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('home.title')}</h1>
        <div className="avatar placeholder">
          <div className="w-9 rounded-full bg-neutral text-neutral-content">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" />
            ) : (
              <span className="text-sm">{user?.displayName?.charAt(0) ?? '?'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Create Group Button */}
      <button
        className="btn btn-primary btn-block mt-6"
        onClick={() => navigate('/groups/new')}
      >
        + {t('home.createGroup')}
      </button>

      {/* Group List */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
          {t('home.groups')}
        </h2>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : groups.length === 0 ? (
          <div className="mt-8 text-center text-base-content/40">
            <p>{t('home.noGroups')}</p>
            <p className="text-sm mt-1">{t('home.noGroupsHint')}</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {groups.map((g) => (
              <div
                key={g.groupId}
                className="card bg-base-200 cursor-pointer transition-colors hover:bg-base-300"
                onClick={() => navigate(`/groups/${g.groupId}`)}
              >
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    {g.coverUrl ? (
                      <img
                        src={g.coverUrl}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                        {g.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{g.name}</h3>
                      <p className="text-sm text-base-content/50">
                        {g.members?.length ?? 0} {t('group.members.members').toLowerCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
