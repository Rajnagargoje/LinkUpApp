import React from "react";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OneTwoOneChat from "./OneTwoOneChat";
import socketService from "../../service/socketService";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: "alice" } }) }));
vi.mock("../../service/socketService", () => ({ default: {
  isConnected: vi.fn(() => true), onConnectionChange: vi.fn(() => vi.fn()),
  subscribe: vi.fn(), unsubscribe: vi.fn(), publish: vi.fn(() => true),
} }));
vi.mock("@ionic/react", async () => {
  const React = await import("react");
  const box = ({ children }: any) => <div>{children}</div>;
  return {
    IonPage: box, IonHeader: box, IonFooter: box, IonToolbar: box, IonButtons: box, IonTitle: box,
    IonBackButton: () => null, IonIcon: () => null, IonSpinner: () => null, IonAlert: () => null,
    IonContent: React.forwardRef(({ children }: any, ref) => {
      React.useImperativeHandle(ref, () => ({ scrollToBottom: vi.fn() }));
      return <div>{children}</div>;
    }),
    IonButton: ({ children, onClick, disabled, "aria-label": label }: any) => <button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
    IonInput: ({ onIonInput, onKeyDown, value, disabled, "aria-label": label }: any) => <input aria-label={label} value={value} disabled={disabled} onKeyDown={onKeyDown} onChange={e => onIonInput({ detail: { value: e.target.value } })} />,
  };
});

function event(payload: object) {
  const callback = vi.mocked(socketService.subscribe).mock.calls.at(-1)![2];
  act(() => callback(payload, {} as any));
}

beforeEach(() => { vi.clearAllMocks(); });
describe("random chat", () => {
  it("waits for matching and displays only server-confirmed messages", () => {
    render(<OneTwoOneChat />);
    expect(screen.getByLabelText("Message")).toBeDisabled();
    fireEvent.click(screen.getByText("New chat"));
    expect(socketService.publish).toHaveBeenCalledWith("/app/random/join", { language: "", interests: [] });
    event({ type: "WAITING" });
    event({ type: "MATCHED", matchId: "match1", partner: "bob" });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(socketService.publish).toHaveBeenCalledWith("/app/random/message", { matchId: "match1", content: "Hello" });
    expect(screen.queryByText("Hello")).toBeNull();
    event({ type: "MESSAGE", matchId: "match1", id: "m1", sender: "alice", content: "Hello", timeStamp: "2026-09-19T12:00:00Z" });
    expect(screen.getByText("Hello")).toBeInTheDocument();
    event({ type: "MESSAGE", matchId: "old", id: "m2", sender: "bob", content: "Stale", timeStamp: "2026-09-19T12:00:00Z" });
    expect(screen.queryByText("Stale")).toBeNull();
  });

  it("waits for leave acknowledgement before searching for the next person", () => {
    render(<OneTwoOneChat />);
    event({ type: "MATCHED", matchId: "match1", partner: "bob" });
    fireEvent.click(screen.getByText("Next person"));
    expect(socketService.publish).toHaveBeenLastCalledWith("/app/random/leave", {});
    event({ type: "ENDED", matchId: "match1", message: "Partner left" });
    expect(socketService.publish).toHaveBeenLastCalledWith("/app/random/leave", {});
    event({ type: "ENDED", message: "Chat ended." });
    expect(socketService.publish).toHaveBeenLastCalledWith("/app/random/join", { language: "", interests: [] });
  });

  it("disables sending on disconnect and leaves on unmount", () => {
    const view = render(<OneTwoOneChat />);
    event({ type: "MATCHED", matchId: "match1", partner: "bob" });
    act(() => vi.mocked(socketService.onConnectionChange).mock.calls[0][0](false));
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
    view.unmount();
    expect(socketService.publish).toHaveBeenLastCalledWith("/app/random/leave", {});
    expect(socketService.unsubscribe).toHaveBeenCalledWith("random-chat");
  });
});
