import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Plus as PlusIcon,
  Search as MagnifyingGlassIcon,
  ChevronDown as ChevronDownIcon,
  Banknote as BanknotesIcon,
  CircleCheck as CheckCircleIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuthStore } from "@/store/authStore";
import { usePersonalStore } from "@/store/personalStore";
import {
  getContacts,
  getPersonalExpenses,
  computePersonalNetAmount,
  type PersonalContact,
} from "@/services/personalLedgerService";
import { useUIStore } from "@/store/uiStore";
import { logger } from "@/utils/logger";

interface ContactWithNet extends PersonalContact {
  netAmount: number;
  lastInteraction: Date | null;
}

export function PersonalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const setContacts = usePersonalStore((s) => s.setContacts);
  const isLoading = usePersonalStore((s) => s.isLoadingContacts);
  const setIsLoading = usePersonalStore((s) => s.setIsLoadingContacts);

  const [search, setSearch] = useState("");
  const [showSettled, setShowSettled] = useState(false);
  const [contactsWithNet, setContactsWithNet] = useState<ContactWithNet[]>([]);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const rawContacts = await getContacts(user.uid);
      setContacts(rawContacts);

      // Compute net amounts for each contact
      const withNet: ContactWithNet[] = await Promise.all(
        rawContacts.map(async (c) => {
          const expenses = await getPersonalExpenses(user.uid, c.contactId);
          const netAmount = computePersonalNetAmount(expenses);
          const lastDate =
            expenses.length > 0
              ? new Date(
                  ((expenses[0].date as { seconds: number })?.seconds ?? 0) *
                    1000,
                )
              : null;
          return { ...c, netAmount, lastInteraction: lastDate };
        }),
      );
      setContactsWithNet(withNet);
    } catch (err) {
      logger.error("personal.load", "載入個人記錄失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filtered = contactsWithNet.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  const unsettled = filtered.filter((c) => c.netAmount !== 0);
  const settled = filtered.filter((c) => c.netAmount === 0);
  const isSearching = search.trim().length > 0;
  const shouldShowSettled = showSettled || (isSearching && settled.length > 0);

  const totalOwed = unsettled
    .filter((c) => c.netAmount > 0)
    .reduce((sum, c) => sum + c.netAmount, 0);
  const totalOwe = unsettled
    .filter((c) => c.netAmount < 0)
    .reduce((sum, c) => sum + Math.abs(c.netAmount), 0);

  return (
    <div className="px-4 pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("personal.title")}
        </h1>
      </div>

      {/* Search */}
      <div className="mt-4">
        <label className="input w-full flex items-center gap-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-base-content/40" />
          <input
            type="text"
            className="grow"
            placeholder={t("personal.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {/* Net Summary */}
      {contactsWithNet.length > 0 && (totalOwed > 0 || totalOwe > 0) && (
        <div className="mt-4 stats stats-horizontal w-full flex border border-base-300 bg-base-100">
          <div className="stat flex-1 py-3 px-4 min-w-0">
            <div className="stat-title text-success">
              {t("personal.owedToYouTotal")}
            </div>
            <div className="stat-value text-success text-2xl truncate">
              NT${totalOwed.toLocaleString()}
            </div>
          </div>
          <div className="stat flex-1 py-3 px-4 border-l border-base-300 min-w-0">
            <div className="stat-title text-warning">
              {t("personal.youOweTotal")}
            </div>
            <div className="stat-value text-warning text-2xl truncate">
              NT${totalOwe.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="mt-4 space-y-3">
          <div className="skeleton h-20 w-full rounded-2xl" />
          <div className="skeleton h-4 w-20" />
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 py-2">
              <div className="skeleton h-12 w-12 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-5 w-16" />
            </div>
          ))}
        </div>
      ) : contactsWithNet.length === 0 ? (
        <div className="mt-16 text-center text-base-content/40">
          <BanknotesIcon className="mx-auto mb-3 h-12 w-12" />
          <p>{t("personal.noContacts")}</p>
          <p className="text-sm mt-1">{t("personal.noContactsHint")}</p>
        </div>
      ) : (
        <>
          {/* Unsettled */}
          {unsettled.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                {t("personal.unsettled")}
              </h2>
              <div className="mt-2 flex flex-col">
                {unsettled
                  .sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount))
                  .map((c) => (
                    <ContactCard
                      key={c.contactId}
                      contact={c}
                      onClick={() => navigate(`/personal/${c.contactId}`)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Settled (collapsible) */}
          {settled.length > 0 && (
            <div className="mt-6">
              <button
                className="flex w-full items-center gap-1 text-xs font-semibold text-base-content/50 uppercase tracking-wider"
                onClick={() => setShowSettled(!showSettled)}
              >
                {t("personal.settledSection")}（{settled.length}）
                <ChevronDownIcon
                  className={`h-3 w-3 transition-transform ${shouldShowSettled ? "rotate-180" : ""}`}
                />
              </button>
              {shouldShowSettled && (
                <div className="mt-2 flex flex-col">
                  {settled.map((c) => (
                    <ContactCard
                      key={c.contactId}
                      contact={c}
                      onClick={() => navigate(`/personal/${c.contactId}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* FAB - 新增個人分帳 */}
      <div className="fab-in-frame fab-in-frame-nav">
        <button
          className="btn btn-primary btn-md h-11 min-w-28 rounded-full px-4 text-sm shadow-lg"
          onClick={() => navigate("/personal/expense/new")}
          aria-label={t("personal.addExpense")}
        >
          <PlusIcon className="h-4 w-4" />
          <span>{t("personal.addExpense")}</span>
        </button>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  onClick,
}: {
  contact: ContactWithNet;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isOwed = contact.netAmount > 0;
  const isSettled = contact.netAmount === 0;

  return (
    <div
      className="flex items-center gap-3 py-3 cursor-pointer active:bg-base-200/50 transition-colors border-b border-base-200 last:border-b-0"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 w-full">
        <UserAvatar src={contact.avatarUrl} name={contact.displayName} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{contact.displayName}</p>
          {contact.lastInteraction && (
            <p className="text-xs text-base-content/40">
              {t("personal.lastRecordCreated", {
                time: formatRelativeTime(contact.lastInteraction, t),
              })}
            </p>
          )}
        </div>
        <div className="text-right">
          {isSettled ? (
            <span className="inline-flex items-center gap-1 text-sm text-base-content/40">
              <CheckCircleIcon className="h-4 w-4" />
              {t("personal.settled")}
            </span>
          ) : isOwed ? (
            <div>
              <p className="text-xs text-success">
                {t("personal.owedToYouTotal")}
              </p>
              <p className="font-bold text-success">
                NT${contact.netAmount.toLocaleString()}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-warning">
                {t("personal.youOweTotal")}
              </p>
              <p className="font-bold text-warning">
                NT${Math.abs(contact.netAmount).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(
  date: Date,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return t("common.today");
  if (days < 7) return t("common.daysAgo", { count: days });
  const weeks = Math.floor(days / 7);
  return t("common.weeksAgo", { count: weeks });
}
