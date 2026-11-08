import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplanationRecorder } from "./explanation-recorder";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const uploadExplanation = vi.fn();
vi.mock("./upload-explanation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./upload-explanation")>()),
  uploadExplanation: (...args: unknown[]) => uploadExplanation(...args),
}));

const LECTURES = [
  { id: "0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c", title: "Cellular respiration" },
  { id: "1c7a6d3b-0e4f-4a2b-9d8c-3f2e1a0b9c8d", title: "Photosynthesis" },
];

class FakeRecorder {
  static isTypeSupported = (t: string) => t.startsWith("audio/webm");
  static last: FakeRecorder | null = null;
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    readonly stream: MediaStream,
    readonly options: { mimeType: string },
  ) {
    FakeRecorder.last = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: this.options.mimeType }) });
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }) as unknown as MediaStream);

function renderRecorder(props: Partial<Parameters<typeof ExplanationRecorder>[0]> = {}) {
  return render(
    <ExplanationRecorder
      lectures={LECTURES.slice(0, 1)}
      defaultLectureId={LECTURES[0].id}
      disabled={false}
      hasAttempt={false}
      backHref="/weak-concepts"
      {...props}
    />,
  );
}

describe("ExplanationRecorder", () => {
  beforeEach(() => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    URL.createObjectURL = vi.fn(() => "blob:take");
    URL.revokeObjectURL = vi.fn();
    uploadExplanation.mockReset();
    push.mockReset();
    getUserMedia.mockClear();
    stopTrack.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("records, reviews and submits an explanation, then opens the new attempt", async () => {
    uploadExplanation.mockResolvedValue("3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d");
    renderRecorder();

    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    expect(await screen.findByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(FakeRecorder.last?.options.mimeType).toBe("audio/webm;codecs=opus");
    expect(screen.getByText("For Cellular respiration")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByLabelText("Your recorded explanation")).toHaveAttribute("src", "blob:take");

    await userEvent.click(screen.getByRole("button", { name: /submit for feedback/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/explain?recording=3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d"));
    const [arg] = uploadExplanation.mock.calls[0] as [{ mimeType: string; lectureId: string; blob: Blob }];
    expect(arg.mimeType).toBe("audio/webm");
    expect(arg.lectureId).toBe(LECTURES[0].id);
    expect(arg.blob.size).toBeGreaterThan(0);
    // Navigation (mocked) settles immediately: the "opening" panel closes and recording is available again.
    expect(await screen.findByRole("button", { name: /record an explanation/i })).toBeEnabled();
    expect(screen.queryByText(/opening your attempt/i)).not.toBeInTheDocument();
  });

  it("shows 'Opening your attempt…' until the new attempt has loaded", async () => {
    // A navigation that never settles keeps the transition pending.
    push.mockImplementation(() => {
      throw new Promise(() => {});
    });
    uploadExplanation.mockResolvedValue("3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d");
    renderRecorder();
    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    await userEvent.click(await screen.findByRole("button", { name: /stop/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit for feedback/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Opening your attempt…");
    expect(screen.getByRole("heading", { name: "Uploaded" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record an explanation/i })).not.toBeInTheDocument();
  });

  it("asks which notes when there are several and no current one", async () => {
    renderRecorder({ lectures: LECTURES, defaultLectureId: null });
    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    expect(getUserMedia).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText(/which notes/i), LECTURES[1].id);
    await userEvent.click(screen.getByRole("button", { name: /start recording/i }));
    await userEvent.click(await screen.findByRole("button", { name: /stop/i }));
    expect(screen.getByText("For Photosynthesis")).toBeInTheDocument();
  });

  it("explains a blocked microphone", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    renderRecorder();
    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/microphone access is blocked/i);
  });

  it("keeps the take and shows the error when the upload fails", async () => {
    const { UploadError } = await import("./upload-explanation");
    uploadExplanation.mockRejectedValue(new UploadError("Notes not found"));
    renderRecorder();
    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    await userEvent.click(await screen.findByRole("button", { name: /stop/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit for feedback/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Notes not found");
    expect(screen.getByRole("button", { name: /submit for feedback/i })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("asks which weak concept to explain, and uploads the choice", async () => {
    uploadExplanation.mockResolvedValue("3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d");
    const concepts = [
      { id: "c1", conceptKey: "oxygen-final-electron-acceptor", label: "Give oxygen its specific role", lectureId: LECTURES[0].id },
      { id: "c2", conceptKey: "light-reactions", label: "Light reactions", lectureId: LECTURES[1].id },
    ];
    renderRecorder({ concepts });
    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    expect(getUserMedia).not.toHaveBeenCalled();

    const select = screen.getByLabelText(/which concept/i);
    // Only this class's concepts, plus a free explanation.
    expect([...(select as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      "Give oxygen its specific role",
      "Whole class (free explanation)",
    ]);
    await userEvent.selectOptions(select, "oxygen-final-electron-acceptor");
    await userEvent.click(screen.getByRole("button", { name: /start recording/i }));
    await userEvent.click(await screen.findByRole("button", { name: /stop/i }));
    expect(screen.getByText("Give oxygen its specific role")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /submit for feedback/i }));
    await waitFor(() => expect(uploadExplanation).toHaveBeenCalled());
    expect(uploadExplanation.mock.calls[0][0]).toMatchObject({ conceptKey: "oxygen-final-electron-acceptor" });
  });

  it("starts right away on a preselected concept and keeps it", async () => {
    uploadExplanation.mockResolvedValue("3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d");
    const concepts = [{ id: "c1", conceptKey: "oxygen-final-electron-acceptor", label: "Give oxygen its specific role", lectureId: LECTURES[0].id }];
    renderRecorder({ concepts, defaultConceptKey: "oxygen-final-electron-acceptor" });
    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    expect(await screen.findByRole("button", { name: /stop/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit for feedback/i }));
    await waitFor(() => expect(uploadExplanation).toHaveBeenCalled());
    expect(uploadExplanation.mock.calls[0][0]).toMatchObject({ conceptKey: "oxygen-final-electron-acceptor" });
  });

  it("sends no concept for a free explanation", async () => {
    uploadExplanation.mockResolvedValue("3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d");
    renderRecorder();
    await userEvent.click(screen.getByRole("button", { name: /record an explanation/i }));
    await userEvent.click(await screen.findByRole("button", { name: /stop/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit for feedback/i }));
    await waitFor(() => expect(uploadExplanation).toHaveBeenCalled());
    expect(uploadExplanation.mock.calls[0][0].conceptKey).toBeUndefined();
  });

  it("is disabled with a hint when the user has no classes", () => {
    renderRecorder({ lectures: [], defaultLectureId: null });
    expect(screen.getByRole("button", { name: /record an explanation/i })).toBeDisabled();
    expect(screen.getByText(/capture some notes first/i)).toBeInTheDocument();
  });
});
