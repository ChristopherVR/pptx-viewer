import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlidePaneContextMenuEntries, slidePaneViewItems } from 'pptx-viewer-shared';
import type { SlidePaneContextMenuCommandId } from 'pptx-viewer-shared';
import type React from 'react';
import { useTranslation } from 'react-i18next';

import { ContextMenuSurface } from '../ContextMenuSurface';
import type { SlideContextMenuState } from './types';

/**
 * The thumbnail right-click menu: New Slide, Duplicate, Delete, Layout, Hide,
 * Add Section, driven by the shared `buildSlidePaneContextMenuEntries` list so
 * this menu cannot drift from the other four bindings' one command at a time.
 * The rows are drawn by the shared `pptx-ui-context-menu`.
 */
interface SlideContextMenuProps {
	state: SlideContextMenuState;
	slides: PptxSlide[];
	onAddSlideAfter: (index: number) => void;
	onDuplicateSlides: (indexes: number[]) => void;
	onDeleteSlides: (indexes: number[]) => void;
	onHideSlides: (indexes: number[]) => void;
	onOpenLayoutForSlide: (index: number, x: number, y: number) => void;
	onAddSection?: (name: string, afterSlideIndex: number) => void;
	onClose: () => void;
}

export function SlideContextMenu({
	state,
	slides,
	onAddSlideAfter,
	onDuplicateSlides,
	onDeleteSlides,
	onHideSlides,
	onOpenLayoutForSlide,
	onAddSection,
	onClose,
}: SlideContextMenuProps): React.ReactElement {
	const { t } = useTranslation();
	const selected = state.selectedIndexes;
	const selectedSlides = selected.map((i) => slides[i]).filter((s): s is PptxSlide => Boolean(s));
	const entries = buildSlidePaneContextMenuEntries({
		selectedCount: selected.length,
		hasHiddenInSelection: selectedSlides.some((s) => s.hidden),
		hasVisibleInSelection: selectedSlides.some((s) => !s.hidden),
		wouldDeleteAllSlides: selected.length >= slides.length,
	});

	const run = (id: SlidePaneContextMenuCommandId): void => {
		switch (id) {
			case 'new-slide':
				onAddSlideAfter(state.slideIndex);
				break;
			case 'duplicate':
				onDuplicateSlides(selected);
				break;
			case 'delete':
				onDeleteSlides(selected);
				break;
			case 'layout':
				onOpenLayoutForSlide(state.slideIndex, state.x, state.y);
				break;
			case 'hide':
				onHideSlides(selected);
				break;
			case 'add-section':
				onAddSection?.(t('pptx.sections.defaultName'), state.slideIndex);
				break;
			default:
				break;
		}
		onClose();
	};

	return (
		<ContextMenuSurface
			x={state.x}
			y={state.y}
			label={t('pptx.slidesPane.contextMenu.newSlide')}
			markers={['data-pptx-context-menu', 'data-pptx-slide-pane-context-menu']}
			items={slidePaneViewItems(entries, t, selected.length)}
			onRequest={(id) => run(id as SlidePaneContextMenuCommandId)}
			onClose={onClose}
		/>
	);
}
