import { getSelectionControlArtworkStyle } from 'pptx-viewer-shared';
import type { ResizeHandleId } from 'pptx-viewer-shared';

/** The overlay is unscaled; only its element geometry follows the slide zoom. */
export function selectionControlArtwork(handle?: ResizeHandleId) {
	const kind = !handle
		? 'rotate'
		: handle.length === 2
			? 'corner'
			: handle === 'n' || handle === 's'
				? 'horizontal-edge'
				: 'vertical-edge';
	const size = handle
		? 'var(--pptx-svelte-resize-size, 10px)'
		: 'var(--pptx-svelte-rotate-size, 12px)';
	const { frame, artwork } = getSelectionControlArtworkStyle(kind, {
		width: size,
		height: size,
		radius: handle ? '2px' : '50%',
		fill: 'var(--pptx-background, #ffffff)',
		borderColor: 'var(--pptx-ring, #6366f1)',
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
