import { useEffect, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useAuthStore } from "@/store/authStore";
import { usePersonalStore } from "@/store/personalStore";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { loadContactsWithNet, type ContactWithNet } from "@/lib/listQueries";

export function PersonalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const setContacts = usePersonalStore((s) => s.setContacts);

  const [search, setSearch] = useState("");
  const [showSettled, setShowSettled] = useState(false);

  // 與首頁共用同一份快取：從首頁切過來時可立即顯示
  const { data, loading: isLoading } = useCachedQuery(
    user ? `personal:${user.uid}` : null,
    (source) => loadContactsWithNet(user!.uid, source),
  );
  const contactsWithNet = useMemo(() => data ?? [], [data]);

  // 新增帳務頁會使用 store 內的聯絡人清單
  useEffect(() => {
    if (data) setContacts(data);
  }, [data, setContacts]);

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
    <div className="flex h-full flex-col overflow-hidden">
      {/* 標題、搜尋與統計固定置頂，只有下方清單捲動 */}
      <div className="shrink-0 px-4 pt-4">
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
      </div>

      <ScrollArea className="px-4 pb-40" restoreKey="personal">
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
      </ScrollArea>

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
            <p className="font-bold text-success">
              +NT${contact.netAmount.toLocaleString()}
            </p>
          ) : (
            <p className="font-bold text-warning">
              -NT${Math.abs(contact.netAmount).toLocaleString()}
            </p>
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
