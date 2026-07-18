/**
 * Touch double-tap recognition for stage elements: two quick touch/pen
 * pointer-downs on the same top-level element open inline (or structured)
 * editing, because native `dblclick` is unreliable for touch input (mirrors
 * React's `handleStagePointerDown` and Angular's slide-canvas equivalent).
 * Mouse input keeps using the native `dblclick` path and never feeds this.
 */

/** Two touch taps on one element within this window count as a double-tap. */
export const ELEMENT_DOUBLE_TAP_MS = 300;

interface TapRecord {
	id: string;
	time: number;
}

/**
 * Create a stateful recognizer. Feed it every stage pointer-down; it returns
 * true when the press completes a double-tap (and resets, so a third tap
 * starts a fresh sequence). Mouse presses and empty-canvas presses reset the
 * pending tap.
 */
export function createElementDoubleTapRecognizer(
	windowMs: number = ELEMENT_DOUBLE_TAP_MS,
): (pointerType: string, id: string | null, time: number) => boolean {
	let previous: TapRecord | null = null;
	return (pointerType, id, time) => {
		if (pointerType === 'mouse' || !id) {
			previous = null;
			return false;
		}
		const secondTap = previous !== null && previous.id === id && time - previous.time < windowMs;
		previous = secondTap ? null : { id, time };
		return secondTap;
	};
}
