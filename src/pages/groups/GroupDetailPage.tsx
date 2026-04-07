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
import { logger } from '@/utils/logger';
import { SummaryTab } from './tabs/SummaryTab';
import { SettleTab } from './tabs/SettleTab';
import { MembersTab } from './tabs/MembersTab';
import { ChevronLeftIcon, PlusIcon } from '@heroicons/react/24/outline';

type TabKey = 'summary' | 'settle' | 'members';

export function GroupDetailPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

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

    // Subscribe to group document
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

    // Subscribe to expenses
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

    // Subscribe to settlements
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

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm btn-circle" onClick={() => navigate('/home')}>
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold truncate">{currentGroup.name}</h1>
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
      <div className="flex-1 px-4 pt-4 pb-20">
        {activeTab === 'summary' && <SummaryTab />}
        {activeTab === 'settle' && <SettleTab />}
        {activeTab === 'members' && <MembersTab />}
      </div>

      {/* FAB - Add Expense */}
      {activeTab === 'summary' && (
        <div className="fab fixed bottom-20 right-4 z-50">
          <button
            className="btn btn-primary btn-circle btn-lg shadow-xl"
            onClick={() => navigate(`/groups/${groupId}/expense/new`)}
            aria-label={t('expense.add')}
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}
