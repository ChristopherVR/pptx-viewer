import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handlePresentationActionImpl,
  type PresentationActionDeps,
} from "./presentation-actions";
import type { PptxAction } from "pptx-viewer-core";

function createMockDeps(
  overrides: Partial<PresentationActionDeps> = {},
): PresentationActionDeps {
  return {
    movePresentationSlide: vi.fn(),
    navigateToSlide: vi.fn(),
    onPlayActionSound: vi.fn(),
    onSetMode: vi.fn(),
    slidesLength: 10,
    ...overrides,
  };
}

describe("handlePresentationActionImpl", () => {
  let deps: PresentationActionDeps;

  beforeEach(() => {
    vi.stubGlobal("window", {
      open: vi.fn(),
    });
    deps = createMockDeps();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -- Sound ------------------------------------------------------------------

  it("should play sound when action has soundPath", () => {
    const action: PptxAction = { soundPath: "click.wav" };
    handlePresentationActionImpl(action, deps);
    expect(deps.onPlayActionSound).toHaveBeenCalledWith("click.wav");
  });

  it("should not play sound when onPlayActionSound is undefined", () => {
    deps = createMockDeps({ onPlayActionSound: undefined });
    const action: PptxAction = { soundPath: "click.wav" };
    // should not throw
    handlePresentationActionImpl(action, deps);
  });

  // -- Target slide index -----------------------------------------------------

  it("should navigate to targetSlideIndex when provided", () => {
    const action: PptxAction = { targetSlideIndex: 5 };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).toHaveBeenCalledWith(5);
  });

  it("should navigate to targetSlideIndex 0", () => {
    const action: PptxAction = { targetSlideIndex: 0 };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).toHaveBeenCalledWith(0);
  });

  // -- hlinkshowjump actions -------------------------------------------------

  it("should move to next slide for hlinkshowjump?jump=nextslide", () => {
    const action: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=nextslide",
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.movePresentationSlide).toHaveBeenCalledWith(1);
  });

  it("should move to previous slide for hlinkshowjump?jump=previousslide", () => {
    const action: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=previousslide",
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.movePresentationSlide).toHaveBeenCalledWith(-1);
  });

  it("should navigate to first slide for hlinkshowjump?jump=firstslide", () => {
    const action: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=firstslide",
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).toHaveBeenCalledWith(0);
  });

  it("should navigate to last slide for hlinkshowjump?jump=lastslide", () => {
    const action: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=lastslide",
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).toHaveBeenCalledWith(9); // slidesLength - 1
  });

  it("should end show for hlinkshowjump?jump=endshow", () => {
    const action: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=endshow",
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.onSetMode).toHaveBeenCalledWith("edit");
  });

  it("should handle lowercase jump verbs after lowercase includes match", () => {
    // The source checks actionStr.includes("hlinkshowjump") (case-sensitive),
    // then lowercases the full string to match jump verbs. So the initial
    // "hlinkshowjump" must be lowercase, but the jump verb can be any case.
    const action: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=NEXTSLIDE",
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.movePresentationSlide).toHaveBeenCalledWith(1);
  });

  // -- hlinksldjump -----------------------------------------------------------

  it("should do nothing for hlinksldjump without targetSlideIndex", () => {
    const action: PptxAction = {
      action: "ppaction://hlinksldjump",
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).not.toHaveBeenCalled();
    expect(deps.movePresentationSlide).not.toHaveBeenCalled();
  });

  // -- External URL -----------------------------------------------------------

  it("should open external URL in new tab", () => {
    const action: PptxAction = {
      url: "https://example.com",
      action: "",
    };
    handlePresentationActionImpl(action, deps);
    expect(window.open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  // -- URL security -----------------------------------------------------------

  it("should block javascript: URLs", () => {
    const action: PptxAction = {
      url: "javascript:alert(1)",
      action: "",
    };
    handlePresentationActionImpl(action, deps);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("should block data: URLs", () => {
    const action: PptxAction = {
      url: "data:text/html,<script>alert(1)</script>",
      action: "",
    };
    handlePresentationActionImpl(action, deps);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("should block vbscript: URLs", () => {
    const action: PptxAction = {
      url: "vbscript:MsgBox('XSS')",
      action: "",
    };
    handlePresentationActionImpl(action, deps);
    expect(window.open).not.toHaveBeenCalled();
  });

  // -- Slide index clamping ---------------------------------------------------

  it("should clamp targetSlideIndex beyond range to last slide", () => {
    const action: PptxAction = { targetSlideIndex: 100 };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).toHaveBeenCalledWith(9); // slidesLength - 1 = 9
  });

  it("should clamp negative targetSlideIndex to 0", () => {
    const action: PptxAction = { targetSlideIndex: -5 };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).toHaveBeenCalledWith(0);
  });

  it("should floor fractional targetSlideIndex", () => {
    const action: PptxAction = { targetSlideIndex: 3.7 };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).toHaveBeenCalledWith(3);
  });

  it("should not navigate when slidesLength is 0", () => {
    deps = createMockDeps({ slidesLength: 0 });
    const action: PptxAction = { targetSlideIndex: 5 };
    handlePresentationActionImpl(action, deps);
    expect(deps.navigateToSlide).not.toHaveBeenCalled();
  });

  // -- Combined: sound + action -----------------------------------------------

  it("should play sound AND navigate when both are present", () => {
    const action: PptxAction = {
      soundPath: "transition.wav",
      targetSlideIndex: 3,
    };
    handlePresentationActionImpl(action, deps);
    expect(deps.onPlayActionSound).toHaveBeenCalledWith("transition.wav");
    expect(deps.navigateToSlide).toHaveBeenCalledWith(3);
  });

  // -- Empty / no-op action ---------------------------------------------------

  it("should not throw for empty action", () => {
    const action: PptxAction = {};
    expect(() =>
      handlePresentationActionImpl(action, deps),
    ).not.toThrow();
  });
});
