/**
 * slide-canvas-context-menu.component.ts: right-click menu for the empty
 * slide canvas (no element under the cursor) in the Angular PPTX editor.
 *
 * Selector: `pptx-slide-canvas-context-menu`
 *
 * Sibling of `EditorContextMenuComponent` (the per-element menu): the item
 * list comes from `buildCanvasContextMenuEntries` in `pptx-viewer-shared`,
 * this component's job is only to render it and route a chosen command.
 *
 * Usage:
 * ```html
 * @if (canEdit() && canvasContextMenuPos(); as m) {
 *   <pptx-slide-canvas-context-menu
 *     [x]="m.x"
 *     [y]="m.y"
 *     [hasClipboard]="editor.hasClipboard()"
 *     [showGrid]="showGrid()"
 *     [showRulers]="showRulers()"
 *     (paste)="editor.paste(activeSlideIndex())"
 *     (openLayoutGallery)="openCanvasLayoutGallery(m.x, m.y)"
 *     (resetSlide)="resetActiveSlide()"
 *     (openFormatBackground)="inspectorPanel.openFormatPanel(); editor.clearSelection()"
 *     (toggleGrid)="showGrid.update((v) => !v)"
 *     (toggleRulers)="showRulers.update((v) => !v)"
 *     (closed)="canvasContextMenuPos.set(null)"
 *   />
 * }
 * ```
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
	CustomizedCanvasContextMenuEntry,
} from '../internal/shared';
import {
	buildCanvasContextMenuEntries,
	contextMenuViewItems,
	customizeCanvasContextMenuEntries,
} from '../internal/shared';
import type { MenuTranslate } from './context-menu-translate';
import { injectMenuTranslate } from './context-menu-translate';
import type { CanvasContextMenuActions } from './slide-canvas-context-menu-dispatch';
import { runCanvasContextMenuCommand } from './slide-canvas-context-menu-dispatch';
import { injectResolvedCustomization } from './viewer-customization.service';

@Component({
	selector: 'pptx-slide-canvas-context-menu',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { style: 'display: contents' },
	// An empty menu (host customisation removed every entry) renders nothing.
	template: `
		<pptx-ui-context-menu
			[state]="view()"
			(menu-request)="request($event)"
			(menu-close)="closed.emit()"
		></pptx-ui-context-menu>
	`,
})
export class SlideCanvasContextMenuComponent {
	readonly x = input.required<number>();
	readonly y = input.required<number>();
	readonly slideIndex = input<number>(0);
	readonly hasClipboard = input<boolean>(false);
	readonly showGrid = input<boolean>(false);
	readonly showRulers = input<boolean>(false);

	readonly closed = output<void>();
	readonly paste = output<void>();
	/** Opens the existing Layout gallery (imperative open, not the ribbon's own click). */
	readonly openLayoutGallery = output<void>();
	readonly resetSlide = output<void>();
	/** Opens the inspector on slide/background properties (no element selected). */
	readonly openFormatBackground = output<void>();
	readonly toggleGrid = output<void>();
	readonly toggleRulers = output<void>();

	private readonly t: MenuTranslate = injectMenuTranslate();

	private readonly customization = injectResolvedCustomization();

	protected readonly entries = computed<CustomizedCanvasContextMenuEntry[]>(() =>
		customizeCanvasContextMenuEntries(
			buildCanvasContextMenuEntries({
				hasClipboard: this.hasClipboard(),
				showGrid: this.showGrid(),
				showRulers: this.showRulers(),
			}),
			this.customization(),
			{ slideIndex: this.slideIndex() },
		),
	);

	private readonly actions: CanvasContextMenuActions = {
		paste: () => this.paste.emit(),
		openLayoutGallery: () => this.openLayoutGallery.emit(),
		resetSlide: () => this.resetSlide.emit(),
		openFormatBackground: () => this.openFormatBackground.emit(),
		toggleGrid: () => this.toggleGrid.emit(),
		toggleRulers: () => this.toggleRulers.emit(),
	};

	/** The shared element's state: translated rows, the hook markers and the label. */
	protected readonly view = computed<ContextMenuViewState>(() => ({
		x: this.x(),
		y: this.y(),
		label: this.t('pptx.canvasContextMenu.ariaLabel'),
		markers: ['data-pptx-context-menu', 'data-pptx-canvas-context-menu'],
		items: contextMenuViewItems(this.entries(), this.t),
	}));

	protected request(event: Event): void {
		this.run((event as ContextMenuRequestEvent).detail.id);
	}

	/** Run the chosen command (an id or an entry), then close: every item closes the menu. */
	protected run(target: string | CustomizedCanvasContextMenuEntry): void {
		const entry =
			typeof target === 'string'
				? this.entries().find((candidate) => candidate.id === target)
				: target;
		if (!entry) {
			return;
		}
		if ('host' in entry) {
			this.closed.emit();
			entry.onSelect();
			return;
		}
		runCanvasContextMenuCommand(entry.id, this.actions);
		this.closed.emit();
	}
}
