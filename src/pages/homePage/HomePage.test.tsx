import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";
import { getSystemRoomsApi, joinSystemRoomApi } from "../../service/roomService";
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("react-router", () => ({ useHistory: () => ({ push: mocks.push }) }));
vi.mock("../../header/Header", () => ({ default: () => <div>LinkUp</div> }));
vi.mock("../../service/roomService", () => ({ getSystemRoomsApi: vi.fn(), joinSystemRoomApi: vi.fn() }));
vi.mock("@ionic/react", () => {
  const box = ({ children }: any) => <div>{children}</div>;
  const button = ({ children, onClick, disabled, "aria-label": label }: any) => <button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>;
  return { IonPage: box, IonContent: box, IonHeader: box, IonToolbar: box, IonTitle: box, IonButtons: box,
    IonCard: (props: any) => props.button ? button(props) : box(props), IonCardHeader: box, IonCardContent: box, IonCardSubtitle: box, IonCardTitle: box, IonButton: button,
    IonIcon: () => null, IonSpinner: () => null, IonModal: ({ isOpen, children }: any) => isOpen ? <div role="dialog">{children}</div> : null,
    useIonRouter: () => ({ push: mocks.push }),
  };
});
const room = { roomId: "system-feedback", title: "LinkUp Feedback", topic: "Bugs and suggestions", description: "Help improve LinkUp.", rules: ["Keep feedback constructive."] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSystemRoomsApi).mockResolvedValue({ data: [room] } as any);
  vi.mocked(joinSystemRoomApi).mockResolvedValue({ data: room } as any);
});
describe("system room entry", () => {
  it("shows topic and rules before joining and opens the shared room only on Start chat", async () => {
    render(<HomePage />);
    fireEvent.click(await screen.findByLabelText("View LinkUp Feedback room info"));
    expect(screen.getByText("Keep feedback constructive.")).toBeInTheDocument();
    expect(joinSystemRoomApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Start chat"));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/app/chatPage", expect.objectContaining({ roomId: "system-feedback" })));
  });
  it("keeps the room info open and offers retry when joining fails", async () => {
    vi.mocked(joinSystemRoomApi).mockRejectedValue(new Error("Offline"));
    render(<HomePage />);
    fireEvent.click(await screen.findByLabelText("View LinkUp Feedback room info"));
    fireEvent.click(screen.getByText("Start chat"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't join");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByText("Start chat")).toBeEnabled();
  });
});
