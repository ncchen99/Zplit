import { createContext, useContext } from "react";

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
