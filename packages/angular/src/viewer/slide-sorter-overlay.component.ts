import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	HostListener,
	computed,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import {
	buildSlideSorterContextMenuEntries,
	HIDDEN_SLIDE_LABEL_KEY,
	HIDDEN_SLIDE_SLASH_GRADIENT,
	hiddenSlideCue,
	isEditorTextInputTarget,
	mapSlideSorterKey,
	slideSorterContextMenuLabel,
	applySorterAction,
	createSlideSorterState,
	selectSorterSlide,
	sorterSelectionIndexes,
	sorterMenuContext,
	sorterGridColumns,
} from '../internal/shared';
import type {
	CanvasSize,
	HiddenSlideCue,
	SlideSorterKeyActionName,
	SlideSorterState,
	SlideSorterContextMenuCommandId,
	SlideSorterContextMenuEntry,
} from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Pixel width of each thumbnail cell (the clipping box, not the canvas). */
const THUMB_W = 200;

/**
 * SlideSorterOverlayComponent: Angular port of the React `SlideSorterOverlay`.
 *
 * Renders a fixed full-screen modal overlay containing a responsive grid of
 * scaled slide previews. Double-clicking a thumbnail emits `select(index)`; pressing
 * Escape or clicking the ✕ button emits `closed`. Right-clicking a thumbnail
 * (when `canEdit`) opens a small context menu (Copy / Paste / Duplicate /
 * Hide-Show / Delete) whose command list comes from the shared
 * `buildSlideSorterContextMenuEntries`, the same list React, Vue, Svelte and
 * Vanilla render.
 *
 * Viewer-first scope: no drag-reorder, no section grouping.
 *
 * Usage:
 * ```html
 * <pptx-slide-sorter-overlay
 *   [slides]="slides()"
 *   [canvasSize]="canvasSize()"
 *   [mediaDataUrls]="mediaDataUrls()"
 *   [activeIndex]="activeSlideIndex()"
 *   (select)="goTo($event)"
 *   (closed)="showSorter.set(false)"
 * />
 * ```
 */
@Component({
	selector: 'pptx-slide-sorter-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent, TranslatePipe],
	templateUrl: './slide-sorter-overlay.component.html',
	styleUrl: './slide-sorter-overlay.component.css',
})
export class SlideSorterOverlayComponent {
	/** Full list of slides to display. */
	readonly slides = input.required<PptxSlide[]>();

	/** Natural (100 %) canvas dimensions, passed through to SlideCanvasComponent. */
	readonly canvasSize = input.required<CanvasSize>();

	/** Media asset lookup table, forwarded to each SlideCanvasComponent. */
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	/** Zero-based index of the currently active slide (highlighted in blue). */
	readonly activeIndex = input<number>(0);

	/** Whether the host allows edits; gates the deck-writing shortcuts. */
	readonly canEdit = input<boolean>(false);

	/** Emits the zero-based index of the thumbnail the user clicked. */
	readonly select = output<number>();

	/** Emits when the user closes the overlay (✕ button or Escape key). */
	readonly closed = output<void>();

	/** Delete the active slide (Delete / Backspace). */
	readonly deleteSlide = output<number>();

	/** Duplicate the active slide (Ctrl/Cmd+D). */
	readonly duplicateSlide = output<number>();

	/** Toggle the hidden flag on a slide (context-menu only, no keyboard chord). */
	readonly toggleHiddenSlide = output<number>();

	// -------------------------------------------------------------------------
	// Derived display values
	// -------------------------------------------------------------------------

	/** Zoom level that fits the full canvas width into THUMB_W pixels. */
	readonly sorter = signal<SlideSorterState | null>(null);
	readonly state = computed(
		() => this.sorter() ?? createSlideSorterState(this.slides(), this.activeIndex()),
	);
	readonly thumbZoom = computed(() =>
		thumbnailZoom(this.canvasSize().width, (THUMB_W * this.state().zoom) / 100),
	);

	/** Pixel height of the clipping box (aspect-correct). */
	readonly thumbH = computed(() =>
		thumbnailHeight(
			this.canvasSize().width,
			this.canvasSize().height,
			(THUMB_W * this.state().zoom) / 100,
		),
	);

	/** ngStyle object for the thumbnail clipping box. */
	readonly clipStyle = computed<Record<string, string>>(() => ({
		width: `${(THUMB_W * this.state().zoom) / 100}px`,
		height: `${this.thumbH()}px`,
	}));

	/** ngStyle object for the grid: responsive auto-fill columns. */
	readonly gridStyle = computed<Record<string, string>>(() => ({
		'grid-template-columns': `repeat(${sorterGridColumns(this.state().zoom)}, minmax(0, 1fr))`,
	}));

