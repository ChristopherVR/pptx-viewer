import { describe, it, expect, vi, beforeEach } from "vitest";
import { playAnimationSound, stopAnimationSound } from "./animation-sound";

/**
 * Mock HTMLAudioElement for Node/Vitest environment.
 *
 * The animation-sound module uses `new Audio(url)` which requires a
 * browser environment.  We mock the global Audio constructor to track
 * calls to play/pause and currentTime.
 */

interface MockAudio {
  src: string;
  currentTime: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

let lastCreatedAudio: MockAudio | null = null;

function createMockAudio(src: string): MockAudio {
  const audio: MockAudio = {
    src,
    currentTime: 0,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  };
  lastCreatedAudio = audio;
  return audio;
}

beforeEach(() => {
  lastCreatedAudio = null;
  // Reset module-level singleton by calling stop
  stopAnimationSound();

  // Install mock Audio constructor — vitest 4 requires `function` for `new`
  vi.stubGlobal(
    "Audio",
    vi.fn(function (src: string) {
      return createMockAudio(src);
    }),
  );
});

describe("playAnimationSound", () => {
  it("is exported as a function", () => {
    expect(typeof playAnimationSound).toBe("function");
  });

  it("creates an Audio element with the given URL", () => {
    playAnimationSound("blob:http://example.com/sound.mp3");
    expect(Audio).toHaveBeenCalledWith("blob:http://example.com/sound.mp3");
  });

  it("calls play() on the created Audio element", () => {
    playAnimationSound("data:audio/wav;base64,AAAA");
    expect(lastCreatedAudio).not.toBeNull();
    expect(lastCreatedAudio!.play).toHaveBeenCalledTimes(1);
  });

  it("stops any previously playing sound before playing a new one", () => {
    playAnimationSound("sound1.mp3");
    const firstAudio = lastCreatedAudio!;

    playAnimationSound("sound2.mp3");
    // The first audio should have been paused
    expect(firstAudio.pause).toHaveBeenCalledTimes(1);
    expect(firstAudio.currentTime).toBe(0);
  });

  it("handles play() rejection gracefully (autoplay restrictions)", () => {
    vi.stubGlobal(
      "Audio",
      vi.fn(function (src: string) {
        const audio: MockAudio = {
          src,
          currentTime: 0,
          play: vi.fn().mockRejectedValue(new Error("Autoplay blocked")),
          pause: vi.fn(),
        };
        lastCreatedAudio = audio;
        return audio;
      }),
    );

    // Should not throw
    expect(() => playAnimationSound("blocked.mp3")).not.toThrow();
  });
});

describe("stopAnimationSound", () => {
  it("is exported as a function", () => {
    expect(typeof stopAnimationSound).toBe("function");
  });

  it("does not throw when no audio is playing", () => {
    expect(() => stopAnimationSound()).not.toThrow();
  });

  it("multiple stop calls do not throw", () => {
    expect(() => {
      stopAnimationSound();
      stopAnimationSound();
      stopAnimationSound();
    }).not.toThrow();
  });

  it("pauses and resets currentTime of the active audio", () => {
    playAnimationSound("test.mp3");
    const audio = lastCreatedAudio!;
    stopAnimationSound();
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(0);
  });

  it("nullifies the active audio reference (subsequent stop is no-op)", () => {
    playAnimationSound("test.mp3");
    const audio = lastCreatedAudio!;
    stopAnimationSound();
    // Second stop should not call pause again
    stopAnimationSound();
    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  it("allows a new sound to be played after stopping", () => {
    playAnimationSound("first.mp3");
    stopAnimationSound();
    playAnimationSound("second.mp3");
    expect(lastCreatedAudio!.play).toHaveBeenCalledTimes(1);
    expect(Audio).toHaveBeenCalledTimes(2);
  });
});
