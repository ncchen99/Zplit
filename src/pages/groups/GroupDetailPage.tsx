import { useEffect } from 'react';
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
import { useUIStore } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { SummaryTab } from './tabs/SummaryTab';
import { SettleTab } from './tabs/SettleTab';
import { MembersTab } from './tabs/MembersTab';
import { SettingsTab } from './tabs/SettingsTab';
import { useState } from 'react';
import {
  ChevronLeftIcon,
  PlusIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';

type TabKey = 'summary' | 'settle' | 'members' | 'settings';

export function GroupDetailPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const currentGroup = useGroupStore((s) => s.currentGroup);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const setExpenses = useGroupStore((s) => s.setExpenses);
  const setSettlements = useGroupStore((s) => s.setSettlements);
  const clearCurrentGroup = useGroupStore((s) => s.clearCurrentGroup);
  const unsubscribeListeners = useGroupStore((s) => s.unsubscribeListeners);
  const setUnsubscribeExpenses = useGroupStore((s) => s.setUnsubscribeExpenses);
  const setUnsubscribeSettlements = useGroupStore((s) => s.setUnsubscribeSettlements);
  const setUnsubscribeGroup = useGroupStore((s) => s.setUnsubscribeGroup);

  useEffect(() => {
    if (!groupId) return;

    // 若切換到不同群組，清除舊資料
    const storeGroupId = useGroupStore.getState().currentGroupId;
    if (storeGroupId && storeGroupId !== groupId) {
      clearCurrentGroup();
    }

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
      // 僅取消 Firebase 訂閱，保留 store 資料供 AddExpensePage 等子頁面讀取
      unsubscribeListeners();
    };
  }, [groupId]);

  const handleShare = async () => {
    if (!currentGroup) return;
    const inviteUrl = `${window.location.origin}/join/${currentGroup.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('group.detail.shareTitle', { name: currentGroup.name }),
          text: t('group.detail.shareText'),
          url: inviteUrl,
        });
      } catch {
        // User cancelled — no action needed
      }
    } else {
      navigator.clipboard.writeText(inviteUrl);
      showToast(t('group.members.linkCopied'), 'success');
    }
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
    { key: 'settings', label: t('group.settings.title') },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header — always at top */}
      <div className="px-4 pt-4 pb-2">
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

          {/* Share button */}
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={handleShare}
            aria-label={t('group.detail.shareInvite')}
          >
            <ShareIcon className="h-5 w-5" />
          </button>
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
        {activeTab === 'summary' && <SummaryTab onNavigateSettle={() => setActiveTab('settle')} />}
        {activeTab === 'settle' && <SettleTab />}
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      {/* FAB - Add Expense */}
      <div className="fixed bottom-6 right-4 z-50">
        <button
          className="btn btn-primary btn-circle btn-lg shadow-xl"
          onClick={() => navigate(`/groups/${groupId}/expense/new`)}
          aria-label={t('expense.add')}
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