	// -------------------------------------------------------------------------
	// Event handlers
	// -------------------------------------------------------------------------

	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent): void {
		this.closeContextMenu();
		const { action } = mapSlideSorterKey(event, {
			canEdit: this.canEdit(),
			hasMultiSelection: sorterSelectionIndexes(this.state(), this.slides()).length > 1,
			isTextInputTarget: isEditorTextInputTarget(event.target),
		});
		if (!action) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.runAction(action);
	}
	setZoom(event: Event): void {
		this.sorter.set({ ...this.state(), zoom: Number((event.target as HTMLInputElement).value) });
	}
	private runAction(action: SlideSorterKeyActionName | 'toggle-hidden'): void {
		const result = applySorterAction(this.state(), this.slides(), action, this.activeIndex());
		this.sorter.set(result.state);
		if (result.close) {
			this.closed.emit();
		}
		for (const index of result.indexes) {
			if (result.operation === 'duplicate') {
				this.duplicateSlide.emit(index);
			}
			if (result.operation === 'delete') {
				this.deleteSlide.emit(index);
			}
			if (result.operation === 'toggle-hidden') {
				this.toggleHiddenSlide.emit(index);
			}
		}
	}

	/** Clicking the backdrop (outside the panel) closes the overlay. */
	onBackdropClick(event: MouseEvent): void {
		// Only close when the click target IS the backdrop element itself.
		if (event.target === event.currentTarget) {
			this.closed.emit();
		}
	}

	/** Clicking selects within the sorter; double-clicking opens the canvas. */
	onThumbClick(index: number, event: MouseEvent): void {
		this.sorter.set(selectSorterSlide(this.state(), this.slides(), index, event));
	}

	// -------------------------------------------------------------------------
	// Context menu (right-click a thumbnail)
	// -------------------------------------------------------------------------

	/** Open state + screen position of the context menu, or null when closed. */
	readonly contextMenu = signal<{ x: number; y: number; index: number } | null>(null);

	/**
	 * Right-clicking a thumbnail opens the menu for THAT slide.
	 *
	 * Deliberately does not also emit `select`: the host's `select` handler
	 * closes the whole overlay (it navigates the canvas and dismisses the
	 * sorter), so doing that here would tear down the menu before a single
	 * mouse action against it was reachable.
	 */
	onThumbContextMenu(event: MouseEvent, index: number): void {
		if (!this.canEdit()) {
			return;
		}
		event.preventDefault();
		this.sorter.set(selectSorterSlide(this.state(), this.slides(), index, {}, true));
		this.contextMenu.set({ x: event.clientX, y: event.clientY, index });
	}

	closeContextMenu(): void {
		this.contextMenu.set(null);
	}

	readonly menuEntries = computed<SlideSorterContextMenuEntry[]>(() =>
		buildSlideSorterContextMenuEntries(sorterMenuContext(this.state(), this.slides())),
	);
	menuLabelSuffix(translated: string, entry: SlideSorterContextMenuEntry): string {
		return slideSorterContextMenuLabel(
			translated,
			entry,
			sorterSelectionIndexes(this.state(), this.slides()).length,
		);
	}
	runMenuCommand(id: SlideSorterContextMenuCommandId): void {
		this.closeContextMenu();
		this.runAction(id);
	}

	// -------------------------------------------------------------------------
	// Utilities
	// -------------------------------------------------------------------------

	/** Returns true when a slide has been marked as hidden in the presentation. */
	isHiddenSlide(slide: PptxSlide): boolean {
		// PptxSlide carries a `hidden` boolean when the slide is set to hidden in
		// the OpenXML package. Cast via unknown to avoid accessing a field that
		// may not exist on all versions of the core type.
		const s = slide as unknown as Record<string, unknown>;
		return s['hidden'] === true;
	}

	/** Dictionary key for the word shown and announced on a hidden slide's cell. */
	readonly hiddenLabelKey = HIDDEN_SLIDE_LABEL_KEY;

	/** Shared slash mark, bound inline so a stylesheet copy cannot drift. */
	readonly slashGradient = HIDDEN_SLIDE_SLASH_GRADIENT;

	/**
	 * The shared cue for one cell. The dim already came off `.is-hidden`, but
	 * opacity is a colour-only signal and said nothing to a screen reader, so
	 * this adds the number slash, the word, and the neutral marker attribute.
	 */
	hiddenCue(slide: PptxSlide, index: number): HiddenSlideCue {
		return hiddenSlideCue(this.isHiddenSlide(slide), 'sorter', index);
	}
}
