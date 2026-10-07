import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const fixtures = vi.hoisted(() => ({
  auth: {} as any,
  listener: undefined as undefined | ((value: boolean) => void),
}));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => fixtures.auth }));
vi.mock("../service/socketService", () => ({
  default: {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    subscribe: vi.fn(),
    onConnectionChange: vi.fn((listener: (value: boolean) => void) => {
      fixtures.listener = listener;
      return vi.fn();
    }),
  },
}));
import service from "../service/socketService";
import { useRealtimeConnection } from "./useRealtimeConnection";
const token = (sid: string, exp: number) =>
  "h." + btoa(JSON.stringify({ sub: "alice", sid, exp })) + ".s";
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.auth = {
    isAuthenticated: true,
    token: token("one", 100),
    user: { publicId: "alice" },
  };
});
describe("renewal and active chat", () => {
  it("keeps the socket and subscriptions when only the access token changes", async () => {
    const { rerender } = renderHook(() => useRealtimeConnection());
    await act(async () => {});
    expect(service.connect).toHaveBeenCalledTimes(1);
    fixtures.auth = { ...fixtures.auth, token: token("one", 200) };
    rerender();
    expect(service.connect).toHaveBeenCalledTimes(1);
    expect(service.disconnect).not.toHaveBeenCalled();
  });
  it("tears down the socket for a different login or logout", async () => {
    const { rerender } = renderHook(() => useRealtimeConnection());
    await act(async () => {});
    fixtures.auth = { ...fixtures.auth, token: token("two", 300) };
    rerender();
    await act(async () => {});
    expect(service.connect).toHaveBeenCalledTimes(2);
    expect(service.disconnect).toHaveBeenCalledTimes(1);
    fixtures.auth = { isAuthenticated: false, user: null, token: null };
    rerender();
    expect(service.disconnect).toHaveBeenCalledTimes(3);
  });
  it("restores presence subscriptions after a real network reconnect", async () => {
    renderHook(() => useRealtimeConnection());
    await act(async () => {});
    vi.mocked(service.subscribe).mockClear();
    act(() => fixtures.listener?.(false));
    act(() => fixtures.listener?.(true));
    expect(service.subscribe).toHaveBeenCalledWith(
      "presence",
      expect.any(String),
      expect.any(Function),
    );
  });
});
