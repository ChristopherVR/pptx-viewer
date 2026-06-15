import { NgClass, NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';

import type { ViewerTheme } from '../internal/shared';
import { themeStyle } from '../theme/viewer-theme';
import { LoadContentService } from './load-content.service';
import { PresentationOverlayComponent } from './presentation-overlay.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
import type { CollaborationConfig } from './types';

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;

/**
 * PowerPointViewerComponent — Angular port of the React `PowerPointViewer.tsx`
 * and Vue `PowerPointViewer.vue`.
 *
 * Top-level orchestrator that loads `.pptx` bytes and renders the slides with
 * navigation and zoom. This is the viewer-first milestone of the port: the
 * React component additionally composes a full editor (toolbar, inspector
 * panels, dialogs, presentation mode, collaboration, export). The roadmap and
 * per-area status live in `packages/angular/PORTING.md`.
 *
 * Conventions vs. React/Vue:
 *  - React `forwardRef` handle / Vue `defineExpose` → public {@link getContent}
 *    method (reach it via a template ref or `viewChild`).
 *  - React callback props / Vue emits → Angular `output()` events.
 *  - React theme context / Vue provide-inject → `themeStyle` CSS vars applied to
 *    the root element (app-wide sharing via `provideViewerTheme`).
 */
@Component({
	selector: 'pptx-viewer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [LoadContentService],
	imports: [
		NgClass,
		NgStyle,
		SlideCanvasComponent,
		PresentationOverlayComponent,
		SlideSorterOverlayComponent,
	],
	template: `
		<div class="pptx-ng-viewer" [ngClass]="class()" [ngStyle]="rootStyle()">
			@if (loader.loading()) {
				<div class="pptx-ng-state pptx-ng-loading">
					<div class="pptx-ng-spinner" aria-hidden="true"></div>
					<p>Loading presentation…</p>
				</div>
			} @else if (loader.isEncrypted()) {
				<div class="pptx-ng-state pptx-ng-error">
					<p>This presentation is password-protected and cannot be opened.</p>
				</div>
			} @else if (loader.error()) {
				<div class="pptx-ng-state pptx-ng-error">
					<p>Failed to load presentation.</p>
					<pre class="pptx-ng-error-detail">{{ loader.error() }}</pre>
				</div>
			} @else {
				<header class="pptx-ng-toolbar">
					<div class="pptx-ng-nav">
						<button type="button" [disabled]="activeSlideIndex() <= 0" (click)="goPrev()">‹</button>
						<span class="pptx-ng-slide-counter">
							{{ slideCount() === 0 ? 0 : activeSlideIndex() + 1 }} / {{ slideCount() }}
						</span>
						<button
							type="button"
							[disabled]="activeSlideIndex() >= slideCount() - 1"
							(click)="goNext()"
						>
							›
						</button>
					</div>
					<div class="pptx-ng-zoom">
						<button type="button" (click)="zoomOut()">−</button>
						<button type="button" class="pptx-ng-zoom-value" (click)="zoomReset()">
							{{ zoomPercent() }}%
						</button>
						<button type="button" (click)="zoomIn()">+</button>
					</div>
					<div class="pptx-ng-actions">
						<button type="button" (click)="showSorter.set(true)" aria-label="Slide sorter">
							⊞
						</button>
						<button
							type="button"
							[class.is-active]="showNotes()"
							[disabled]="!activeNotes()"
							(click)="toggleNotes()"
							aria-label="Speaker notes"
						>
							Notes
						</button>
						<button type="button" [disabled]="slideCount() === 0" (click)="present()">
							Present
						</button>
					</div>
				</header>

				<div class="pptx-ng-body">
					<nav class="pptx-ng-thumbnails" aria-label="Slides">
						@for (slide of loader.slides(); track slide.id; let i = $index) {
							<button
								type="button"
								class="pptx-ng-thumb"
								[class.is-active]="i === activeSlideIndex()"
								(click)="goTo(i)"
							>
								<span class="pptx-ng-thumb-index">{{ i + 1 }}</span>
							</button>
						}
					</nav>

					<main class="pptx-ng-main">
						<pptx-slide-canvas
							[slide]="activeSlide()"
							[canvasSize]="loader.canvasSize()"
							[mediaDataUrls]="loader.mediaDataUrls()"
							[zoom]="zoom()"
						/>
						@if (showNotes() && activeNotes()) {
							<aside class="pptx-ng-notes" aria-label="Speaker notes">
								<h2 class="pptx-ng-notes-title">Notes</h2>
								<p class="pptx-ng-notes-body">{{ activeNotes() }}</p>
							</aside>
						}
					</main>
				</div>
			}

			@if (showSorter()) {
				<pptx-slide-sorter-overlay
					[slides]="loader.slides()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[activeIndex]="activeSlideIndex()"
					(select)="goTo($event); showSorter.set(false)"
					(closed)="showSorter.set(false)"
				/>
			}

			@if (presenting()) {
				<pptx-presentation-overlay
					[slides]="loader.slides()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[startIndex]="activeSlideIndex()"
					(indexChange)="activeSlideIndex.set($event)"
					(closed)="presenting.set(false)"
				/>
			}
		</div>
	`,
})
export class PowerPointViewerComponent {
	/** PowerPoint content as Uint8Array (or ArrayBuffer). */
	readonly content = input<Uint8Array | ArrayBuffer | null>(null);
	/** Whether editing actions are enabled. (Editor chrome not yet ported.) */
	readonly canEdit = input<boolean>(false);
	/** Optional class applied to the root element. */
	readonly class = input<string>('');
	/** Theme configuration for customising the viewer's appearance. */
	readonly theme = input<ViewerTheme | undefined>(undefined);
	/** Optional real-time collaboration config (accepted for API parity; not yet implemented). */
	readonly collaboration = input<CollaborationConfig | undefined>(undefined);

	/** Fired when the active slide changes. */
	readonly activeSlideChange = output<number>();
	/** Fired when the unsaved-changes flag toggles. (Editing not yet ported.) */
	readonly dirtyChange = output<boolean>();
	/** Fired when the in-memory content changes after edits. (Editing not yet ported.) */
	readonly contentChange = output<Uint8Array>();

	protected readonly loader = inject(LoadContentService);

	protected readonly activeSlideIndex = signal(0);
	protected readonly slideCount = this.loader.slideCount;
	protected readonly activeSlide = computed(() => this.loader.slides()[this.activeSlideIndex()]);
	protected readonly rootStyle = computed(() => themeStyle(this.theme()));

	protected readonly zoom = signal(1);
	protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

	/** Fullscreen presentation-mode overlay visibility. */
	protected readonly presenting = signal(false);
	/** Slide-sorter grid overlay visibility. */
	protected readonly showSorter = signal(false);
	/** Speaker-notes strip visibility. */
	protected readonly showNotes = signal(false);
	/** Notes for the active slide, if any. */
	protected readonly activeNotes = computed(() => this.activeSlide()?.notes?.trim() || '');

	constructor() {
		// Load whenever the `content` input changes.
		effect(() => {
			const content = this.content();
			void this.loader.load(content);
		});

		// Reset to the first slide whenever a new presentation finishes loading.
		effect(() => {
			// Read slides to track; reset index out of band.
			this.loader.slides();
			this.activeSlideIndex.set(0);
		});

		// Emit navigation changes.
		effect(() => {
			this.activeSlideChange.emit(this.activeSlideIndex());
		});
	}

	/** Serialise the current presentation to `.pptx` bytes (imperative handle). */
	getContent(): Promise<Uint8Array> {
		return this.loader.getContent();
	}

	goTo(index: number): void {
		if (index < 0 || index >= this.slideCount()) {
			return;
		}
		this.activeSlideIndex.set(index);
	}
	goPrev(): void {
		this.goTo(this.activeSlideIndex() - 1);
	}
	goNext(): void {
		this.goTo(this.activeSlideIndex() + 1);
	}

	zoomIn(): void {
		this.zoom.set(Math.min(ZOOM_MAX, Number((this.zoom() + ZOOM_STEP).toFixed(2))));
	}
	zoomOut(): void {
		this.zoom.set(Math.max(ZOOM_MIN, Number((this.zoom() - ZOOM_STEP).toFixed(2))));
	}
	zoomReset(): void {
		this.zoom.set(1);
	}

	/** Open the fullscreen presentation overlay from the current slide. */
	present(): void {
		if (this.slideCount() > 0) {
			this.presenting.set(true);
		}
	}
	/** Toggle the speaker-notes strip. */
	toggleNotes(): void {
		this.showNotes.update((v) => !v);
	}
}
