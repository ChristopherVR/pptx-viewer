import { RESIZE_HANDLE_GEOMETRY } from './element-interaction';
import type { ResizeHandleId } from './element-interaction';

type HitAreaStyle = Partial<Record<'top' | 'right' | 'bottom' | 'left', string>> & {
	position: 'absolute';
	pointerEvents: 'auto';
	inset: string;
};

const inset = 'var(--pptx-handle-hit-inset, -1px)';
const horizontalInset = `max(${inset}, calc(50% - var(--pptx-selection-width, 1000000px) / var(--pptx-handle-inverse-scale, 1) / 4))`;
const verticalInset = `max(${inset}, calc(50% - var(--pptx-selection-height, 1000000px) / var(--pptx-handle-inverse-scale, 1) / 4))`;

/**
 * Bound an invisible resize target halfway toward its neighboring anchors.
 * The visible, focusable button stays pointer-events:none; this child owns
 * presses and bubbles them to its existing button handlers. Outward padding
 * stays intact, and targets only share space when their usual areas overlap.
 *
 * Inherit selection width/height in the button's coordinate space. React's
 * inverse-scaled buttons also inherit --pptx-handle-inverse-scale; other
 * bindings leave it at 1. The default -1px inset includes a button's border;
 * an expanded target can override --pptx-handle-hit-inset without changing
 * the partition. CSS keeps these bounds live during zoom and resize previews.
 */
export function getResizeHandleHitAreaStyle(handle: ResizeHandleId): HitAreaStyle {
	const { fx, fy } = RESIZE_HANDLE_GEOMETRY[handle];
	return {
		position: 'absolute',
		pointerEvents: 'auto',
		inset,
		...(fx > 0 ? { left: horizontalInset } : {}),
		...(fx < 1 ? { right: horizontalInset } : {}),
		...(fy > 0 ? { top: verticalInset } : {}),
		...(fy < 1 ? { bottom: verticalInset } : {}),
	};
}
