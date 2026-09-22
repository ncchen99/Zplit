import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import {
  getGroupByInviteCode,
  addMemberToGroup,
  bindMemberToUser,
} from "@/services/groupService";
import type { Group, GroupMember } from "@/store/groupStore";
import { logger } from "@/utils/logger";
import { PageHeader } from "@/components/ui/PageHeader";
import { JoinSkeleton } from "@/components/ui/PageSkeleton";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  UserPlus,
  Link2,
  AlertCircle,
  ChevronRight,
  Eye,
} from "lucide-react";

export function JoinPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const showToast = useUIStore((s) => s.showToast);

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getGroupByInviteCode(code)
      .then(setGroup)
      .catch((err) => logger.error("join.load", "載入群組失敗", err))
      .finally(() => setLoading(false));
  }, [code]);

  /** 先以唯讀方式進群組看紀錄，要新增／編輯時才會被要求登入 */
  const goToPreview = () => {
    if (!group) return;
    navigate(`/groups/${group.groupId}?invite=${code}`);
  };

  const isAlreadyMember =
    user != null &&
    (group?.members?.some((m) => m.isBound && m.userId === user.uid) ?? false);

  const handleJoin = async (selectedMember: GroupMember | null) => {
    if (!group || !user) return;
    const id = selectedMember ? selectedMember.memberId : "__new__";
    setJoiningId(id);
    try {
      if (selectedMember) {
        // 綁定到現有佔位成員，使用帳號名稱直接同步
        await bindMemberToUser(
          group.groupId,
          selectedMember.memberId,
          user.uid,
          user.displayName,
          user.avatarUrl,
        );
      } else {
        // 以新成員加入，使用帳號名稱
        const member: GroupMember = {
          memberId: user.uid,
          userId: user.uid,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isBound: true,
          joinedAt: null,
        };
        await addMemberToGroup(group.groupId, member);
      }
      showToast(t("join.joined"), "success");
      navigate(`/groups/${group.groupId}`, { replace: true });
    } catch (err) {
      logger.error("join", "加入群組失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setJoiningId(null);
    }
  };

  // ── Loading ─────────────────────────────────────────────
  // 與 AuthGuard / Suspense / index.html 的骨架共用同一份版面，
  // 從點開邀請連結到資料到齊都是同一個畫面，不會換骨架
  if (loading) {
    return <JoinSkeleton />;
  }

  // ── Invalid link ─────────────────────────────────────────
  if (!group) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center md:min-h-full">
        <AlertCircle className="h-12 w-12 text-warning" />
        <p className="text-lg font-bold">{t("join.invalidLink")}</p>
        <button
          className="btn btn-primary mt-2"
          onClick={() => navigate("/home")}
        >
          {t("join.backToHome")}
        </button>
      </div>
    );
  }

  const unboundMembers = group.members?.filter((m) => !m.isBound) ?? [];
  const boundMembers = group.members?.filter((m) => m.isBound) ?? [];
  // 已登入但還不是成員：直接進選身份，不再多問一次要加入還是看紀錄
  // （會走到這裡的人不是點邀請連結就是剛為了加入而登入，意圖本來就一樣）
  const selectingIdentity =
    status === "ready" && user != null && !isAlreadyMember;

  const memberCount = t("common.members_count", {
    count: group.members?.length ?? 0,
  });

  return (
    <div className="flex h-full min-h-full flex-col overflow-hidden md:min-h-[inherit]">
      {/* 選身份時才有標題列；固定不捲動，交界的漸層交給下面的 ScrollArea */}
      {selectingIdentity ? (
        <PageHeader
          sticky={false}
          title={
            <span className="inline-flex max-w-full flex-col items-center justify-center leading-none">
              <span className="max-w-full truncate text-base font-bold leading-tight">
                {group.name}
              </span>
              <span className="mt-0.5 text-[11px] font-medium leading-none text-base-content/60">
                {t("join.title")}
              </span>
            </span>
          }
          onBack={goToPreview}
        />
      ) : (
        <div className="min-h-[3.5rem] shrink-0" />
      )}

      <ScrollArea className="px-5">
        <div className="mx-auto flex min-h-full w-full max-w-sm flex-col pb-10">
          {selectingIdentity ? (
            /* ── 選擇身份 ── */
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold">{t("join.question")}</h2>
                <p className="mt-1 text-sm text-base-content/50">
                  {t("join.selectMember")}
                </p>
              </div>

              {/* 未綁定成員 + 已綁定成員，使用 divide-y 讓最後一個卡片不顯示分隔線 */}
              <div className="divide-y divide-base-200">
                {unboundMembers.map((m) => (
                  <button
                    key={m.memberId}
                    className="flex w-full cursor-pointer items-center gap-3 py-3 text-left transition-colors active:bg-base-200/50 disabled:opacity-50"
                    onClick={() => void handleJoin(m)}
                    disabled={joiningId !== null}
                  >
                    <UserAvatar src={null} name={m.displayName} size="w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{m.displayName}</p>
                      <p className="mt-0.5 text-xs text-base-content/40">
                        {t("join.unboundMember")}
                      </p>
                    </div>
                    {joiningId === m.memberId ? (
                      <span className="loading loading-spinner loading-sm shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-base-content/30" />
                    )}
                  </button>
                ))}

                {/* 已綁定成員（僅供參考，不可點擊） */}
                {boundMembers.map((m) => (
                  <div
                    key={m.memberId}
                    className="flex items-center gap-3 py-3 opacity-40"
                  >
                    <UserAvatar
                      src={m.avatarUrl}
                      name={m.displayName}
                      size="w-10"
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {m.displayName}
                    </span>
                    <span className="badge badge-success badge-sm shrink-0 gap-0.5">
                      <Link2 className="h-2.5 w-2.5" />
                      {t("join.boundMember")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="divider mt-4 mb-7 text-xs text-base-content/30">
                {t("common.or")}
              </div>

              {/* 以全新成員加入 */}
              <button
                className="btn-muted btn-block"
                onClick={() => void handleJoin(null)}
                disabled={joiningId !== null}
              >
                {joiningId === "__new__" ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
                {t("join.newMember")}
              </button>
            </>
          ) : (
            /* ── 邀請落地頁：只給一個動作，不讓人在這裡做選擇 ── */
            <>
              <p className="mb-4 text-center text-sm text-base-content/50">
                {t("join.invitedToJoin")}
              </p>

              {/* Group info — stat style (bordered, unfilled) */}
              <div className="mb-6 flex flex-col items-center gap-2 rounded-2xl border border-base-300 bg-base-100 px-6 py-6 text-center">
                {group.coverUrl ? (
                  <img
                    src={group.coverUrl}
                    alt=""
                    className="h-32 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-2xl font-bold text-primary">
                    {group.name.charAt(0)}
                  </div>
                )}
                <h2 className="mt-1 text-xl font-bold">{group.name}</h2>
                <p className="text-sm text-base-content/50">{memberCount}</p>
              </div>

              <div className="flex-1" />

              {isAlreadyMember ? (
                <div className="flex flex-col gap-3">
                  <p className="text-center text-sm text-base-content/50">
                    {t("join.alreadyMember")}
                  </p>
                  <button
                    className="btn-theme-green btn-block"
                    onClick={() => navigate(`/groups/${group.groupId}`)}
                  >
                    {t("join.goToGroup")}
                  </button>
                </div>
              ) : (
                /* 未登入：直接進去看紀錄，要新增／編輯時才在群組裡引導登入 */
                <button
                  className="btn-theme-green btn-block"
                  onClick={goToPreview}
                >
                  <Eye className="h-5 w-5" />
                  {t("join.previewGroup")}
                </button>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
