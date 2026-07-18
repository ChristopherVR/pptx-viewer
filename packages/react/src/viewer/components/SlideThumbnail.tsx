import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { buildPreviewElements } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SLIDE_NAV_THUMBNAIL_WIDTH, SLIDE_TRANSITION_OPTIONS } from '../constants';
import type { CanvasSize } from '../types';
import { getReactSlideBackgroundStyle } from '../utils/slide-background-style';
import type { TableStyleContext } from '../utils/table-band-style';
import type { FieldSubstitutionContext } from '../utils/text-field-substitution';
import { deriveSlideFieldContext } from './slide-field-context';
import { StaticElementRenderer } from './StaticElementRenderer';

interface SlideThumbnailProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	/** Presentation-wide field context (date/header/footer/custom props). */
	fieldContext?: FieldSubstitutionContext;
	/** Theme + table style map for resolving table band/header colours. */
	tableStyleContext?: TableStyleContext;
}

function SlideThumbnailImpl({
	slide,
	templateElements,
	canvasSize,
	fieldContext,
	tableStyleContext,
}: SlideThumbnailProps): React.ReactElement {
	const safeCanvasWidth = Math.max(canvasSize.width, 1);
	const safeCanvasHeight = Math.max(canvasSize.height, 1);
	const scale = SLIDE_NAV_THUMBNAIL_WIDTH / safeCanvasWidth;
	const previewHeight = Math.max(56, Math.round(safeCanvasHeight * scale));
	const previewElements = buildPreviewElements(slide, templateElements);
	const slideFieldContext = deriveSlideFieldContext(fieldContext, slide);
	const { t } = useTranslation();
	const transitionLabel = slide.transition
		? (() => {
				const opt = SLIDE_TRANSITION_OPTIONS.find((o) => o.value === slide.transition?.type);
				return opt ? t(opt.i18nKey) : slide.transition.type;
			})()
		: undefined;

	return (
		<div
			className='relative w-full overflow-hidden rounded border border-border bg-white'
			style={{ height: previewHeight, ...getReactSlideBackgroundStyle(slide) }}
		>
			<div
				className='absolute top-0 left-0 origin-top-left'
				style={{
					width: safeCanvasWidth,
					height: safeCanvasHeight,
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
				}}
			>
				{/* Transition indicator badge */}
				{slide.transition &&
					slide.transition.type !== 'none' &&
					slide.transition.type !== 'cut' && (
						<div
							className='absolute top-0.5 right-0.5 z-10 px-1 py-px rounded bg-primary/80 text-[7px] text-white leading-tight pointer-events-none'
							title={t('pptx.slideThumbnail.transitionTooltip', { name: transitionLabel })}
						>
							{transitionLabel}
						</div>
					)}
				{previewElements.map((element, index) => (
					<StaticElementRenderer
						key={element.id}
						element={element}
						activeSlide={slide}
						allSlides={[slide]}
						zIndex={index}
						fieldContext={slideFieldContext}
						tableStyleContext={tableStyleContext}
					/>
				))}
			</div>
		</div>
	);
}

/**
 * Memo comparator: re-render only when the slide identity, dirty/hidden flags,
 * underlying elements reference, template elements reference, or canvas size
 * changes. Avoids burning frames on parent re-renders that don't change props.
 */
function arePropsEqual(prev: SlideThumbnailProps, next: SlideThumbnailProps): boolean {
	if (prev.slide.id !== next.slide.id) {
		return false;
	}
	if (prev.slide.isDirty !== next.slide.isDirty) {
		return false;
	}
	if (prev.slide.hidden !== next.slide.hidden) {
		return false;
	}
	if (prev.slide.elements !== next.slide.elements) {
		return false;
	}
	if (prev.slide.backgroundColor !== next.slide.backgroundColor) {
		return false;
	}
	if (prev.slide.backgroundImage !== next.slide.backgroundImage) {
		return false;
	}
	if (prev.slide.backgroundGradient !== next.slide.backgroundGradient) {
		return false;
	}
	if (prev.slide.backgroundPattern !== next.slide.backgroundPattern) {
		return false;
	}
	if (prev.templateElements !== next.templateElements) {
		return false;
	}
	if (prev.fieldContext !== next.fieldContext) {
		return false;
	}
	if (prev.tableStyleContext !== next.tableStyleContext) {
		return false;
	}
	if (
		prev.canvasSize.width !== next.canvasSize.width ||
		prev.canvasSize.height !== next.canvasSize.height
	) {
		return false;
	}
	return true;
}

export const SlideThumbnail = React.memo(SlideThumbnailImpl, arePropsEqual);
