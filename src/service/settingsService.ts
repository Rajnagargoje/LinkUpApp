import axiosClient from './axiosClient';

export interface PrivacySettings { discoverable: boolean; activityVisible: boolean; messageRequestsEnabled: boolean; }
export interface BlockedUser { id: number; publicId: string | null; username: string; profilePhoto: string | null; blockedAt: string; }
export interface PageResult<T> { items: T[]; nextPage: number | null; }
export interface PublicSettings { operator: string; supportEmail: string; downloadUrl: string; instagramUrl: string; tiktokUrl: string; }
export interface LegalDocument { title: string; updatedAt: string; operator: string; contactEmail: string; sections: { title: string; text: string }[]; }
export type SupportCategory = 'GENERAL' | 'BUG' | 'SAFETY' | 'PRIVACY';
export interface SupportRequest { category: SupportCategory; subject: string; message: string; }
export interface SupportTicket extends SupportRequest { id: number; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; reply: string | null; createdAt: string; }

export const getPrivacySettings = async () => (await axiosClient.get<PrivacySettings>('/settings/privacy')).data;
export const savePrivacySettings = async (value: PrivacySettings) => (await axiosClient.put<PrivacySettings>('/settings/privacy', value)).data;
export const getBlockedUsers = async (page = 0) => (await axiosClient.get<PageResult<BlockedUser>>('/settings/blocked', { params: { page } })).data;
export const unblockUser = async (id: number) => { await axiosClient.delete(`/settings/blocked/${id}`); };
export const getPublicSettings = async () => (await axiosClient.get<PublicSettings>('/public/settings')).data;
export const getLegalDocument = async (kind: 'privacy' | 'terms' | 'deletion') => (await axiosClient.get<LegalDocument>(`/public/legal/${kind}`)).data;
export const createSupportRequest = async (value: SupportRequest) => (await axiosClient.post<SupportTicket>('/settings/support', value)).data;
export const getSupportRequests = async (page = 0) => (await axiosClient.get<PageResult<SupportTicket>>('/settings/support', { params: { page } })).data;
export function settingsError(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === 'string' && message.length < 300 ? message : fallback;
}
