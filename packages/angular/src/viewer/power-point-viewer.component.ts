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
import { applyThemeToData, hasShapeProperties } from 'pptx-viewer-core';
import type {
	InkPptxElement,
	PptxComment,
	PptxCoreProperties,
	PptxData,
	PptxElement,
	PptxSlide,
	PptxThemePreset,
} from 'pptx-viewer-core';

import type { ViewerTheme } from '../internal/shared';
import { themeStyle } from '../theme/viewer-theme';
import { AccessibilityPanelComponent } from './accessibility-panel.component';
import { AccessibilityService } from './accessibility.service';
import { BroadcastDialogComponent } from './broadcast-dialog.component';
import type { BroadcastConfig } from './broadcast-helpers';
import { CollaborationCursorsComponent } from './collaboration-cursors.component';
import { CollaborationService } from './collaboration.service';
import {
	addCommentToList,
	removeCommentFromList,
	toggleCommentResolvedInList,
} from './comments-helpers';
import { CommentsPanelComponent } from './comments-panel.component';
import { createCustomShow } from './custom-shows-helpers';
import type { CustomShow } from './custom-shows-helpers';
import { CustomShowsComponent } from './custom-shows.component';
import { EditorContextMenuComponent } from './editor-context-menu.component';
import { newTextElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { EditorToolbarComponent } from './editor-toolbar.component';
import { EmbeddedFontsService } from './embedded-fonts.service';
import { slideFileName } from './export-helpers';
import { ExportService } from './export.service';
import { openNativeEyeDropper } from './eyedropper';
import { FindBarComponent } from './find-bar.component';
import { FindReplaceBarComponent } from './find-replace-bar.component';
import type { FindEvent, ReplaceEvent } from './find-replace-bar.component';
import { findInSlides, replaceInSlides, replaceMatch } from './find-replace-helpers';
import type { FindResult } from './find-replace-helpers';
import { applyFormatToElement, copyFormatFromElement, hasCopyableFormat } from './format-painter';
import type { CopiedFormat } from './format-painter';
import { HyperlinkDialogComponent } from './hyperlink-dialog.component';
import { InspectorPanelComponent } from './inspector-panel.component';
import { IsMobileService } from './is-mobile';
import { LoadContentService } from './load-content.service';
import { MobileBottomBarComponent } from './mobile-bottom-bar.component';
import type { MobileBarSheet } from './mobile-bottom-bar.component';
import { MobileMenuSheetComponent } from './mobile-menu-sheet.component';
import { MobileSlidesSheetComponent } from './mobile-slides-sheet.component';
import { MobileToolbarComponent } from './mobile-toolbar.component';
import { NotesPanelComponent } from './notes-panel.component';
import { PresentationOverlayComponent } from './presentation-overlay.component';
import { PresenterViewComponent } from './presenter-view.component';
import { PrintDialogComponent } from './print-dialog.component';
import type { PrintSettings } from './print-helpers';
import { PrintService } from './print.service';
import { PropertiesDialogComponent } from './properties-dialog.component';
import { RibbonComponent } from './ribbon.component';
import { SelectionPaneComponent } from './selection-pane.component';
import { ShareDialogComponent } from './share-dialog.component';
import { SignaturesPanelComponent } from './signatures-panel.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
import { SlidesPanelComponent } from './slides-panel.component';
import { setCellText } from './table-data-helpers';
import type { TableCellCommit } from './table-renderer.component';
import { ThemeGalleryComponent } from './theme-gallery.component';
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
		IsMobileService,
	],
	imports: [
		NgClass,
		NgStyle,
		SlideCanvasComponent,
		PresentationOverlayComponent,
		PresenterViewComponent,
		SlideSorterOverlayComponent,
		FindBarComponent,
		FindReplaceBarComponent,
		InspectorPanelComponent,
		SlidesPanelComponent,
		EditorToolbarComponent,
		EditorContextMenuComponent,
		CommentsPanelComponent,
		SignaturesPanelComponent,
		AccessibilityPanelComponent,
		CollaborationCursorsComponent,
		PropertiesDialogComponent,
		HyperlinkDialogComponent,
		PrintDialogComponent,
		ShareDialogComponent,
		BroadcastDialogComponent,
		MobileBottomBarComponent,
		MobileMenuSheetComponent,
		MobileSlidesSheetComponent,
		MobileToolbarComponent,
		NotesPanelComponent,
		RibbonComponent,
		ThemeGalleryComponent,
		SelectionPaneComponent,
		CustomShowsComponent,
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
				@if (!mobile.isMobile()) {
					<pptx-ribbon
					[slideIndex]="activeSlideIndex()"
					[slideCount]="slideCount()"
					[selectedElement]="selectedElement()"
					[zoomPercent]="zoomPercent()"
					[formatPainterActive]="formatPainterActive()"
					[canActivateFormatPainter]="canActivateFormatPainter()"
					[exporting]="exporting()"
					(prev)="goPrev()"
					(next)="goNext()"
					(zoomIn)="zoomIn()"
					(zoomOut)="zoomOut()"
					(zoomReset)="zoomReset()"
					(find)="showFind.set(true)"
					(present)="present()"
					(presenter)="presentPresenter()"
					(share)="showShare.set(true)"
					(broadcast)="showBroadcast.set(true)"
					(info)="showProperties.set(true)"
					(print)="print.openDialog()"
					(comments)="togglePanel('comments')"
					(a11y)="togglePanel('accessibility')"
					(link)="showHyperlink.set(true)"
					(openSorter)="showSorter.set(true)"
					(toggleNotes)="toggleNotes()"
					(toggleFormatPainter)="toggleFormatPainter()"
					(exportPng)="exportPng()"
					(exportPdf)="exportPdf()"
					(exportGif)="exportGif()"
					(exportVideo)="exportVideo()"
					(replace)="openFindReplace()"
					(toggleInspector)="activePanel.set(null)"
					(drawToolChange)="onDrawToolChange($event)"
					[showGrid]="showGrid()"
					[showRulers]="showRulers()"
					[showGuides]="showGuides()"
					[snapToGrid]="snapToGrid()"
					[eyedropperActive]="eyedropperActive()"
					(toggleGrid)="showGrid.update(v => !v)"
					(toggleRulers)="showRulers.update(v => !v)"
					(toggleGuides)="showGuides.update(v => !v)"
					(toggleSnapToGrid)="snapToGrid.update(v => !v)"
					(toggleEyedropper)="onToggleEyedropper()"
					[themeGalleryOpen]="showThemeGallery()"
					(toggleThemeGallery)="showThemeGallery.update(v => !v)"
					(toggleSelectionPane)="togglePanel('selection')"
					(openCustomShows)="showCustomShows.set(true)"
					/>
				}

				@if (mobile.isMobile()) {
					<pptx-mobile-toolbar
						[canEdit]="canEdit()"
						[canUndo]="editor.canUndo()"
						[canRedo]="editor.canRedo()"
						[canPresent]="slideCount() > 0"
						[menuOpen]="mobileSheet() === 'menu'"
						(toggleMenu)="mobileSheet.set(mobileSheet() === 'menu' ? null : 'menu')"
						(undo)="editor.undo()"
						(redo)="editor.redo()"
						(save)="saveAsPptx()"
						(present)="present()"
					/>
				}

				<div class="pptx-ng-body">
					@if (canEdit() && !mobile.isMobile()) {
						<pptx-slides-panel
							[canvasSize]="loader.canvasSize()"
							[mediaDataUrls]="loader.mediaDataUrls()"
							[activeIndex]="activeSlideIndex()"
							(select)="goTo($event)"
						/>
					} @else if (!canEdit()) {
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
							[showGrid]="showGrid()"
							[showRulers]="showRulers()"
							[showGuides]="showGuides()"
							[snapToGrid]="snapToGrid()"
							[snapToGuides]="showGuides()"
							[drawTool]="activeDrawTool()"
							[drawColor]="activeDrawColor()"
							[drawWidth]="activeDrawWidth()"
							(elementSelect)="onElementSelect($event)"
							(backgroundClick)="onBackgroundClick()"
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
							(inkStrokeComplete)="onInkStrokeComplete($event)"
							(eraserHit)="onEraserHit($event)"
							(cellCommit)="onTableCellCommit($event)"
						/>
						@if (collab.connected()) {
							<pptx-collaboration-cursors [cursors]="collab.cursors()" [zoom]="zoom()" />
						}
						@if (showNotes() && !mobile.isMobile()) {
							<aside class="pptx-ng-notes" aria-label="Speaker notes">
								<pptx-notes-panel
									[slide]="activeSlide()"
									(update)="onNotesUpdate($event)"
								/>
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
					} @else if (activePanel() === 'signatures') {
						<aside class="pptx-ng-inspector-host" aria-label="Digital signatures">
							<pptx-signatures-panel [signatures]="loader.signatures()" />
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
					} @else if (activePanel() === 'selection' && canEdit()) {
						<aside class="pptx-ng-inspector-host" aria-label="Selection pane">
							<pptx-selection-pane
								[elements]="activeSlide()?.elements ?? []"
								[selectedIds]="editor.selectedIds()"
								(selectElement)="editor.select([$event])"
								(bringForward)="onSelectionPaneBringForward($event)"
								(sendBackward)="onSelectionPaneSendBackward($event)"
								(toggleHidden)="onToggleElementHidden($event)"
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

				@if (!mobile.isMobile()) {
					<footer
						class="flex items-center justify-between border-t border-border bg-secondary/50 px-3 py-1 text-[11px] text-muted-foreground"
					>
						<div class="flex items-center gap-3">
							<span>Slide {{ slideCount() === 0 ? 0 : activeSlideIndex() + 1 }} of {{ slideCount() }}</span>
							@if (canEdit()) {
								<span>{{ editor.dirty() ? 'Unsaved changes' : 'All saved' }}</span>
							}
						</div>
						<div class="flex items-center gap-1">
							<button type="button" class="pptx-rb-icon" aria-label="Speaker notes" (click)="toggleNotes()">≣</button>
							<button type="button" class="pptx-rb-icon" aria-label="Slide sorter" (click)="showSorter.set(true)">▦</button>
							<span class="mx-1 h-4 w-px self-center bg-border/50"></span>
							<button type="button" class="pptx-rb-icon" aria-label="Zoom out" (click)="zoomOut()">−</button>
							<button
								type="button"
								class="pptx-rb-pill min-w-12 justify-center tabular-nums"
								(click)="zoomReset()"
							>
								{{ zoomPercent() }}%
							</button>
							<button type="button" class="pptx-rb-icon" aria-label="Zoom in" (click)="zoomIn()">+</button>
						</div>
					</footer>
				}
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
					[slides]="presentationSlides()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[startIndex]="presentationStartIndex()"
					(indexChange)="onPresentationIndexChange($event)"
					(closed)="presenting.set(false)"
				/>
			}

			@if (presentingPresenter()) {
				<pptx-presenter-view
					[slides]="loader.slides()"
					[currentSlideIndex]="activeSlideIndex()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[presentationStartTime]="presenterStartTime()"
					[isAudienceWindowOpen]="presenting()"
					(movePresentationSlide)="goTo(activeSlideIndex() + $event)"
					(openAudienceWindow)="present()"
					(closeAudienceWindow)="presenting.set(false)"
					(exit)="exitPresenter()"
				/>
			}

			@if (showFind()) {
				<pptx-find-bar
					[slides]="loader.slides()"
					(navigate)="goTo($event)"
					(closed)="showFind.set(false)"
				/>
			}

			@if (showFindReplace()) {
				<pptx-find-replace-bar
					[matchCount]="findResults().length"
					[matchIndex]="findActiveIndex()"
					(find)="onFindReplaceFind($event)"
					(navigate)="onFindReplaceNavigate($event)"
					(replaceOne)="onFindReplaceReplaceOne($event)"
					(replaceAll)="onFindReplaceReplaceAll($event)"
					(close)="showFindReplace.set(false)"
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

			<pptx-theme-gallery
				[open]="showThemeGallery()"
				[activeName]="activeThemeName()"
				(applyTheme)="applyThemePreset($event)"
				(close)="showThemeGallery.set(false)"
			/>

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

			<pptx-share-dialog
				[open]="showShare()"
				[active]="collab.connected()"
				(start)="onShareStart($event)"
				(stop)="onShareStop()"
				(close)="showShare.set(false)"
			/>

			<pptx-broadcast-dialog
				[open]="showBroadcast()"
				[active]="collab.connected()"
				(start)="onBroadcastStart($event)"
				(stop)="onBroadcastStop()"
				(close)="showBroadcast.set(false)"
			/>

			@if (canEdit()) {
				<pptx-custom-shows
					[open]="showCustomShows()"
					[slides]="displaySlidesMut()"
					[customShows]="customShows()"
					[activeCustomShowId]="activeCustomShowId()"
					(create)="onCustomShowCreate($event)"
					(remove)="onCustomShowRemove($event)"
					(update)="onCustomShowUpdate($event)"
					(setActive)="activeCustomShowId.set($event)"
					(close)="showCustomShows.set(false)"
				/>
			}

			<!-- ── Mobile chrome (narrow / touch viewports only) ─────────────── -->
			@if (mobile.isMobile() && !loader.loading() && !loader.error()) {
				<pptx-mobile-slides-sheet
					[open]="mobileSheet() === 'slides'"
					[slides]="displaySlidesMut()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[activeIndex]="activeSlideIndex()"
					(jumpToSlide)="goTo($event)"
					(closed)="mobileSheet.set(null)"
				/>

				<pptx-mobile-menu-sheet
					[open]="mobileSheet() === 'menu'"
					[slideCount]="slideCount()"
					[exporting]="exporting()"
					[showNotes]="showNotes()"
					[canEdit]="canEdit()"
					(closed)="mobileSheet.set(null)"
					(openFind)="showFind.set(true)"
					(openSorter)="showSorter.set(true)"
					(toggleNotes)="toggleNotes()"
					(insertText)="onMobileInsert()"
					(present)="present()"
					(savePptx)="saveAsPptx()"
					(exportPng)="exportPng()"
					(exportPdf)="exportPdf()"
					(exportGif)="exportGif()"
					(exportVideo)="exportVideo()"
					(print)="print.openDialog()"
				/>

				<!-- Mobile speaker-notes sheet (toggled from the bottom bar). Rendered
				     inside the isMobile() gate so it stays mounted when the on-screen
				     keyboard shrinks the viewport (coarse pointer keeps isMobile true).
				     Docked in normal flow *above* the bottom bar (not position:fixed) so it
				     lives inside the app's layout-viewport bounds — a fixed sheet anchored to
				     the visual viewport ends up below the document on mobile (100vh layout
				     viewport < dynamic viewport), leaving its textarea unreachable to taps.
				     Mirrors React, where the notes panel is a flow sibling below the canvas. -->
				@if (showNotes()) {
					<div class="pptx-ng-mobile-notes-sheet">
						<pptx-notes-panel [slide]="activeSlide()" (update)="onNotesUpdate($event)" />
					</div>
				}

				<pptx-mobile-bottom-bar
					[slideCount]="slideCount()"
					[commentCount]="activeComments().length"
					[activeSheet]="mobileBarSheet()"
					(openSlides)="mobileSheet.set(mobileSheet() === 'slides' ? null : 'slides')"
					(insert)="onMobileInsert()"
					(openFormat)="onMobileFormat()"
					(openComments)="togglePanel('comments')"
					(notes)="toggleNotes()"
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
	protected readonly mobile = inject(IsMobileService);

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
	/** Presenter-view (speaker) overlay visibility. */
	protected readonly presentingPresenter = signal(false);
	/** Epoch ms when presenter view started (drives the elapsed timer). */
	protected readonly presenterStartTime = signal<number | null>(null);
	/** Slide-sorter grid overlay visibility. */
	protected readonly showSorter = signal(false);
	/** Open mobile bottom-sheet (slides / menu), or null. */
	protected readonly mobileSheet = signal<'slides' | 'menu' | null>(null);
	/** Speaker-notes strip visibility. */
	protected readonly showNotes = signal(false);
	/** Find-in-slides bar visibility. */
	protected readonly showFind = signal(false);

	/** Find-and-replace bar state (edit mode only). */
	protected readonly showFindReplace = signal(false);

	// ── Draw tool state (forwarded to slide-canvas) ───────────────────────────
	/** Active drawing tool (from the ribbon Draw tab). */
	protected readonly activeDrawTool = signal<
		'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform'
	>('select');
	/** Active ink stroke colour. */
	protected readonly activeDrawColor = signal<string>('#000000');
	/** Active ink stroke width in stage pixels. */
	protected readonly activeDrawWidth = signal<number>(3);
	protected readonly findResults = signal<readonly FindResult[]>([]);
	protected readonly findActiveIndex = signal(-1);
	private findMatchCase = false;

	/** Active right-docked tool panel (comments / accessibility / selection), or null. */
	protected readonly activePanel = signal<
		'comments' | 'accessibility' | 'signatures' | 'selection' | null
	>(null);

	/**
	 * Which mobile bottom-bar slot is currently "active" (highlighted). The
	 * comments panel maps to the Comments slot; an open notes strip maps to
	 * Notes; the open slides sheet maps to Slides; otherwise, when an element is
	 * selected the inspector (Format) is showing inline so it maps to inspector.
	 */
	protected readonly mobileBarSheet = computed<MobileBarSheet>(() => {
		if (this.mobileSheet() === 'slides') {
			return 'slides';
		}
		if (this.activePanel() === 'comments') {
			return 'comments';
		}
		if (this.showNotes()) {
			return 'notes';
		}
		if (this.selectedElement()) {
			return 'inspector';
		}
		return null;
	});
	/** Document-properties (Info) dialog visibility. */
	protected readonly showProperties = signal(false);
	/** Hyperlink-edit dialog visibility. */
	protected readonly showHyperlink = signal(false);
	/** Share (collaboration) dialog visibility. */
	protected readonly showShare = signal(false);
	/** Broadcast dialog visibility. */
	protected readonly showBroadcast = signal(false);
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
	/** Whether the dot-grid overlay is visible on the editor canvas. */
	protected readonly showGrid = signal(false);
	/** Whether ruler strips are visible on the editor canvas. */
	protected readonly showRulers = signal(false);
	/** Whether center-crosshair guide lines are visible on the editor canvas. */
	protected readonly showGuides = signal(false);
	/** Whether snap-to-grid is active on the editor canvas. */
	protected readonly snapToGrid = signal(false);
	/** Whether the eyedropper is currently active. */
	protected readonly eyedropperActive = signal(false);
	/** Whether the theme-gallery overlay is visible (Design → Browse Themes). */
	protected readonly showThemeGallery = signal(false);
	/** Whether the custom-shows dialog is open. */
	protected readonly showCustomShows = signal(false);
	/** The list of user-defined custom shows for this session. */
	protected readonly customShows = signal<readonly CustomShow[]>([]);
	/** The id of the currently active custom show, or null. */
	protected readonly activeCustomShowId = signal<string | null>(null);

	/**
	 * The active custom show's slides, in its defined order, or null when no show
	 * is active (or it resolves to nothing). Used to filter the presentation.
	 */
	private resolveActiveShowSlides(): PptxSlide[] | null {
		const id = this.activeCustomShowId();
		if (!id) {
			return null;
		}
		const show = this.customShows().find((s) => s.id === id);
		if (!show || show.slideIds.length === 0) {
			return null;
		}
		const byId = new Map(this.loader.slides().map((s) => [s.id, s]));
		const picked = show.slideIds
			.map((sid) => byId.get(sid))
			.filter((s): s is PptxSlide => s !== undefined);
		return picked.length > 0 ? picked : null;
	}

	/** Slides shown in presentation mode: the active custom show, else the full deck. */
	protected readonly presentationSlides = computed<PptxSlide[]>(
		() => this.resolveActiveShowSlides() ?? [...this.loader.slides()],
	);

	/** Start index into {@link presentationSlides}: first slide of a custom show, else the active slide. */
	protected readonly presentationStartIndex = computed<number>(() =>
		this.resolveActiveShowSlides() ? 0 : this.activeSlideIndex(),
	);
	/** The `name` property of the loaded deck's theme (for check-mark in gallery). */
	protected readonly activeThemeName = computed<string | undefined>(
		() => this.loader.theme()?.name,
	);
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

	// ── Format painter ─────────────────────────────────────────────────────
	// Arm by copying the selected element's format; the next element click applies
	// it. Escape or an empty-canvas click cancels (mirrors React/Vue).
	/** True while the painter is armed (next element click applies the copied format). */
	protected readonly formatPainterActive = signal(false);
	/** Format copied from the source element when the painter was armed. */
	private copiedFormat: CopiedFormat | null = null;
	/** Whether the painter can be armed: exactly one selected element with copyable format. */
	protected readonly canActivateFormatPainter = computed(() =>
		hasCopyableFormat(this.selectedElement()),
	);

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

	/**
	 * Serialise the current deck and trigger a browser download of the `.pptx`.
	 * Surfaced on the mobile toolbar so saving is reachable without the desktop
	 * ribbon's File tab.
	 */
	async saveAsPptx(): Promise<void> {
		const bytes = await this.getContent();
		this.exportSvc.savePptx(bytes, 'presentation.pptx');
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

	// ── Theme gallery (Design tab) ─────────────────────────────────────────────

	/**
	 * Apply a built-in theme preset to the whole deck.
	 *
	 * Mirrors Vue's `applyThemePreset()`: re-resolves slide colours via core's
	 * pure `applyThemeToData`, then writes the updated slides + theme metadata
	 * into `EditorStateService` as a single undoable entry.  Also refreshes the
	 * `loader.themeColorMap` so subsequent theme switches start from the correct
	 * baseline.
	 */
	applyThemePreset(preset: PptxThemePreset): void {
		const currentSlides = this.editor.slides();
		const result = applyThemeToData(
			{
				slides: [...currentSlides],
				theme: this.loader.theme() ?? {},
				themeColorMap: this.loader.themeColorMap() ?? {},
			} as unknown as PptxData,
			preset.colorScheme,
			preset.fontScheme,
			preset.name,
		);
		// Write slides back through the editor (records undo history).
		this.editor.applyReplacement(result.slides, `Apply theme "${preset.name}"`);
		// Update the loader's theme signals so the check-mark and future switches are correct.
		this.loader.theme.set(result.theme);
		this.loader.themeColorMap.set(result.themeColorMap);
		this.showThemeGallery.set(false);
	}

	// ── Find & replace (edit mode) ─────────────────────────────────────────────

	/** Open the find/replace bar (mutually exclusive with the find-only bar). */
	protected openFindReplace(): void {
		this.showFind.set(false);
		this.showFindReplace.set(true);
	}

	/** Re-run the search over the editable deck and refresh the match list. */
	private refreshFindResults(query: string): void {
		if (query.length === 0) {
			this.findResults.set([]);
			this.findActiveIndex.set(-1);
			return;
		}
		const results = findInSlides(this.editor.slides(), query, { matchCase: this.findMatchCase });
		this.findResults.set(results);
		this.findActiveIndex.set(results.length > 0 ? 0 : -1);
		if (results.length > 0) {
			this.goTo(results[0].slideIndex);
		}
	}

	protected onFindReplaceFind(evt: FindEvent): void {
		this.findMatchCase = evt.matchCase;
		this.refreshFindResults(evt.query);
	}

	protected onFindReplaceNavigate(dir: 1 | -1): void {
		const results = this.findResults();
		if (results.length === 0) {
			return;
		}
		const next = (this.findActiveIndex() + dir + results.length) % results.length;
		this.findActiveIndex.set(next);
		this.goTo(results[next].slideIndex);
	}

	protected onFindReplaceReplaceOne(evt: ReplaceEvent): void {
		const results = this.findResults();
		const idx = this.findActiveIndex();
		if (idx < 0 || idx >= results.length) {
			return;
		}
		const updated = replaceMatch(this.editor.slides(), results, idx, evt.replacement);
		this.editor.applyReplacement(updated.slides, 'Replace');
		this.refreshFindResults(evt.query);
	}

	protected onFindReplaceReplaceAll(evt: ReplaceEvent): void {
		const updated = replaceInSlides(this.editor.slides(), evt.query, evt.replacement, {
			matchCase: this.findMatchCase,
		});
		if (updated.replacements > 0) {
			this.editor.applyReplacement(updated.slides, 'Replace all');
		}
		this.refreshFindResults(evt.query);
	}

	// ── Collaboration: share & broadcast ───────────────────────────────────────

	/** Start a real-time collaboration session from the share dialog config. */
	protected onShareStart(config: CollaborationConfig): void {
		void this.collab.connect(config);
		this.showShare.set(false);
	}

	protected onShareStop(): void {
		this.collab.disconnect();
	}

	/** Start broadcasting (presenter as session owner) from the broadcast config. */
	protected onBroadcastStart(config: BroadcastConfig): void {
		const collabConfig: CollaborationConfig = {
			roomId: config.roomId,
			serverUrl: config.serverUrl,
			userName: 'Presenter',
			role: 'owner',
		};
		void this.collab.connect(collabConfig);
		this.showBroadcast.set(false);
	}

	protected onBroadcastStop(): void {
		this.collab.disconnect();
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
			// Deselect first so no edit chrome (selection outline / resize + rotate
			// "Adjust shape" handles) leaks over the slideshow.
			this.editor.clearSelection();
			this.editingId.set(null);
			this.presenting.set(true);
		}
	}

	/**
	 * Map a presentation-overlay index back to the full-deck `activeSlideIndex`.
	 * The overlay's index is relative to {@link presentationSlides} (a custom show
	 * may filter/reorder the deck), so resolve by slide id to keep the editor
	 * selection correct when the show closes.
	 */
	onPresentationIndexChange(index: number): void {
		const target = this.presentationSlides()[index];
		if (!target) {
			return;
		}
		const fullIndex = this.loader.slides().findIndex((s) => s.id === target.id);
		this.activeSlideIndex.set(fullIndex >= 0 ? fullIndex : index);
	}

	/** Open the presenter (speaker) view — current+next slide, notes, timer. */
	presentPresenter(): void {
		if (this.slideCount() > 0) {
			this.presenterStartTime.set(Date.now());
			this.presentingPresenter.set(true);
		}
	}

	/** Close the presenter view (and any audience overlay it opened). */
	exitPresenter(): void {
		this.presentingPresenter.set(false);
		this.presenting.set(false);
	}
	/** Toggle the speaker-notes strip. */
	toggleNotes(): void {
		this.showNotes.update((v) => !v);
	}

	/**
	 * Mobile quick-insert: drop a text box on the active slide. Mirrors React's
	 * mobile bottom-bar "Insert" slot (a text box is the most common starter
	 * element on a phone; the full Insert section lives in the top-bar menu).
	 */
	protected onMobileInsert(): void {
		if (!this.canEdit() || this.slideCount() === 0) {
			return;
		}
		// Close any open mobile sheet so the new element is visible on the canvas.
		this.mobileSheet.set(null);
		this.editor.addElement(this.activeSlideIndex(), newTextElement());
	}

	/**
	 * Mobile "Format" slot: surface the inspector for the current selection. The
	 * inspector renders inline (below the canvas) whenever an element is selected
	 * and no other right-docked panel is open, so closing any open panel reveals
	 * it. With nothing selected this is a no-op (the slide-properties panel shows
	 * instead).
	 */
	protected onMobileFormat(): void {
		this.activePanel.set(null);
		this.mobileSheet.set(null);
	}

	/** Toggle a right-docked tool panel (clicking the active one closes it). */
	togglePanel(panel: 'comments' | 'accessibility' | 'signatures' | 'selection'): void {
		this.activePanel.update((current) => (current === panel ? null : panel));
	}

	/** Receive draw-tool state changes from the ribbon Draw tab. */
	protected onDrawToolChange(state: { tool: string; color: string; width: number }): void {
		this.activeDrawTool.set(state.tool as 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform');
		this.activeDrawColor.set(state.color);
		this.activeDrawWidth.set(state.width);
	}

	/** Receive a completed ink stroke and append it to the active slide. */
	protected onInkStrokeComplete(ink: InkPptxElement): void {
		if (!this.canEdit()) {
			return;
		}
		this.editor.addElement(this.activeSlideIndex(), ink);
	}

	/** Receive an eraser hit and delete the targeted ink element. */
	protected onEraserHit(id: string): void {
		if (!this.canEdit()) {
			return;
		}
		this.editor.select([id]);
		this.editor.deleteSelected(this.activeSlideIndex());
	}

	/**
	 * Activate the native EyeDropper API to pick a colour from the screen.
	 * When a shape/text/connector/image element is selected, applies the colour
	 * to its fill. Otherwise copies the colour to the clipboard. No-ops when
	 * the EyeDropper API is not available or the user cancels.
	 */
	protected async onToggleEyedropper(): Promise<void> {
		this.eyedropperActive.set(true);
		try {
			const color = await openNativeEyeDropper();
			if (color) {
				const sel = this.selectedElement();
				const idx = this.activeSlideIndex();
				if (sel !== null && hasShapeProperties(sel)) {
					this.editor.updateElement(idx, sel.id, {
						shapeStyle: { ...sel.shapeStyle, fillColor: color },
					} as Partial<PptxElement>);
				} else {
					await navigator.clipboard.writeText(color).catch(() => undefined);
				}
			}
		} finally {
			this.eyedropperActive.set(false);
		}
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
		// The armed format painter intercepts the next element click: apply the
		// copied format to the target, then disarm (no selection change).
		if (this.formatPainterActive()) {
			this.applyFormatToTarget(event.id);
			this.cancelFormatPainter();
			return;
		}
		if (event.additive) {
			this.editor.toggleSelect(event.id, true);
		} else if (!this.editor.isSelected(event.id)) {
			this.editor.select([event.id]);
		}
	}

	/** Empty-stage press: disarm the painter if armed, else clear the selection. */
	onBackgroundClick(): void {
		if (this.formatPainterActive()) {
			this.cancelFormatPainter();
			return;
		}
		this.editor.clearSelection();
	}

	/** Toggle the format painter: arm from the current selection, or disarm. */
	toggleFormatPainter(): void {
		if (this.formatPainterActive()) {
			this.cancelFormatPainter();
			return;
		}
		const source = this.selectedElement();
		if (!source || !hasCopyableFormat(source)) {
			return;
		}
		this.copiedFormat = copyFormatFromElement(source);
		this.formatPainterActive.set(true);
	}

	/** Disarm the painter and drop the copied format. */
	cancelFormatPainter(): void {
		this.formatPainterActive.set(false);
		this.copiedFormat = null;
	}

	/** Apply the copied format to a target element (shape/text style only; one history entry). */
	private applyFormatToTarget(id: string): void {
		const format = this.copiedFormat;
		const target = this.activeSlide()?.elements.find((e) => e.id === id);
		if (!format || !target) {
			return;
		}
		const updated = applyFormatToElement(target, format) as unknown as Record<string, unknown>;
		const patch: Record<string, unknown> = {};
		if (format.shapeStyle && updated['shapeStyle'] !== undefined) {
			patch['shapeStyle'] = updated['shapeStyle'];
		}
		if (format.textStyle && updated['textStyle'] !== undefined) {
			patch['textStyle'] = updated['textStyle'];
		}
		if (Object.keys(patch).length > 0) {
			this.editor.updateElement(this.activeSlideIndex(), id, patch as Partial<PptxElement>);
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

	/** Update the active slide's speaker notes from the editable NotesPanel. */
	onNotesUpdate(notes: string): void {
		this.editor.updateSlide(this.activeSlideIndex(), { notes });
	}

	// ── Selection pane handlers ────────────────────────────────────────────────

	onSelectionPaneBringForward(id: string): void {
		this.editor.select([id]);
		this.editor.bringSelectedForward(this.activeSlideIndex());
	}

	onSelectionPaneSendBackward(id: string): void {
		this.editor.select([id]);
		this.editor.sendSelectedBackward(this.activeSlideIndex());
	}

	onToggleElementHidden(id: string): void {
		const el = this.activeSlide()?.elements.find((e) => e.id === id);
		if (el) {
			this.editor.updateElement(this.activeSlideIndex(), id, { hidden: !el.hidden });
		}
	}

	// ── Custom shows handlers ──────────────────────────────────────────────────

	onCustomShowCreate(show: { name: string; slideIds: string[] }): void {
		this.customShows.update((list) => [...list, createCustomShow(show.name, show.slideIds)]);
	}

	onCustomShowRemove(id: string): void {
		this.customShows.update((list) => list.filter((s) => s.id !== id));
		if (this.activeCustomShowId() === id) {
			this.activeCustomShowId.set(null);
		}
	}

	onCustomShowUpdate(show: { id: string; name: string; slideIds: string[] }): void {
		this.customShows.update((list) =>
			list.map((s) => (s.id === show.id ? { ...s, name: show.name, slideIds: show.slideIds } : s)),
		);
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
	 * Commit a table cell's inline text edit. Finds the table element on the
	 * active slide, rebuilds its `tableData` with the new cell text, and patches
	 * it through the editor (which records undo history).
	 */
	protected onTableCellCommit(event: { id: string; commit: TableCellCommit }): void {
		if (!this.canEdit()) {
			return;
		}
		const el = this.activeSlide()?.elements.find((e) => e.id === event.id);
		if (!el || el.type !== 'table') {
			return;
		}
		const updated = setCellText(
			el,
			event.commit.rowIndex,
			event.commit.colIndex,
			event.commit.text,
		);
		this.editor.updateElement(this.activeSlideIndex(), event.id, {
			tableData: updated.tableData,
		});
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

		// Escape disarms the format painter first (mirrors React/Vue).
		if (event.key === 'Escape' && this.formatPainterActive()) {
			event.preventDefault();
			this.cancelFormatPainter();
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

	/** Render every slide to a canvas (each made the live stage in turn). */
	private async renderAllSlideCanvases(): Promise<HTMLCanvasElement[]> {
		const total = this.slideCount();
		const original = this.activeSlideIndex();
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
		} finally {
			this.activeSlideIndex.set(original);
		}
		return canvases;
	}

	/** Export every slide as an animated GIF (2s per slide). */
	async exportGif(): Promise<void> {
		if (this.slideCount() === 0 || this.exporting()) {
			return;
		}
		this.exporting.set(true);
		try {
			const canvases = await this.renderAllSlideCanvases();
			this.exportSvc.exportCanvasesToGif(canvases, 2000, 'presentation.gif');
		} finally {
			this.exporting.set(false);
		}
	}

	/** Export every slide as a WebM video (3s per slide) via MediaRecorder. */
	async exportVideo(): Promise<void> {
		if (this.slideCount() === 0 || this.exporting()) {
			return;
		}
		this.exporting.set(true);
		try {
			const canvases = await this.renderAllSlideCanvases();
			await this.exportSvc.exportCanvasesToWebm(canvases, 3000, 'presentation.webm');
		} finally {
			this.exporting.set(false);
		}
	}
}
