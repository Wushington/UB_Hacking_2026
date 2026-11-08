import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListenButton } from "./listen-button";

const ID = "7d1f3c1e-2b8a-4c3e-9f4a-1a2b3c4d5e6f";

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  static playResult: () => Promise<void> = () => Promise.resolve();
  preload = "";
  ended = false;
  currentTime = 0;
  constructor(readonly src: string) {
    super();
    FakeAudio.instances.push(this);
  }
  play = vi.fn(() => {
    const result = FakeAudio.playResult();
    void result.then(() => this.dispatchEvent(new Event("playing"))).catch(() => {});
    return result;
  });
  pause = vi.fn(() => {
    this.dispatchEvent(new Event("pause"));
  });
}

describe("ListenButton", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    FakeAudio.playResult = () => Promise.resolve();
    vi.stubGlobal("Audio", FakeAudio);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads the feedback audio only when clicked, then pauses and resumes", async () => {
    render(<ListenButton recordingId={ID} />);
    expect(FakeAudio.instances).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: /listen/i }));
    expect(FakeAudio.instances[0].src).toBe(`/api/explanations/${ID}/feedback-audio`);
    expect(await screen.findByRole("button", { name: /pause/i })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(FakeAudio.instances).toHaveLength(1);
    expect(await screen.findByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("returns to Listen when playback ends", async () => {
    render(<ListenButton recordingId={ID} />);
    await userEvent.click(screen.getByRole("button", { name: /listen/i }));
    await screen.findByRole("button", { name: /pause/i });
    act(() => {
      FakeAudio.instances[0].ended = true;
      FakeAudio.instances[0].dispatchEvent(new Event("ended"));
    });
    expect(screen.getByRole("button", { name: /listen/i })).toBeInTheDocument();
  });

  it("shows an error and retries with a fresh request", async () => {
    FakeAudio.playResult = () => Promise.reject(new DOMException("unsupported", "NotSupportedError"));
    render(<ListenButton recordingId={ID} />);
    await userEvent.click(screen.getByRole("button", { name: /listen/i }));
    const retry = await screen.findByRole("button", { name: /audio unavailable, retry/i });

    FakeAudio.playResult = () => Promise.resolve();
    await userEvent.click(retry);
    expect(FakeAudio.instances).toHaveLength(2);
    expect(await screen.findByRole("button", { name: /pause/i })).toBeInTheDocument();
  });
});
