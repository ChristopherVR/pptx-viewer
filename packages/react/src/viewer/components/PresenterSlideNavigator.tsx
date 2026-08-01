import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { PRESENTER_CONSOLE_CLASSES, PRESENTER_NAVIGATOR_LABEL_KEYS } from 'pptx-viewer-shared';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../types';
import { ScaledSlidePreview } from './ScaledSlidePreview';

/**
 * PowerPoint's Ctrl+S "See All Slides" overlay.
 *
 * Its three strings were hard-coded English, which made the only way out of the
 * overlay ("Close") unreadable in every other locale; they now resolve through
 * the shared navigator keys, as in the other four bindings.
 */
export function PresenterSlideNavigator(props: {
	slides: PptxSlide[];
	current: number;
	canvasSize: CanvasSize;
	templateElements: PptxElement[];
	onSelect: (index: number) => void;
	onClose: () => void;
}): ReactElement {
	const { t } = useTranslation();
	return (
		<div className={`${PRESENTER_CONSOLE_CLASSES.navigator} text-foreground`}>
			<header className='mb-4 flex items-center justify-between border-b border-border pb-4'>
				<div>
					<p className='text-xs uppercase tracking-[0.22em] text-sky-300'>
						{t(PRESENTER_NAVIGATOR_LABEL_KEYS.title)}
					</p>
					<h2 className='text-xl font-semibold'>{t(PRESENTER_NAVIGATOR_LABEL_KEYS.subtitle)}</h2>
				</div>
				<button
					type='button'
					className='rounded-md bg-muted px-4 py-2 hover:bg-accent'
					onClick={props.onClose}
				>
					{t(PRESENTER_NAVIGATOR_LABEL_KEYS.close)}
				</button>
			</header>
			<div className={PRESENTER_CONSOLE_CLASSES.navigatorGrid}>
				{props.slides.map((slide, index) => (
					<button
						key={slide.id ?? index}
						type='button'
						className={`group text-left ${index === props.current ? 'ring-2 ring-sky-400' : ''} ${slide.hidden ? 'opacity-45' : ''}`}
						onClick={() => props.onSelect(index)}
					>
						<ScaledSlidePreview
							slide={slide}
							templateElements={props.templateElements}
							canvasSize={props.canvasSize}
						/>
						<span className='mt-2 block text-xs tabular-nums text-muted-foreground'>
							{index + 1}
							{slide.hidden ? ' - hidden' : ''}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
