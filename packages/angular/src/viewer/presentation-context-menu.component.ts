/**
 * presentation-context-menu.component.ts: right-click menu shown while
 * presenting.
 *
 * Selector: `pptx-presentation-context-menu`
 *
 * Item order/grouping/i18n keys come from the shared
 * `getPresentationContextMenuSections` (`pptx-viewer-shared`), the same
 * source React's `PresentationContextMenu` and Vue's `PresentationMode`
 * render from, so this menu cannot drift from theirs. This component only
 * describes what capabilities are available (always all of them here: the
 * overlay already has next/prev, See All Slides, presenter view, pointer
 * tools, and the black/white blank screen) and routes a chosen action id
 * back to the overlay via a single output.
 *
 * The rows, keyboard navigation, clamping, dismissal (Escape, an outside press)
 * and focus restore belong to the shared `pptx-ui-context-menu`.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	input,
	output,
} from '@angular/core';

import type {
	ContextMenuRequestEvent,
	ContextMenuViewState,
	PresentationContextMenuActionId,
	PresentationContextMenuSection,
} from '../internal/shared';
import {
	CONTEXT_MENU_PRESENTATION_LAYER,
	getPresentationContextMenuSections,
	presentationViewItems,
} from '../internal/shared';
import type { MenuTranslate } from './context-menu-translate';
import { injectMenuTranslate } from './context-menu-translate';

@Component({
	selector: 'pptx-presentation-context-menu',
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
export class PresentationContextMenuComponent {
	/** Horizontal viewport coordinate (px) of the top-left corner of the menu. */
	readonly x = input.required<number>();
	/** Vertical viewport coordinate (px) of the top-left corner of the menu. */
	readonly y = input.required<number>();

	/** Emitted when the menu should close (Escape, outside click, or after an action). */
	readonly closed = output<void>();
	/** The chosen action id; the overlay maps it onto its own navigator/annotations/etc. */
	readonly action = output<PresentationContextMenuActionId>();

	private readonly t: MenuTranslate = injectMenuTranslate();

	protected readonly sections = computed<PresentationContextMenuSection[]>(() =>
		getPresentationContextMenuSections({
			seeAllSlides: true,
			presenterView: true,
			pointerTools: true,
			eraseInk: true,
			blankBlack: true,
			blankWhite: true,
		}),
	);

	/** The shared element's state, stacked above the presentation overlay. */
	protected readonly view = computed<ContextMenuViewState>(() => ({
		x: this.x(),
		y: this.y(),
		label: this.t('pptx.presentation.menuLabel'),
		markers: ['data-pptx-presentation-menu'],
		zIndex: CONTEXT_MENU_PRESENTATION_LAYER,
		items: presentationViewItems(this.sections(), this.t),
	}));

	protected request(event: Event): void {
		this.action.emit(
			(event as ContextMenuRequestEvent).detail.id as PresentationContextMenuActionId,
		);
		this.closed.emit();
	}
}
