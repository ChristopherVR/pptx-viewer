import { useRef, useCallback } from "react";

/**
 * Input for the useZoomNavigation sub-hook.
 */
export interface UseZoomNavigationInput {
  /** Navigate to a specific slide index. */
  navigateToSlide: (slideIndex: number) => void;
}

/**
 * Return type for the useZoomNavigation sub-hook.
 */
export interface UseZoomNavigationResult {
  /**
   * Handle a zoom element click. Navigates to the target slide and
   * stores the return slide index so we can go back later.
   */
  handleZoomClick: (targetSlideIndex: number, returnSlideIndex: number) => void;
  /**
   * The slide index to return to after a zoom navigation, or `null` if
   * there is no pending return.
   */
  zoomReturnSlideIndex: React.RefObject<number | null>;
  /**
   * Navigate back to the zoom summary slide (if a return index is set).
   * Returns `true` if navigation occurred, `false` otherwise.
   */
  returnToZoomSlide: () => boolean;
  /**
   * Clear the stored return index (e.g. when the user manually navigates
   * away from the zoomed section).
   */
  clearZoomReturn: () => void;
}

/**
 * Sub-hook that manages zoom element navigation in presentation mode.
 *
 * When a zoom element is clicked, this hook:
 * 1. Navigates to the target slide
 * 2. Stores the "return" slide index
 *
 * The caller can later use `returnToZoomSlide()` to navigate back to
 * the summary zoom slide.
 */
export function useZoomNavigation(
  input: UseZoomNavigationInput,
): UseZoomNavigationResult {
  const { navigateToSlide } = input;
  const zoomReturnSlideIndex = useRef<number | null>(null);

  const handleZoomClick = useCallback(
    (targetSlideIndex: number, returnSlideIndex: number) => {
      zoomReturnSlideIndex.current = returnSlideIndex;
      navigateToSlide(targetSlideIndex);
    },
    [navigateToSlide],
  );

  const returnToZoomSlide = useCallback((): boolean => {
    const returnIndex = zoomReturnSlideIndex.current;
    if (returnIndex === null) return false;
    zoomReturnSlideIndex.current = null;
    navigateToSlide(returnIndex);
    return true;
  }, [navigateToSlide]);

  const clearZoomReturn = useCallback(() => {
    zoomReturnSlideIndex.current = null;
  }, []);

  return {
    handleZoomClick,
    zoomReturnSlideIndex,
    returnToZoomSlide,
    clearZoomReturn,
  };
}
