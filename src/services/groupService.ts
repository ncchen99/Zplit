import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { nanoid } from "nanoid";
import type { Group, GroupMember, Settlement } from "@/store/groupStore";
import {
  ensureContact,
  syncPersonalContactNameByReference,
} from "@/services/personalLedgerService";
import { logger } from "@/utils/logger";
import { ZplitError } from "@/utils/errors";

/**
 * 從 members 陣列中，提取所有 isBound=true 成員的 userId，
 * 建立供 Firestore Security Rules 使用的 memberUids Map。
 *
 * 為什麼需要這個：
 *   Firestore Rules 的 hasAny([{userId: uid}]) 是完整物件比對，
 *   無法做部分欄位查詢。需要獨立的 Map 欄位才能正確驗證群組成員身份。
 */
function buildMemberUids(members: GroupMember[]): Record<string, true> {
  const map: Record<string, true> = {};
  for (const m of members) {
    if (m.isBound && m.userId) {
      map[m.userId] = true;
    }
  }
  return map;
}

function buildMemberNameMap(members: GroupMember[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const member of members) {
    map[member.memberId] = member.displayName;
  }
  return map;
}

export async function createGroup(
  name: string,
  createdBy: string,
  creatorDisplayName: string,
  creatorAvatarUrl: string | null,
  coverUrl: string | null = null,
): Promise<Group> {
  const inviteCode = nanoid(8);
  const ref = doc(collection(db, "groups"));

  const member: GroupMember = {
    memberId: createdBy,
    userId: createdBy,
    displayName: creatorDisplayName,
    avatarUrl: creatorAvatarUrl,
    isBound: true,
    joinedAt: null, // will be server timestamp
  };

  const initialMembers = [member];
  const groupData = {
    name,
    coverUrl,
    inviteCode,
    createdBy,
    members: initialMembers,
    memberNameMap: buildMemberNameMap(initialMembers),
    memberUids: buildMemberUids(initialMembers),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 同時寫入群組文件和 inviteCodes 查詢文件（batch 不需要，因為 inviteCodes 是輔助索引）
  await setDoc(ref, groupData);
  await setDoc(doc(db, "inviteCodes", inviteCode), { groupId: ref.id });
  logger.info("groupService.create", "群組建立成功", { groupId: ref.id, name });

  return {
    groupId: ref.id,
    ...groupData,
  } as unknown as Group;
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) return null;
  return { groupId: snap.id, ...snap.data() } as Group;
}

export async function getGroupByInviteCode(
  code: string,
): Promise<Group | null> {
  // 先從 inviteCodes 查詢對應 groupId，再讀取群組文件
  // 這樣非成員也能透過邀請碼找到群組（Security Rules 允許 get）
  const codeSnap = await getDoc(doc(db, "inviteCodes", code));
  if (!codeSnap.exists()) return null;
  const { groupId } = codeSnap.data() as { groupId: string };
  return getGroupById(groupId);
}

export async function getUserGroups(userId: string): Promise<Group[]> {
  const q = query(
    collection(db, "groups"),
    where(`memberUids.${userId}`, "==", true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), groupId: d.id }) as Group);
}

// One-time migration: ensure every group has a matching inviteCodes lookup doc.
// Run at startup; independent per-group checks run in parallel.
export async function backfillInviteCodes(groups: Group[]): Promise<void> {
  await Promise.all(
    groups
      .filter((g) => g.inviteCode)
      .map(async (g) => {
        const codeRef = doc(db, "inviteCodes", g.inviteCode);
        const codeSnap = await getDoc(codeRef);
        if (!codeSnap.exists()) {
          await setDoc(codeRef, { groupId: g.groupId });
          logger.info("groupService.backfill", "補建 inviteCode", {
            groupId: g.groupId,
            inviteCode: g.inviteCode,
          });
        }
      }),
  );
}

export async function addMemberToGroup(
  groupId: string,
  member: GroupMember,
): Promise<void> {
  const ref = doc(db, "groups", groupId);
  const group = await getGroupById(groupId);
  if (!group) throw new ZplitError("GROUP_NOT_FOUND", "群組不存在");

  const alreadyExists = group.members.some((m) => m.memberId === member.memberId);
  const nextMembers = alreadyExists ? group.members : [...group.members, member];
  const nextMemberNameMap = {
    ...(group.memberNameMap ?? {}),
    [member.memberId]: member.displayName,
  };
  const nextMemberUids = { ...(group.memberUids ?? {}) };
  if (member.isBound && member.userId) {
    nextMemberUids[member.userId] = true;
  }

  await updateDoc(ref, {
    members: nextMembers,
    memberNameMap: nextMemberNameMap,
    memberUids: nextMemberUids,
    updatedAt: serverTimestamp(),
  });
  logger.info("groupService.addMember", "成員加入群組", {
    groupId,
    memberId: member.memberId,
  });
}

