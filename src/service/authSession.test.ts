import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import type { User } from "../common/user.model";

const vault = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("./sessionVault", () => ({
  readSessionVault: vi.fn(async () => vault.value),
  writeSessionVault: vi.fn(async (value: string) => {
    vault.value = value;
  }),
}));
const user = {
  publicId: "alice",
  username: "alice",
  interests: [],
} as unknown as User;
function jwt(expiresInSeconds: number, sid = "session-a") {
  return (
    "header." +
    btoa(
      JSON.stringify({
        sub: "alice",
        sid,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      }),
    ) +
    ".signature"
  );
}
function session(exp = -30, refreshToken = "a".repeat(43)) {
  return {
    token: jwt(exp),
    user,
    refreshToken,
    refreshExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function httpError(
  status: number,
  config: any = { headers: new AxiosHeaders() },
) {
  return new AxiosError(
    "Request failed",
    "ERR_BAD_RESPONSE",
    config,
    undefined,
    { status, statusText: "Error", headers: {}, config, data: {} },
  );
}
async function setup(value = session()) {
  const storage = await import("./tokenStorage");
  await storage.initializeSessionStorage();
  await storage.installSession(value);
  const auth = await import("./authSession");
  const client = (await import("./axiosClient")).default;
  return { storage, auth, client };
}
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vault.value = null;
  localStorage.clear();
  sessionStorage.clear();
});

