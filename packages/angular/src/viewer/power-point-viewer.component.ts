import { NgClass, NgStyle } from '@angular/common';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
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
import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	openPptxFile,
	recordProgressPercent,
	slideProgressPercent,
	slideStatusLabel,
} from '../internal/shared';
import { themeStyle } from '../theme/viewer-theme';
import { AccessibilityPanelComponent } from './accessibility-panel.component';
import { AccessibilityService } from './accessibility.service';
import { BroadcastDialogComponent } from './broadcast-dialog.component';
import { buildBroadcastViewerUrl } from './broadcast-helpers';
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
import { ExportProgressModalComponent } from './export-progress-modal.component';
import { ExportService } from './export.service';
import { openNativeEyeDropper } from './eyedropper';
import { FieldContextService } from './field-context.service';
import { FindBarComponent } from './find-bar.component';
import { FindReplaceBarComponent } from './find-replace-bar.component';
import type { FindEvent, ReplaceEvent } from './find-replace-bar.component';
import { findInSlides, replaceInSlides, replaceMatch } from './find-replace-helpers';
import type { FindResult } from './find-replace-helpers';
import { applyFormatToElement, copyFormatFromElement, hasCopyableFormat } from './format-painter';
import type { CopiedFormat } from './format-painter';
import { HyperlinkDialogComponent } from './hyperlink-dialog.component';
import { InsertSmartArtDialogComponent } from './insert-smart-art-dialog.component';
import type { SmartArtInsertEvent } from './insert-smart-art-dialog.component';
import { InspectorPanelComponent } from './inspector-panel.component';
import { IsMobileService } from './is-mobile';
import { LoadContentService } from './load-content.service';
import { MobileBottomBarComponent } from './mobile-bottom-bar.component';
import type { MobileBarSheet } from './mobile-bottom-bar.component';
import { MobileMenuSheetComponent } from './mobile-menu-sheet.component';
import { MobilePresenterViewComponent } from './mobile-presenter-view.component';
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
import { buildShareUrl } from './share-helpers';
import { SignaturesPanelComponent } from './signatures-panel.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
import { SlidesPanelComponent } from './slides-panel.component';
import { SmartArt3DService } from './smart-art-3d.service';
import { buildSmartArtInsertElement } from './smart-art-insert-helpers';
import { setCellText } from './table-data-helpers';
import type { TableCellCommit } from './table-renderer.component';
import { buildSaveSlides } from './template-mode';
import { ThemeGalleryComponent } from './theme-gallery.component';
import { attachTouchGestures } from './touch-gestures';
import type { CollaborationConfig } from './types';

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;

