/**
 * slide-pane-context-menu.component.ts: the slides pane's thumbnail
 * right-click menu (New Slide, Duplicate, Delete, Layout, Hide, Add Section).
 *
 * Selector: `pptx-slide-pane-context-menu`
 *
 * Sibling of `SlideCanvasContextMenuComponent` (the empty-canvas menu). The
 * item list comes from `buildSlidePaneContextMenuEntries` in
 * `pptx-viewer-shared`, this component's job is only to render it and route a
 * chosen command.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	input,
	output,
} from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type {
	ContextMenuRequestEvent,
	ContextMenuViewState,
	SlidePaneContextMenuCommandId,
	SlidePaneContextMenuEntry,
} from '../internal/shared';
import { buildSlidePaneContextMenuEntries, slidePaneViewItems } from '../internal/shared';
import type { MenuTranslate } from './context-menu-translate';
import { injectMenuTranslate } from './context-menu-translate';
import type { SlidePaneContextMenuActions } from './slide-pane-context-menu-dispatch';
import { runSlidePaneContextMenuCommand } from './slide-pane-context-menu-dispatch';

@Component({
	selector: 'pptx-slide-pane-context-menu',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { style: 'display: contents' },
	template: `
		<pptx-ui-context-menu
			[state]="view()"
			(menu-request)="request($event)"
			(menu-close)="closed.emit()"
		></pptx-ui-context-menu>
	`,
})
export class SlidePaneContextMenuComponent {
	readonly x = input.required<number>();
	readonly y = input.required<number>();
	readonly slideIndex = input.required<number>();
	readonly selectedIndexes = input.required<number[]>();
	readonly slides = input.required<readonly PptxSlide[]>();

	readonly closed = output<void>();
	readonly addSlideAfter = output<number>();
	readonly duplicateSlides = output<number[]>();
	readonly deleteSlides = output<number[]>();
	/** Makes the right-clicked slide active, then opens the Layout gallery at (x, y). */
	readonly openLayoutForSlide = output<{ index: number; x: number; y: number }>();
	readonly toggleHideSlides = output<number[]>();
	readonly addSectionAt = output<number>();

	private readonly t: MenuTranslate = injectMenuTranslate();

	protected readonly entries = computed<SlidePaneContextMenuEntry[]>(() => {
		const selected = this.selectedIndexes()
			.map((i) => this.slides()[i])
			.filter((s): s is PptxSlide => Boolean(s));
		return buildSlidePaneContextMenuEntries({
			selectedCount: selected.length,
			hasHiddenInSelection: selected.some((s) => s.hidden),
			hasVisibleInSelection: selected.some((s) => !s.hidden),
			wouldDeleteAllSlides: selected.length >= this.slides().length,
		});
	});

	private readonly actions: SlidePaneContextMenuActions = {
		addSlideAfter: (index) => this.addSlideAfter.emit(index),
		duplicateSlides: (indexes) => this.duplicateSlides.emit(indexes),
		deleteSlides: (indexes) => this.deleteSlides.emit(indexes),
		openLayoutForSlide: (index, x, y) => this.openLayoutForSlide.emit({ index, x, y }),
		toggleHideSlides: (indexes) => this.toggleHideSlides.emit(indexes),
		addSectionAt: (index) => this.addSectionAt.emit(index),
	};

	/** The shared element's state: translated rows, the hook markers and the label. */
	protected readonly view = computed<ContextMenuViewState>(() => ({
		x: this.x(),
		y: this.y(),
		label: this.t('pptx.slidesPane.contextMenu.newSlide'),
		markers: ['data-pptx-context-menu', 'data-pptx-slide-pane-context-menu'],
		items: slidePaneViewItems(this.entries(), this.t, this.selectedIndexes().length),
	}));

	protected request(event: Event): void {
		this.run((event as ContextMenuRequestEvent).detail.id as SlidePaneContextMenuCommandId);
	}

	/** Run the chosen command, then close: every item closes the menu. */
	protected run(id: SlidePaneContextMenuCommandId): void {
		runSlidePaneContextMenuCommand(
			id,
			this.slideIndex(),
			this.selectedIndexes(),
			{ x: this.x(), y: this.y() },
			this.actions,
		);
		this.closed.emit();
	}
}
