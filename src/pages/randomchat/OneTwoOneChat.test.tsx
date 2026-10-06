import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import socketService from "../../service/socketService";
import { Preferences } from "./randomChat.types";
import useRandomChat from "./useRandomChat";

vi.mock("../../contexts/NotificationContext", () => ({
  useNotifications: () => ({ revision: 0 }),
}));
vi.mock("../../service/socketService", () => ({
  default: {
    isConnected: vi.fn(() => true),
    onConnectionChange: vi.fn(() => vi.fn()),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(() => true),
  },
}));
const prefs: Preferences = {
  language: "Hindi",
  interests: ["Music"],
  aiFallback: true,
};
function emit(payload: object) {
  const callback = vi.mocked(socketService.subscribe).mock.calls.at(-1)![2];
  act(() => callback(payload, {} as any));
}
function setup(ai = false) {
  const view = renderHook(() => useRandomChat("alice"));
  act(() => view.result.current.start(prefs));
  emit({ type: "WAITING", aiAvailable: true, fallbackSeconds: 15 });
  emit({
    type: "MATCHED",
    matchId: "match1",
    selfId: "u:alice",
    partner: ai ? "Aanya" : "Bob",
    partnerKind: ai ? "AI" : "HUMAN",
  });
  return view;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(socketService.publish).mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("random chat sessions", () => {
  it("requests fallback only for the users selected preference and waits for server identity", () => {
    const { result } = renderHook(() => useRandomChat("alice"));
    act(() => result.current.start(prefs));
    expect(socketService.publish).toHaveBeenCalledWith(
      "/app/random/join",
      prefs,
    );
    expect(result.current.phase).toBe("waiting");
    act(() => vi.advanceTimersByTime(15000));
    expect(result.current.partner).toBeNull(); // No client-side fictional match.
    emit({
      type: "MATCHED",
      matchId: "ai1",
      partner: "Aanya",
      partnerKind: "AI",
      selfId: "u:alice",
      messages: [
        {
          id: "g",
          senderId: "ai:aanya",
          content: "Hi",
          timeStamp: "2026-10-06T00:00:00Z",
        },
      ],
    });
    expect(result.current.partner?.kind).toBe("AI");
    expect(result.current.messages[0].mine).toBe(false);
  });
  it("merges acknowledgement into one bubble and retries with the same client ID", () => {
    const { result } = setup();
    act(() => {
      result.current.send("hello");
    });
    const message = result.current.messages[0];
    expect(message.status).toBe("sending");
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.messages[0].status).toBe("failed");
    act(() => {
      result.current.send(message.content, result.current.messages[0]);
    });
    emit({
      type: "MESSAGE",
      matchId: "match1",
      id: "server1",
      clientId: message.clientId,
      senderId: "u:alice",
      sender: "alice",
      content: "hello",
      timeStamp: "2026-10-06T00:00:00Z",
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe("sent");
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/message",
      expect.objectContaining({ clientId: message.clientId }),
    );
  });
  it("requires leave acknowledgement before next and ignores old messages", () => {
    const { result } = setup();
    act(() => result.current.start(prefs));
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/leave",
      {},
    );
    emit({ type: "ENDED", matchId: "match1" });
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/leave",
      {},
    );
    emit({ type: "ENDED" });
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/join",
      prefs,
    );
    emit({
      type: "MATCHED",
      matchId: "match2",
      partner: "Meera",
      partnerKind: "HUMAN",
      selfId: "u:alice",
    });
    emit({ type: "MESSAGE", matchId: "match1", id: "old", content: "stale" });
    expect(result.current.messages).toHaveLength(0);
  });
  it("keeps AI and human histories separate during a confirmed handoff", () => {
    const { result } = setup(true);
    emit({
      type: "MESSAGE",
      matchId: "match1",
      id: "ai-greeting",
      senderId: "ai:aanya",
      content: "Hello",
      timeStamp: "2026-10-06T00:00:00Z",
    });
    emit({
      type: "HUMAN_OFFER",
      matchId: "match1",
      offerId: "offer",
      expiresAt: new Date(Date.now() + 20000).toISOString(),
    });
    expect(result.current.partner?.kind).toBe("AI");
    act(() =>
      result.current.command("offer", { offerId: "offer", accept: true }),
    );
    emit({
      type: "MATCHED",
      matchId: "human",
      selfId: "u:alice",
      partner: "Bob",
      partnerKind: "HUMAN",
    });
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.offer).toBeNull();
    emit({
      type: "MESSAGE",
      matchId: "match1",
      id: "late",
      senderId: "ai:aanya",
      content: "late response",
    });
    expect(result.current.messages).toHaveLength(0);
  });
  it("uses separate saved-companion state from actual friend requests", () => {
    const { result } = setup(true);
    act(() => result.current.command("companions/save"));
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/companions/save",
      { matchId: "match1" },
    );
    emit({ type: "COMPANION_SAVED", matchId: "match1", saved: true });
    expect(result.current.saved).toBe(true);
    expect(result.current.connectionStatus).toBe("NONE");
    expect(
      vi
        .mocked(socketService.publish)
        .mock.calls.some((call) => call[0] === "/app/random/connect"),
    ).toBe(false);
  });
  it("clears the previous human typing timer before an AI reply starts", () => {
    const { result } = setup();
    emit({ type: "TYPING", matchId: "match1", typing: true });
    act(() => result.current.start(prefs));
    emit({ type: "ENDED" });
    emit({
      type: "MATCHED",
      matchId: "ai2",
      selfId: "u:alice",
      partner: "Tara",
      partnerKind: "AI",
    });
    emit({ type: "TYPING", matchId: "ai2", typing: true });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.typing).toBe(true);
  });
  it("does not let a late reply error interrupt the leave acknowledgement", () => {
    const { result } = setup(true);
    act(() => result.current.start(prefs));
    emit({ type: "AI_ERROR", matchId: "match1", message: "old failure" });
    expect(result.current.busy).toBe("end");
    emit({
      type: "MATCHED",
      matchId: "late",
      partnerKind: "HUMAN",
      partner: "Old match",
    });
    expect(result.current.match).toBe("match1");
    emit({ type: "ENDED" });
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/join",
      prefs,
    );
  });
  it("reflects genuine sent, received and accepted friend requests", () => {
    const { result } = setup();
    act(() => result.current.command("connect"));
    emit({
      type: "CONNECTION",
      matchId: "match1",
      connectionStatus: "REQUEST_SENT",
    });
    expect(result.current.connectionStatus).toBe("REQUEST_SENT");
    emit({
      type: "CONNECTION",
      matchId: "match1",
      connectionStatus: "REQUEST_RECEIVED",
    });
    act(() => result.current.command("connection/accept"));
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/connection/accept",
      { matchId: "match1" },
    );
    emit({
      type: "CONNECTION",
      matchId: "match1",
      connectionStatus: "CONNECTED",
    });
    expect(result.current.connectionStatus).toBe("CONNECTED");
  });
  it("does not silently rejoin after a disconnected session or accept its late reply", () => {
    const { result, unmount } = setup(true);
    act(() =>
      vi.mocked(socketService.onConnectionChange).mock.calls[0][0](false),
    );
    expect(result.current.phase).toBe("ended");
    emit({ type: "MESSAGE", matchId: "match1", id: "late", content: "late" });
    expect(result.current.messages).toHaveLength(0);
    vi.mocked(socketService.publish).mockClear();
    act(() =>
      vi.mocked(socketService.onConnectionChange).mock.calls[0][0](true),
    );
    expect(socketService.publish).not.toHaveBeenCalledWith(
      "/app/random/join",
      expect.anything(),
    );
    unmount();
    expect(socketService.unsubscribe).toHaveBeenCalledWith("random-chat");
  });
  it("leaves an active session and clears message timers when unmounted", () => {
    const { result, unmount } = setup();
    act(() => {
      result.current.send("hello");
    });
    unmount();
    expect(socketService.publish).toHaveBeenLastCalledWith(
      "/app/random/leave",
      {},
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
