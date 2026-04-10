import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { Group } from "@/store/groupStore";
import { getUserGroups, backfillInviteCodes } from "@/services/groupService";
import {
  getContacts,
  getPersonalExpenses,
  computePersonalNetAmount,
  type PersonalContact,
} from "@/services/personalLedgerService";
import { logger } from "@/utils/logger";
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalContacts, setPersonalContacts] = useState<
    (PersonalContact & { netAmount: number })[]
  >([]);

  const getTimestampMs = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (
      typeof value === "object" &&
      value !== null &&
      "seconds" in value &&
      typeof (value as { seconds?: unknown }).seconds === "number"
    ) {
      return (value as { seconds: number }).seconds * 1000;
    }
    return 0;
  };

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      try {
        const myGroups = await getUserGroups(user.uid);
        const sortedGroups = [...myGroups].sort((a, b) => {
          const bLast = getTimestampMs(b.lastExpenseAt ?? b.updatedAt);
          const aLast = getTimestampMs(a.lastExpenseAt ?? a.updatedAt);
          return bLast - aLast;
        });
        setGroups(sortedGroups);
        backfillInviteCodes(myGroups).catch((err) => {
          logger.error("home.backfill", "補建 inviteCode 失敗", err);
        });
      } catch (err) {
        logger.error("home.fetchGroups", "載入群組失敗", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchPersonal = async () => {
      try {
        const contacts = await getContacts(user.uid);
        const activeContacts = contacts
          .filter((c) => {
            const hasRecordTime = getTimestampMs(c.lastExpenseAt) > 0;
            return hasRecordTime || c.interactionCount > 0;
          })
          .sort(
            (a, b) =>
              getTimestampMs(b.lastExpenseAt ?? b.updatedAt) -
              getTimestampMs(a.lastExpenseAt ?? a.updatedAt),
          )
          .slice(0, 3);

        const withNet = await Promise.all(
          activeContacts.map(async (c) => {
            const expenses = await getPersonalExpenses(user.uid, c.contactId);
            return { ...c, netAmount: computePersonalNetAmount(expenses) };
          }),
        );
        setPersonalContacts(withNet.filter((c) => c.netAmount !== 0));
      } catch (err) {
        logger.error("home.fetchPersonal", "載入個人記錄失敗", err);
      }
    };
    Promise.all([fetchGroups(), fetchPersonal()]);
  }, [user]);

  const topGroups = groups.slice(0, 3);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Zplit Logo" className="w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight text-primary">
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
          {groups.length > 0
            ? t("home.pendingCount", { count: groups.length })
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
