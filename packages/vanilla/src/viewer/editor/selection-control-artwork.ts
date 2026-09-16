import { getSelectionControlArtworkStyle } from 'pptx-viewer-shared';
import type { ResizeHandleId } from 'pptx-viewer-shared';

import { createEl } from '../render';

/** Local appearance defaults for the unscaled selection overlay. */
export function selectionControlArtwork(handle?: ResizeHandleId) {
	const kind = !handle
		? 'rotate'
		: handle.length === 2
			? 'corner'
			: handle === 'n' || handle === 's'
				? 'horizontal-edge'
				: 'vertical-edge';
	const size = handle ? 'var(--pptxv-resize-size, 10px)' : 'var(--pptxv-rotate-size, 12px)';
	const { frame, artwork } = getSelectionControlArtworkStyle(kind, {
		width: size,
		height: size,
		radius: handle ? '2px' : '50%',
		fill: '#fff',
		borderColor: 'var(--pptx-ring)',
	});
	return {
		frame: {
			...frame,
			marginLeft: `calc(${frame.width} / -2)`,
			marginTop: `calc(${frame.height} / -2)`,
		},
		artwork,
	};
}

/** Apply artwork without changing the button's pointer or keyboard ownership. */
export function appendSelectionControlArtwork(button: HTMLButtonElement, handle?: ResizeHandleId) {
	const { frame, artwork } = selectionControlArtwork(handle);
	Object.assign(button.style, frame);
	const visual = createEl(button.ownerDocument, 'span', 'pptxv-control-artwork', artwork);
	visual.setAttribute('data-pptx-handle-artwork', '');
	visual.setAttribute('aria-hidden', 'true');
	button.appendChild(visual);
}
