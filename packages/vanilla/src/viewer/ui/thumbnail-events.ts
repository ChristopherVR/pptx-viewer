import type { PptxSlide } from 'pptx-viewer-core';

import type { ThumbnailContextMenu } from './thumbnail-context-menu';
import type { ThumbnailRailMenu } from './thumbnail-rail-menu';

interface RowEvents {
	selection: ThumbnailRailMenu;
	menu: ThumbnailContextMenu | null;
	getSlides(): PptxSlide[];
	getActive(): number;
	onSelect(index: number): void;
}

/** Event callbacks read the current deck when invoked, including after edits. */
export function wireThumbnailRowEvents(
	button: HTMLButtonElement,
	slide: PptxSlide,
	index: number,
	events: RowEvents,
): void {
	const { selection, menu, getSlides, getActive, onSelect } = events;
	if (selection.isSelected(slide.id) && index !== getActive()) {
		button.classList.add('is-selected');
	}
	button.addEventListener('click', (event) => {
		selection.onClick(
			event,
			slide.id,
			getSlides().map((s) => s.id),
		);
		button.classList.toggle('is-selected', selection.isSelected(slide.id) && index !== getActive());
		onSelect(index);
	});
	if (menu) {
		button.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			const slides = getSlides();
			const state = selection.openContextMenu(
				event.clientX,
				event.clientY,
				index,
				slides.map((s) => s.id),
			);
			if (state) {
				menu.open(state, slides);
			}
		});
	}
}
