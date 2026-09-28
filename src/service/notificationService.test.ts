import { describe, it, expect } from "vitest";
import { AppNotification, badgeCount, notificationDestination } from "./notificationService";
const item = (type: AppNotification["type"], referenceId: number | null = 12): AppNotification => ({
  id: 1, type, referenceId, messageId: null, title: "", body: "", actorId: "friend", createdAt: "", readAt: null,
});
describe("notification navigation", () => {
  it("opens the correct conversation and friend-request segment", () => {
    expect(notificationDestination(item("MESSAGE"))).toBe("/app/friend-chat/12");
    expect(notificationDestination(item("FRIEND_REQUEST"))).toBe("/app/friends?tab=requests");
    expect(notificationDestination(item("FRIEND_ACCEPTED"))).toBe("/app/person/friend");
  });
  it("keeps system and report updates in the inbox", () => {
    expect(notificationDestination(item("SYSTEM"))).toBe("/app/notifications");
    expect(notificationDestination(item("REPORT_UPDATE"))).toBe("/app/notifications");
  });
  it("does not build invalid chat links and caps badges", () => {
    expect(notificationDestination(item("MESSAGE", null))).toBe("/app/friends");
    expect(badgeCount(120)).toBe("99+");
    expect(badgeCount(7)).toBe("7");
  });
});
