import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGroupStore, type Expense, type Settlement, type Group } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { SummaryTab } from './tabs/SummaryTab';
import { SettleTab } from './tabs/SettleTab';
import { MembersTab } from './tabs/MembersTab';
import {
  ChevronLeftIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  ShareIcon,
  PencilIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';

type TabKey = 'summary' | 'settle' | 'members';

export function GroupDetailPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [showMenu, setShowMenu] = useState(false);

  const currentGroup = useGroupStore((s) => s.currentGroup);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const setExpenses = useGroupStore((s) => s.setExpenses);
  const setSettlements = useGroupStore((s) => s.setSettlements);
  const clearCurrentGroup = useGroupStore((s) => s.clearCurrentGroup);
  const setUnsubscribeExpenses = useGroupStore((s) => s.setUnsubscribeExpenses);
  const setUnsubscribeSettlements = useGroupStore((s) => s.setUnsubscribeSettlements);
  const setUnsubscribeGroup = useGroupStore((s) => s.setUnsubscribeGroup);

  useEffect(() => {
    if (!groupId) return;

    const groupUnsub = onSnapshot(
      doc(db, 'groups', groupId),
      (snap) => {
        if (snap.exists()) {
          setCurrentGroup({ groupId: snap.id, ...snap.data() } as Group);
        }
      },
      (err) => logger.error('group.subscribe', '群組監聽失敗', err)
    );
    setUnsubscribeGroup(groupUnsub);

    const expensesUnsub = onSnapshot(
      query(
        collection(db, `groups/${groupId}/expenses`),
        orderBy('date', 'desc')
      ),
      (snap) => {
        const expenses = snap.docs.map((d) => ({
          ...d.data(),
          expenseId: d.id,
        })) as Expense[];
        setExpenses(expenses);
      },
      (err) => logger.error('expenses.subscribe', '帳務監聽失敗', err)
    );
    setUnsubscribeExpenses(expensesUnsub);

    const settlementsUnsub = onSnapshot(
      collection(db, `groups/${groupId}/settlements`),
      (snap) => {
        const settlements = snap.docs.map((d) => ({
          ...d.data(),
          settlementId: d.id,
        })) as Settlement[];
        setSettlements(settlements);
      },
      (err) => logger.error('settlements.subscribe', '清算監聽失敗', err)
    );
    setUnsubscribeSettlements(settlementsUnsub);

    return () => {
      clearCurrentGroup();
    };
  }, [groupId]);

  const handleShareInvite = () => {
    const inviteUrl = `${window.location.origin}/join/${currentGroup?.inviteCode ?? ''}`;
    navigator.clipboard.writeText(inviteUrl);
    showToast(t('group.members.linkCopied'), 'success');
    setShowMenu(false);
  };

  const handleLeaveGroup = () => {
    if (!window.confirm(t('group.detail.leaveConfirm'))) return;
    // TODO: implement leave group
    setShowMenu(false);
  };

  if (!currentGroup) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'summary', label: t('group.summary.title') },
    { key: 'settle', label: t('group.settle.title') },
    { key: 'members', label: t('group.members.title') },
  ];

  const isCreator = currentGroup.createdBy === user?.uid;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Cover Image */}
      {currentGroup.coverUrl && (
        <div className="relative h-40 w-full">
          <img
            src={currentGroup.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-base-200/80 to-transparent" />
        </div>
      )}

      {/* Header */}
      <div className={`px-4 ${currentGroup.coverUrl ? '-mt-12 relative z-10' : 'pt-4'} pb-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="btn btn-ghost btn-sm btn-circle flex-shrink-0"
              onClick={() => navigate('/home')}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{currentGroup.name}</h1>
              <p className="text-xs text-base-content/50">
                {t('common.members_count', { count: currentGroup.members?.length ?? 0 })}
              </p>
            </div>
          </div>

          {/* More menu */}
          <div className="dropdown dropdown-end">
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setShowMenu(!showMenu)}
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            {showMenu && (
              <ul className="dropdown-content menu bg-base-200 rounded-box z-50 w-56 p-2 shadow-lg">
                <li>
                  <button onClick={handleShareInvite}>
                    <ShareIcon className="h-4 w-4" />
                    {t('group.detail.shareInvite')}
                  </button>
                </li>
                <li>
                  <button onClick={() => { setShowMenu(false); }}>
                    <PencilIcon className="h-4 w-4" />
                    {t('group.detail.editGroup')}
                  </button>
                </li>
                <li>
                  <button
                    className={isCreator ? 'text-error' : ''}
                    onClick={handleLeaveGroup}
                  >
                    <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                    {isCreator ? t('group.detail.deleteGroup') : t('group.detail.leaveGroup')}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            className={`tab ${activeTab === tab.key ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-4 pt-4 pb-24">
        {activeTab === 'summary' && <SummaryTab />}
        {activeTab === 'settle' && <SettleTab />}
        {activeTab === 'members' && <MembersTab />}
      </div>

      {/* FAB - Add Expense (always visible) */}
      <div className="fixed bottom-6 right-4 z-50">
        <button
          className="btn btn-primary btn-circle btn-lg shadow-xl"
          onClick={() => navigate(`/groups/${groupId}/expense/new`)}
          aria-label={t('expense.add')}
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Backdrop for dropdown */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
