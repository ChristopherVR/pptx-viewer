import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../types';
import { ScaledSlidePreview } from './ScaledSlidePreview';

export function PresenterSlideNavigator(props: {
	slides: PptxSlide[];
	current: number;
	canvasSize: CanvasSize;
	templateElements: PptxElement[];
	onSelect: (index: number) => void;
	onClose: () => void;
}) {
	return (
		<div className='absolute inset-0 z-[120] flex flex-col bg-slate-950/98 text-slate-100'>
			<header className='flex items-center justify-between border-b border-white/10 px-6 py-4'>
				<div>
					<p className='text-xs uppercase tracking-[0.22em] text-sky-300'>Slide navigator</p>
					<h2 className='text-xl font-semibold'>See all slides</h2>
				</div>
				<button
					className='rounded-md bg-white/10 px-4 py-2 hover:bg-white/20'
					onClick={props.onClose}
				>
					Close
				</button>
			</header>
			<div className='grid flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 overflow-auto p-6'>
				{props.slides.map((slide, index) => (
					<button
						key={slide.id ?? index}
						className={`group text-left ${index === props.current ? 'ring-2 ring-sky-400' : ''} ${slide.hidden ? 'opacity-45' : ''}`}
						onClick={() => props.onSelect(index)}
					>
						<ScaledSlidePreview
							slide={slide}
							templateElements={props.templateElements}
							canvasSize={props.canvasSize}
						/>
						<span className='mt-2 block text-xs tabular-nums text-slate-400'>
							{index + 1}
							{slide.hidden ? ' - hidden' : ''}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
