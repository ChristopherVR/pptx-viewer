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
	HIDDEN_SLIDE_LABEL_KEY,
	HIDDEN_SLIDE_SLASH_GRADIENT,
	hiddenSlideCue,
	isEditorTextInputTarget,
	mapSlideSorterKey,
} from '../internal/shared';
import type { CanvasSize, HiddenSlideCue } from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Pixel width of each thumbnail cell (the clipping box, not the canvas). */
const THUMB_W = 200;

/** Gap between grid cells in pixels. */
const GRID_GAP = 16;

/**
 * SlideSorterOverlayComponent: Angular port of the React `SlideSorterOverlay`.
 *
 * Renders a fixed full-screen modal overlay containing a responsive grid of
 * scaled slide previews. Clicking a thumbnail emits `select(index)`; pressing
 * Escape or clicking the ✕ button emits `closed`. Right-clicking a thumbnail
 * (when `canEdit`) opens a small context menu (Duplicate / Hide-Show /
 * Delete), matching React's `SorterContextMenu` and Vue's `ContextMenu`
 * wiring: this overlay previously had no mouse path to any of the three, and
 * no path to hide/show at all (mouse or keyboard).
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
	readonly thumbZoom = computed(() => thumbnailZoom(this.canvasSize().width, THUMB_W));

	/** Pixel height of the clipping box (aspect-correct). */
	readonly thumbH = computed(() =>
		thumbnailHeight(this.canvasSize().width, this.canvasSize().height, THUMB_W),
	);

	/** ngStyle object for the thumbnail clipping box. */
	readonly clipStyle = computed<Record<string, string>>(() => ({
		width: `${THUMB_W}px`,
		height: `${this.thumbH()}px`,
	}));

	/** ngStyle object for the grid: responsive auto-fill columns. */
	readonly gridStyle = computed<Record<string, string>>(() => ({
		'grid-template-columns': `repeat(auto-fill, minmax(${THUMB_W + GRID_GAP * 2 + 4}px, 1fr))`,
	}));

	// -------------------------------------------------------------------------
	// Event handlers
	// -------------------------------------------------------------------------

	/**
	 * Keyboard handler, resolved by the shared sorter keymap.
	 *
	 * This used to test for `Escape` and nothing else, so the sorter's Delete and
	 * Ctrl+D were dead in Angular alone. Only the commands this overlay can
	 * perform are dispatched: there is no slide clipboard, no multi-selection and
	 * no thumbnail zoom here, so those chords are left to the host instead of
	 * being swallowed by a branch that would do nothing.
	 */
	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent): void {
		if (this.contextMenu()) {
			this.closeContextMenu();
		}
		const { action } = mapSlideSorterKey(event, {
			canEdit: this.canEdit(),
			isTextInputTarget: isEditorTextInputTarget(event.target),
		});
		if (action === 'close') {
			event.preventDefault();
			this.closed.emit();
			return;
		}
		if (action === 'delete') {
			event.preventDefault();
			this.deleteSlide.emit(this.activeIndex());
			return;
		}
		if (action === 'duplicate') {
			event.preventDefault();
			this.duplicateSlide.emit(this.activeIndex());
		}
	}

	/** Clicking the backdrop (outside the panel) closes the overlay. */
	onBackdropClick(event: MouseEvent): void {
		// Only close when the click target IS the backdrop element itself.
		if (event.target === event.currentTarget) {
			this.closed.emit();
		}
	}

	/** Clicking a thumbnail selects the slide. */
	onThumbClick(index: number): void {
		this.select.emit(index);
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
		this.contextMenu.set({ x: event.clientX, y: event.clientY, index });
	}

	closeContextMenu(): void {
		this.contextMenu.set(null);
	}

	/** Whether the context menu's target slide is currently hidden. */
	contextMenuTargetHidden(): boolean {
		const menu = this.contextMenu();
		return menu ? (this.slides()[menu.index]?.hidden ?? false) : false;
	}

	menuDuplicate(): void {
		const menu = this.contextMenu();
		if (menu) {
			this.duplicateSlide.emit(menu.index);
		}
		this.closeContextMenu();
	}

	menuToggleHidden(): void {
		const menu = this.contextMenu();
		if (menu) {
			this.toggleHiddenSlide.emit(menu.index);
		}
		this.closeContextMenu();
	}

	menuDelete(): void {
		const menu = this.contextMenu();
		if (menu) {
			this.deleteSlide.emit(menu.index);
		}
		this.closeContextMenu();
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
