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

  const groupData = {
    name,
    coverUrl,
    inviteCode,
    createdBy,
    members: [member],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, groupData);
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
  const q = query(collection(db, 'groups'), where('inviteCode', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { groupId: d.id, ...d.data() } as Group;
}

export async function addMemberToGroup(
  groupId: string,
  member: GroupMember
): Promise<void> {
  const ref = doc(db, 'groups', groupId);
  await updateDoc(ref, {
    members: arrayUnion(member),
    updatedAt: serverTimestamp(),
  });
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
    updatedAt: serverTimestamp(),
  });
}
