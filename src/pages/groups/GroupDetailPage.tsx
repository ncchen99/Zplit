import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { logger } from "@/utils/logger";
import { SummaryTab } from "./tabs/SummaryTab";
import { SettleTab } from "./tabs/SettleTab";
import { MembersTab } from "./tabs/MembersTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { GroupAccessProvider } from "./groupAccess";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { buildExternalBrowserUrl } from "@/utils/browser";
import { Plus as PlusIcon, Share2 as ShareIcon } from "lucide-react";

type TabKey = "summary" | "settle" | "members" | "settings";
type GroupDetailLocationState = { from?: string };

const VALID_TABS: TabKey[] = ["summary", "settle", "members", "settings"];
// 預覽模式沒有編輯權限，群組設定分頁整個隱藏
const PREVIEW_TABS: TabKey[] = ["summary", "settle", "members"];

/** 判定為換頁的最小水平位移，並要求水平分量明顯大於垂直，避免誤判成捲動 */
const SWIPE_MIN_DISTANCE = 60;
const SWIPE_DIRECTION_RATIO = 1.5;

export function GroupDetailPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  const navigationState = location.state as GroupDetailLocationState | null;
  const backTarget = navigationState?.from?.startsWith("/")
    ? navigationState.from
    : "/home";

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const inviteCode = searchParams.get("invite");

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

  // 只有 store 裡的群組確實是網址上的這一個時才採用，避免沿用上一個群組的殘留資料
  const group = currentGroup?.groupId === groupId ? currentGroup : null;
  const isMember = !!user && group?.memberUids?.[user.uid] === true;
  // 非成員唯讀預覽：必須帶著與群組相符的邀請碼
  const isInvitedPreview = !!inviteCode && group?.inviteCode === inviteCode;
  const canEdit = isMember;

  const tabs = useMemo(() => {
    const labels: Record<TabKey, string> = {
      summary: t("group.summary.title"),
      settle: t("group.settle.title"),
      members: t("group.members.title"),
      settings: t("group.settings.title"),
    };
    return (canEdit ? VALID_TABS : PREVIEW_TABS).map((key) => ({
      key,
      label: labels[key],
    }));
  }, [canEdit, t]);

  const activeTab: TabKey = tabs.some((tab) => tab.key === rawTab)
    ? (rawTab as TabKey)
    : "summary";
  const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);

  const setActiveTab = (tab: TabKey) => {
    // 直接改寫既有查詢字串，才不會把預覽用的 invite 參數弄丟
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: false });
  };

  // 切換分頁時的進場方向（往後 = 從右邊滑進來）。
  // 在 render 期間比對上一個 index，動畫才會和新的分頁內容同一幀出現。
  const [prevIndex, setPrevIndex] = useState(activeIndex);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">(
    "right",
  );
  if (prevIndex !== activeIndex) {
    setSlideDirection(activeIndex > prevIndex ? "right" : "left");
    setPrevIndex(activeIndex);
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 換分頁後回到頂端，否則會停在上一個分頁的捲動位置
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) return;

    const nextIndex = dx < 0 ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex < 0 || nextIndex >= tabs.length) return;
    setActiveTab(tabs[nextIndex].key);
  };

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
  }, [
    clearCurrentGroup,
    groupId,
    setCurrentGroup,
    setExpenses,
    setSettlements,
    setUnsubscribeExpenses,
    setUnsubscribeGroup,
    setUnsubscribeSettlements,
    unsubscribeListeners,
  ]);

  // 既不是成員、邀請碼也對不上：不該看到這個群組
  useEffect(() => {
    if (!group || isMember || isInvitedPreview) return;
    navigate(authStatus === "ready" ? "/home" : "/login", { replace: true });
  }, [authStatus, group, isInvitedPreview, isMember, navigate]);

  /** 預覽者要新增／編輯時，先登入或註冊，完成後回到加入群組流程綁定成員 */
  const requireAuth = () => {
    const joinPath = group?.inviteCode ? `/join/${group.inviteCode}` : "/home";
    if (authStatus === "guest") {
      navigate("/login", { state: { redirectTo: joinPath } });
      return;
    }
    if (authStatus === "onboarding") {
      navigate("/onboarding", { state: { redirectTo: joinPath } });
      return;
    }
    // 已登入但還不是成員：直接進加入流程
    navigate(joinPath);
  };

  const handleShare = async () => {
    if (!group) return;
    // 帶上 openExternalBrowser=1，讓從 LINE 點開的人直接進系統瀏覽器，
    // 而不是無法使用 Google 登入的 LINE 內建瀏覽器
    const inviteUrl = buildExternalBrowserUrl(
      `${window.location.origin}/join/${group.inviteCode}`,
    );
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("group.detail.shareTitle", { name: group.name }),
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

  if (!group) {
    return (
      <div className="relative flex h-full min-h-[inherit] flex-col overflow-hidden">
        <PageHeader
          title={t("group.summary.title")}
          onBack={() => navigate(backTarget)}
          rightAction={
            <HeaderIconButton onClick={() => {}} disabled>
              <ShareIcon className="h-5 w-5" />
            </HeaderIconButton>
          }
        />

        <div role="tablist" className="tabs tabs-border shrink-0 px-4">
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

        <div className="flex-1 overflow-hidden px-4 pt-4 pb-24">
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
    <GroupAccessProvider value={{ canEdit, requireAuth }}>
      {/* 外層不捲動：header 與 tabs 固定，只有下方內容區可以上下捲動 */}
      <div className="relative flex h-full min-h-[inherit] flex-col overflow-hidden">
        <PageHeader
          title={
            <span className="inline-flex max-w-full flex-col items-center justify-center leading-none">
              <span className="max-w-full truncate text-base font-bold leading-tight">
                {group.name}
              </span>
              <span className="mt-0.5 text-[11px] font-medium leading-none text-base-content/60">
                {t("common.members_count", {
                  count: group.members?.length ?? 0,
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
        <div role="tablist" className="tabs tabs-border shrink-0 px-4">
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

        {!canEdit && (
          <p className="shrink-0 bg-base-200/60 px-4 py-2 text-center text-xs text-base-content/60">
            {t("group.preview.banner")}
          </p>
        )}

        {/* Tab Content：左右滑動切換分頁 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            key={activeTab}
            className={
              slideDirection === "right"
                ? "tab-panel-in-right"
                : "tab-panel-in-left"
            }
          >
            {activeTab === "summary" && (
              <SummaryTab onNavigateSettle={() => setActiveTab("settle")} />
            )}
            {activeTab === "settle" && <SettleTab />}
            {activeTab === "members" && <MembersTab />}
            {activeTab === "settings" && <SettingsTab />}
          </div>
        </div>

        {/* FAB - Add Expense */}
        <div className="fab-in-frame">
          <button
            className="btn btn-primary btn-md h-11 min-w-28 rounded-full px-4 text-sm shadow-lg"
            onClick={() =>
              canEdit ? navigate(`/groups/${groupId}/expense/new`) : requireAuth()
            }
            aria-label={canEdit ? t("expense.add") : t("group.preview.joinToEdit")}
          >
            <PlusIcon className="h-4 w-4" />
            <span>{canEdit ? t("expense.add") : t("group.preview.joinToEdit")}</span>
          </button>
        </div>
      </div>
    </GroupAccessProvider>
  );
}
