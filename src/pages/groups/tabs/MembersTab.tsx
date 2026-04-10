import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useGroupStore } from "@/store/groupStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { addPlaceholderMember, getUserGroups } from "@/services/groupService";
import {
  getContacts,
  type PersonalContact,
} from "@/services/personalLedgerService";
import { logger } from "@/utils/logger";
import { LinkIcon, PlusIcon } from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface ActivityItem {
  id: string;
  memberId?: string;
  actorUid?: string;
  action?: "created" | "updated" | "deleted";
  description?: string;
  title?: string;
  amount?: number;
  timestamp?: { seconds?: number } | null;
}

interface MemberSuggestion {
  key: string;
  displayName: string;
  avatarUrl: string | null;
}

export function MembersTab() {
  const { t } = useTranslation();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const expenses = useGroupStore((s) => s.expenses);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestionDropdown, setShowSuggestionDropdown] = useState(false);
  const [contacts, setContacts] = useState<PersonalContact[]>([]);
  const [groupMemberSuggestions, setGroupMemberSuggestions] = useState<
    MemberSuggestion[]
  >([]);
  const [groupActivities, setGroupActivities] = useState<ActivityItem[]>([]);

  const loadMemberSuggestions = useCallback(async () => {
    if (!user) return;
    setLoadingSuggestions(true);
    try {
      const [contactList, groups] = await Promise.all([
        getContacts(user.uid),
        getUserGroups(user.uid),
      ]);
      setContacts(contactList);

      const memberMap = new Map<string, MemberSuggestion>();
      for (const group of groups) {
        for (const member of group.members) {
          if (!member.displayName?.trim() || member.userId === user.uid) {
            continue;
          }
          const normalized = member.displayName.trim();
          const key = normalized.toLowerCase();
          if (!memberMap.has(key)) {
            memberMap.set(key, {
              key: `group:${key}`,
              displayName: normalized,
              avatarUrl: member.avatarUrl,
            });
          }
        }
      }
      setGroupMemberSuggestions(Array.from(memberMap.values()));
    } catch (err) {
      logger.error("members.suggestions", "載入成員建議失敗", err);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [user]);

  useEffect(() => {
    if (!currentGroup?.groupId) {
      setGroupActivities([]);
      return;
    }

    const q = query(
      collection(db, `groups/${currentGroup.groupId}/activity`),
      orderBy("timestamp", "desc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      setGroupActivities(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ActivityItem, "id">),
        })),
      );
    });

    return () => unsub();
  }, [currentGroup?.groupId]);

  useEffect(() => {
    loadMemberSuggestions();
  }, [loadMemberSuggestions]);

  const existingMemberNames = useMemo(
    () =>
      new Set(
        (currentGroup?.members ?? []).map((m) =>
          m.displayName.trim().toLowerCase(),
        ),
      ),
    [currentGroup?.members],
  );

  const allSuggestions = useMemo(() => {
    const existingContactNames = new Set(
      contacts.map((c) => c.displayName.trim().toLowerCase()),
    );

    const contactSuggestions: MemberSuggestion[] = contacts.map((c) => ({
      key: `contact:${c.contactId}`,
      displayName: c.displayName,
      avatarUrl: c.avatarUrl,
    }));

    const groupOnlySuggestions = groupMemberSuggestions.filter(
      (s) => !existingContactNames.has(s.displayName.trim().toLowerCase()),
    );

    return [...contactSuggestions, ...groupOnlySuggestions];
  }, [contacts, groupMemberSuggestions]);

  const trimmedSearch = newName.trim();
  const filteredSuggestions = useMemo(
    () =>
      (trimmedSearch
        ? allSuggestions.filter((s) =>
            s.displayName.toLowerCase().includes(trimmedSearch.toLowerCase()),
          )
        : allSuggestions
      ).filter((s) => !existingMemberNames.has(s.displayName.toLowerCase())),
    [allSuggestions, existingMemberNames, trimmedSearch],
  );

  const canAddTypedName =
    !!trimmedSearch && !existingMemberNames.has(trimmedSearch.toLowerCase());

  const handleAddMember = async (candidateName?: string) => {
    if (!currentGroup) return;
    const targetName = (candidateName ?? newName).trim();
    if (!targetName || existingMemberNames.has(targetName.toLowerCase())) return;

    setAdding(true);
    try {
      await addPlaceholderMember(currentGroup.groupId, targetName, user?.uid);
      setNewName("");
      setShowSuggestionDropdown(false);
      showToast(t("common.button.done"), "success");
    } catch (err) {
      logger.error("members.add", "新增成員失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setAdding(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: MemberSuggestion) => {
    await handleAddMember(suggestion.displayName);
  };

  const activityLog = useMemo(() => {
    const legacyLogs: ActivityItem[] = expenses.flatMap(
      (e) =>
        e.editLog?.map((log, index) => ({
          id: `legacy-${e.expenseId}-${index}`,
          memberId: log.memberId,
          action: log.action,
          description: log.description,
          title: e.title,
          amount: e.amount,
          timestamp: log.timestamp,
        })) ?? [],
    );

    return [...groupActivities, ...legacyLogs]
      .sort((a, b) => {
        const aTime = a.timestamp?.seconds ?? 0;
        const bTime = b.timestamp?.seconds ?? 0;
        return bTime - aTime;
      })
      .slice(0, 20);
  }, [expenses, groupActivities]);

  const memberMap = useMemo(
    () =>
      new Map(
        currentGroup?.members?.map((m) => [m.memberId, m.displayName]) ?? [],
      ),
    [currentGroup?.members],
  );

  const userMap = useMemo(
    () =>
      new Map(
        currentGroup?.members
          ?.filter((m) => Boolean(m.userId))
          .map((m) => [m.userId as string, m.displayName]) ?? [],
      ),
    [currentGroup?.members],
  );

  const formatActivityText = (log: ActivityItem): string => {
    if (log.description) return log.description;

    const amount = log.amount ?? 0;
    const title = log.title ?? t("expense.titlePlaceholder");
    if (log.action === "updated") {
      return t("group.members.activityAction.updated", { title, amount });
    }
    if (log.action === "deleted") {
      return t("group.members.activityAction.deleted", { title, amount });
    }
    return t("group.members.activityAction.created", { title, amount });
  };

  return (
    <div>
      {/* Members Section */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider">
          {t("group.members.members")}（{currentGroup?.members?.length ?? 0}）
        </h3>
      </div>

      <div className="mt-3 flex flex-col">
        {currentGroup?.members?.map((m) => {
          const isMemberCreator = m.userId === currentGroup.createdBy;
          return (
            <div
              key={m.memberId}
              className="flex items-center gap-3 py-3 border-b border-base-200 last:border-b-0"
            >
              <UserAvatar
                src={m.avatarUrl}
                name={m.displayName}
                bgClass={
                  m.isBound
                    ? "bg-primary/15 text-primary"
                    : "bg-base-300 text-base-content/50"
                }
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold truncate">{m.displayName}</p>
                  {isMemberCreator && (
                    <StarIcon className="h-3.5 w-3.5 text-warning" />
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {m.isBound ? (
                    <span className="badge badge-soft badge-success badge-xs gap-0.5">
                      <LinkIcon className="h-2.5 w-2.5" />
                      {t("group.members.bound")}
                    </span>
                  ) : (
                    <span className="badge badge-ghost badge-xs">
                      {t("group.members.unbound")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Member */}
      <div className="mt-4">
        <div className="relative">
          <input
            type="text"
            className="input input-sm w-full"
            placeholder={t("group.members.memberName")}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setShowSuggestionDropdown(true);
            }}
            onFocus={() => setShowSuggestionDropdown(true)}
            onClick={() => setShowSuggestionDropdown(true)}
            onBlur={() => setTimeout(() => setShowSuggestionDropdown(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
            maxLength={30}
          />

          {(loadingSuggestions || adding) && (
            <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2" />
          )}

          {showSuggestionDropdown && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl bg-base-100 shadow-lg border border-base-200 overflow-hidden">
              {filteredSuggestions.slice(0, 6).map((suggestion) => (
                <button
                  key={suggestion.key}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-none px-4 py-3 text-left transition-colors hover:bg-base-200 active:bg-base-300"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleSelectSuggestion(suggestion);
                  }}
                >
                  <UserAvatar
                    src={suggestion.avatarUrl}
                    name={suggestion.displayName}
                    size="w-7"
                    textSize="text-[10px]"
                  />
                  <span className="text-sm font-medium truncate">
                    {suggestion.displayName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {canAddTypedName && (
          <button
            type="button"
            className="btn-theme-green btn-sm mt-2"
            onClick={() => {
              void handleAddMember();
            }}
            disabled={adding}
          >
            {adding ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                {t("group.members.addMember")}
              </>
            )}
          </button>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mt-6">
        <h3 className="font-semibold text-sm text-base-content/60 uppercase tracking-wider">
          {t("group.members.activity")}
        </h3>
        {activityLog.length === 0 ? (
          <p className="mt-2 text-sm text-base-content/40">No activity yet</p>
        ) : (
          <div className="mt-2 flex flex-col">
            {activityLog.map((log, i) => {
              const actorName =
                (log.memberId ? memberMap.get(log.memberId) : undefined) ??
                (log.actorUid ? userMap.get(log.actorUid) : undefined) ??
                log.memberId ??
                log.actorUid ??
                "-";
              const time = log.timestamp?.seconds
                ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                : "";
              return (
                <div
                  key={log.id || i}
                  className="flex py-2 border-b border-base-200 last:border-b-0 text-xs text-base-content/60"
                >
                  <span className="font-semibold">{actorName}</span>{" "}
                  {formatActivityText(log)}
                  {time && (
                    <span className="text-base-content/30 ml-2">{time}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
