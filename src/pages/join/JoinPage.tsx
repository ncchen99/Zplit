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
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  ArrowLeft,
  UserPlus,
  LogIn,
  Link2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

type Step = "info" | "select";

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
  const [step, setStep] = useState<Step>("info");

  useEffect(() => {
    if (!code) return;
    getGroupByInviteCode(code)
      .then(setGroup)
      .catch((err) => logger.error("join.load", "載入群組失敗", err))
      .finally(() => setLoading(false));
  }, [code]);

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
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] md:min-h-full flex-col">
        {/* Header placeholder */}
        <div className="flex items-center px-4 pt-4 pb-2 min-h-[3.5rem]" />

        <div className="flex-1 flex flex-col px-5 pb-10">
          <div className="mx-auto w-full max-w-sm flex-1 flex flex-col">
            {/* Step indicator */}
            <div className="flex justify-center gap-2 mb-6">
              <div className="skeleton h-1.5 w-8 rounded-full" />
              <div className="skeleton h-1.5 w-4 rounded-full" />
            </div>

            {/* Step 1: Group Info Placeholder */}
            <div className="flex-1 flex flex-col">
              <div className="skeleton h-4 w-32 mx-auto mb-4 rounded-full" />

              {/* Group info card skeleton */}
              <div className="border border-base-300 rounded-2xl bg-base-100 flex flex-col items-center text-center gap-2 px-6 py-6 mb-6">
                <div className="skeleton w-16 h-16 rounded-full" />
                <div className="skeleton h-7 w-48 mt-1 rounded-lg" />
                <div className="skeleton h-4 w-24 rounded-md" />
              </div>

              <div className="flex-1" />

              {/* Action button skeleton */}
              <div className="skeleton h-12 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Invalid link ─────────────────────────────────────────
  if (!group) {
    return (
      <div className="flex min-h-[100dvh] md:min-h-full flex-col items-center justify-center px-6 text-center gap-4">
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
  // 未登入（guest）或尚未完成帳號設定（onboarding）時需要引導登入
  const needsAuth = status === "guest" || status === "onboarding";

  return (
    <div className="flex min-h-[100dvh] md:min-h-full flex-col">
      {/* Header：select 步驟才顯示返回按鈕與標題 */}
      <div className="flex items-center px-4 pt-4 pb-2 min-h-[3.5rem]">
        {step === "select" && (
          <>
            <button
              className="btn btn-ghost btn-sm btn-circle text-base-content/50"
              onClick={() => setStep("info")}
              aria-label={t("common.button.back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="flex-1 text-center text-lg font-bold pr-9">
              {t("join.title")}
            </h1>
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col px-5 pb-10">
        <div className="mx-auto w-full max-w-sm flex-1 flex flex-col">
          {/* Step indicator */}
          <div className="flex justify-center gap-2 mb-6">
            {(["info", "select"] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  s === step ? "w-8 bg-primary" : "w-4 bg-base-300"
                }`}
              />
            ))}
          </div>

          {/* ── Step 1: Group Info ── */}
          {step === "info" && (
            <div className="flex-1 flex flex-col">
              <p className="text-sm text-base-content/50 text-center mb-4">
                {t("join.invitedToJoin")}
              </p>

              {/* Group info — stat style (bordered, unfilled) */}
              <div className="border border-base-300 rounded-2xl bg-base-100 flex flex-col items-center text-center gap-2 px-6 py-6 mb-6">
                {group.coverUrl ? (
                  <img
                    src={group.coverUrl}
                    alt=""
                    className="w-full h-32 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl font-bold text-primary">
                    {group.name.charAt(0)}
                  </div>
                )}
                <h2 className="text-xl font-bold mt-1">{group.name}</h2>
                <p className="text-sm text-base-content/50">
                  {t("common.members_count", {
                    count: group.members?.length ?? 0,
                  })}
                </p>
              </div>

              <div className="flex-1" />

              {/* Action area */}
              {isAlreadyMember ? (
                /* 已是成員 */
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-base-content/50 text-center">
                    {t("join.alreadyMember")}
                  </p>
                  <button
                    className="btn-theme-green btn-block"
                    onClick={() => navigate(`/groups/${group.groupId}`)}
                  >
                    {t("join.goToGroup")}
                  </button>
                </div>
              ) : needsAuth ? (
                /* 需要登入或完成註冊 */
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-base-content/50 text-center">
                    {status === "onboarding"
                      ? t("auth.onboarding.title")
                      : t("join.loginFirst")}
                  </p>
                  <button
                    className="btn-theme-green btn-block"
                    onClick={() =>
                      navigate(status === "onboarding" ? "/onboarding" : "/login", {
                        state: { redirectTo: `/join/${code}` },
                      })
                    }
                  >
                    {status === "onboarding" ? (
                      <ChevronRight className="h-5 w-5" />
                    ) : (
                      <LogIn className="h-5 w-5" />
                    )}
                    {status === "onboarding"
                      ? t("auth.onboarding.title")
                      : t("join.loginButton")}
                  </button>
                </div>
              ) : (
                /* 已登入，可加入 */
                <button
                  className="btn-theme-green btn-block"
                  onClick={() => setStep("select")}
                >
                  {t("join.title")}
                </button>
              )}
            </div>
          )}

          {/* ── Step 2: Select Identity ── */}
          {step === "select" && (
            <div className="flex-1 flex flex-col">
              <div className="mb-5">
                <h2 className="text-xl font-bold">{t("join.question")}</h2>
                <p className="text-sm text-base-content/50 mt-1">
                  {t("join.selectMember")}
                </p>
              </div>

              <div className="flex flex-col">
                {/* 未綁定成員 + 已綁定成員，使用 divide-y 讓最後一個卡片不顯示分隔線 */}
                <div className="divide-y divide-base-200">
                  {unboundMembers.map((m) => (
                    <button
                      key={m.memberId}
                      className="flex items-center gap-3 py-3 w-full active:bg-base-200/50 transition-colors text-left disabled:opacity-50 cursor-pointer"
                      onClick={() => void handleJoin(m)}
                      disabled={joiningId !== null}
                    >
                      <UserAvatar src={null} name={m.displayName} size="w-10" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{m.displayName}</p>
                        <p className="text-xs text-base-content/40 mt-0.5">
                          {t("join.unboundMember")}
                        </p>
                      </div>
                      {joiningId === m.memberId ? (
                        <span className="loading loading-spinner loading-sm shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-base-content/30 shrink-0" />
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
                      <span className="flex-1 min-w-0 font-semibold truncate">
                        {m.displayName}
                      </span>
                      <span className="badge badge-success badge-sm gap-0.5 shrink-0">
                        <Link2 className="h-2.5 w-2.5" />
                        {t("join.boundMember")}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="divider text-xs text-base-content/30 mt-4 mb-7">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
