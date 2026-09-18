import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import {
  getTimestampMs,
  loadContactsWithNet,
  loadGroupsWithNet,
} from "@/lib/listQueries";
import {
  ChevronRight as ChevronRightIcon,
  FileText as DocumentTextIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { GroupListItem } from "@/components/ui/GroupListItem";

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid;

  // 只計算首頁顯示的前 3 個群組淨額，避免過多讀取
  const groupsQuery = useCachedQuery(
    uid ? `home-groups:${uid}` : null,
    (source) => loadGroupsWithNet(uid!, source, 3),
    (d) => d.groups.length > 0,
  );
  // 與個人頁共用同一份快取
  const personalQuery = useCachedQuery(
    uid ? `personal:${uid}` : null,
    (source) => loadContactsWithNet(uid!, source),
  );

  const loading = groupsQuery.loading;
  const groups = groupsQuery.data?.groups ?? [];
  const groupNetMap = groupsQuery.data?.netMap ?? {};

  const { personalContacts, unsettledPersonalCount } = useMemo(() => {
    const unsettled = (personalQuery.data ?? []).filter((c) => c.netAmount !== 0);
    const top = unsettled
      .filter(
        (c) => getTimestampMs(c.lastExpenseAt) > 0 || c.interactionCount > 0,
      )
      .sort(
        (a, b) =>
          getTimestampMs(b.lastExpenseAt ?? b.updatedAt) -
          getTimestampMs(a.lastExpenseAt ?? a.updatedAt),
      )
      .slice(0, 3);
    return { personalContacts: top, unsettledPersonalCount: unsettled.length };
  }, [personalQuery.data]);

  const topGroups = groups.slice(0, 3);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Zplit Logo" className="w-8 h-8" />
          <h1 className="text-2xl font-extrabold tracking-tight text-brand">
            Zplit
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => navigate("/settings")}
          >
            <UserAvatar
              src={user?.avatarUrl}
              name={user?.displayName ?? "?"}
              size="w-8"
              textSize="text-xs"
            />
          </button>
        </div>
      </div>

      {/* Welcome */}
      <div className="mt-4">
        <p className="text-lg font-semibold">
          {t("home.welcome", { name: user?.displayName ?? "" })}
        </p>
        <p className="text-sm text-base-content/50">
          {groups.length + unsettledPersonalCount > 0
            ? t("home.pendingCount", {
                count: groups.length + unsettledPersonalCount,
              })
            : t("home.noPending")}
        </p>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-16 w-full rounded-2xl" />
            <div className="skeleton h-16 w-full rounded-2xl" />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-16 w-full rounded-2xl" />
            <div className="skeleton h-16 w-full rounded-2xl" />
          </div>
        </div>
      ) : groups.length === 0 && personalContacts.length === 0 ? (
        <div
          className="mt-16 text-center text-base-content/40 cursor-pointer"
          onClick={() => navigate("/groups/new")}
        >
          <DocumentTextIcon className="mx-auto mb-3 h-12 w-12" />
          <p>{t("home.noGroups")}</p>
          <p className="text-sm mt-1">{t("home.noGroupsHint")}</p>
        </div>
      ) : (
        <>
          {/* My Groups Section */}
          {groups.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
                  {t("home.groups")}
                </h2>
                <button
                  className="btn-white-soft btn-xs flex items-center gap-0.5"
                  onClick={() => navigate("/groups")}
                >
                  {t("common.viewAll")}
                  <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-2 flex flex-col">
                {topGroups.map((g) => (
                  <GroupListItem
                    key={g.groupId}
                    group={g}
                    netAmount={groupNetMap[g.groupId]}
                    onClick={() => navigate(`/groups/${g.groupId}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Personal Lending Section */}
          {personalContacts.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">
                  {t("home.personal")}
                </h2>
                <button
                  className="btn-white-soft btn-xs flex items-center gap-0.5"
                  onClick={() => navigate("/personal")}
                >
                  {t("common.viewAll")}
                  <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-2 flex flex-col">
                {personalContacts.map((c) => (
                  <div
                    key={c.contactId}
                    className="flex items-center gap-3 py-3 cursor-pointer active:bg-base-200/50 transition-colors border-b border-base-200 last:border-b-0"
                    onClick={() => navigate(`/personal/${c.contactId}`)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <UserAvatar
                        src={c.avatarUrl}
                        name={c.displayName}
                        size="w-10"
                        textSize="text-sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {c.displayName}
                        </p>
                      </div>
                      <div className="text-right">
                        {c.netAmount > 0 ? (
                          <p className="font-bold text-success text-sm">
                            +NT${c.netAmount.toLocaleString()}
                          </p>
                        ) : (
                          <p className="font-bold text-warning text-sm">
                            -NT${Math.abs(c.netAmount).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
