import { useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  useGroupStore,
  type Expense,
  type Settlement,
  type Group,
} from "@/store/groupStore";
import { useUIStore } from "@/store/uiStore";
import { logger } from "@/utils/logger";
import { SummaryTab } from "./tabs/SummaryTab";
import { SettleTab } from "./tabs/SettleTab";
import { MembersTab } from "./tabs/MembersTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { useState } from "react";
import { Plus as PlusIcon, Share2 as ShareIcon } from "lucide-react";

type TabKey = "summary" | "settle" | "members" | "settings";
type GroupDetailLocationState = { from?: string };

export function GroupDetailPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useUIStore((s) => s.showToast);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");

  const navigationState = location.state as GroupDetailLocationState | null;
  const backTarget = navigationState?.from?.startsWith("/")
    ? navigationState.from
    : "/home";

  const currentGroup = useGroupStore((s) => s.currentGroup);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const setExpenses = useGroupStore((s) => s.setExpenses);
  const setSettlements = useGroupStore((s) => s.setSettlements);
  const clearCurrentGroup = useGroupStore((s) => s.clearCurrentGroup);
  const unsubscribeListeners = useGroupStore((s) => s.unsubscribeListeners);
  const setUnsubscribeExpenses = useGroupStore((s) => s.setUnsubscribeExpenses);
  const setUnsubscribeSettlements = useGroupStore(
    (s) => s.setUnsubscribeSettlements,
  );
  const setUnsubscribeGroup = useGroupStore((s) => s.setUnsubscribeGroup);

  useEffect(() => {
    if (!groupId) return;

    // 若切換到不同群組，清除舊資料
    const storeGroupId = useGroupStore.getState().currentGroupId;
    if (storeGroupId && storeGroupId !== groupId) {
      clearCurrentGroup();
    }

    const groupUnsub = onSnapshot(
      doc(db, "groups", groupId),
      (snap) => {
        if (snap.exists()) {
          setCurrentGroup({ groupId: snap.id, ...snap.data() } as Group);
        }
      },
      (err) => logger.error("group.subscribe", "群組監聽失敗", err),
    );
    setUnsubscribeGroup(groupUnsub);

    const expensesUnsub = onSnapshot(
      query(
        collection(db, `groups/${groupId}/expenses`),
        orderBy("date", "desc"),
      ),
      (snap) => {
        const expenses = snap.docs.map((d) => ({
          ...d.data(),
          expenseId: d.id,
        })) as Expense[];
        setExpenses(expenses);
      },
      (err) => logger.error("expenses.subscribe", "帳務監聽失敗", err),
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
      (err) => logger.error("settlements.subscribe", "結算監聽失敗", err),
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
          title: t("group.detail.shareTitle", { name: currentGroup.name }),
          text: t("group.detail.shareText"),
          url: inviteUrl,
        });
      } catch {
        // User cancelled — no action needed
      }
    } else {
      navigator.clipboard.writeText(inviteUrl);
      showToast(t("group.members.linkCopied"), "success");
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "summary", label: t("group.summary.title") },
    { key: "settle", label: t("group.settle.title") },
    { key: "members", label: t("group.members.title") },
    { key: "settings", label: t("group.settings.title") },
  ];

  if (!currentGroup) {
    return (
      <div className="relative flex min-h-[100dvh] md:min-h-[inherit] flex-col">
        <PageHeader
          title={t("group.summary.title")}
          onBack={() => navigate(backTarget)}
          rightAction={
            <HeaderIconButton onClick={() => {}} disabled>
              <ShareIcon className="h-5 w-5" />
            </HeaderIconButton>
          }
        />

        <div role="tablist" className="tabs tabs-border px-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              className={`tab ${tab.key === "summary" ? "tab-active" : ""}`}
              disabled
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 px-4 pt-4 pb-24">
          <div className="space-y-4">
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-44 w-full rounded-2xl" />
            <div className="skeleton h-4 w-28" />
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-5 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className="fab-in-frame" aria-hidden="true">
          <div className="skeleton h-16 w-16 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={
          <span className="inline-flex max-w-full flex-col items-center justify-center leading-none">
            <span className="max-w-full truncate text-base font-bold leading-tight">
              {currentGroup.name}
            </span>
            <span className="mt-0.5 text-[11px] font-medium leading-none text-base-content/60">
              {t("common.members_count", {
                count: currentGroup.members?.length ?? 0,
              })}
            </span>
          </span>
        }
        onBack={() => navigate(backTarget)}
        rightAction={
          <HeaderIconButton onClick={handleShare}>
            <ShareIcon className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            className={`tab ${activeTab === tab.key ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-4 pt-4 pb-24">
        {activeTab === "summary" && (
          <SummaryTab onNavigateSettle={() => setActiveTab("settle")} />
        )}
        {activeTab === "settle" && <SettleTab />}
        {activeTab === "members" && <MembersTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>

      {/* FAB - Add Expense */}
        <div className="fab-in-frame">
        <button
          className="btn btn-primary btn-circle btn-lg shadow-xl"
          onClick={() => navigate(`/groups/${groupId}/expense/new`)}
          aria-label={t("expense.add")}
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
