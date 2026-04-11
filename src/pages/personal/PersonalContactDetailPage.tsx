import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import {
  EllipsisVertical as EllipsisVerticalIcon,
  Plus as PlusIcon,
  FileText as DocumentTextIcon,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { useAuthStore } from "@/store/authStore";
import { usePersonalStore } from "@/store/personalStore";
import { useUIStore } from "@/store/uiStore";
import {
  getContact,
  getPersonalExpenses,
  computePersonalNetAmount,
  settleAllWithContact,
  deleteContact,
  syncPersonalContactNameByReference,
  updateContact,
  type PersonalExpense,
} from "@/services/personalLedgerService";
import { syncGroupMemberNameByReference } from "@/services/groupService";
import { logger } from "@/utils/logger";

export function PersonalContactDetailPage() {
  const { t } = useTranslation();
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const currentContact = usePersonalStore((s) => s.currentContact);
  const setCurrentContact = usePersonalStore((s) => s.setCurrentContact);
  const currentExpenses = usePersonalStore((s) => s.currentExpenses);
  const setCurrentExpenses = usePersonalStore((s) => s.setCurrentExpenses);
  const isLoading = usePersonalStore((s) => s.isLoadingExpenses);
  const setIsLoading = usePersonalStore((s) => s.setIsLoadingExpenses);
  const clearCurrentContact = usePersonalStore((s) => s.clearCurrentContact);

  const [showMenu, setShowMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });

  const netAmount = computePersonalNetAmount(currentExpenses);
  const loadingDisplayName = currentContact?.displayName ?? "...";

  const loadData = useCallback(async () => {
    if (!user || !contactId) return;
    setIsLoading(true);
    try {
      const [contact, expenses] = await Promise.all([
        getContact(user.uid, contactId),
        getPersonalExpenses(user.uid, contactId),
      ]);
      if (contact) {
        setCurrentContact(contact);
        setEditName(contact.displayName);
      }
      setCurrentExpenses(expenses);
    } catch (err) {
      logger.error("personal.detail.load", "載入個人帳務失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setIsLoading(false);
    }
  }, [user, contactId]);

  useEffect(() => {
    // 清除前一個聯絡人的舊資料（避免短暫顯示過期內容）
    clearCurrentContact();
    loadData();
    // 不在 unmount 時清除，保留資料供 AddPersonalExpensePage 使用
  }, [loadData]);

  const closeConfirm = () =>
    setConfirmModal((prev) => ({ ...prev, open: false }));

  const handleSettleAll = () => {
    if (!user || !contactId || netAmount === 0) return;
    const contactName = currentContact?.displayName ?? "";
    setConfirmModal({
      open: true,
      title: t("personal.settleAll"),
      message: t("personal.settleAllConfirm", { name: contactName }),
      confirmLabel: t("common.button.confirm"),
      confirmVariant: "btn-primary",
      onConfirm: async () => {
        closeConfirm();
        try {
          await settleAllWithContact(user.uid, contactId, netAmount);
          showToast(t("personal.settled"), "success");
          loadData();
        } catch (err) {
          logger.error("personal.settleAll", "結清失敗", err);
          showToast(t("common.error"), "error");
        }
        setShowMenu(false);
      },
    });
  };

  const handleDeleteContact = () => {
    if (!user || !contactId) return;
    const contactName = currentContact?.displayName ?? "";
    setConfirmModal({
      open: true,
      title: t("personal.deleteContact"),
      message: t("personal.deleteContactConfirm", { name: contactName }),
      confirmLabel: t("common.button.delete"),
      confirmVariant: "btn-error",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteContact(user.uid, contactId);
          showToast(t("common.button.done"), "success");
          navigate("/personal");
        } catch (err) {
          logger.error("personal.deleteContact", "刪除聯絡人失敗", err);
          showToast(t("common.error"), "error");
        }
        setShowMenu(false);
      },
    });
  };

  const handleUpdateName = async () => {
    if (!user || !contactId || !editName.trim()) return;
    const normalizedName = editName.trim();
    const previousName = currentContact?.displayName?.trim() ?? "";

    try {
      await updateContact(user.uid, contactId, {
        displayName: normalizedName,
      });

      if (previousName && previousName.toLowerCase() !== normalizedName.toLowerCase()) {
        try {
          await Promise.all([
            syncGroupMemberNameByReference(user.uid, {
              previousDisplayName: previousName,
              nextDisplayName: normalizedName,
              linkedUserId: currentContact?.linkedUserId,
            }),
            // Keep same-identity contact records consistent across local lists.
            syncPersonalContactNameByReference(user.uid, {
              previousDisplayName: previousName,
              nextDisplayName: normalizedName,
              linkedUserId: currentContact?.linkedUserId,
            }),
          ]);
        } catch (syncErr) {
          logger.warn("personal.updateName.sync", "名稱跨區同步失敗", syncErr);
        }
      }

      setCurrentContact({ ...currentContact!, displayName: normalizedName });
      setEditingName(false);
      showToast(t("common.button.done"), "success");
    } catch (err) {
      logger.error("personal.updateName", "更新名稱失敗", err);
      showToast(t("common.error"), "error");
    }
  };

  if (isLoading && !currentContact) {
    return (
      <div className="relative flex min-h-[100dvh] md:min-h-[inherit] flex-col">
        <PageHeader
          title={
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="truncate text-lg font-bold">
                {loadingDisplayName}
              </span>
            </span>
          }
          onBack={() => navigate("/personal")}
          rightAction={
            <HeaderIconButton onClick={() => {}} disabled>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </HeaderIconButton>
          }
        />

        <div className="px-4 mt-4">
          <div className="stats stats-horizontal w-full flex border border-base-300 bg-base-100">
            <div className="stat flex-1 py-3 px-4 min-w-0">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-8 w-28 mt-2" />
              <div className="skeleton h-3 w-24 mt-2" />
            </div>
            <div className="stat flex-1 py-3 px-4 border-l border-base-300 min-w-0">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-8 w-28 mt-2" />
              <div className="skeleton h-3 w-24 mt-2" />
            </div>
          </div>
        </div>

        <div className="px-4 mt-6 flex-1">
          <div className="skeleton h-4 w-24" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0"
              >
                <div className="skeleton h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
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

  const displayName = currentContact?.displayName ?? "Contact";

  return (
    <div className="relative flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="truncate text-lg font-bold">{displayName}</span>
          </span>
        }
        onBack={() => navigate("/personal")}
        rightAction={
          <HeaderIconButton onClick={() => setShowMenu(true)}>
            <EllipsisVerticalIcon className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      {/* Net Amount Card */}
      <div className="px-4 mt-4">
        <div className="stats stats-horizontal w-full flex border border-base-300 bg-base-100">
          <div className="stat flex-1 py-3 px-4 min-w-0">
            <div className="stat-title text-success">
              {t("personal.owedToYouTotal")}
            </div>
            <div className="stat-value text-success text-2xl truncate">
              NT${(netAmount > 0 ? netAmount : 0).toLocaleString()}
            </div>
            <div className="stat-desc truncate">
              {t("personal.owesYou", { name: displayName })}
            </div>
          </div>

          <div className="stat flex-1 py-3 px-4 border-l border-base-300 min-w-0">
            <div className="stat-title text-warning">
              {t("personal.youOweTotal")}
            </div>
            <div className="stat-value text-warning text-2xl truncate">
              NT${(netAmount < 0 ? Math.abs(netAmount) : 0).toLocaleString()}
            </div>
            <div className="stat-desc truncate">
              {t("personal.youOwe", { name: displayName })}
            </div>
          </div>
        </div>
      </div>

      {/* Lending History */}
      <div className="px-4 mt-6 flex-1">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
          {t("personal.lendingHistory")}
        </h2>

        {isLoading ? (
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0"
              >
                <div className="skeleton h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="skeleton h-4 w-36" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-5 w-14" />
              </div>
            ))}
          </div>
        ) : currentExpenses.length === 0 ? (
          <div className="mt-8 text-center text-base-content/40 py-8">
            <DocumentTextIcon className="mx-auto mb-3 h-12 w-12" />
            <p>{t("personal.noContacts")}</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col">
            {currentExpenses.map((expense) => (
              <ExpenseCard
                key={expense.expenseId}
                expense={expense}
                contactName={displayName}
                contactAvatarUrl={currentContact?.avatarUrl}
                onClick={() =>
                  navigate(
                    `/personal/${contactId}/expenses/${expense.expenseId}`,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB - Add Expense */}
      <div className="fab-in-frame">
        <button
          className="btn btn-primary btn-md h-11 min-w-28 rounded-full px-4 text-sm shadow-lg"
          onClick={() => navigate(`/personal/${contactId}/expense/new`)}
          aria-label={t("personal.addExpense")}
        >
          <PlusIcon className="h-4 w-4" />
          <span>{t("personal.addExpense")}</span>
        </button>
      </div>

      <ActionSheet
        open={showMenu}
        onClose={() => setShowMenu(false)}
        items={[
          ...(netAmount !== 0
            ? [
                {
                  key: "settle-all",
                  label: t("personal.settleAll"),
                  tone: "default" as const,
                  onClick: handleSettleAll,
                },
              ]
            : []),
          {
            key: "edit-name",
            label: t("personal.editContactName"),
            tone: "default" as const,
            onClick: () => {
              setShowMenu(false);
              setEditName(currentContact?.displayName ?? "");
              setEditingName(true);
            },
          },
          {
            key: "delete-contact",
            label: t("personal.deleteContact"),
            tone: "danger" as const,
            onClick: handleDeleteContact,
          },
        ]}
      />

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        cancelLabel={t("common.button.cancel")}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />

      {editingName && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-3">{t("personal.editContactName")}</h3>
            <fieldset className="fieldset w-full">
              <legend className="fieldset-legend">{t("personal.contact")}</legend>
              <input
                type="text"
                className="input w-full"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleUpdateName();
                  }
                  if (e.key === "Escape") {
                    setEditingName(false);
                  }
                }}
                autoFocus
                maxLength={30}
                placeholder={t("personal.contactPlaceholder")}
              />
            </fieldset>
            <div className="modal-action">
              <button className="btn-white-soft" onClick={() => setEditingName(false)}>
                {t("common.button.cancel")}
              </button>
              <button
                className="btn-theme-green"
                onClick={() => {
                  void handleUpdateName();
                }}
                disabled={!editName.trim()}
              >
                {t("common.button.save")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setEditingName(false)} />
        </div>
      )}
    </div>
  );
}