export async function updateGroup(
  groupId: string,
  data: { name: string; coverUrl?: string | null },
): Promise<void> {
  await updateDoc(doc(db, "groups", groupId), {
    name: data.name,
    coverUrl: data.coverUrl ?? null,
    updatedAt: serverTimestamp(),
  });
  logger.info("groupService.update", "群組資料更新", {
    groupId,
    name: data.name,
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  const group = await getGroupById(groupId);
  if (!group) {
    throw new ZplitError("GROUP_NOT_FOUND", "群組不存在");
  }

  // 先清理 inviteCodes 索引，避免留下無效邀請碼
  if (group.inviteCode) {
    await deleteDoc(doc(db, "inviteCodes", group.inviteCode));
  }

  await deleteDoc(doc(db, "groups", groupId));
  logger.info("groupService.delete", "群組已刪除", { groupId });
}

export async function addPlaceholderMember(
  groupId: string,
  displayName: string,
  ownerUserId?: string,
): Promise<GroupMember> {
  const normalizedName = displayName.trim();
  if (!normalizedName) {
    throw new ZplitError("EXPENSE_SAVE_FAILED", "成員名稱不可為空");
  }

  if (ownerUserId) {
    await ensureContact(ownerUserId, normalizedName);
  }

  const member: GroupMember = {
    memberId: nanoid(),
    userId: null,
    displayName: normalizedName,
    avatarUrl: null,
    isBound: false,
    joinedAt: null,
  };

  const ref = doc(db, "groups", groupId);
  const group = await getGroupById(groupId);
  if (!group) throw new ZplitError("GROUP_NOT_FOUND", "群組不存在");

  const nextMemberNameMap = {
    ...(group.memberNameMap ?? {}),
    [member.memberId]: member.displayName,
  };

  await updateDoc(ref, {
    members: arrayUnion(member),
    memberNameMap: nextMemberNameMap,
    updatedAt: serverTimestamp(),
  });

  return member;
}

export async function bindMemberToUser(
  groupId: string,
  memberId: string,
  userId: string,
  displayName: string,
  avatarUrl: string | null,
): Promise<void> {
  const group = await getGroupById(groupId);
  if (!group) throw new ZplitError("GROUP_NOT_FOUND", "群組不存在");

  const updatedMembers = group.members.map((m) =>
    m.memberId === memberId
      ? { ...m, userId, displayName, avatarUrl, isBound: true }
      : m,
  );

  const nextMemberNameMap = {
    ...(group.memberNameMap ?? {}),
    [memberId]: displayName,
  };
  const nextMemberUids = {
    ...(group.memberUids ?? {}),
    [userId]: true as const,
  };

  await updateDoc(doc(db, "groups", groupId), {
    members: updatedMembers,
    memberNameMap: nextMemberNameMap,
    // 同步更新 memberUids，讓 Security Rules 可以驗證此使用者的成員身份
    memberUids: nextMemberUids,
    updatedAt: serverTimestamp(),
  });

  logger.info("groupService.bindMember", "成員帳號綁定成功", {
    groupId,
    memberId,
    userId,
  });
}

export async function renameGroupMember(
  groupId: string,
  memberId: string,
  displayName: string,
  options?: {
    ownerUserId?: string;
    memberUserId?: string | null;
  },
): Promise<void> {
  const normalizedName = displayName.trim();
  if (!normalizedName) {
    throw new ZplitError("EXPENSE_SAVE_FAILED", "成員名稱不可為空");
  }

  const group = await getGroupById(groupId);
  if (!group) throw new ZplitError("GROUP_NOT_FOUND", "群組不存在");

  let previousDisplayName = "";
  const updatedMembers = group.members.map((member) => {
    if (member.memberId !== memberId) return member;
    previousDisplayName = member.displayName;
    return { ...member, displayName: normalizedName };
  });

  if (!previousDisplayName) {
    throw new ZplitError("GROUP_NOT_FOUND", "成員不存在");
  }

  await updateDoc(doc(db, "groups", groupId), {
    members: updatedMembers,
    memberNameMap: {
      ...(group.memberNameMap ?? {}),
      [memberId]: normalizedName,
    },
    updatedAt: serverTimestamp(),
  });

  logger.info("groupService.renameMember", "成員名稱更新成功", {
    groupId,
    memberId,
  });

  const ownerUserId = options?.ownerUserId;
  if (ownerUserId) {
    try {
      await syncPersonalContactNameByReference(ownerUserId, {
        previousDisplayName,
        nextDisplayName: normalizedName,
        linkedUserId: options?.memberUserId,
      });
    } catch (err) {
      logger.warn("groupService.renameMember.syncPersonal", "群組改名後同步個人聯絡人失敗", {
        groupId,
        memberId,
        ownerUserId,
        err,
      });
    }
  }
}

export async function syncGroupMemberNameByReference(
  ownerUserId: string,
  options: {
    previousDisplayName: string;
    nextDisplayName: string;
    linkedUserId?: string | null;
  },
): Promise<number> {
  const previousDisplayName = options.previousDisplayName.trim();
  const nextDisplayName = options.nextDisplayName.trim();
  const linkedUserId = options.linkedUserId ?? null;

  if (!previousDisplayName || !nextDisplayName) return 0;
  if (previousDisplayName.toLowerCase() === nextDisplayName.toLowerCase()) return 0;

  const groups = await getUserGroups(ownerUserId);
  const previousLower = previousDisplayName.toLowerCase();
  let updatedGroupCount = 0;

  await Promise.all(
    groups.map(async (group) => {
      let changed = false;
      const nextMembers = group.members.map((member) => {
        const matchedByLinkedUser =
          !!linkedUserId && !!member.userId && member.userId === linkedUserId;
        const matchedByName =
          !member.isBound && member.displayName.trim().toLowerCase() === previousLower;

        if (!matchedByLinkedUser && !matchedByName) return member;
        changed = true;
        return {
          ...member,
          displayName: nextDisplayName,
        };
      });

      if (!changed) return;

      const nextMemberNameMap = {
        ...(group.memberNameMap ?? {}),
        ...buildMemberNameMap(nextMembers),
      };

      await updateDoc(doc(db, "groups", group.groupId), {
        members: nextMembers,
        memberNameMap: nextMemberNameMap,
        updatedAt: serverTimestamp(),
      });
      updatedGroupCount += 1;
    }),
  );

  if (updatedGroupCount > 0) {
    logger.info("groupService.syncMemberName", "同步群組成員名稱成功", {
      ownerUserId,
      updatedGroupCount,
    });
  }

  return updatedGroupCount;
}

export async function syncGroupMemberProfileByUserId(
  userId: string,
  profile: {
    displayName: string;
    avatarUrl: string | null;
  },
): Promise<number> {
  const normalizedDisplayName = profile.displayName.trim();
  if (!normalizedDisplayName) return 0;

  const groups = await getUserGroups(userId);
  let updatedGroupCount = 0;

  await Promise.all(
    groups.map(async (group) => {
      let changed = false;
      const nextMembers = group.members.map((member) => {
        if (member.userId !== userId) return member;

        if (
          member.displayName === normalizedDisplayName
          && member.avatarUrl === profile.avatarUrl
        ) {
          return member;
        }

        changed = true;
        return {
          ...member,
          displayName: normalizedDisplayName,
          avatarUrl: profile.avatarUrl,
        };
      });

      if (!changed) return;

      const nextMemberNameMap = {
        ...(group.memberNameMap ?? {}),
        ...buildMemberNameMap(nextMembers),
      };

      await updateDoc(doc(db, "groups", group.groupId), {
        members: nextMembers,
        memberNameMap: nextMemberNameMap,
        updatedAt: serverTimestamp(),
      });
      updatedGroupCount += 1;
    }),
  );

  if (updatedGroupCount > 0) {
    logger.info("groupService.syncMemberProfile", "同步群組成員頭貼/名稱成功", {
      userId,
      updatedGroupCount,
    });
  }

  return updatedGroupCount;
}

export async function removeGroupMember(
  groupId: string,
  memberId: string,
): Promise<void> {
  const group = await getGroupById(groupId);
  if (!group) throw new ZplitError("GROUP_NOT_FOUND", "群組不存在");

  const targetMember = group.members.find((member) => member.memberId === memberId);
  if (!targetMember) {
    throw new ZplitError("GROUP_NOT_FOUND", "成員不存在");
  }

  const settlementsSnap = await getDocs(
    collection(db, `groups/${groupId}/settlements`),
  );
  const hasPendingSettlements = settlementsSnap.docs.some((docSnap) => {
    const settlement = docSnap.data() as Settlement;
    return (
      !settlement.completed &&
      settlement.amount > 0 &&
      (settlement.from === memberId || settlement.to === memberId)
    );
  });

  if (hasPendingSettlements) {
    throw new ZplitError(
      "GROUP_MEMBER_HAS_PENDING_SETTLEMENTS",
      "成員尚有未結清款項，無法移除",
    );
  }

  const updatedMembers = group.members.filter((member) => member.memberId !== memberId);

  const updateData: Record<string, unknown> = {
    members: updatedMembers,
    memberNameMap: buildMemberNameMap(updatedMembers),
    updatedAt: serverTimestamp(),
  };

  if (targetMember.isBound && targetMember.userId) {
    const stillExists = updatedMembers.some(
      (member) => member.userId === targetMember.userId,
    );
    if (!stillExists) {
      const nextMemberUids = { ...(group.memberUids ?? {}) };
      delete nextMemberUids[targetMember.userId];
      updateData.memberUids = nextMemberUids;
    }
  }

  await updateDoc(doc(db, "groups", groupId), updateData);

  logger.info("groupService.removeMember", "成員移除成功", {
    groupId,
    memberId,
  });
}
