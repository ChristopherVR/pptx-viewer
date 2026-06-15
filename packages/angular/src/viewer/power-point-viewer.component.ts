import { NgClass, NgStyle } from '@angular/common';
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
import type { PptxElement } from 'pptx-viewer-core';

import type { ViewerTheme } from '../internal/shared';
import { themeStyle } from '../theme/viewer-theme';
import { EditorStateService } from './editor-state.service';
import { slideFileName } from './export-helpers';
import { ExportService } from './export.service';
import { FindBarComponent } from './find-bar.component';
import { InspectorPanelComponent } from './inspector-panel.component';
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
	providers: [LoadContentService, ExportService, EditorStateService],
	imports: [
		NgClass,
		NgStyle,
		SlideCanvasComponent,
		PresentationOverlayComponent,
		SlideSorterOverlayComponent,
		FindBarComponent,
		InspectorPanelComponent,
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
						@if (canEdit()) {
							<button
								type="button"
								[disabled]="!editor.canUndo()"
								[attr.title]="editor.undoLabel() ? 'Undo ' + editor.undoLabel() : 'Undo'"
								(click)="editor.undo()"
								aria-label="Undo"
							>
								↶
							</button>
							<button
								type="button"
								[disabled]="!editor.canRedo()"
								[attr.title]="editor.redoLabel() ? 'Redo ' + editor.redoLabel() : 'Redo'"
								(click)="editor.redo()"
								aria-label="Redo"
							>
								↷
							</button>
						}
						<button type="button" (click)="showFind.set(true)" aria-label="Find in slides">
							Find
						</button>
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
						<button
							type="button"
							[disabled]="slideCount() === 0 || exporting()"
							(click)="exportPng()"
						>
							PNG
						</button>
						<button
							type="button"
							[disabled]="slideCount() === 0 || exporting()"
							(click)="exportPdf()"
						>
							{{ exporting() ? 'Exporting…' : 'PDF' }}
						</button>
						<button type="button" [disabled]="slideCount() === 0" (click)="present()">
							Present
						</button>
					</div>
				</header>

				<div class="pptx-ng-body">
					<nav class="pptx-ng-thumbnails" aria-label="Slides">
						@for (slide of displaySlides(); track slide.id; let i = $index) {
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

					<main class="pptx-ng-main" #mainEl>
						<pptx-slide-canvas
							[slide]="activeSlide()"
							[canvasSize]="loader.canvasSize()"
							[mediaDataUrls]="loader.mediaDataUrls()"
							[zoom]="zoom()"
							[editable]="canEdit()"
							[selectedIds]="editor.selectedIds()"
							(elementSelect)="onElementSelect($event)"
							(backgroundClick)="editor.clearSelection()"
							(transformStart)="editor.beginTransform($event.label)"
							(transformUpdate)="editor.applyTransform(activeSlideIndex(), $event.id, $event.box)"
						/>
						@if (showNotes() && activeNotes()) {
							<aside class="pptx-ng-notes" aria-label="Speaker notes">
								<h2 class="pptx-ng-notes-title">Notes</h2>
								<p class="pptx-ng-notes-body">{{ activeNotes() }}</p>
							</aside>
						}
					</main>

					@if (canEdit() && selectedElement(); as el) {
						<aside class="pptx-ng-inspector-host" aria-label="Element properties">
							<pptx-inspector-panel [element]="el" [slideIndex]="activeSlideIndex()" />
						</aside>
					}
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

			@if (showFind()) {
				<pptx-find-bar
					[slides]="loader.slides()"
					(navigate)="goTo($event)"
					(closed)="showFind.set(false)"
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
	private readonly exportSvc = inject(ExportService);
	protected readonly editor = inject(EditorStateService);

	/** The `<main>` host; used to locate the live `.pptx-ng-canvas-stage`. */
	private readonly mainEl = viewChild<ElementRef<HTMLElement>>('mainEl');
	/** True while a PNG/PDF export is in progress (disables the buttons). */
	protected readonly exporting = signal(false);

	protected readonly activeSlideIndex = signal(0);
	/** Slides to display: the editable deck when `canEdit`, else the loaded deck. */
	protected readonly displaySlides = computed(() =>
		this.canEdit() ? this.editor.slides() : this.loader.slides(),
	);
	protected readonly slideCount = computed(() => this.displaySlides().length);
	protected readonly activeSlide = computed(() => this.displaySlides()[this.activeSlideIndex()]);
	protected readonly rootStyle = computed(() => themeStyle(this.theme()));

	protected readonly zoom = signal(1);
	protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

	/** Fullscreen presentation-mode overlay visibility. */
	protected readonly presenting = signal(false);
	/** Slide-sorter grid overlay visibility. */
	protected readonly showSorter = signal(false);
	/** Speaker-notes strip visibility. */
	protected readonly showNotes = signal(false);
	/** Find-in-slides bar visibility. */
	protected readonly showFind = signal(false);
	/** Notes for the active slide, if any. */
	protected readonly activeNotes = computed(() => this.activeSlide()?.notes?.trim() || '');
	/** The single selected element on the active slide (for the inspector). */
	protected readonly selectedElement = computed<PptxElement | null>(() => {
		const ids = this.editor.selectedIds();
		if (ids.length !== 1) {
			return null;
		}
		return this.activeSlide()?.elements.find((e) => e.id === ids[0]) ?? null;
	});

	constructor() {
		// Load whenever the `content` input changes.
		effect(() => {
			const content = this.content();
			void this.loader.load(content);
		});

		// Reset to the first slide and seed the editable deck whenever a new
		// presentation finishes loading.
		effect(() => {
			const slides = this.loader.slides();
			this.editor.setSlides(slides);
			this.activeSlideIndex.set(0);
		});

		// Emit navigation changes.
		effect(() => {
			this.activeSlideChange.emit(this.activeSlideIndex());
		});

		// Surface the editor's dirty flag to the host.
		effect(() => {
			this.dirtyChange.emit(this.editor.dirty());
		});

		// Keep the active index in range when the deck shrinks (slide deleted).
		effect(() => {
			const count = this.displaySlides().length;
			if (count > 0 && this.activeSlideIndex() >= count) {
				this.activeSlideIndex.set(count - 1);
			}
		});
	}

	/**
	 * Serialise the current presentation to `.pptx` bytes (imperative handle).
	 * When editing, this serialises the editor's edited deck so changes persist.
	 */
	getContent(): Promise<Uint8Array> {
		return this.canEdit() ? this.loader.saveSlides(this.editor.slides()) : this.loader.getContent();
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

	/**
	 * Handle an element press from the canvas. Additive (Shift/Ctrl) toggles
	 * membership; a plain press selects the element (keeping it selected if it
	 * already was, so a subsequent drag works).
	 */
	onElementSelect(event: { id: string; additive: boolean }): void {
		if (event.additive) {
			this.editor.toggleSelect(event.id, true);
		} else if (!this.editor.isSelected(event.id)) {
			this.editor.select([event.id]);
		}
	}

	/**
	 * Editing keyboard shortcuts (only when `canEdit` and not typing in a
	 * field or presenting): Delete, Ctrl/Cmd+Z/Y undo/redo, Ctrl/Cmd+D
	 * duplicate, arrow-key nudge (Shift = ×10).
	 */
	@HostListener('document:keydown', ['$event'])
	onKeyDown(event: KeyboardEvent): void {
		if (!this.canEdit() || this.presenting()) {
			return;
		}
		const target = event.target as HTMLElement | null;
		const tag = target?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
			return;
		}

		const mod = event.ctrlKey || event.metaKey;
		const idx = this.activeSlideIndex();

		if (mod && (event.key === 'z' || event.key === 'Z')) {
			event.preventDefault();
			if (event.shiftKey) {
				this.editor.redo();
			} else {
				this.editor.undo();
			}
			return;
		}
		if (mod && (event.key === 'y' || event.key === 'Y')) {
			event.preventDefault();
			this.editor.redo();
			return;
		}
		if (mod && (event.key === 'd' || event.key === 'D')) {
			event.preventDefault();
			this.editor.duplicateSelected(idx);
			return;
		}

		if (!this.editor.hasSelection()) {
			return;
		}

		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			this.editor.deleteSelected(idx);
			return;
		}

		const step = event.shiftKey ? 10 : 1;
		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, -step, 0);
				break;
			case 'ArrowRight':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, step, 0);
				break;
			case 'ArrowUp':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, 0, -step);
				break;
			case 'ArrowDown':
				event.preventDefault();
				this.editor.moveSelectedBy(idx, 0, step);
				break;
			default:
				break;
		}
	}

	/** Resolve the live slide-stage element within `<main>`. */
	private stageElement(): HTMLElement | undefined {
		return (
			this.mainEl()?.nativeElement.querySelector<HTMLElement>('.pptx-ng-canvas-stage') ?? undefined
		);
	}

	/** Export the current slide as a PNG download. */
	async exportPng(): Promise<void> {
		const el = this.stageElement();
		if (!el || this.exporting()) {
			return;
		}
		this.exporting.set(true);
		try {
			await this.exportSvc.exportElementToPng(
				el,
				slideFileName('slide', this.activeSlideIndex() + 1, 'png'),
			);
		} finally {
			this.exporting.set(false);
		}
	}

	/**
	 * Export every slide to a multi-page PDF. Each slide is made the live stage,
	 * given a render tick to settle, captured to a canvas, then the original
	 * slide is restored.
	 */
	async exportPdf(): Promise<void> {
		const total = this.slideCount();
		if (total === 0 || this.exporting()) {
			return;
		}
		this.exporting.set(true);
		const original = this.activeSlideIndex();
		const { width, height } = this.loader.canvasSize();
		const canvases: HTMLCanvasElement[] = [];
		try {
			for (let i = 0; i < total; i++) {
				this.activeSlideIndex.set(i);
				await new Promise<void>((resolve) => {
					setTimeout(resolve, 150);
				});
				const el = this.stageElement();
				if (el) {
					canvases.push(await this.exportSvc.renderElement(el));
				}
			}
			this.activeSlideIndex.set(original);
			this.exportSvc.exportCanvasesToPdf(canvases, width, height, 'presentation.pdf');
		} finally {
			this.activeSlideIndex.set(original);
			this.exporting.set(false);
		}
	}
}
