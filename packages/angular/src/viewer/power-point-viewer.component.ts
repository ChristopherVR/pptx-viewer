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
import type { PptxComment, PptxCoreProperties, PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { ViewerTheme } from '../internal/shared';
import { themeStyle } from '../theme/viewer-theme';
import { AccessibilityPanelComponent } from './accessibility-panel.component';
import { AccessibilityService } from './accessibility.service';
import { CollaborationCursorsComponent } from './collaboration-cursors.component';
import { CollaborationService } from './collaboration.service';
import {
	addCommentToList,
	removeCommentFromList,
	toggleCommentResolvedInList,
} from './comments-helpers';
import { CommentsPanelComponent } from './comments-panel.component';
import { EditorContextMenuComponent } from './editor-context-menu.component';
import { EditorStateService } from './editor-state.service';
import { EditorToolbarComponent } from './editor-toolbar.component';
import { EmbeddedFontsService } from './embedded-fonts.service';
import { slideFileName } from './export-helpers';
import { ExportService } from './export.service';
import { FindBarComponent } from './find-bar.component';
import { HyperlinkDialogComponent } from './hyperlink-dialog.component';
import { InspectorPanelComponent } from './inspector-panel.component';
import { LoadContentService } from './load-content.service';
import { PresentationOverlayComponent } from './presentation-overlay.component';
import { PrintDialogComponent } from './print-dialog.component';
import type { PrintSettings } from './print-helpers';
import { PrintService } from './print.service';
import { PropertiesDialogComponent } from './properties-dialog.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
import { SlidesPanelComponent } from './slides-panel.component';
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
	providers: [
		LoadContentService,
		ExportService,
		EditorStateService,
		EmbeddedFontsService,
		CollaborationService,
		AccessibilityService,
		PrintService,
	],
	imports: [
		NgClass,
		NgStyle,
		SlideCanvasComponent,
		PresentationOverlayComponent,
		SlideSorterOverlayComponent,
		FindBarComponent,
		InspectorPanelComponent,
		SlidesPanelComponent,
		EditorToolbarComponent,
		EditorContextMenuComponent,
		CommentsPanelComponent,
		AccessibilityPanelComponent,
		CollaborationCursorsComponent,
		PropertiesDialogComponent,
		HyperlinkDialogComponent,
		PrintDialogComponent,
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
							[class.is-active]="activePanel() === 'accessibility'"
							[attr.aria-pressed]="activePanel() === 'accessibility'"
							(click)="togglePanel('accessibility')"
							aria-label="Accessibility checker"
						>
							A11y
						</button>
						@if (canEdit()) {
							<button
								type="button"
								[class.is-active]="activePanel() === 'comments'"
								[attr.aria-pressed]="activePanel() === 'comments'"
								(click)="togglePanel('comments')"
								aria-label="Comments"
							>
								Comments
							</button>
							@if (selectedElement(); as el) {
								<button type="button" (click)="showHyperlink.set(true)" aria-label="Edit hyperlink">
									Link
								</button>
							}
						}
						<button type="button" (click)="showProperties.set(true)" aria-label="Document properties">
							Info
						</button>
						<button
							type="button"
							[disabled]="slideCount() === 0"
							(click)="print.openDialog()"
							aria-label="Print"
						>
							Print
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

				@if (canEdit()) {
					<pptx-editor-toolbar [slideIndex]="activeSlideIndex()" />
				}

				<div class="pptx-ng-body">
					@if (canEdit()) {
						<pptx-slides-panel
							[canvasSize]="loader.canvasSize()"
							[mediaDataUrls]="loader.mediaDataUrls()"
							[activeIndex]="activeSlideIndex()"
							(select)="goTo($event)"
						/>
					} @else {
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
					}

					<main
						class="pptx-ng-main"
						#mainEl
						(touchstart)="onMainTouchStart($event)"
						(touchend)="onMainTouchEnd($event)"
					>
						<pptx-slide-canvas
							[slide]="activeSlide()"
							[canvasSize]="loader.canvasSize()"
							[mediaDataUrls]="loader.mediaDataUrls()"
							[zoom]="zoom()"
							[editable]="canEdit()"
							[selectedIds]="editor.selectedIds()"
							(elementSelect)="onElementSelect($event)"
							(backgroundClick)="editor.clearSelection()"
							(marqueeSelect)="editor.select($event)"
							(transformStart)="editor.beginTransform($event.label)"
							(transformUpdate)="editor.applyTransform(activeSlideIndex(), $event.id, $event.box)"
							(rotateUpdate)="
								editor.applyTransform(activeSlideIndex(), $event.id, { rotation: $event.rotation })
							"
							(contextMenu)="onContextMenu($event)"
							[editingId]="editingId()"
							(textEditStart)="editingId.set($event.id)"
							(textCommit)="onTextCommit($event)"
							(textCancel)="editingId.set(null)"
						/>
						@if (collab.connected()) {
							<pptx-collaboration-cursors [cursors]="collab.cursors()" [zoom]="zoom()" />
						}
						@if (showNotes() && activeNotes()) {
							<aside class="pptx-ng-notes" aria-label="Speaker notes">
								<h2 class="pptx-ng-notes-title">Notes</h2>
								<p class="pptx-ng-notes-body">{{ activeNotes() }}</p>
							</aside>
						}
					</main>

					@if (activePanel() === 'accessibility') {
						<aside class="pptx-ng-inspector-host" aria-label="Accessibility checker">
							<pptx-accessibility-panel
								[issues]="accessibility.issues()"
								(selectSlide)="goTo($event)"
							/>
						</aside>
					} @else if (activePanel() === 'comments' && canEdit()) {
						<aside class="pptx-ng-inspector-host" aria-label="Comments">
							<pptx-comments-panel
								[comments]="activeComments()"
								(add)="onCommentAdd($event)"
								(remove)="onCommentRemove($event)"
								(resolve)="onCommentResolve($event)"
							/>
						</aside>
					} @else if (canEdit() && selectedElement(); as el) {
						<aside class="pptx-ng-inspector-host" aria-label="Element properties">
							<pptx-inspector-panel [element]="el" [slideIndex]="activeSlideIndex()" />
						</aside>
					} @else if (canEdit() && activeSlide(); as sl) {
						<aside class="pptx-ng-inspector-host" aria-label="Slide properties">
							<!--
								Keyed on the active index so the inputs are recreated (and reseeded)
								only when the slide changes — never on every change-detection pass
								while typing. This keeps the on-screen keyboard open and the caret
								stable on mobile.
							-->
							@if (slidePropsKey(); as key) {
								<div class="pptx-ng-slide-props" [attr.data-slide-key]="key">
									<h2 class="pptx-ng-notes-title">Slide</h2>
									<label class="pptx-ng-prop-row">
										<span>Background</span>
										<input
											type="color"
											[attr.value]="sl.backgroundColor || '#ffffff'"
											(change)="onSlideBackground($event)"
										/>
									</label>
									<label class="pptx-ng-prop-row pptx-ng-prop-col">
										<span>Notes</span>
										<textarea
											rows="5"
											placeholder="Speaker notes…"
											(change)="onSlideNotes($event)"
											(blur)="onSlideNotes($event)"
											>{{ sl.notes || '' }}</textarea
										>
									</label>
								</div>
							}
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

			@if (canEdit() && contextMenuPos(); as m) {
				<pptx-editor-context-menu
					[x]="m.x"
					[y]="m.y"
					[slideIndex]="activeSlideIndex()"
					(closed)="contextMenuPos.set(null)"
				/>
			}

			<pptx-properties-dialog
				[open]="showProperties()"
				[properties]="coreProperties()"
				(save)="onPropertiesSave($event)"
				(close)="showProperties.set(false)"
			/>

			@if (canEdit()) {
				<pptx-hyperlink-dialog
					[open]="showHyperlink()"
					[element]="selectedElement()"
					(save)="onHyperlinkSave($event)"
					(close)="showHyperlink.set(false)"
				/>
			}

			@if (print.isDialogOpen()) {
				<pptx-print-dialog
					[slides]="displaySlidesMut()"
					[activeSlideIndex]="activeSlideIndex()"
					(print)="onPrint($event)"
					(cancel)="print.closeDialog()"
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
	/** Optional real-time collaboration config; when set, connects and shows remote cursors. */
	readonly collaboration = input<CollaborationConfig | undefined>(undefined);

	/** Fired when the active slide changes. */
	readonly activeSlideChange = output<number>();
	/** Fired when the unsaved-changes flag toggles. */
	readonly dirtyChange = output<boolean>();
	/** Fired with freshly-serialised `.pptx` bytes whenever {@link getContent} materialises the deck. */
	readonly contentChange = output<Uint8Array>();
	/** Fired when the user edits document properties in the Info dialog. */
	readonly propertiesChange = output<Partial<PptxCoreProperties>>();

	protected readonly loader = inject(LoadContentService);
	private readonly exportSvc = inject(ExportService);
	protected readonly editor = inject(EditorStateService);
	private readonly fonts = inject(EmbeddedFontsService);
	protected readonly collab = inject(CollaborationService);
	protected readonly accessibility = inject(AccessibilityService);
	protected readonly print = inject(PrintService);

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
	/** Mutable copy of the display deck for inputs that require a non-readonly array. */
	protected readonly displaySlidesMut = computed<PptxSlide[]>(() => [...this.displaySlides()]);
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
	/** Active right-docked tool panel (comments / accessibility), or null. */
	protected readonly activePanel = signal<'comments' | 'accessibility' | null>(null);
	/** Document-properties (Info) dialog visibility. */
	protected readonly showProperties = signal(false);
	/** Hyperlink-edit dialog visibility. */
	protected readonly showHyperlink = signal(false);
	/** Local overrides applied to document properties via the Info dialog. */
	private readonly coreOverride = signal<Partial<PptxCoreProperties>>({});
	/** Comments on the active slide. */
	protected readonly activeComments = computed<PptxComment[]>(
		() => this.activeSlide()?.comments ?? [],
	);
	/** Document core properties (loaded, with any in-session edits merged in). */
	protected readonly coreProperties = computed<PptxCoreProperties>(() => ({
		...(this.loader.coreProperties() ?? {}),
		...this.coreOverride(),
	}));
	/** Open editor context-menu position (client coords), or null. */
	protected readonly contextMenuPos = signal<{ x: number; y: number } | null>(null);
	/** Id of the element being inline text-edited, or null. */
	protected readonly editingId = signal<string | null>(null);
	/** Notes for the active slide, if any. */
	protected readonly activeNotes = computed(() => this.activeSlide()?.notes?.trim() || '');
	/**
	 * Stable, always-truthy key for the slide-properties form. Changes only when
	 * the active slide changes, so the `@if` recreates (and reseeds) the
	 * uncontrolled notes/background inputs on navigation — but never mid-typing.
	 * String-prefixed so slide index 0 stays truthy under `@if (…; as key)`.
	 */
	protected readonly slidePropsKey = computed(() => `slide-${this.activeSlideIndex()}`);
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

		// Inject the presentation's embedded fonts as managed `@font-face` rules.
		effect(() => {
			this.fonts.setFonts(this.loader.embeddedFonts());
		});

		// Feed the live deck to the accessibility checker.
		effect(() => {
			this.accessibility.setSlides([...this.displaySlides()]);
		});

		// Connect / disconnect real-time collaboration when the config changes.
		effect(() => {
			const config = this.collaboration();
			if (config) {
				void this.collab.connect(config);
			} else {
				this.collab.disconnect();
			}
		});
	}

	/**
	 * Serialise the current presentation to `.pptx` bytes (imperative handle).
	 * When editing, this serialises the editor's edited deck so changes persist.
	 */
	async getContent(): Promise<Uint8Array> {
		const data = this.canEdit()
			? await this.loader.saveSlides(this.editor.slides())
			: await this.loader.getContent();
		// Mirror React's imperative handle: serialising the deck also notifies the
		// host so listeners wired to (contentChange) receive the latest bytes.
		this.contentChange.emit(data);
		return data;
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

	/** Horizontal-swipe tracking start coordinates (touch begins on the canvas). */
	private swipeStartX: number | null = null;
	private swipeStartY: number | null = null;

	/**
	 * Begin tracking a horizontal swipe for slide navigation.
	 *
	 * To disambiguate a navigation swipe from an element drag, swipe-nav is only
	 * armed when editing is off (`!canEdit()`). When `canEdit()` is true,
	 * pointer/touch gestures belong to element manipulation (move/resize/rotate),
	 * so we never hijack them. The large ‹ › buttons remain available in all
	 * modes for explicit navigation.
	 */
	onMainTouchStart(event: TouchEvent): void {
		if (this.canEdit() || event.changedTouches.length !== 1) {
			this.swipeStartX = null;
			this.swipeStartY = null;
			return;
		}
		const touch = event.changedTouches[0];
		this.swipeStartX = touch.clientX;
		this.swipeStartY = touch.clientY;
	}

	/**
	 * Complete a swipe: a predominantly horizontal drag of at least the threshold
	 * navigates to the previous (swipe right) or next (swipe left) slide.
	 */
	onMainTouchEnd(event: TouchEvent): void {
		const startX = this.swipeStartX;
		const startY = this.swipeStartY;
		this.swipeStartX = null;
		this.swipeStartY = null;
		if (startX === null || startY === null || event.changedTouches.length !== 1) {
			return;
		}
		const touch = event.changedTouches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;
		const SWIPE_THRESHOLD = 50;
		// Ignore vertical-dominant gestures (scrolling) and short drags.
		if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) {
			return;
		}
		if (dx < 0) {
			this.goNext();
		} else {
			this.goPrev();
		}
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

	/** Toggle a right-docked tool panel (clicking the active one closes it). */
	togglePanel(panel: 'comments' | 'accessibility'): void {
		this.activePanel.update((current) => (current === panel ? null : panel));
	}

	/** Append a comment to the active slide (one history entry). */
	onCommentAdd(text: string): void {
		const next = addCommentToList(this.activeComments(), text, 'You');
		if (next) {
			this.editor.updateSlide(this.activeSlideIndex(), { comments: next });
		}
	}

	/** Remove a comment from the active slide. */
	onCommentRemove(id: string): void {
		const next = removeCommentFromList(this.activeComments(), id);
		if (next) {
			this.editor.updateSlide(this.activeSlideIndex(), { comments: next });
		}
	}

	/** Toggle a comment's resolved flag on the active slide. */
	onCommentResolve(id: string): void {
		const next = toggleCommentResolvedInList(this.activeComments(), id);
		if (next) {
			this.editor.updateSlide(this.activeSlideIndex(), { comments: next });
		}
	}

	/**
	 * Persist a document-properties edit from the Info dialog. Gated on
	 * {@link canEdit} — viewers may inspect properties but not mutate them
	 * (mirrors the comments / hyperlink edit paths).
	 */
	onPropertiesSave(patch: Partial<PptxCoreProperties>): void {
		if (!this.canEdit()) {
			this.showProperties.set(false);
			return;
		}
		this.coreOverride.update((current) => ({ ...current, ...patch }));
		this.propertiesChange.emit(patch);
		this.showProperties.set(false);
	}

	/** Apply a hyperlink edit to the selected element (one history entry). */
	onHyperlinkSave(patch: Partial<PptxElement>): void {
		const el = this.selectedElement();
		if (el) {
			this.editor.updateElement(this.activeSlideIndex(), el.id, patch);
		}
		this.showHyperlink.set(false);
	}

	/** Run a print job for the chosen settings, rasterising each slide off the live stage. */
	async onPrint(settings: PrintSettings): Promise<void> {
		const original = this.activeSlideIndex();
		try {
			await this.print.print(settings, [...this.displaySlides()], original, (index) =>
				this.captureSlideDataUrl(index),
			);
		} finally {
			this.activeSlideIndex.set(original);
		}
	}

	/** Flip the live stage to `index`, let it settle, and capture it to a PNG data URL. */
	private async captureSlideDataUrl(index: number): Promise<string | null> {
		this.activeSlideIndex.set(index);
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 150);
		});
		const el = this.stageElement();
		if (!el) {
			return null;
		}
		const canvas = await this.exportSvc.renderElement(el);
		return canvas.toDataURL('image/png');
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

	/** Right-click: select the element under the cursor and open the menu. */
	onContextMenu(event: { id: string | null; x: number; y: number }): void {
		if (event.id && !this.editor.isSelected(event.id)) {
			this.editor.select([event.id]);
		}
		this.contextMenuPos.set({ x: event.x, y: event.y });
	}

	/** Update the active slide's background colour. */
	onSlideBackground(event: Event): void {
		this.editor.updateSlide(this.activeSlideIndex(), {
			backgroundColor: (event.target as HTMLInputElement).value,
		});
	}

	/** Update the active slide's speaker notes. */
	onSlideNotes(event: Event): void {
		this.editor.updateSlide(this.activeSlideIndex(), {
			notes: (event.target as HTMLTextAreaElement).value,
		});
	}

	/** Commit an inline text edit: replace the element's text (one history entry). */
	onTextCommit(event: { id: string; text: string }): void {
		this.editor.updateElement(this.activeSlideIndex(), event.id, {
			text: event.text,
			textSegments: [],
		});
		this.editingId.set(null);
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
		if (mod && (event.key === 'c' || event.key === 'C')) {
			event.preventDefault();
			this.editor.copySelected(idx);
			return;
		}
		if (mod && (event.key === 'x' || event.key === 'X')) {
			event.preventDefault();
			this.editor.cutSelected(idx);
			return;
		}
		if (mod && (event.key === 'v' || event.key === 'V')) {
			event.preventDefault();
			this.editor.paste(idx);
			return;
		}
		if (mod && (event.key === 'a' || event.key === 'A')) {
			event.preventDefault();
			this.editor.selectAll(idx);
			return;
		}
		if (mod && (event.key === 'g' || event.key === 'G')) {
			event.preventDefault();
			if (event.shiftKey) {
				this.editor.ungroupSelected(idx);
			} else {
				this.editor.groupSelected(idx);
			}
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
