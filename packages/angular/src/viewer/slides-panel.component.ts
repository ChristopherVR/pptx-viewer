import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	HostListener,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { LucidePlus } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import {
	computeVirtualRange,
	EDITOR_THUMBNAIL_WIDTH,
	EDITOR_SLIDE_RAIL_WIDTH,
	editorThumbnailStep,
	HIDDEN_SLIDE_DIM_OPACITY,
	HIDDEN_SLIDE_LABEL_KEY,
	HIDDEN_SLIDE_SLASH_GRADIENT,
	hiddenSlideCue,
	sectionAddAfterSlideIndex,
	SLIDE_VIRTUALIZATION_THRESHOLD,
} from '../internal/shared';
import type { CanvasSize, HiddenSlideCue, SectionContextMenuCommandId } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { SectionContextMenuComponent } from './section-context-menu.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { SlidePaneContextMenuComponent } from './slide-pane-context-menu.component';
import { SlidePaneRailSelection } from './slide-pane-rail-selection';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Pixel width of each thumbnail clipping box inside the panel. Slightly
 *  narrower than the panel so the slide-number column fits to its left
 *  (React SlideItem lays the number beside, not below, the preview). */
const THUMB_W = EDITOR_THUMBNAIL_WIDTH;

/**
 * SlidesPanelComponent: vertical slide-strip for the editor sidebar.
 *
 * Renders the live editable deck (from {@link EditorStateService}) as a
 * scrollable vertical list of numbered thumbnail cards. Clicking a card emits
 * `select(index)`; the active card is highlighted. Slide commands live on the
 * shared thumbnail right-click menu and cards reorder by drag and drop; section
 * commands live on the shared section-header menu. A footer "＋ Add slide"
 * button, the rail's one persistent action, appends a blank slide after the
 * current `activeIndex`.
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
		SectionContextMenuComponent,
		SlidePaneContextMenuComponent,
		TranslatePipe,
		LucidePlus,
	],
	templateUrl: './slides-panel.component.html',
	styleUrl: './slides-panel.component.css',
})
export class SlidesPanelComponent {
	readonly railWidth = EDITOR_SLIDE_RAIL_WIDTH;
	/** Natural (100 %) canvas dimensions, forwarded to each SlideCanvasComponent. */
	readonly canvasSize = input.required<CanvasSize>();

	/** Media asset lookup table, forwarded to each SlideCanvasComponent. */
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	/** Zero-based index of the currently active slide (highlighted in blue). */
	readonly activeIndex = input<number>(0);

	/** Emits the zero-based index of the card the user clicked. */
	readonly select = output<number>();
	/** Insert a new slide after `index` (thumbnail menu's New Slide, and Enter on the panel). */
	readonly addSlideAfter = output<number>();
	readonly duplicateSlides = output<number[]>();
	readonly deleteSlides = output<number[]>();
	readonly toggleHideSlides = output<number[]>();
	/** Makes `index` active, then opens the Layout gallery anchored at (x, y). */
	readonly openLayoutForSlide = output<{ index: number; x: number; y: number }>();
	readonly addSectionAt = output<number>();

	/** Ctrl/Shift multi-select + the thumbnail context menu's open state. */
	protected readonly rail = new SlidePaneRailSelection();

	protected readonly editor = inject(EditorStateService);
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

	readonly itemHeight = computed(() =>
		editorThumbnailStep(this.canvasSize().width, this.canvasSize().height),
	);
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

	// ── Drag-to-reorder (the rail's reorder path; there are no per-card buttons) ──
	private dragFrom: number | null = null;

	onDragStart(event: DragEvent, index: number): void {
		this.dragFrom = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(index));
		}
	}

	onDrop(event: DragEvent, index: number): void {
		event.preventDefault();
		const from = this.dragFrom;
		this.dragFrom = null;
		if (from !== null && from !== index) {
			this.editor.moveSlide(from, index);
		}
	}

	onAddSlide(): void {
		this.editor.addSlide(this.activeIndex());
	}

	/** A click (even a Ctrl/Shift one) both updates the multi-selection AND
	 * moves the canvas to the slide clicked, matching the sorter overlay. */
	onThumbClick(event: MouseEvent, index: number): void {
		const slide = this.editor.slides()[index];
		if (slide) {
			this.rail.onClick(event, slide.id, this.orderedIds());
		}
		this.select.emit(index);
	}

	onThumbContextMenu(event: MouseEvent, index: number): void {
		event.preventDefault();
		this.rail.openContextMenu(event.clientX, event.clientY, index, this.orderedIds());
	}

	/** PowerPoint's Enter on a focused thumbnail inserts a new slide after it. */
	@HostListener('keydown.enter', ['$event'])
	onPanelKeydown(event: Event): void {
		const target = event.target;
		if (target instanceof HTMLElement && target.tagName === 'INPUT') {
			return;
		}
		event.preventDefault();
		this.addSlideAfter.emit(this.activeIndex());
	}

	private orderedIds(): string[] {
		return this.editor.slides().map((s) => s.id);
	}

	// ── Section header menu + inline rename ──
	/** Open state of the section-header menu, or null when closed. */
	protected readonly sectionMenu = signal<{ x: number; y: number; sectionId: string } | null>(null);
	protected readonly renamingSectionId = signal<string | null>(null);
	protected readonly renameValue = signal('');
	private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');

	onSectionContextMenu(event: MouseEvent, sectionId: string): void {
		event.preventDefault();
		this.sectionMenu.set({ x: event.clientX, y: event.clientY, sectionId });
	}

	onSectionCommand(id: SectionContextMenuCommandId, sectionId: string): void {
		const section = this.editor.sections().find((candidate) => candidate.id === sectionId);
		if (!section) {
			return;
		}
		switch (id) {
			case 'rename':
				this.startRenameSection(sectionId, section.name);
				break;
			case 'delete':
				this.editor.sectionOps.delete(sectionId);
				break;
			case 'move-up':
				this.editor.sectionOps.move(sectionId, 'up');
				break;
			case 'move-down':
				this.editor.sectionOps.move(sectionId, 'down');
				break;
			case 'add-after': {
				const group = this.editor.sectionGroups().find((g) => g.section?.id === sectionId);
				this.addSectionAt.emit(
					sectionAddAfterSlideIndex(
						group?.slideIndexes[group.slideIndexes.length - 1],
						this.editor.slides().length,
					),
				);
				break;
			}
			default:
				break;
		}
	}

	startRenameSection(sectionId: string, currentName: string): void {
		this.renamingSectionId.set(sectionId);
		this.renameValue.set(currentName);
		setTimeout(() => {
			const field = this.renameInput()?.nativeElement;
			field?.focus();
			field?.select();
		});
	}

	commitRenameSection(): void {
		const id = this.renamingSectionId();
		if (id === null) {
			return;
		}
		const name = this.renameValue().trim();
		this.renamingSectionId.set(null);
		if (name.length > 0) {
			this.editor.sectionOps.rename(id, name);
		}
	}

	onRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			this.commitRenameSection();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			this.renamingSectionId.set(null);
		}
		event.stopPropagation();
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