describe("renewable sessions", () => {
  it("coalesces simultaneous renewal and persists rotated credentials", async () => {
    const { storage, auth } = await setup();
    const next = session(1800, "b".repeat(43));
    const post = vi
      .spyOn(auth.sessionHttp, "post")
      .mockResolvedValue({ data: { data: next } });
    const values = await Promise.all(
      Array.from({ length: 8 }, () => auth.ensureFreshToken()),
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(values).toEqual(Array(8).fill(next.token));
    expect(storage.getSession()?.refreshToken).toBe(next.refreshToken);
    expect(JSON.parse(vault.value!).session.pendingRefreshId).toBeUndefined();
    expect(localStorage.getItem("linkup_token")).toBeNull();
  });
  it("keeps credentials during a network outage and retries the same rotation ID", async () => {
    const { storage, auth } = await setup();
    const post = vi
      .spyOn(auth.sessionHttp, "post")
      .mockRejectedValueOnce(new AxiosError("Network Error"));
    await expect(auth.ensureFreshToken()).rejects.toThrow("Network Error");
    const firstRequest = post.mock.calls[0][1] as any;
    expect(storage.getSession()?.refreshToken).toBe("a".repeat(43));
    expect(JSON.parse(vault.value!).session.pendingRefreshId).toBe(
      firstRequest.requestId,
    );
    post.mockResolvedValueOnce({
      data: { data: session(1800, "b".repeat(43)) },
    });
    await auth.ensureFreshToken();
    expect((post.mock.calls[1][1] as any).requestId).toBe(
      firstRequest.requestId,
    );
  });
  it("restores an expired saved session after process restart and renews it", async () => {
    const first = await setup();
    expect(first.storage.getStoredUser()?.publicId).toBe("alice");
    vi.resetModules();
    const storage = await import("./tokenStorage");
    const auth = await import("./authSession");
    const next = session(1800, "b".repeat(43));
    vi.spyOn(auth.sessionHttp, "post").mockResolvedValue({
      data: { data: next },
    });
    expect(await auth.ensureFreshToken()).toBe(next.token);
    expect(storage.getStoredUser()?.publicId).toBe("alice");
  });
  it("clears the session only when renewal is rejected as invalid", async () => {
    const { storage, auth } = await setup();
    const expired = vi.fn();
    window.addEventListener(storage.AUTH_LOGOUT_EVENT, expired);
    vi.spyOn(auth.sessionHttp, "post").mockRejectedValue(httpError(401));
    await expect(auth.ensureFreshToken()).rejects.toThrow("expired");
    expect(storage.getSession()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener(storage.AUTH_LOGOUT_EVENT, expired);
  });
  it("preserves sign-in on 429 and 503", async () => {
    const { storage, auth } = await setup();
    const post = vi.spyOn(auth.sessionHttp, "post");
    for (const status of [429, 503]) {
      post.mockRejectedValueOnce(httpError(status));
      await expect(auth.ensureFreshToken()).rejects.toBeInstanceOf(AxiosError);
      expect(storage.getSession()?.user.publicId).toBe("alice");
    }
  });
  it("does not resurrect login when logout happens during renewal", async () => {
    const { storage, auth } = await setup();
    const pending = deferred<any>();
    const post = vi
      .spyOn(auth.sessionHttp, "post")
      .mockImplementation((url: string) =>
        url.endsWith("/refresh")
          ? pending.promise
          : (Promise.resolve({ data: {} }) as any),
      );
    const renewing = auth.ensureFreshToken();
    const rejected = expect(renewing).rejects.toThrow("session changed");
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await storage.clearSession();
    pending.resolve({ data: { data: session(1800, "b".repeat(43)) } });
    await rejected;
    expect(storage.getSession()).toBeNull();
    await auth.flushRevocations();
    expect(JSON.parse(vault.value!).session).toBeNull();
  });
  it("ignores a late refresh rejection belonging to a previous login", async () => {
    const { storage, auth } = await setup();
    const pending = deferred<any>();
    const post = vi
      .spyOn(auth.sessionHttp, "post")
      .mockReturnValue(pending.promise);
    const refreshing = auth.ensureFreshToken();
    const rejected = expect(refreshing).rejects.toBeInstanceOf(AxiosError);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const next = {
      ...session(1800, "c".repeat(43)),
      token: jwt(1800, "new-login"),
    };
    await storage.installSession(next);
    pending.reject(httpError(401));
    await rejected;
    expect(storage.getToken()).toBe(next.token);
  });
  it("does not log out or refresh on an ordinary 403", async () => {
    const { storage, auth, client } = await setup(session(1800));
    const post = vi.spyOn(auth.sessionHttp, "post");
    client.defaults.adapter = async (config) => {
      throw httpError(403, config);
    };
    await expect(client.get("/restricted")).rejects.toBeInstanceOf(AxiosError);
    expect(storage.getSession()).not.toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
  it("retries a protected 401 once with the renewed access token", async () => {
    const { auth, client } = await setup(session(1800));
    const next = { ...session(1900, "b".repeat(43)) };
    const post = vi
      .spyOn(auth.sessionHttp, "post")
      .mockResolvedValue({ data: { data: next } });
    const requests: string[] = [];
    client.defaults.adapter = async (config) => {
      requests.push(String(config.headers.Authorization));
      if (!config._authRetried) throw httpError(401, config);
      return {
        status: 200,
        statusText: "OK",
        data: { done: true },
        headers: {},
        config,
      };
    };
    expect((await client.get("/protected")).data.done).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toBe("Bearer " + next.token);
  });
  it("does not loop when a retried request is still unauthorized", async () => {
    const { storage, auth, client } = await setup(session(1800));
    const post = vi
      .spyOn(auth.sessionHttp, "post")
      .mockResolvedValue({ data: { data: session(1900, "b".repeat(43)) } });
    const adapter = vi.fn(async (config: any) => {
      throw httpError(401, config);
    });
    client.defaults.adapter = adapter;
    await expect(client.get("/protected")).rejects.toBeInstanceOf(AxiosError);
    expect(post).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(storage.getSession()).toBeNull();
  });
  it("queues offline logout and revokes it after connectivity returns", async () => {
    const { storage, auth } = await setup(session(1800));
    await storage.clearSession();
    const post = vi
      .spyOn(auth.sessionHttp, "post")
      .mockRejectedValueOnce(new AxiosError("Offline"));
    await auth.flushRevocations();
    expect(storage.getPendingRevocations()).toEqual(["a".repeat(43)]);
    post.mockResolvedValueOnce({ data: {} });
    await auth.flushRevocations();
    expect(storage.getPendingRevocations()).toEqual([]);
    expect(storage.getSession()).toBeNull();
  });
});
