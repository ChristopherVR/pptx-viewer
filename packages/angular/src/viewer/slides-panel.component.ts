import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import {
	LucideArrowDown,
	LucideArrowUp,
	LucideCopy,
	LucidePlus,
	LucideTrash2,
} from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
	computeVirtualRange,
	HIDDEN_SLIDE_DIM_OPACITY,
	HIDDEN_SLIDE_LABEL_KEY,
	HIDDEN_SLIDE_SLASH_GRADIENT,
	hiddenSlideCue,
	SLIDE_VIRTUALIZATION_THRESHOLD,
} from '../internal/shared';
import type { CanvasSize, HiddenSlideCue } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { SlideCanvasComponent } from './slide-canvas.component';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Pixel width of each thumbnail clipping box inside the panel. Slightly
 *  narrower than the panel so the slide-number column fits to its left
 *  (React SlideItem lays the number beside, not below, the preview). */
const THUMB_W = 132;
const THUMB_CARD_CHROME_HEIGHT = 12;

/**
 * SlidesPanelComponent: vertical slide-strip for the editor sidebar.
 *
 * Renders the live editable deck (from {@link EditorStateService}) as a
 * scrollable vertical list of numbered thumbnail cards. Clicking a card emits
 * `select(index)`; the active card is highlighted. Per-card hover toolbar
 * provides Duplicate, Delete (disabled when only 1 slide), Move up, and Move
 * down. A footer "＋ Add slide" button appends a blank slide after the current
 * `activeIndex`.
 *
 * Usage:
 * ```html
 * <pptx-slides-panel
 *   [canvasSize]="loader.canvasSize()"
 *   [mediaDataUrls]="loader.mediaDataUrls()"
 *   [activeIndex]="activeSlideIndex()"
 *   (select)="goTo($event)"
 * />
 * ```
 */
@Component({
	selector: 'pptx-slides-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgStyle,
		SlideCanvasComponent,
		TranslatePipe,
		LucideCopy,
		LucideTrash2,
		LucideArrowUp,
		LucideArrowDown,
		LucidePlus,
	],
	templateUrl: './slides-panel.component.html',
	styleUrl: './slides-panel.component.css',
})
export class SlidesPanelComponent {
	/** Natural (100 %) canvas dimensions, forwarded to each SlideCanvasComponent. */
	readonly canvasSize = input.required<CanvasSize>();

	/** Media asset lookup table, forwarded to each SlideCanvasComponent. */
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	/** Zero-based index of the currently active slide (highlighted in blue). */
	readonly activeIndex = input<number>(0);

	/** Emits the zero-based index of the card the user clicked. */
	readonly select = output<number>();

	protected readonly editor = inject(EditorStateService);
	private readonly translate = inject(TranslateService);
	private readonly scrollViewport = viewChild<ElementRef<HTMLElement>>('scrollViewport');
	private readonly scrollTop = signal(0);
	private readonly viewportHeight = signal(600);

	// ── Derived thumbnail dimensions ──────────────────────────────────────────

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

	readonly itemHeight = computed(() => this.thumbH() + THUMB_CARD_CHROME_HEIGHT);
	readonly shouldVirtualize = computed(
		() =>
			this.editor.sections().length === 0 &&
			this.editor.slides().length >= SLIDE_VIRTUALIZATION_THRESHOLD,
	);
	readonly virtualRange = computed(() =>
		computeVirtualRange(
			this.editor.slides().length,
			this.itemHeight(),
			this.scrollTop(),
			this.viewportHeight(),
		),
	);
	readonly renderedSlides = computed(() => {
		const slides = this.editor.slides();
		if (this.editor.sections().length > 0) {
			return this.editor.sectionGroups().flatMap((group) =>
				group.slides.map((slide, offset) => ({
					slide,
					index: group.slideIndexes[offset],
					section: group.section,
					sectionStart: offset === 0,
				})),
			);
		}
		const start = this.shouldVirtualize() ? this.virtualRange().startIndex : 0;
		const end = this.shouldVirtualize() ? this.virtualRange().endIndex : slides.length - 1;
		return slides.slice(start, end + 1).map((slide, offset) => ({
			slide,
			index: start + offset,
			section: undefined,
			sectionStart: false,
		}));
	});

	constructor() {
		effect(() => {
			const viewport = this.scrollViewport()?.nativeElement;
			const index = this.activeIndex();
			if (!viewport || !this.shouldVirtualize()) {
				return;
			}
			const itemHeight = this.itemHeight();
			const top = index * itemHeight;
			const bottom = top + itemHeight;
			if (top < viewport.scrollTop) {
				viewport.scrollTop = top;
			} else if (bottom > viewport.scrollTop + viewport.clientHeight) {
				viewport.scrollTop = Math.max(0, bottom - viewport.clientHeight);
			}
			this.syncViewport(viewport);
		});
	}

	onScroll(): void {
		const viewport = this.scrollViewport()?.nativeElement;
		if (viewport) {
			this.syncViewport(viewport);
		}
	}

	private syncViewport(viewport: HTMLElement): void {
		this.scrollTop.set(viewport.scrollTop);
		this.viewportHeight.set(viewport.clientHeight || 600);
	}

	// ── Event handlers ────────────────────────────────────────────────────────

	onDuplicate(index: number): void {
		this.editor.duplicateSlide(index);
	}

	onDelete(index: number): void {
		this.editor.deleteSlide(index);
	}

	onMoveUp(index: number): void {
		this.editor.moveSlide(index, index - 1);
	}

	onMoveDown(index: number): void {
		this.editor.moveSlide(index, index + 1);
	}

	onAddSlide(): void {
		this.editor.addSlide(this.activeIndex());
	}

	onRenameSection(sectionId: string, currentName: string): void {
		const name = window.prompt(this.translate.instant('pptx.sections.rename'), currentName);
		if (name !== null) {
			this.editor.sectionOps.rename(sectionId, name);
		}
	}

	sectionIndex(sectionId: string): number {
		return this.editor.sections().findIndex((section) => section.id === sectionId);
	}

	/** Dictionary key for the word shown and announced on a hidden slide's card. */
	readonly hiddenLabelKey = HIDDEN_SLIDE_LABEL_KEY;

	/**
	 * The hidden-slide slash and dim, bound as inline styles rather than written
	 * into `slides-panel.component.css`. A component stylesheet cannot read a TS
	 * constant, so a literal copy there would be free to drift from the four
	 * other bindings; binding the shared values makes drift impossible.
	 */
	readonly slashGradient = HIDDEN_SLIDE_SLASH_GRADIENT;
	readonly dimOpacity = HIDDEN_SLIDE_DIM_OPACITY;

	/**
	 * The shared rail/sorter cue for one card. A hidden slide is still LISTED
	 * here (hiding only removes it from the show), so without this the panel gave
	 * a user no way to tell that a slide will be skipped.
	 */
	hiddenCue(slide: { hidden?: boolean }, index: number): HiddenSlideCue {
		return hiddenSlideCue(slide.hidden, 'rail', index);
	}
}
