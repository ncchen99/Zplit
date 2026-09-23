import { createContext, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useGroupStore, type Group } from "@/store/groupStore";
import { getGroupById } from "@/services/groupService";
import { logger } from "@/utils/logger";

export interface GroupAccess {
  /**
   * 是否為群組成員。非成員（未登入或尚未加入）只能透過邀請連結唯讀預覽，
   * 所有新增／編輯入口都要改成呼叫 requireAuth()。
   */
  canEdit: boolean;
  /** 預覽模式下引導使用者登入／註冊，完成後回到加入群組流程 */
  requireAuth: () => void;
}

const GroupAccessContext = createContext<GroupAccess>({
  canEdit: true,
  requireAuth: () => {},
});

export const GroupAccessProvider = GroupAccessContext.Provider;

export function useGroupAccess() {
  return useContext(GroupAccessContext);
}

/**
 * 新增／編輯帳務這類表單頁用：非成員不該看到表單（寫入本來就會被 Rules 擋下）。
 * store 裡的群組可能是舊快照（例如加入前的唯讀預覽），說「不是成員」時先向伺服器
 * 確認再導走，不會把剛加入的人誤踢出去。回傳 true 才顯示表單。
 */
export function useGroupMemberGuard(
  groupId: string | undefined,
  group: Group | null,
): boolean {
  const navigate = useNavigate();
  const uid = useAuthStore((s) => s.user?.uid);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const isMember = !!uid && group?.memberUids?.[uid] === true;
  const needsCheck = !!groupId && !!group && !isMember;

  useEffect(() => {
    if (!needsCheck || !groupId) return;
    let cancelled = false;
    getGroupById(groupId)
      .then((fresh) => {
        if (cancelled) return;
        if (fresh && uid && fresh.memberUids?.[uid] === true) {
          setCurrentGroup(fresh);
          return;
        }
        navigate("/home", { replace: true });
      })
      .catch((err) =>
        logger.error("group.memberGuard", "確認成員身份失敗", err),
      );
    return () => {
      cancelled = true;
    };
  }, [groupId, navigate, needsCheck, setCurrentGroup, uid]);

  return isMember;
}
