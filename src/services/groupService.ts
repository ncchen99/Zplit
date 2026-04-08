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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { nanoid } from 'nanoid';
import type { Group, GroupMember } from '@/store/groupStore';
import { logger } from '@/utils/logger';
import { ZplitError } from '@/utils/errors';

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

export async function createGroup(
  name: string,
  createdBy: string,
  creatorDisplayName: string,
  creatorAvatarUrl: string | null,
  coverUrl: string | null = null
): Promise<Group> {
  const inviteCode = nanoid(8);
  const ref = doc(collection(db, 'groups'));

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
    memberUids: buildMemberUids(initialMembers),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 同時寫入群組文件和 inviteCodes 查詢文件（batch 不需要，因為 inviteCodes 是輔助索引）
  await setDoc(ref, groupData);
  await setDoc(doc(db, 'inviteCodes', inviteCode), { groupId: ref.id });
  logger.info('groupService.create', '群組建立成功', { groupId: ref.id, name });

  return {
    groupId: ref.id,
    ...groupData,
  } as unknown as Group;
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) return null;
  return { groupId: snap.id, ...snap.data() } as Group;
}

export async function getGroupByInviteCode(code: string): Promise<Group | null> {
  // 先從 inviteCodes 查詢對應 groupId，再讀取群組文件
  // 這樣非成員也能透過邀請碼找到群組（Security Rules 允許 get）
  const codeSnap = await getDoc(doc(db, 'inviteCodes', code));
  if (!codeSnap.exists()) return null;
  const { groupId } = codeSnap.data() as { groupId: string };
  return getGroupById(groupId);
}

export async function getUserGroups(userId: string): Promise<Group[]> {
  const q = query(
    collection(db, 'groups'),
    where(`memberUids.${userId}`, '==', true)
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
        const codeRef = doc(db, 'inviteCodes', g.inviteCode);
        const codeSnap = await getDoc(codeRef);
        if (!codeSnap.exists()) {
          await setDoc(codeRef, { groupId: g.groupId });
          logger.info('groupService.backfill', '補建 inviteCode', {
            groupId: g.groupId,
            inviteCode: g.inviteCode,
          });
        }
      })
  );
}

export async function addMemberToGroup(
  groupId: string,
  member: GroupMember
): Promise<void> {
  const ref = doc(db, 'groups', groupId);

  const updateData: Record<string, unknown> = {
    members: arrayUnion(member),
    updatedAt: serverTimestamp(),
  };

  // 若為已綁定帳號的成員，同步更新 memberUids Map（供 Security Rules 查詢）
  if (member.isBound && member.userId) {
    updateData[`memberUids.${member.userId}`] = true;
  }

  await updateDoc(ref, updateData);
  logger.info('groupService.addMember', '成員加入群組', { groupId, memberId: member.memberId });
}

export async function addPlaceholderMember(
  groupId: string,
  displayName: string
): Promise<GroupMember> {
  const member: GroupMember = {
    memberId: nanoid(),
    userId: null,
    displayName,
    avatarUrl: null,
    isBound: false,
    joinedAt: null,
  };

  const ref = doc(db, 'groups', groupId);
  await updateDoc(ref, {
    members: arrayUnion(member),
    updatedAt: serverTimestamp(),
  });

  return member;
}

export async function bindMemberToUser(
  groupId: string,
  memberId: string,
  userId: string,
  displayName: string,
  avatarUrl: string | null
): Promise<void> {
  const group = await getGroupById(groupId);
  if (!group) throw new ZplitError('GROUP_NOT_FOUND', '群組不存在');

  const updatedMembers = group.members.map((m) =>
    m.memberId === memberId
      ? { ...m, userId, displayName, avatarUrl, isBound: true }
      : m
  );

  await updateDoc(doc(db, 'groups', groupId), {
    members: updatedMembers,
    // 同步更新 memberUids，讓 Security Rules 可以驗證此使用者的成員身份
    [`memberUids.${userId}`]: true,
    updatedAt: serverTimestamp(),
  });

  logger.info('groupService.bindMember', '成員帳號綁定成功', { groupId, memberId, userId });
}
