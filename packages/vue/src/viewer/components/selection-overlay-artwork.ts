import { getSelectionControlArtworkStyle } from 'pptx-viewer-shared';
import type { ResizeHandleId } from 'pptx-viewer-shared';

/** Vue sizes artwork in slide coordinates; the stage supplies the only scale. */
export function controlArtwork(handle: ResizeHandleId | 'rotate', inverseScale: number) {
	const rotate = handle === 'rotate';
	const size = rotate
		? 'var(--pptx-vue-rotate-default, 12px)'
		: 'var(--pptx-vue-resize-default, 10px)';
	const styles = getSelectionControlArtworkStyle(
		rotate
			? 'rotate'
			: handle.length === 2
				? 'corner'
				: handle === 'n' || handle === 's'
					? 'horizontal-edge'
					: 'vertical-edge',
		{
			width: size,
			height: size,
			radius: '9999px',
			fill: 'var(--pptx-vue-selection-color, #3b82f6)',
			borderColor: '#ffffff',
		},
		inverseScale,
	);
	return {
		frame: {
			...styles.frame,
			marginLeft: `calc(${styles.frame.width} / -2)`,
			marginTop: `calc(${styles.frame.height} / -2)`,
		},
		artwork: styles.artwork,
	};
}
