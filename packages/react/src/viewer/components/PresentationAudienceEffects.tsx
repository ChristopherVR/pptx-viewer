import { presentationInkPath } from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';

export function PresentationAudienceEffects({ snapshot }: { snapshot: PresentationSnapshot }) {
	const strokes =
		snapshot.inkStrokes?.filter((stroke) => stroke.slideIndex === snapshot.slideIndex) ?? [];
	return (
		<div className='pointer-events-none absolute inset-0 z-[75] overflow-hidden'>
			{snapshot.blackout !== 'none' && (
				<div
					className={`absolute inset-0 ${snapshot.blackout === 'black' ? 'bg-black' : 'bg-white'}`}
				/>
			)}
			<svg
				className='absolute inset-0 h-full w-full'
				viewBox='0 0 100 100'
				preserveAspectRatio='none'
				aria-hidden='true'
			>
				{strokes.map((stroke) => (
					<path
						key={stroke.id}
						d={presentationInkPath(stroke.points)}
						fill='none'
						stroke={stroke.color}
						strokeWidth={stroke.width / 10}
						strokeLinecap='round'
						strokeLinejoin='round'
						opacity={stroke.tool === 'highlighter' ? 0.42 : 1}
					/>
				))}
			</svg>
			{snapshot.pointer?.tool === 'laser' && (
				<span
					className='absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_20px_8px_rgba(239,68,68,.55)]'
					style={{ left: `${snapshot.pointer.x * 100}%`, top: `${snapshot.pointer.y * 100}%` }}
				/>
			)}
			{snapshot.subtitlesVisible && snapshot.caption && (
				<div className='absolute inset-x-[10%] bottom-8 rounded-lg bg-black/80 px-6 py-3 text-center text-xl font-medium text-white'>
					{snapshot.caption}
				</div>
			)}
		</div>
	);
}
