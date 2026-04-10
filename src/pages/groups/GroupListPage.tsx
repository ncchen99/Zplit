import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { Group } from "@/store/groupStore";
import { getUserGroups } from "@/services/groupService";
import { logger } from "@/utils/logger";
import {
  Plus as PlusIcon,
  Search as MagnifyingGlassIcon,
  Users as UserGroupIcon,
} from "lucide-react";
import { GroupListItem } from "@/components/ui/GroupListItem";

export function GroupListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      try {
        const myGroups = await getUserGroups(user.uid);
        setGroups(myGroups);
      } catch (err) {
        logger.error("groupList.fetch", "載入群組失敗", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [user]);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  // TODO: categorize into in-progress vs settled based on settlement data
  const inProgress = filtered;
  const settled: Group[] = [];

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("group.list.title")}
        </h1>
        <button
          className="btn-theme-green btn-sm"
          onClick={() => navigate("/groups/new")}
        >
          <PlusIcon className="h-4 w-4" />
          {t("home.createGroup")}
        </button>
      </div>

      {/* Search */}
      <div className="mt-4">
        <label className="input w-full flex items-center gap-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-base-content/40" />
          <input
            type="text"
            className="grow"
            placeholder={t("group.list.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 py-2">
              <div className="skeleton h-12 w-12 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-5 w-12" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="mt-8 text-center text-base-content/40">
          <p>{t("group.list.noResults")}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-16 text-center text-base-content/40">
          <UserGroupIcon className="mx-auto mb-3 h-12 w-12" />
          <p>{t("group.list.noGroups")}</p>
          <p className="text-sm mt-1">{t("group.list.noGroupsHint")}</p>
        </div>
      ) : (
        <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                {t("group.list.inProgress")}（{inProgress.length}）
              </h2>
              <div className="mt-2 flex flex-col">
                {inProgress.map((g) => (
                  <GroupListItem
                    key={g.groupId}
                    group={g}
                    onClick={() => navigate(`/groups/${g.groupId}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Settled */}
          {settled.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                {t("group.list.settled")}（{settled.length}）
              </h2>
              <div className="mt-2 flex flex-col">
                {settled.map((g) => (
                  <GroupListItem
                    key={g.groupId}
                    group={g}
                    settled
                    onClick={() => navigate(`/groups/${g.groupId}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
