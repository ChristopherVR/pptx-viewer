import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { CanvasSize } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { SlideCanvasComponent } from './slide-canvas.component';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Pixel width of each thumbnail clipping box inside the panel. */
const THUMB_W = 150;

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
	imports: [NgStyle, SlideCanvasComponent],
	template: `
		<div class="pptx-ng-spanel">
			<!-- Scrollable slide list -->
			<div class="pptx-ng-spanel-scroll" role="listbox" aria-label="Slides">
				@for (slide of editor.slides(); track slide.id; let i = $index) {
					<div
						class="pptx-ng-spanel-card"
						[class.is-active]="i === activeIndex()"
						role="option"
						[attr.aria-selected]="i === activeIndex()"
						[attr.aria-label]="'Slide ' + (i + 1)"
					>
						<!-- Thumbnail (clickable to select) -->
						<button
							type="button"
							class="pptx-ng-spanel-thumb-btn"
							[attr.aria-label]="'Go to slide ' + (i + 1)"
							(click)="select.emit(i)"
						>
							<!-- Clipping wrapper: neutralises the 1rem auto margin from SlideCanvas -->
							<div class="pptx-ng-spanel-clip" [ngStyle]="clipStyle()">
								<pptx-slide-canvas
									[slide]="slide"
									[templateElements]="editor.templateElementsBySlideId()[slide.id] ?? []"
									[canvasSize]="canvasSize()"
									[mediaDataUrls]="mediaDataUrls()"
									[zoom]="thumbZoom()"
									[editable]="false"
									[autoFit]="false"
									[interactive]="false"
								/>
							</div>
						</button>

						<!-- Slide number badge -->
						<span class="pptx-ng-spanel-num" aria-hidden="true">{{ i + 1 }}</span>

						<!-- Per-card action toolbar (visible on hover / focus-within) -->
						<div
							class="pptx-ng-spanel-actions"
							role="toolbar"
							[attr.aria-label]="'Slide ' + (i + 1) + ' actions'"
						>
							<button
								type="button"
								class="pptx-ng-spanel-action"
								title="Duplicate slide"
								aria-label="Duplicate"
								(click)="onDuplicate(i)"
							>
								⧉
							</button>
							<button
								type="button"
								class="pptx-ng-spanel-action"
								title="Delete slide"
								aria-label="Delete"
								[disabled]="editor.slides().length <= 1"
								(click)="onDelete(i)"
							>
								✕
							</button>
							<button
								type="button"
								class="pptx-ng-spanel-action"
								title="Move up"
								aria-label="Move up"
								[disabled]="i === 0"
								(click)="onMoveUp(i)"
							>
								↑
							</button>
							<button
								type="button"
								class="pptx-ng-spanel-action"
								title="Move down"
								aria-label="Move down"
								[disabled]="i === editor.slides().length - 1"
								(click)="onMoveDown(i)"
							>
								↓
							</button>
						</div>
					</div>
				}
			</div>

			<!-- Footer: add new slide -->
			<footer class="pptx-ng-spanel-footer">
				<button
					type="button"
					class="pptx-ng-spanel-add"
					aria-label="Add slide"
					(click)="onAddSlide()"
				>
					＋ Add slide
				</button>
			</footer>
		</div>
	`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
			}

			.pptx-ng-spanel {
				display: flex;
				flex-direction: column;
				height: 100%;
				background: #1e1e1e;
				color: #e5e5e5;
				border-right: 1px solid rgba(255, 255, 255, 0.08);
				overflow: hidden;
			}

			/* ── Scrollable list ── */

			.pptx-ng-spanel-scroll {
				flex: 1;
				overflow-y: auto;
				padding: 0.5rem 0.375rem;
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}

			/* ── Card ── */

			.pptx-ng-spanel-card {
				position: relative;
				border-radius: 0.375rem;
				border: 2px solid transparent;
				background: transparent;
				transition:
					border-color 0.15s,
					background 0.15s;
			}

			.pptx-ng-spanel-card:hover,
			.pptx-ng-spanel-card:focus-within {
				background: rgba(255, 255, 255, 0.05);
				border-color: rgba(255, 255, 255, 0.15);
			}

			.pptx-ng-spanel-card.is-active {
				border-color: #3b82f6;
				background: rgba(59, 130, 246, 0.1);
			}

			/* ── Thumbnail button ── */

			.pptx-ng-spanel-thumb-btn {
				display: block;
				width: 100%;
				padding: 0.375rem 0.375rem 0;
				border: none;
				background: transparent;
				cursor: pointer;
				color: inherit;
				line-height: 0;
			}

			.pptx-ng-spanel-thumb-btn:focus-visible {
				outline: 2px solid #3b82f6;
				outline-offset: 2px;
				border-radius: 0.25rem;
			}

			/* ── Clip box: fixed width, aspect-correct height set via [ngStyle].
			       ::ng-deep removes the 1rem auto margin that SlideCanvas adds to its
			       wrapper, so the stage sits flush inside the box (same technique as
			       the sorter overlay). ── */

			.pptx-ng-spanel-clip {
				overflow: hidden;
				border-radius: 2px;
				/* width/height injected via [ngStyle] */
			}

			.pptx-ng-spanel-clip ::ng-deep .pptx-ng-canvas-wrapper {
				margin: 0 !important;
			}

			/* ── Slide number badge ── */

			.pptx-ng-spanel-num {
				display: block;
				text-align: center;
				font-size: 0.625rem;
				line-height: 1.6;
				color: rgba(255, 255, 255, 0.45);
				user-select: none;
				padding-bottom: 0.25rem;
			}

			/* ── Per-card action toolbar ──
			       Hidden by default; revealed on card hover or focus-within. ── */

			.pptx-ng-spanel-actions {
				position: absolute;
				top: 0.25rem;
				right: 0.25rem;
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				opacity: 0;
				pointer-events: none;
				transition: opacity 0.12s;
			}

			.pptx-ng-spanel-card:hover .pptx-ng-spanel-actions,
			.pptx-ng-spanel-card:focus-within .pptx-ng-spanel-actions {
				opacity: 1;
				pointer-events: auto;
			}

			.pptx-ng-spanel-action {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 1.375rem;
				height: 1.375rem;
				padding: 0;
				border: none;
				border-radius: 0.25rem;
				background: rgba(30, 30, 30, 0.85);
				color: #e5e5e5;
				font-size: 0.6875rem;
				cursor: pointer;
				transition: background 0.12s;
				backdrop-filter: blur(2px);
			}

			.pptx-ng-spanel-action:hover:not([disabled]) {
				background: rgba(59, 130, 246, 0.75);
			}

			.pptx-ng-spanel-action[disabled] {
				opacity: 0.3;
				cursor: not-allowed;
			}

			/* ── Footer ── */

			.pptx-ng-spanel-footer {
				flex-shrink: 0;
				padding: 0.5rem 0.375rem;
				border-top: 1px solid rgba(255, 255, 255, 0.08);
			}

			.pptx-ng-spanel-add {
				display: block;
				width: 100%;
				padding: 0.4375rem 0;
				border: 1px dashed rgba(255, 255, 255, 0.2);
				border-radius: 0.375rem;
				background: transparent;
				color: rgba(255, 255, 255, 0.6);
				font-size: 0.75rem;
				cursor: pointer;
				transition:
					background 0.15s,
					border-color 0.15s,
					color 0.15s;
			}

			.pptx-ng-spanel-add:hover {
				background: rgba(59, 130, 246, 0.15);
				border-color: #3b82f6;
				color: #e5e5e5;
			}
		`,
	],
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
}
