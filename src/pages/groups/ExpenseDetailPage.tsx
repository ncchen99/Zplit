import { useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useGroupStore, type Expense, type Group } from "@/store/groupStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { Pencil as PencilIcon } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

export function ExpenseDetailPage() {
  const { t } = useTranslation();
  const { groupId, expenseId } = useParams<{
    groupId: string;
    expenseId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const storeGroup = useGroupStore((s) => s.currentGroup);
  const storeExpenses = useGroupStore((s) => s.expenses);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const setExpenses = useGroupStore((s) => s.setExpenses);

  const needsFetch =
    !storeGroup || storeGroup.groupId !== groupId || storeExpenses.length === 0;
  const loading = needsFetch;

  useEffect(() => {
    if (!groupId) return;

    const groupUnsub = onSnapshot(doc(db, "groups", groupId), (snap) => {
      if (snap.exists()) {
        setCurrentGroup({ groupId: snap.id, ...snap.data() } as Group);
      }
    });

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
    );

    return () => {
      groupUnsub();
      expensesUnsub();
    };
  }, [groupId, setCurrentGroup, setExpenses]);

  const currentGroup = storeGroup?.groupId === groupId ? storeGroup : null;
  const expense = storeExpenses.find((e) => e.expenseId === expenseId);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(currentGroup?.memberNameMap ?? {}).forEach(
      ([memberId, displayName]) => {
        map.set(memberId, displayName);
      },
    );
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.displayName));
    return map;
  }, [currentGroup]);

  // 舊資料（按金額／比例時把所有成員都寫進去）可能留有 0 元的分帳，
  // 沒有一起分帳的人不該出現在明細裡
  const visibleSplits = useMemo(
    () => expense?.splits?.filter((s) => s.amount > 0) ?? [],
    [expense],
  );

  const memberAvatarMap = useMemo(() => {
    const map = new Map<string, string | null>();
    currentGroup?.members?.forEach((m) => map.set(m.memberId, m.avatarUrl));
    return map;
  }, [currentGroup]);

  // 邀請預覽（非成員）只能看，編輯鍵改成提示登入；返回時要帶回邀請碼
  const canEdit = !!user && currentGroup?.memberUids?.[user.uid] === true;
  const backTo = `/groups/${groupId}${
    !canEdit && inviteCode ? `?invite=${inviteCode}` : ""
  }`;

  // Always show header
  const header = (
    <PageHeader
      title={t("expense.detail.title")}
      onBack={() => navigate(backTo)}
      rightAction={
        expense ? (
          // 預覽模式仍然可以按，但只回覆一句提示，讓人知道為什麼不能改
          <HeaderIconButton
            onClick={() =>
              canEdit
                ? navigate(`/groups/${groupId}/expense/${expenseId}/edit`)
                : showToast(t("group.preview.editHint"), "warning")
            }
          >
            <PencilIcon className="h-5 w-5" />
          </HeaderIconButton>
        ) : (
          <HeaderIconButton onClick={() => {}} disabled>
            <PencilIcon className="h-5 w-5" />
          </HeaderIconButton>
        )
      }
    />
  );

  if (loading || !expense) {
    return (
      <div className="flex min-h-full md:min-h-[inherit] flex-col">
        {header}

        <div className="px-4 pb-16 flex flex-col gap-5 mt-4">
          {/* Summary stat skeleton */}
          <div className="stats w-full border border-base-300 bg-base-100">
            <div className="stat">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-10 w-32 mt-2" />
              <div className="skeleton h-3 w-36 mt-2" />
            </div>
          </div>

          {/* Payer skeleton */}
          <div>
            <div className="skeleton h-3 w-16 mb-2" />
            <div className="flex items-center gap-3 py-2">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="skeleton h-5 w-28" />
            </div>
          </div>

          {/* Split details skeleton */}
          <div>
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="flex flex-col">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 border-b border-base-200 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="skeleton h-8 w-8 rounded-full" />
                    <div className="skeleton h-4 w-24" />
                  </div>
                  <div className="skeleton h-4 w-16" />
                </div>
              ))}
            </div>
          </div>

          {/* Description and receipt placeholders */}
          <div>
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-4/5" />
            </div>
          </div>

          <div>
            <div className="skeleton h-3 w-16 mb-2" />
            <div className="skeleton h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const payerName =
    memberMap.get(expense.paidBy) ?? t("group.members.unknownMember");
  const payerAvatar = memberAvatarMap.get(expense.paidBy) ?? null;
  const date = expense.date?.seconds
    ? new Date(expense.date.seconds * 1000).toLocaleString()
    : "";

  return (
    <div className="flex min-h-full md:min-h-[inherit] flex-col">
      {header}

      <div className="px-4 pb-16 flex flex-col gap-5 mt-4">
        {/* Summary stat */}
        <div className="stats w-full border border-base-300 bg-base-100">
          <div className="stat">
            <div className="stat-title flex items-center gap-2">{expense.title}</div>
            <div className="stat-value text-warning">
              NT${expense.amount.toLocaleString()}
            </div>
            {date && <div className="stat-desc">{date}</div>}
          </div>
        </div>

        {/* Payer */}
        <div>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {t("expense.paidBy")}
          </h3>
          <div className="flex items-center gap-3 py-2">
            <UserAvatar src={payerAvatar} name={payerName} />
            <span className="font-semibold">{payerName}</span>
          </div>
        </div>

        {/* Split Details */}
        <div>
          <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {t("expense.splitWith")}
          </h3>
          <div className="flex flex-col">
            {visibleSplits.map((split) => {
              const name =
                memberMap.get(split.memberId) ?? t("group.members.unknownMember");
              const avatar = memberAvatarMap.get(split.memberId) ?? null;
              return (
                <div
                  key={split.memberId}
                  className="flex items-center justify-between py-3 border-b border-base-200 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={avatar}
                      name={name}
                      size="w-8"
                      textSize="text-xs"
                    />
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <span className="text-sm font-bold">
                    NT${split.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Description */}
        {expense.description && (
          <div>
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
              {t("expense.description")}
            </h3>
            <p className="text-sm">{expense.description}</p>
          </div>
        )}

        {/* Receipt Image */}
        {expense.imageUrl && (
          <div>
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
              {t("expense.receipt")}
            </h3>
            <div className="rounded-xl overflow-hidden bg-base-200">
              <img
                src={expense.imageUrl}
                alt="Receipt"
                className="w-full object-contain max-h-96"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