function ExpenseCard({
  expense,
  contactName,
  contactAvatarUrl,
  onClick,
}: {
  expense: PersonalExpense;
  contactName: string;
  contactAvatarUrl?: string | null;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isSelfPaid = expense.paidBy === "self";
  const user = useAuthStore((s) => s.user);
  const isSettlement =
    (expense as unknown as Record<string, unknown>).isSettlement === true;
  const dateStr = expense.date
    ? new Date(
        ((expense.date as { seconds: number })?.seconds ?? 0) * 1000,
      ).toLocaleDateString()
    : "";

  return (
    <button
      className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0 text-left active:bg-base-200 transition-colors w-full"
      onClick={onClick}
    >
      <UserAvatar
        src={
          isSelfPaid ? (user?.avatarUrl ?? null) : (contactAvatarUrl ?? null)
        }
        name={isSelfPaid ? (user?.displayName ?? "?") : contactName}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold truncate">{expense.title}</p>
        </div>
        <p className="text-xs text-base-content/50">
          {dateStr && <span className="mr-1">{dateStr}</span>}
        </p>
        <p className="text-xs text-base-content/50">
          {isSettlement
            ? t("personal.contactSettledByName", { name: contactName })
            : isSelfPaid
            ? t("personal.paidFor", { name: contactName })
            : t("personal.contactPaidByName", { name: contactName })}
        </p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span
          className={`font-bold ${isSelfPaid ? "text-success" : "text-warning"}`}
        >
          {isSelfPaid ? "+" : "-"}NT${expense.amount.toLocaleString()}
        </span>
      </div>
    </button>
  );
}
