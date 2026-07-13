/** State consumed by the touch-only controls shown over a live slide show. */
export interface PresentationTouchControlState {
	previousDisabled: boolean;
	nextDisabled: boolean;
	counterLabel: string;
}

/**
 * Build the stable presentation-control state shared by every UI binding.
 * Empty presentations disable both directions and use the same 0 / 0 label.
 */
export function buildPresentationTouchControlState(
	currentSlideIndex: number,
	totalSlides: number,
): PresentationTouchControlState {
	if (totalSlides <= 0) {
		return {
			previousDisabled: true,
			nextDisabled: true,
			counterLabel: '0 / 0',
		};
	}

	return {
		previousDisabled: currentSlideIndex <= 0,
		nextDisabled: currentSlideIndex >= totalSlides - 1,
		counterLabel: `${currentSlideIndex + 1} / ${totalSlides}`,
	};
}
