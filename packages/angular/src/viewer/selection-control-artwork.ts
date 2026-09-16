import { getSelectionControlArtworkStyle } from '../internal/shared';
import type { ResizeHandle } from './drag-resize';
import type { CornerHandleBox } from './selection-geometry';

/** Keep the existing handle anchor while opt-in artwork can grow its frame. */
export function selectionControlArtwork(box: CornerHandleBox, handle?: ResizeHandle) {
	const kind = !handle
		? 'rotate'
		: handle.length === 2
			? 'corner'
			: handle === 'n' || handle === 's'
				? 'horizontal-edge'
				: 'vertical-edge';
	const { frame, artwork } = getSelectionControlArtworkStyle(
		kind,
		{
			width: 24,
			height: 24,
			radius: handle ? '2px' : '50%',
			fill: '#ffffff',
			borderColor: '#4f86ff',
		},
		box.size / 24,
	);
	return {
		frame: {
			...frame,
			left: `calc(${box.left + box.size / 2}px - ${frame.width} / 2)`,
			top: `calc(${box.top + box.size / 2}px - ${frame.height} / 2)`,
		},
		artwork,
	};
}
