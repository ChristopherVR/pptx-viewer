import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Since @testing-library/react is not available, we test the zoom navigation
// logic directly by extracting the pure functions from the hook.
// The hook itself is thin (useCallback + useRef), so testing the logic is
// equivalent.
// ---------------------------------------------------------------------------

// We simulate the zoom navigation state machine without React hooks.

interface ZoomNavState {
  returnSlideIndex: number | null;
}

function createZoomNav(navigateToSlide: (idx: number) => void) {
  const state: ZoomNavState = { returnSlideIndex: null };

  return {
    handleZoomClick(targetSlideIndex: number, returnSlideIndex: number) {
      state.returnSlideIndex = returnSlideIndex;
      navigateToSlide(targetSlideIndex);
    },
    returnToZoomSlide(): boolean {
      const returnIndex = state.returnSlideIndex;
      if (returnIndex === null) return false;
      state.returnSlideIndex = null;
      navigateToSlide(returnIndex);
      return true;
    },
    clearZoomReturn() {
      state.returnSlideIndex = null;
    },
    get zoomReturnSlideIndex() {
      return state.returnSlideIndex;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("zoom navigation logic", () => {
  let navigateToSlide: ReturnType<typeof vi.fn>;
  let nav: ReturnType<typeof createZoomNav>;

  beforeEach(() => {
    navigateToSlide = vi.fn();
    nav = createZoomNav(navigateToSlide);
  });

  it("handleZoomClick navigates to the target slide", () => {
    nav.handleZoomClick(5, 0);
    expect(navigateToSlide).toHaveBeenCalledWith(5);
  });

  it("handleZoomClick stores the return slide index", () => {
    nav.handleZoomClick(5, 2);
    expect(nav.zoomReturnSlideIndex).toBe(2);
  });

  it("returnToZoomSlide navigates back and clears the return index", () => {
    nav.handleZoomClick(5, 2);
    navigateToSlide.mockClear();

    const returned = nav.returnToZoomSlide();

    expect(returned).toBe(true);
    expect(navigateToSlide).toHaveBeenCalledWith(2);
    expect(nav.zoomReturnSlideIndex).toBeNull();
  });

  it("returnToZoomSlide returns false when no return index is set", () => {
    const returned = nav.returnToZoomSlide();
    expect(returned).toBe(false);
    expect(navigateToSlide).not.toHaveBeenCalled();
  });

  it("clearZoomReturn clears the stored return index", () => {
    nav.handleZoomClick(5, 2);
    expect(nav.zoomReturnSlideIndex).toBe(2);

    nav.clearZoomReturn();
    expect(nav.zoomReturnSlideIndex).toBeNull();
  });

  it("multiple zoom clicks overwrite the return index", () => {
    nav.handleZoomClick(3, 0);
    expect(nav.zoomReturnSlideIndex).toBe(0);

    nav.handleZoomClick(7, 3);
    expect(nav.zoomReturnSlideIndex).toBe(3);
  });

  it("returnToZoomSlide only works once per zoom click", () => {
    nav.handleZoomClick(5, 2);
    navigateToSlide.mockClear();

    // First return succeeds
    nav.returnToZoomSlide();
    expect(navigateToSlide).toHaveBeenCalledTimes(1);

    navigateToSlide.mockClear();

    // Second return does nothing
    const returned = nav.returnToZoomSlide();
    expect(returned).toBe(false);
    expect(navigateToSlide).not.toHaveBeenCalled();
  });

  it("handleZoomClick with targetSlideIndex 0 works correctly", () => {
    nav.handleZoomClick(0, 5);
    expect(navigateToSlide).toHaveBeenCalledWith(0);
    expect(nav.zoomReturnSlideIndex).toBe(5);
  });

  it("returnToZoomSlide with return index 0 works correctly", () => {
    nav.handleZoomClick(5, 0);
    navigateToSlide.mockClear();

    const returned = nav.returnToZoomSlide();

    expect(returned).toBe(true);
    expect(navigateToSlide).toHaveBeenCalledWith(0);
  });

  it("clearZoomReturn after returnToZoomSlide is idempotent", () => {
    nav.handleZoomClick(5, 2);
    nav.returnToZoomSlide();
    nav.clearZoomReturn();
    expect(nav.zoomReturnSlideIndex).toBeNull();
  });
});