/**
 * PowerPointViewerComponent: Angular port of the React `PowerPointViewer.tsx`
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
		SmartArt3DService,
		FieldContextService,
	],
	imports: [
		NgClass,
		NgStyle,
		SlideCanvasComponent,
		PresentationOverlayComponent,
		PresenterViewComponent,
		MobilePresenterViewComponent,
		SlideSorterOverlayComponent,
		FindBarComponent,
		FindReplaceBarComponent,
		InspectorPanelComponent,
		SlidesPanelComponent,
		EditorToolbarComponent,
		EditorContextMenuComponent,
		ExportProgressModalComponent,
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
		InsertSmartArtDialogComponent,
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
					[canEdit]="canEdit()"
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
					(openFile)="openFile()"
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
					(openSmartArtDialog)="showSmartArtInsert.set(true)"
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

					<main class="pptx-ng-main" #mainEl>
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
							[editTemplateMode]="editor.editTemplateMode()"
							[templateElements]="activeTemplateElements()"
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

					<!--
						Single inspector host for every right-rail panel. On mobile it docks
						full-width below the canvas and is swipe-dismissable (the grab handle
						feeds onInspectorPointerDown/Move/Up); a downward swipe past the
						threshold sets mobileInspectorHidden so the user reclaims the canvas.
					-->
					@if (visibleInspectorKind(); as kind) {
						<aside
							class="pptx-ng-inspector-host"
							[attr.aria-label]="inspectorLabel()"
							[style.transform]="
								inspectorDragY() > 0 ? 'translateY(' + inspectorDragY() + 'px)' : null
							"
							[style.transition]="inspectorDragging() ? 'none' : 'transform 150ms ease-out'"
						>
							<!-- Swipe-down-to-dismiss grab handle (mobile only; hidden on desktop). -->
							<div
								class="pptx-ng-idrawer-grab"
								(pointerdown)="onInspectorPointerDown($event)"
								(pointermove)="onInspectorPointerMove($event)"
								(pointerup)="onInspectorPointerUp($event)"
								(pointercancel)="onInspectorPointerUp($event)"
							>
								<div class="pptx-ng-idrawer-handle"></div>
							</div>
							@switch (kind) {
								@case ('accessibility') {
									<pptx-accessibility-panel
										[issues]="accessibility.issues()"
										(selectSlide)="goTo($event)"
									/>
								}
								@case ('signatures') {
									<pptx-signatures-panel [signatures]="loader.signatures()" />
								}
								@case ('comments') {
									<pptx-comments-panel
										[comments]="activeComments()"
										(add)="onCommentAdd($event)"
										(remove)="onCommentRemove($event)"
										(resolve)="onCommentResolve($event)"
									/>
								}
								@case ('selection') {
									<pptx-selection-pane
										[elements]="activeSlide()?.elements ?? []"
										[selectedIds]="editor.selectedIds()"
										(selectElement)="editor.select([$event])"
										(bringForward)="onSelectionPaneBringForward($event)"
										(sendBackward)="onSelectionPaneSendBackward($event)"
										(toggleHidden)="onToggleElementHidden($event)"
									/>
								}
								@case ('element') {
									@if (selectedElement(); as el) {
										<pptx-inspector-panel [element]="el" [slideIndex]="activeSlideIndex()" />
									}
								}
								@case ('slide') {
									<!--
										Keyed on the active index so the inputs are recreated (and reseeded)
										only when the slide changes, never on every change-detection pass
										while typing. This keeps the on-screen keyboard open and the caret
										stable on mobile.
									-->
									@if (activeSlide(); as sl) {
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
									}
								}
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
				@if (mobile.isMobile()) {
					<!-- Single-column mobile presenter layout (phones / landscape phones). -->
					<pptx-mobile-presenter-view
						[slides]="loader.slides()"
						[currentSlideIndex]="activeSlideIndex()"
						[canvasSize]="loader.canvasSize()"
						[mediaDataUrls]="loader.mediaDataUrls()"
						[presentationStartTime]="presenterStartTime()"
						(movePresentationSlide)="goTo(activeSlideIndex() + $event)"
						(exit)="exitPresenter()"
					/>
				} @else {
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

			<pptx-export-progress-modal
				[open]="exportModalOpen()"
				[title]="exportModalTitle()"
				[progress]="exportProgress()"
				[statusMessage]="exportStatusMessage()"
				(cancel)="onCancelExport()"
			/>

			<pptx-share-dialog
				[open]="showShare()"
				[active]="collab.active()"
				[connected]="collab.connected()"
				[userCount]="collab.connectedCount()"
				[shareUrl]="shareUrl()"
				(start)="onShareStart($event)"
				(stop)="onShareStop()"
				(close)="showShare.set(false)"
			/>

			<pptx-broadcast-dialog
				[open]="showBroadcast()"
				[active]="collab.active()"
				[connected]="collab.connected()"
				[viewerCount]="collab.presence().length"
				[viewerUrl]="broadcastViewerUrl()"
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

				<!-- ── Insert SmartArt gallery dialog ─────────────────────────── -->
				<pptx-insert-smart-art-dialog
					[open]="showSmartArtInsert()"
					(insert)="onInsertSmartArt($event)"
					(close)="showSmartArtInsert.set(false)"
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
					(openFile)="openFile()"
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
				     lives inside the app's layout-viewport bounds; a fixed sheet anchored to
				     the visual viewport ends up below the document on mobile (100vh layout
				     viewport < dynamic viewport), leaving its textarea unreachable to taps.
				     Mirrors React, where the notes panel is a flow sibling below the canvas. -->
				@if (showNotes()) {
					<div
						class="pptx-ng-mobile-notes-sheet"
						[style.transform]="notesDragY() > 0 ? 'translateY(' + notesDragY() + 'px)' : null"
						[style.transition]="notesDragging() ? 'none' : 'transform 150ms ease-out'"
					>
						<!-- Swipe-down-to-dismiss grab handle (kept in-flow so the keyboard
						     can't push the textarea out of reach). -->
						<div
							class="pptx-ng-mnotes-grab"
							(pointerdown)="onNotesPointerDown($event)"
							(pointermove)="onNotesPointerMove($event)"
							(pointerup)="onNotesPointerUp($event)"
							(pointercancel)="onNotesPointerUp($event)"
						>
							<div class="pptx-ng-mnotes-handle"></div>
						</div>
						<pptx-notes-panel [slide]="activeSlide()" (update)="onNotesUpdate($event)" />
					</div>
				}

				<!-- Lift the fixed bottom bar above the on-screen keyboard so its
				     actions stay reachable instead of sitting under the keyboard. -->
				<pptx-mobile-bottom-bar
					[style.transform]="
						mobile.keyboardInset() > 0 ? 'translateY(-' + mobile.keyboardInset() + 'px)' : null
					"
					[style.transition]="mobile.keyboardInset() > 0 ? 'transform 150ms ease-out' : null"
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
	/**
	 * Host override for the File ▸ Open action. When set, the built-in native
	 * file picker is bypassed and this is invoked instead; the host then supplies
	 * a new `content` value. When omitted, the viewer opens its own picker and
	 * loads the chosen presentation in place.
	 */
	readonly onOpenFile = input<(() => void) | undefined>(undefined);
	/**
	 * Opt in to the experimental Three.js SmartArt renderer. When `true`,
	 * SmartArt diagrams render as extruded 3D blocks on a WebGL canvas instead
	 * of flat SVG. Requires the optional `three` peer dependency; when it is not
	 * installed (or the diagram has no geometry), the viewer transparently falls
	 * back to the SVG SmartArt renderer. Default `false`.
	 */
	readonly smartArt3D = input<boolean>(false);

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
	private readonly smartArt3DSvc = inject(SmartArt3DService);

	/** The `<main>` host; used to locate the live `.pptx-ng-canvas-stage`. */
	private readonly mainEl = viewChild<ElementRef<HTMLElement>>('mainEl');
	/** True while a PNG/PDF export is in progress (disables the buttons). */
	protected readonly exporting = signal(false);

	/** Export-progress modal state (PDF / GIF / WebM). */
	protected readonly exportModalOpen = signal(false);
	protected readonly exportModalTitle = signal('');
	protected readonly exportProgress = signal(0);
	protected readonly exportStatusMessage = signal('');
	/** Cooperative cancellation: the capture loop checks `signal.aborted`. */
	private exportAbort: AbortController | null = null;

	protected readonly activeSlideIndex = signal(0);
	/** Slides to display: the editable deck when `canEdit`, else the loaded deck. */
	protected readonly displaySlides = computed(() =>
		this.canEdit() ? this.editor.slides() : this.loader.slides(),
	);
	protected readonly slideCount = computed(() => this.displaySlides().length);
	/**
	 * The deck with the separated template (master/layout) elements merged back
	 * into each slide. The editable {@link displaySlides} is template-free; any
	 * consumer that needs the COMPLETE slide (export, print, slide thumbnails,
	 * accessibility) renders this instead so template elements are not lost.
	 */
	protected readonly mergedSlides = computed<readonly PptxSlide[]>(() =>
		this.canEdit()
			? buildSaveSlides(this.editor.slides(), this.editor.templateElementsBySlideId())
			: this.loader.slides(),
	);
	/** Mutable copy of the merged display deck for inputs that require a non-readonly array. */
	protected readonly displaySlidesMut = computed<PptxSlide[]>(() => [...this.mergedSlides()]);
	protected readonly activeSlide = computed(() => this.displaySlides()[this.activeSlideIndex()]);
	/** Inherited template (master/layout) elements for the active slide, when editing. */
	protected readonly activeTemplateElements = computed<readonly PptxElement[]>(() => {
		const slide = this.activeSlide();
		if (!this.canEdit() || !slide) {
			return [];
		}
		return this.editor.templateElementsBySlideId()[slide.id] ?? [];
	});
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
	 * Which panel the single inspector host should show, applying the original
	 * first-match precedence (explicit tool panels → element → slide default).
	 * `accessibility`/`signatures` render regardless of edit mode; the rest need
	 * `canEdit`.
	 */
	protected readonly inspectorContent = computed<
		'accessibility' | 'signatures' | 'comments' | 'selection' | 'element' | 'slide' | null
	>(() => {
		const panel = this.activePanel();
		if (panel === 'accessibility') {
			return 'accessibility';
		}
		if (panel === 'signatures') {
			return 'signatures';
		}
		if (!this.canEdit()) {
			return null;
		}
		if (panel === 'comments') {
			return 'comments';
		}
		if (panel === 'selection') {
			return 'selection';
		}
		if (this.selectedElement()) {
			return 'element';
		}
		if (this.activeSlide()) {
			return 'slide';
		}
		return null;
	});

	/** Inspector content, but null on mobile once the user has swiped it away. */
	protected readonly visibleInspectorKind = computed(() =>
		this.mobile.isMobile() && this.mobileInspectorHidden() ? null : this.inspectorContent(),
	);

	/** Accessible label for the inspector host, by active content. */
	protected readonly inspectorLabel = computed(() => {
		switch (this.inspectorContent()) {
			case 'accessibility':
				return 'Accessibility checker';
			case 'signatures':
				return 'Digital signatures';
			case 'comments':
				return 'Comments';
			case 'selection':
				return 'Selection pane';
			case 'element':
				return 'Element properties';
			case 'slide':
				return 'Slide properties';
			default:
				return '';
		}
	});

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
	/**
	 * Room/server of the currently active session, used to build the shareable
	 * join/follow links shown in the dialogs. Null when no session is active.
	 */
	protected readonly activeSession = signal<{ roomId: string; serverUrl: string } | null>(null);

	/** Browser location used to assemble share/follow URLs (omitted in SSR). */
	private readonly browserLocation = (): { origin: string; pathname: string } | undefined =>
		typeof window === 'undefined'
			? undefined
			: { origin: window.location.origin, pathname: window.location.pathname };

	/** Shareable join link for the active collaboration session. */
	protected readonly shareUrl = computed<string>(() => {
		const session = this.activeSession();
		return session ? buildShareUrl(session.roomId, session.serverUrl, this.browserLocation()) : '';
	});

	/** Shareable follow link for the active broadcast. */
	protected readonly broadcastViewerUrl = computed<string>(() => {
		const session = this.activeSession();
		return session
			? buildBroadcastViewerUrl(session.roomId, session.serverUrl, this.browserLocation())
			: '';
	});
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
	/** Whether the Insert SmartArt gallery dialog is open. */
	protected readonly showSmartArtInsert = signal(false);
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
	 * uncontrolled notes/background inputs on navigation, but never mid-typing.
	 * String-prefixed so slide index 0 stays truthy under `@if (…; as key)`.
	 */
	protected readonly slidePropsKey = computed(() => `slide-${this.activeSlideIndex()}`);
	/** The single selected element on the active slide (for the inspector). */
	protected readonly selectedElement = computed<PptxElement | null>(() => {
		const ids = this.editor.selectedIds();
		if (ids.length !== 1) {
			return null;
		}
		const id = ids[0];
		// A selected element may be a normal slide element or, in editTemplateMode,
		// an inherited template element living in the separate template store.
		return (
			this.activeSlide()?.elements.find((e) => e.id === id) ??
			this.activeTemplateElements().find((e) => e.id === id) ??
			null
		);
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

	/**
	 * Built-in File ▸ Open override of the `content` input. The native picker
	 * sets this to swap the deck in place; a fresh `content` input clears it so
	 * external reloads always win.
	 */
	private readonly contentOverride = signal<Uint8Array | ArrayBuffer | null>(null);

	constructor() {
		// Surface the `smartArt3D` opt-in to the element dispatcher via the
		// viewer-scoped SmartArt3DService.
		effect(() => {
			this.smartArt3DSvc.enabled.set(this.smartArt3D());
		});

		// A new host `content` input supersedes any in-place picked file.
		effect(() => {
			this.content();
			this.contentOverride.set(null);
		});

		// Load whenever the active content (picked override, else input) changes.
		effect(() => {
			const content = this.contentOverride() ?? this.content();
			void this.loader.load(content);
		});

		// Reset to the first slide and seed the editable deck whenever a new
		// presentation finishes loading.
		effect(() => {
			const slides = this.loader.slides();
			this.editor.setSlides(slides);
			this.activeSlideIndex.set(0);
		});

		// Selecting an element re-opens the inspector if a prior swipe had hidden
		// it on mobile — tapping a shape to edit it should surface its properties.
		effect(() => {
			if (this.selectedElement()) {
				this.mobileInspectorHidden.set(false);
			}
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

		// Feed the live deck (templates merged back) to the accessibility checker.
		effect(() => {
			this.accessibility.setSlides([...this.mergedSlides()]);
		});

		// Connect / disconnect real-time collaboration when the host config changes.
		effect(() => {
			const config = this.collaboration();
			if (config) {
				this.activeSession.set({ roomId: config.roomId, serverUrl: config.serverUrl });
				void this.collab.connect(config, {
					getTemplateElements: () => this.editor.templateElementsBySlideId(),
				});
			} else {
				this.collab.disconnect();
				this.activeSession.set(null);
			}
		});

		// Attach multi-touch gestures (pinch-zoom / swipe-nav / long-press menu)
		// to the canvas host once it is rendered. See setupTouchGestures().
		this.setupTouchGestures();
	}

	/**
	 * Serialise the current presentation to `.pptx` bytes (imperative handle).
	 * When editing, this serialises the editor's edited deck so changes persist.
	 */
	async getContent(): Promise<Uint8Array> {
		const data = this.canEdit()
			? await this.loader.saveSlides(
					buildSaveSlides(this.editor.slides(), this.editor.templateElementsBySlideId()),
				)
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
		this.activeSession.set({ roomId: config.roomId, serverUrl: config.serverUrl });
		void this.collab.connect(config, {
			getTemplateElements: () => this.editor.templateElementsBySlideId(),
		});
	}

	protected onShareStop(): void {
		this.collab.disconnect();
		this.activeSession.set(null);
	}

	/** Start broadcasting (presenter as session owner) from the broadcast config. */
	protected onBroadcastStart(config: BroadcastConfig): void {
		const collabConfig: CollaborationConfig = {
			roomId: config.roomId,
			serverUrl: config.serverUrl,
			userName: 'Presenter',
			role: 'owner',
		};
		this.activeSession.set({ roomId: config.roomId, serverUrl: config.serverUrl });
		void this.collab.connect(collabConfig, {
			getTemplateElements: () => this.editor.templateElementsBySlideId(),
		});
	}

	protected onBroadcastStop(): void {
		this.collab.disconnect();
		this.activeSession.set(null);
	}

	/**
	 * Wire the framework-agnostic touch-gesture recogniser to the `<main>` canvas
	 * host once it is in the DOM. Mirrors React's `useTouchGestures` wiring:
	 *   - pinch-to-zoom always updates the zoom signal (clamped to the viewer
	 *     range), with `preventDefault()` on the pinch path to suppress the
	 *     browser's native pinch-zoom;
	 *   - horizontal swipe navigates slides, but only when editing is off
	 *     (`!canEdit()`): in edit mode single-finger gestures belong to element
	 *     manipulation (move/resize/rotate), so we never hijack them. The large
	 *     ‹ › buttons remain available for explicit navigation in all modes;
	 *   - long-press in edit mode opens the editor context menu at the press
	 *     point for the current selection (mirrors React's onLongPress path).
	 *
	 * The recogniser's swipe/long-press callbacks check the live `canEdit()` /
	 * selection state, so a single attach handles every mode without re-binding.
	 */
	private setupTouchGestures(): void {
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			const el = this.mainEl()?.nativeElement;
			if (!el) {
				return;
			}
			const teardown = attachTouchGestures(el, {
				getScale: () => this.zoom(),
				callbacks: {
					onPinchZoom: (newScale) => this.zoom.set(newScale),
					onSwipe: (direction) => {
						// Edit mode: leave single-finger gestures to element manipulation.
						if (this.canEdit()) {
							return;
						}
						// direction 1 = swipe right (previous), -1 = swipe left (next).
						if (direction === 1) {
							this.goPrev();
						} else {
							this.goNext();
						}
					},
					onLongPress: (x, y) => {
						if (!this.canEdit() || this.presenting()) {
							return;
						}
						const selected = this.selectedElement();
						if (!selected) {
							return;
						}
						this.contextMenuPos.set({ x, y });
					},
				},
			});
			destroyRef.onDestroy(teardown);
		});
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

	/** Open the presenter (speaker) view: current+next slide, notes, timer. */
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
	 * File ▸ Open: host override (`onOpenFile` input) takes precedence; otherwise
	 * a built-in native picker loads the chosen presentation in place.
	 */
	openFile(): void {
		const override = this.onOpenFile();
		if (override) {
			override();
			return;
		}
		void (async () => {
			const picked = await openPptxFile();
			if (picked) {
				this.contentOverride.set(new Uint8Array(picked.buffer));
			}
		})();
	}

	// ── Mobile notes swipe-to-dismiss ─────────────────────────────────────────
	// The notes sheet stays in normal flow (see template/CSS notes), so the drag
	// gesture is wired here rather than via the fixed-overlay `pptx-mobile-sheet`.
	/** Live downward drag offset for the notes sheet (px; 0 when idle). */
	protected readonly notesDragY = signal(0);
	/** True while a notes-sheet drag is in progress (disables the snap-back transition). */
	protected readonly notesDragging = signal(false);
	private notesDragStartY: number | null = null;

	protected onNotesPointerDown(event: PointerEvent): void {
		this.notesDragStartY = event.clientY;
		this.notesDragging.set(true);
		(event.target as HTMLElement).setPointerCapture?.(event.pointerId);
	}

	protected onNotesPointerMove(event: PointerEvent): void {
		if (this.notesDragStartY === null) {
			return;
		}
		this.notesDragY.set(Math.max(0, event.clientY - this.notesDragStartY));
	}

	protected onNotesPointerUp(event: PointerEvent): void {
		if (this.notesDragStartY === null) {
			return;
		}
		const delta = event.clientY - this.notesDragStartY;
		this.notesDragStartY = null;
		this.notesDragging.set(false);
		(event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
		// 120 px matches `pptx-mobile-sheet`'s DISMISS_THRESHOLD for consistency.
		if (delta > 120) {
			this.showNotes.set(false);
		}
		this.notesDragY.set(0);
	}

	// ── Mobile inspector (Format/Comments/Selection/…) swipe-to-dismiss ─────────
	// The inspector host docks in-flow below the canvas on mobile (same keyboard-
	// reachability reason as the notes sheet), so the swipe gesture is wired here.
	/** True once the user swiped the inspector away on mobile (until reopened). */
	protected readonly mobileInspectorHidden = signal(false);
	/** Live downward drag offset for the inspector host (px; 0 when idle). */
	protected readonly inspectorDragY = signal(0);
	/** True while an inspector-host drag is in progress. */
	protected readonly inspectorDragging = signal(false);
	private inspectorDragStartY: number | null = null;

	protected onInspectorPointerDown(event: PointerEvent): void {
		this.inspectorDragStartY = event.clientY;
		this.inspectorDragging.set(true);
		(event.target as HTMLElement).setPointerCapture?.(event.pointerId);
	}

	protected onInspectorPointerMove(event: PointerEvent): void {
		if (this.inspectorDragStartY === null) {
			return;
		}
		this.inspectorDragY.set(Math.max(0, event.clientY - this.inspectorDragStartY));
	}

	protected onInspectorPointerUp(event: PointerEvent): void {
		if (this.inspectorDragStartY === null) {
			return;
		}
		const delta = event.clientY - this.inspectorDragStartY;
		this.inspectorDragStartY = null;
		this.inspectorDragging.set(false);
		(event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
		if (delta > 120) {
			this.mobileInspectorHidden.set(true);
			this.activePanel.set(null);
		}
		this.inspectorDragY.set(0);
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
		// Reopen the inspector if a prior swipe-down had dismissed it.
		this.mobileInspectorHidden.set(false);
	}

	/** Toggle a right-docked tool panel (clicking the active one closes it). */
	togglePanel(panel: 'comments' | 'accessibility' | 'signatures' | 'selection'): void {
		this.activePanel.update((current) => (current === panel ? null : panel));
		// Tapping a panel button re-opens the host even after a swipe-dismiss.
		this.mobileInspectorHidden.set(false);
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
	 * {@link canEdit}: viewers may inspect properties but not mutate them
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
			await this.print.print(settings, [...this.mergedSlides()], original, (index) =>
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

	// ── Insert SmartArt ────────────────────────────────────────────────────────

	/**
	 * Insert a new SmartArt element built from the dialog's chosen preset + item
	 * texts. The element id is left empty so `EditorStateService.addElement`
	 * assigns one; the insert is a single undo/redo history entry.
	 */
	protected onInsertSmartArt(event: SmartArtInsertEvent): void {
		const element = buildSmartArtInsertElement(event.layout, event.items);
		this.editor.addElement(this.activeSlideIndex(), element);
		this.showSmartArtInsert.set(false);
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
	 * Open the progress modal and arm a fresh `AbortController` for an export.
	 * Returns the controller whose `signal` the capture loop checks per slide.
	 */
	private beginExport(title: string): AbortController {
		const controller = new AbortController();
		this.exportAbort = controller;
		this.exportModalTitle.set(title);
		this.exportStatusMessage.set('Capturing slides...');
		this.exportProgress.set(0);
		this.exportModalOpen.set(true);
		this.exporting.set(true);
		return controller;
	}

	/** Tear down the progress modal + export-in-flight state. */
	private endExport(): void {
		this.exportAbort = null;
		this.exportModalOpen.set(false);
		this.exporting.set(false);
	}

	/** User pressed Cancel: abort the loop and close the modal. */
	onCancelExport(): void {
		this.exportAbort?.abort();
		this.exportAbort = null;
		this.exportModalOpen.set(false);
		this.exportProgress.set(0);
	}

	/**
	 * Render every slide to a canvas (each made the live stage in turn), reporting
	 * per-slide progress and bailing out cooperatively when `abortSignal.aborted`.
	 */
	private async captureSlideCanvases(
		abortSignal: AbortSignal,
		verb: string,
		span: number,
	): Promise<HTMLCanvasElement[]> {
		const total = this.slideCount();
		const original = this.activeSlideIndex();
		const canvases: HTMLCanvasElement[] = [];
		try {
			for (let i = 0; i < total; i++) {
				if (abortSignal.aborted) {
					throw new DOMException('Export cancelled', 'AbortError');
				}
				this.exportProgress.set(slideProgressPercent(i, total, span));
				this.exportStatusMessage.set(slideStatusLabel(verb, i, total));
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

	/**
	 * Export every slide to a multi-page PDF. Each slide is made the live stage,
	 * given a render tick to settle, captured to a canvas, then the original
	 * slide is restored. Progress + Cancel drive the export-progress modal.
	 */
	async exportPdf(): Promise<void> {
		if (this.slideCount() === 0 || this.exporting()) {
			return;
		}
		const controller = this.beginExport('Export as PDF');
		const { width, height } = this.loader.canvasSize();
		try {
			const canvases = await this.captureSlideCanvases(controller.signal, 'Rendering', 90);
			this.exportProgress.set(EXPORT_ASSEMBLING_PERCENT);
			this.exportStatusMessage.set('Building PDF...');
			this.exportSvc.exportCanvasesToPdf(canvases, width, height, 'presentation.pdf');
			this.exportProgress.set(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] PDF export failed:', err);
			}
		} finally {
			this.endExport();
		}
	}

	/** Export every slide as an animated GIF (2s per slide). */
	async exportGif(): Promise<void> {
		if (this.slideCount() === 0 || this.exporting()) {
			return;
		}
		const controller = this.beginExport('Export as GIF');
		try {
			const canvases = await this.captureSlideCanvases(controller.signal, 'Encoding', 90);
			this.exportProgress.set(EXPORT_ASSEMBLING_PERCENT);
			this.exportStatusMessage.set('Saving file...');
			this.exportSvc.exportCanvasesToGif(canvases, 2000, 'presentation.gif');
			this.exportProgress.set(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] GIF export failed:', err);
			}
		} finally {
			this.endExport();
		}
	}

	/** Export every slide as a WebM video (3s per slide) via MediaRecorder. */
	async exportVideo(): Promise<void> {
		if (this.slideCount() === 0 || this.exporting()) {
			return;
		}
		const controller = this.beginExport('Export as Video');
		try {
			const canvases = await this.captureSlideCanvases(controller.signal, 'Capturing', 45);
			this.exportProgress.set(EXPORT_ASSEMBLING_PERCENT);
			this.exportStatusMessage.set('Recording video...');
			await this.exportSvc.exportCanvasesToWebm(
				canvases,
				3000,
				'presentation.webm',
				controller.signal,
				(current, total) => {
					this.exportProgress.set(recordProgressPercent(current, total));
					this.exportStatusMessage.set(slideStatusLabel('Recording', current, total));
				},
			);
			this.exportProgress.set(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] Video export failed:', err);
			}
		} finally {
			this.endExport();
		}
	}
}
