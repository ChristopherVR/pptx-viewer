import { getSelectionOutlineColor } from 'pptx-viewer-shared';
import { LuRotateCw } from 'react-icons/lu';

import { ROTATE_ARTWORK } from './selection-control-artwork';

/** Presentation only: the parent button owns rotation and boundary placement. */
export function RotateHandleArtwork() {
	return (
		<>
			<span
				data-pptx-rotate-stem
				className='pointer-events-none absolute top-[calc(100%-1px)] left-1/2 h-3.5 max-md:h-2.5 w-px'
				aria-hidden='true'
				style={{ background: getSelectionOutlineColor('var(--color-primary)') }}
			/>
			<span
				data-pptx-handle-artwork
				aria-hidden='true'
				className='flex items-center justify-center border shadow'
				style={ROTATE_ARTWORK.artwork}
			>
				<LuRotateCw className='w-3 h-3 max-md:w-4 max-md:h-4' />
			</span>
			{/* The old inset included the button's 1px border, now on the artwork. */}
			<span
				data-pptx-handle-hit
				className='absolute -inset-1.75 max-md:-inset-0.75'
				aria-hidden='true'
			/>
		</>
	);
}
