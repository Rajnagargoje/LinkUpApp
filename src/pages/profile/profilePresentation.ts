import { User, Gender, LookingFor } from '../../common/user.model';
import { ConversationResponse } from '../../common/chat.model';
import { chatTimestamp } from '../../utils/chatPresentation';

export type ProfileTab = 'about' | 'chats' | 'friends';
export const profileTab = (value: string | null): ProfileTab => value === 'chats' || value === 'friends' ? value : 'about';
export const genderLabels: Record<Gender, string> = { MALE: 'Man', FEMALE: 'Woman', NON_BINARY: 'Non-binary', PREFER_NOT_TO_SAY: 'Prefer not to say' };
export const lookingForLabels: Record<LookingFor, string> = { FRIENDS: 'New friends', DATING: 'Dating', NETWORKING: 'Networking', NOT_SURE: 'Exploring' };

export function profilePhotos(user: Pick<User, 'profilePhoto' | 'photos'>): string[] {
  return [...new Set([user.profilePhoto, ...(user.photos ?? [])].filter((url): url is string => !!url?.trim()))];
}
export function birthDate(value?: string | null): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value ?? '');
  if (!match) return null;
  const [, y, m, d] = match; const date = new Date(+y, +m - 1, +d);
  return date.getFullYear() === +y && date.getMonth() === +m - 1 && date.getDate() === +d ? date : null;
}
export function profileAge(user: Pick<User, 'age' | 'dob'>): number | null {
  const dob = birthDate(user.dob);
  if (!dob) return typeof user.age === 'number' && user.age > 0 ? user.age : null;
  const now = new Date(); let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}
export function birthdayLabel(value?: string | null): string {
  const date = birthDate(value);
  return date ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date) : 'Not added';
}
export function joinedLabel(value?: string | null): string {
  const timestamp = chatTimestamp(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(timestamp) : 'Not available';
}
export function completion(user: User, photos: string[]) {
  const fields = [
    { done: !!user.profilePhoto, label: 'Add a profile photo', photos: true },
    { done: !!birthDate(user.dob) || user.age != null, label: 'Add your birthday', photos: false },
    { done: !!user.gender, label: 'Add your gender', photos: false },
    { done: !!user.lookingFor, label: 'Choose what you are looking for', photos: false },
    { done: !!user.bio?.trim(), label: 'Write a little about yourself', photos: false },
    { done: !!user.interests?.length, label: 'Add your interests', photos: false },
    { done: photos.length >= 2, label: 'Add another photo', photos: true },
  ];
  return { percent: Math.round(fields.filter(field => field.done).length / fields.length * 100), next: fields.find(field => !field.done) };
}
export function directConversations(items: ConversationResponse[]): ConversationResponse[] {
  return [...new Map(items.filter(item => item.type === 'DIRECT' && !item.archived && !!item.friendPublicId)
    .map(item => [item.conversationId, item])).values()];
}
export function recentConversations(items: ConversationResponse[]): ConversationResponse[] {
  return directConversations(items).filter(item => !!item.lastMessage?.trim() || item.unreadCount > 0)
    .sort((a, b) => (chatTimestamp(b.lastMessageAt) || 0) - (chatTimestamp(a.lastMessageAt) || 0) || b.conversationId - a.conversationId);
}
