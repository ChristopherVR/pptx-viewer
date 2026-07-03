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
import { TranslatePipe } from '@ngx-translate/core';
import { applyThemeToData } from 'pptx-viewer-core';
import type {
	InkPptxElement,
	PptxComment,
	PptxCoreProperties,
	PptxData,
	PptxElement,
	PptxSlide,
	PptxTableData,
	PptxThemePreset,
	TextStyle,
} from 'pptx-viewer-core';

import type { ViewerTheme } from '../internal/shared';
import {
	BROADCAST_THROTTLE_MS,
	clampCursorPosition,
	openPptxFile,
	presenceToCursors,
} from '../internal/shared';
import { themeStyle } from '../theme/viewer-theme';
import { AccessibilityPanelComponent } from './accessibility-panel.component';
import { AccessibilityService } from './accessibility.service';
import { BroadcastDialogComponent } from './broadcast-dialog.component';
import { CollaborationCursorsComponent } from './collaboration-cursors.component';
import { CollaborationService } from './collaboration.service';
import {
	addCommentToList,
	removeCommentFromList,
	toggleCommentResolvedInList,
} from './comments-helpers';
import { CommentsPanelComponent } from './comments-panel.component';
import { CustomShowsComponent } from './custom-shows.component';
import { EditorContextMenuComponent } from './editor-context-menu.component';
import { EditorStateService } from './editor-state.service';
import { EditorToolbarComponent } from './editor-toolbar.component';
import { EmbeddedFontsService } from './embedded-fonts.service';
import { ExportProgressModalComponent } from './export-progress-modal.component';
import { ExportService } from './export.service';
import { FieldContextService } from './field-context.service';
import { FindBarComponent } from './find-bar.component';
import { FindReplaceBarComponent } from './find-replace-bar.component';
import { FollowModeBarComponent } from './follow-mode-bar.component';
import { HyperlinkDialogComponent } from './hyperlink-dialog.component';
import { InsertSmartArtDialogComponent } from './insert-smart-art-dialog.component';
import type { SmartArtInsertEvent } from './insert-smart-art-dialog.component';
import { textStylePatch } from './inspector-helpers';
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
import { PresenterWindowService } from './presenter-window.service';
import { PrintDialogComponent } from './print-dialog.component';
import { PrintService } from './print.service';
import { PropertiesDialogComponent } from './properties-dialog.component';
import { RemoteSelectionOverlayComponent } from './remote-selection-overlay.component';
import { RibbonComponent } from './ribbon.component';
import { SelectionPaneComponent } from './selection-pane.component';
import { ShareDialogComponent } from './share-dialog.component';
import { SignaturesPanelComponent } from './signatures-panel.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
import { SlidesPanelComponent } from './slides-panel.component';
import { SmartArt3DService } from './smart-art-3d.service';
import { buildSmartArtInsertElement } from './smart-art-insert-helpers';
import { StatusBarComponent } from './status-bar.component';
import { setCellText } from './table-data-helpers';
import type { TableCellCommit } from './table-renderer.component';
import { TableSelectionService } from './table-selection.service';
import { buildSaveSlides } from './template-mode';
import { ThemeGalleryComponent } from './theme-gallery.component';
import type { CollaborationConfig } from './types';
import { ViewerCollaborationSessionService } from './viewer-collaboration-session.service';
import { ViewerCompareService } from './viewer-compare.service';
import { ViewerCustomShowsService } from './viewer-custom-shows.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerExportService } from './viewer-export.service';
import { ViewerExtraDialogsComponent } from './viewer-extra-dialogs.component';
import { ViewerFindReplaceService } from './viewer-find-replace.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';
import { ViewerKeyboardService } from './viewer-keyboard.service';
import { ViewerMobileSheetService } from './viewer-mobile-sheet.service';
import { ViewerPresentationModeService } from './viewer-presentation-mode.service';
import { ViewerTouchGesturesService } from './viewer-touch-gestures.service';
import { ViewerZoomService } from './viewer-zoom.service';
import { ZoomTargetService } from './zoom-target.service';

/**
 * PowerPointViewerComponent: Angular port of the React `PowerPointViewer.tsx`
 * and Vue `PowerPointViewer.vue`.
 *
 * Top-level orchestrator that loads `.pptx` bytes and renders the slides with
 * navigation and zoom, composing the full editor (toolbar, inspector panels,
 * dialogs, presentation mode, collaboration, export) like its React and Vue
 * counterparts.
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
		TableSelectionService,
		EmbeddedFontsService,
		CollaborationService,
		AccessibilityService,
		PrintService,
		IsMobileService,
		SmartArt3DService,
		FieldContextService,
		ZoomTargetService,
		ViewerDialogsService,
		ViewerCompareService,
		ViewerExportService,
		ViewerFindReplaceService,
		ViewerCustomShowsService,
		ViewerCollaborationSessionService,
		ViewerFormatPainterService,
		ViewerKeyboardService,
		ViewerMobileSheetService,
		ViewerPresentationModeService,
		ViewerTouchGesturesService,
		ViewerZoomService,
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
		StatusBarComponent,
		EditorToolbarComponent,
		EditorContextMenuComponent,
		ExportProgressModalComponent,
		CommentsPanelComponent,
		SignaturesPanelComponent,
		AccessibilityPanelComponent,
		CollaborationCursorsComponent,
		RemoteSelectionOverlayComponent,
		FollowModeBarComponent,
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
		ViewerExtraDialogsComponent,
		TranslatePipe,
	],
	template: `
		<div class="pptx-ng-viewer" [ngClass]="class()" [ngStyle]="rootStyle()">
			@if (loader.loading()) {
				<div class="pptx-ng-state pptx-ng-loading">
					<div class="pptx-ng-spinner" aria-hidden="true"></div>
					<p>{{ 'pptx.viewer.loading' | translate }}</p>
				</div>
			} @else if (loader.isEncrypted()) {
				<div class="pptx-ng-state pptx-ng-error">
					<p>{{ 'pptx.viewer.encrypted' | translate }}</p>
				</div>
			} @else if (loader.error()) {
				<div class="pptx-ng-state pptx-ng-error">
					<p>{{ 'pptx.viewer.loadError' | translate }}</p>
					<pre class="pptx-ng-error-detail">{{ loader.error() }}</pre>
				</div>
			} @else {
				@if (!mobile.isMobile()) {
					<pptx-ribbon
					[slideIndex]="activeSlideIndex()"
					[slideCount]="slideCount()"
					[canEdit]="canEdit()"
					[selectedElement]="selectedElement()"
					[zoomPercent]="zoomSvc.zoomPercent()"
					[formatPainterActive]="formatPainter.active()"
					[canActivateFormatPainter]="formatPainter.canActivate()"
					[exporting]="xport.exporting()"
					[sidebarCollapsed]="slidesPanelCollapsed()"
					[inspectorOpen]="inspectorPaneOpen()"
					[commentsOpen]="activePanel() === 'comments'"
					[commentCount]="activeComments().length"
					[findOpen]="findReplace.showFind() || findReplace.showFindReplace()"
					[collabConnected]="collab.connected()"
					[connectedCount]="collab.connectedCount()"
					(toggleSidebar)="slidesPanelCollapsed.update(v => !v)"
					(prev)="goPrev()"
					(next)="goNext()"
					(zoomIn)="zoomSvc.zoomIn()"
					(zoomOut)="zoomSvc.zoomOut()"
					(zoomReset)="zoomSvc.zoomReset()"
					(find)="findReplace.showFind.set(true)"
					(present)="presentationMode.present()"
					(presenter)="presentationMode.presentPresenter()"
					(share)="session.showShare.set(true)"
					(broadcast)="session.showBroadcast.set(true)"
					(openFile)="openFile()"
					(save)="saveAsPptx()"
					(info)="showProperties.set(true)"
					(print)="print.openDialog()"
					(comments)="togglePanel('comments')"
					(signatures)="togglePanel('signatures')"
					(a11y)="togglePanel('accessibility')"
					(link)="showHyperlink.set(true)"
					(openSorter)="showSorter.set(true)"
					(toggleNotes)="mobileSheetSvc.toggleNotes()"
					(toggleFormatPainter)="formatPainter.toggle()"
					(exportPng)="xport.exportPng()"
					(exportPdf)="xport.exportPdf()"
					(exportGif)="xport.exportGif()"
					(exportVideo)="xport.exportVideo()"
					(replace)="findReplace.openFindReplace()"
					(toggleInspector)="activePanel.set(null)"
					(drawToolChange)="onDrawToolChange($event)"
					[showGrid]="showGrid()"
					[showRulers]="showRulers()"
					[showGuides]="showGuides()"
					[snapToGrid]="snapToGrid()"
					[eyedropperActive]="formatPainter.eyedropperActive()"
					(toggleGrid)="showGrid.update(v => !v)"
					(toggleRulers)="showRulers.update(v => !v)"
					(toggleGuides)="showGuides.update(v => !v)"
					(toggleSnapToGrid)="snapToGrid.update(v => !v)"
					(toggleEyedropper)="formatPainter.toggleEyedropper()"
					[themeGalleryOpen]="showThemeGallery()"
					(toggleThemeGallery)="showThemeGallery.update(v => !v)"
					(toggleSelectionPane)="togglePanel('selection')"
					(openCustomShows)="customShowsCtl.showDialog.set(true)"
					(openSmartArtDialog)="showSmartArtInsert.set(true)"
					(openEquationDialog)="dialogs.openEquationInsert()"
					(openSetUpSlideShow)="dialogs.showSetUpSlideShow.set(true)"
					(openCompare)="onOpenCompare()"
					(openPassword)="dialogs.showPassword.set(true)"
					(openFontEmbedding)="dialogs.showFontEmbedding.set(true)"
					(openVersionHistory)="dialogs.showVersionHistory.set(true)"
					(openShortcuts)="dialogs.showShortcuts.set(true)"
					/>
				}

				@if (mobile.isMobile()) {
					<pptx-mobile-toolbar
						[canEdit]="canEdit()"
						[canUndo]="editor.canUndo()"
						[canRedo]="editor.canRedo()"
						[canPresent]="slideCount() > 0"
						[menuOpen]="mobileSheetSvc.mobileSheet() === 'menu'"
						(toggleMenu)="mobileSheetSvc.mobileSheet.set(mobileSheetSvc.mobileSheet() === 'menu' ? null : 'menu')"
						(undo)="editor.undo()"
						(redo)="editor.redo()"
						(save)="saveAsPptx()"
						(present)="presentationMode.present()"
					/>
				}

				<div class="pptx-ng-body">
					@if (canEdit() && !mobile.isMobile() && !slidesPanelCollapsed()) {
						<pptx-slides-panel
							[canvasSize]="loader.canvasSize()"
							[mediaDataUrls]="loader.mediaDataUrls()"
							[activeIndex]="activeSlideIndex()"
							(select)="goTo($event)"
						/>
					} @else if (!canEdit()) {
						<nav class="pptx-ng-thumbnails" [attr.aria-label]="'pptx.sections.slides' | translate">
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

					<main class="pptx-ng-main" #mainEl (pointermove)="onCollabPointerMove($event)">
						<pptx-slide-canvas
							[slide]="activeSlide()"
							[canvasSize]="loader.canvasSize()"
							[mediaDataUrls]="loader.mediaDataUrls()"
							[zoom]="zoomSvc.zoom()"
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
							(textEditStart)="onTextEditStart($event.id)"
							(textCommit)="onTextCommit($event)"
							(textCancel)="editingId.set(null)"
							(textFormat)="onTextFormat($event)"
							(inkStrokeComplete)="onInkStrokeComplete($event)"
							(eraserHit)="onEraserHit($event)"
							(cellCommit)="onTableCellCommit($event)"
							(tableChange)="onTableChange($event)"
						/>
						@if (collab.connected()) {
							<pptx-collaboration-cursors [cursors]="collabCursors()" [zoom]="zoomSvc.zoom()" />
							<pptx-remote-selection-overlay
								[presences]="collab.presence()"
								[elements]="activeSlide()?.elements ?? []"
								[activeSlideIndex]="activeSlideIndex()"
								[zoom]="zoomSvc.zoom()"
							/>
						}
						@if (collab.active() && collab.presence().length > 0) {
							<div class="pptx-ng-collab-follow">
								<pptx-follow-mode-bar
									[presences]="collab.presence()"
									[followedClientId]="collab.followedClientId()"
									(follow)="collab.followUser($event)"
								/>
							</div>
						}
						@if (mobileSheetSvc.showNotes() && !mobile.isMobile()) {
							<aside class="pptx-ng-notes" [attr.aria-label]="'pptx.notes.speakerNotes' | translate">
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
							[attr.aria-label]="inspectorLabel() | translate"
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
												<h2 class="pptx-ng-notes-title">{{ 'pptx.viewer.slide' | translate }}</h2>
												<label class="pptx-ng-prop-row">
													<span>{{ 'pptx.viewer.background' | translate }}</span>
													<input
														type="color"
														[attr.value]="sl.backgroundColor || '#ffffff'"
														(change)="onSlideBackground($event)"
													/>
												</label>
												<label class="pptx-ng-prop-row pptx-ng-prop-col">
													<span>{{ 'pptx.notes.title' | translate }}</span>
													<textarea
														rows="5"
														[attr.placeholder]="'pptx.viewer.speakerNotesPlaceholder' | translate"
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
					<pptx-status-bar
						[slideIndex]="activeSlideIndex()"
						[slideCount]="slideCount()"
						[canEdit]="canEdit()"
						[dirty]="editor.dirty()"
						[notesOpen]="mobileSheetSvc.showNotes()"
						[zoomPercent]="zoomSvc.zoomPercent()"
						[sorterActive]="showSorter()"
						[presenting]="presentationMode.presenting()"
						(toggleNotes)="mobileSheetSvc.toggleNotes()"
						(normalView)="showSorter.set(false)"
						(openSorter)="showSorter.set(true)"
						(slideShow)="presentationMode.present()"
						(zoomIn)="zoomSvc.zoomIn()"
						(zoomOut)="zoomSvc.zoomOut()"
						(zoomReset)="zoomSvc.zoomReset()"
					/>
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

			@if (presentationMode.presenting()) {
				<pptx-presentation-overlay
					[slides]="customShowsCtl.presentationSlides()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[startIndex]="customShowsCtl.presentationStartIndex()"
					(indexChange)="presentationMode.onPresentationIndexChange($event)"
					(annotationsExit)="presentationMode.onPresentationAnnotationsExit($event)"
					(closed)="presentationMode.presenting.set(false)"
				/>
			}

			@if (presentationMode.presentingPresenter()) {
				@if (mobile.isMobile()) {
					<!-- Single-column mobile presenter layout (phones / landscape phones). -->
					<pptx-mobile-presenter-view
						[slides]="loader.slides()"
						[currentSlideIndex]="activeSlideIndex()"
						[canvasSize]="loader.canvasSize()"
						[mediaDataUrls]="loader.mediaDataUrls()"
						[presentationStartTime]="presentationMode.presenterStartTime()"
						(movePresentationSlide)="goTo(activeSlideIndex() + $event)"
						(exit)="presentationMode.exitPresenter()"
					/>
				} @else {
					<pptx-presenter-view
						[slides]="loader.slides()"
						[currentSlideIndex]="activeSlideIndex()"
						[canvasSize]="loader.canvasSize()"
						[mediaDataUrls]="loader.mediaDataUrls()"
						[presentationStartTime]="presentationMode.presenterStartTime()"
						[isAudienceWindowOpen]="presenterWindow.isAudienceWindowOpen()"
						(movePresentationSlide)="goTo(activeSlideIndex() + $event)"
						(openAudienceWindow)="presentationMode.openAudienceWindow()"
						(closeAudienceWindow)="presenterWindow.closeAudienceWindow()"
						(exit)="presentationMode.exitPresenter()"
					/>
				}
			}

			@if (findReplace.showFind()) {
				<pptx-find-bar
					[slides]="loader.slides()"
					(navigate)="goTo($event)"
					(closed)="findReplace.showFind.set(false)"
				/>
			}

			@if (findReplace.showFindReplace()) {
				<pptx-find-replace-bar
					[matchCount]="findReplace.results().length"
					[matchIndex]="findReplace.activeIndex()"
					(find)="findReplace.onFind($event)"
					(navigate)="findReplace.onNavigate($event)"
					(replaceOne)="findReplace.onReplaceOne($event)"
					(replaceAll)="findReplace.onReplaceAll($event)"
					(close)="findReplace.showFindReplace.set(false)"
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

			<!-- Secondary dialogs / side panels (equation, set-up show, password,
			     encrypted notice, compare, font embedding, version history,
			     shortcuts, keep-annotations, signature-stripped). -->
			<pptx-viewer-extra-dialogs
				[activeSlideIndex]="activeSlideIndex()"
				[selectedElementId]="selectedElement()?.id ?? null"
				[filePath]="filePath()"
				[customShows]="customShowsCtl.pptxCustomShows()"
				(restoreContent)="onRestoreVersion($event)"
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
					(print)="xport.onPrint($event)"
					(cancel)="print.closeDialog()"
				/>
			}

			<pptx-export-progress-modal
				[open]="xport.modalOpen()"
				[title]="xport.modalTitle()"
				[progress]="xport.progress()"
				[statusMessage]="xport.statusMessage()"
				(cancel)="xport.onCancelExport()"
			/>

			<pptx-share-dialog
				[open]="session.showShare()"
				[active]="collab.active()"
				[connected]="collab.connected()"
				[userCount]="collab.connectedCount()"
				[shareUrl]="session.shareUrl()"
				[p2p]="session.activeSessionP2p()"
				[defaults]="session.shareDialogDefaults()"
				(start)="session.onShareStart($event)"
				(stop)="session.onShareStop()"
				(close)="session.showShare.set(false)"
			/>

			<pptx-broadcast-dialog
				[open]="session.showBroadcast()"
				[active]="collab.active()"
				[connected]="collab.connected()"
				[viewerCount]="collab.presence().length"
				[viewerUrl]="session.broadcastViewerUrl()"
				[p2p]="session.activeSessionP2p()"
				[defaults]="{ serverUrl: shareDefaults()?.serverUrl }"
				(start)="session.onBroadcastStart($event)"
				(stop)="session.onBroadcastStop()"
				(close)="session.showBroadcast.set(false)"
			/>

			@if (canEdit()) {
				<pptx-custom-shows
					[open]="customShowsCtl.showDialog()"
					[slides]="displaySlidesMut()"
					[customShows]="customShowsCtl.shows()"
					[activeCustomShowId]="customShowsCtl.activeId()"
					(create)="customShowsCtl.onCreate($event)"
					(remove)="customShowsCtl.onRemove($event)"
					(update)="customShowsCtl.onUpdate($event)"
					(setActive)="customShowsCtl.activeId.set($event)"
					(close)="customShowsCtl.showDialog.set(false)"
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
					[open]="mobileSheetSvc.mobileSheet() === 'slides'"
					[slides]="displaySlidesMut()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[activeIndex]="activeSlideIndex()"
					(jumpToSlide)="goTo($event)"
					(closed)="mobileSheetSvc.mobileSheet.set(null)"
				/>

				<pptx-mobile-menu-sheet
					[open]="mobileSheetSvc.mobileSheet() === 'menu'"
					[slideCount]="slideCount()"
					[exporting]="xport.exporting()"
					[showNotes]="mobileSheetSvc.showNotes()"
					[canEdit]="canEdit()"
					(closed)="mobileSheetSvc.mobileSheet.set(null)"
					(openFind)="findReplace.showFind.set(true)"
					(openSorter)="showSorter.set(true)"
					(toggleNotes)="mobileSheetSvc.toggleNotes()"
					(insertText)="mobileSheetSvc.onMobileInsert()"
					(present)="presentationMode.present()"
					(openFile)="openFile()"
					(savePptx)="saveAsPptx()"
					(exportPng)="xport.exportPng()"
					(exportPdf)="xport.exportPdf()"
					(exportGif)="xport.exportGif()"
					(exportVideo)="xport.exportVideo()"
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
				@if (mobileSheetSvc.showNotes()) {
					<div
						class="pptx-ng-mobile-notes-sheet"
						[style.transform]="mobileSheetSvc.notesDrag.dragY() > 0 ? 'translateY(' + mobileSheetSvc.notesDrag.dragY() + 'px)' : null"
						[style.transition]="mobileSheetSvc.notesDrag.dragging() ? 'none' : 'transform 150ms ease-out'"
					>
						<!-- Swipe-down-to-dismiss grab handle (kept in-flow so the keyboard
						     can't push the textarea out of reach). -->
						<div
							class="pptx-ng-mnotes-grab"
							(pointerdown)="mobileSheetSvc.notesDrag.onPointerDown($event)"
							(pointermove)="mobileSheetSvc.notesDrag.onPointerMove($event)"
							(pointerup)="mobileSheetSvc.notesDrag.onPointerUp($event)"
							(pointercancel)="mobileSheetSvc.notesDrag.onPointerUp($event)"
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
					(openSlides)="mobileSheetSvc.mobileSheet.set(mobileSheetSvc.mobileSheet() === 'slides' ? null : 'slides')"
					(insert)="mobileSheetSvc.onMobileInsert()"
					(openFormat)="onMobileFormat()"
					(openComments)="togglePanel('comments')"
					(notes)="mobileSheetSvc.toggleNotes()"
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
	/**
	 * Host file path/identifier keying the version-history store. When omitted
	 * the version-history panel shows its empty state. Mirrors React's
	 * `filePath` prop.
	 */
	readonly filePath = input<string | undefined>(undefined);
	/** Optional real-time collaboration config; when set, connects and shows remote cursors. */
	readonly collaboration = input<CollaborationConfig | undefined>(undefined);
	/**
	 * Display name for the local user in collaboration/broadcast sessions and
	 * presence avatars. Falls back to "You" (cursors/avatars) and "Presenter"
	 * (broadcast owner) when omitted. Mirrors the React/Vue `authorName` prop.
	 */
	readonly authorName = input<string>();
	/**
	 * Seed values for the Share dialog's start form (and the broadcast server
	 * URL). Lets the host pre-fill the room id / user name / server URL. Mirrors
	 * the React/Vue `shareDefaults` prop.
	 */
	readonly shareDefaults = input<
		{ roomId?: string; userName?: string; serverUrl?: string } | undefined
	>(undefined);
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
	/**
	 * Fired when a collaboration/broadcast session starts, with the connected
	 * config (role `collaborator` for Share, `owner` for Broadcast). Lets the
	 * host rewrite the URL and publish the deck. Mirrors React/Vue.
	 */
	readonly startCollaboration = output<CollaborationConfig>();
	/** Fired when the collaboration/broadcast session stops. Mirrors React/Vue. */
	readonly stopCollaboration = output<void>();

	protected readonly loader = inject(LoadContentService);
	private readonly exportSvc = inject(ExportService);
	protected readonly editor = inject(EditorStateService);
	private readonly fonts = inject(EmbeddedFontsService);
	protected readonly collab = inject(CollaborationService);
	protected readonly accessibility = inject(AccessibilityService);
	protected readonly print = inject(PrintService);
	protected readonly mobile = inject(IsMobileService);
	private readonly smartArt3DSvc = inject(SmartArt3DService);
	private readonly zoomTarget = inject(ZoomTargetService);
	protected readonly presenterWindow = inject(PresenterWindowService);
	protected readonly dialogs = inject(ViewerDialogsService);
	private readonly compareSvc = inject(ViewerCompareService);
	protected readonly xport = inject(ViewerExportService);
	protected readonly findReplace = inject(ViewerFindReplaceService);
	protected readonly customShowsCtl = inject(ViewerCustomShowsService);
	protected readonly session = inject(ViewerCollaborationSessionService);
	protected readonly formatPainter = inject(ViewerFormatPainterService);
	private readonly keyboard = inject(ViewerKeyboardService);
	protected readonly zoomSvc = inject(ViewerZoomService);
	private readonly touchGestures = inject(ViewerTouchGesturesService);
	protected readonly presentationMode = inject(ViewerPresentationModeService);
	protected readonly mobileSheetSvc = inject(ViewerMobileSheetService);

	/** Handle on the secondary-dialog host (keep-annotations prompt). */
	private readonly extraDialogs = viewChild(ViewerExtraDialogsComponent);

	/** Surface the encrypted-file notice dialog alongside the inline fallback. */
	private readonly encryptedNotice = effect(() => {
		if (this.loader.isEncrypted()) {
			this.dialogs.showEncrypted.set(true);
		}
	});

	/** The `<main>` host; used to locate the live `.pptx-ng-canvas-stage`. */
	private readonly mainEl = viewChild<ElementRef<HTMLElement>>('mainEl');

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

	/**
	 * Remote cursors filtered to the slide the local user is viewing, so peers'
	 * cursors only appear on the shared slide (mirrors React/Vue).
	 */
	protected readonly collabCursors = computed(() =>
		presenceToCursors(this.collab.presence(), this.activeSlideIndex()),
	);
	/** Timestamp of the last cursor broadcast (throttle gate). */
	private lastCursorBroadcast = 0;

	/** Slide-sorter grid overlay visibility. */
	protected readonly showSorter = signal(false);
	/** Whether the left slides panel is collapsed (top-bar sidebar toggle). */
	protected readonly slidesPanelCollapsed = signal(false);

	// ── Draw tool state (forwarded to slide-canvas) ───────────────────────────
	/** Active drawing tool (from the ribbon Draw tab). */
	protected readonly activeDrawTool = signal<
		'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform'
	>('select');
	/** Active ink stroke colour. */
	protected readonly activeDrawColor = signal<string>('#000000');
	/** Active ink stroke width in stage pixels. */
	protected readonly activeDrawWidth = signal<number>(3);

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

	/**
	 * Whether the right-docked inspector is showing the format panel (element or
	 * slide properties). Drives the top-bar inspector-toggle active state.
	 */
	protected readonly inspectorPaneOpen = computed<boolean>(() => {
		const content = this.inspectorContent();
		return content === 'element' || content === 'slide';
	});

	/** Inspector content, but null on mobile once the user has swiped it away. */
	protected readonly visibleInspectorKind = computed(() =>
		this.mobile.isMobile() && this.mobileInspectorHidden() ? null : this.inspectorContent(),
	);

	/** Accessible-label translation key for the inspector host, by active content. */
	protected readonly inspectorLabel = computed(() => {
		switch (this.inspectorContent()) {
			case 'accessibility':
				return 'pptx.accessibility.title';
			case 'signatures':
				return 'pptx.viewer.digitalSignatures';
			case 'comments':
				return 'pptx.toolbar.comments';
			case 'selection':
				return 'pptx.selectionPane.title';
			case 'element':
				return 'pptx.viewer.elementProperties';
			case 'slide':
				return 'pptx.viewer.slideProperties';
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
		if (this.mobileSheetSvc.mobileSheet() === 'slides') {
			return 'slides';
		}
		if (this.activePanel() === 'comments') {
			return 'comments';
		}
		if (this.mobileSheetSvc.showNotes()) {
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
	/** Whether the theme-gallery overlay is visible (Design → Browse Themes). */
	protected readonly showThemeGallery = signal(false);
	/** Whether the Insert SmartArt gallery dialog is open. */
	protected readonly showSmartArtInsert = signal(false);
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

		// Keep an open audience tab in lock-step with the presenter's slide.
		effect(() => {
			const index = this.activeSlideIndex();
			if (this.presenterWindow.isAudienceWindowOpen()) {
				this.presenterWindow.syncSlideToAudience(index);
			}
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

		// Feed the deck to the zoom-target lookup so a zoom tile's fallback
		// thumbnail can resolve its target slide's background / number / section
		// name (mirrors React's ZoomSlideThumbnail).
		effect(() => {
			this.zoomTarget.setSlides(this.mergedSlides());
		});

		// Connect / disconnect real-time collaboration when the host config changes.
		effect(() => {
			this.session.syncHostConfig(this.collaboration());
		});

		// Push local slide edits into the shared Y.Doc (reconcile-based; the
		// service guards against echoing remote-applied changes and against
		// clobbering with an empty deck). A broadcast `viewer` never writes, so a
		// follow-along joiner cannot overwrite the presenter's deck.
		effect(() => {
			const slides = this.editor.slides();
			if (this.collab.active() && this.collab.activeRole() !== 'viewer') {
				this.collab.broadcastSlides(slides);
			}
		});

		// Publish the local selection so peers can draw remote selection boxes.
		effect(() => {
			const ids = this.editor.selectedIds();
			if (this.collab.active()) {
				this.collab.setSelection(ids[0], this.activeSlideIndex());
			}
		});

		// Publish the local active slide so followers navigate with us.
		effect(() => {
			const index = this.activeSlideIndex();
			if (this.collab.active()) {
				this.collab.setActiveSlide(index);
			}
		});

		// Follow mode: mirror the followed peer's active slide.
		effect(() => {
			const target = this.collab.followedSlideIndex();
			if (target !== null) {
				this.goTo(target);
			}
		});

		// Broadcast auto-follow: a `viewer` tracks the broadcaster (owner) peer.
		effect(() => {
			if (this.collab.activeRole() !== 'viewer') {
				return;
			}
			const target = this.collab.broadcasterSlideIndex();
			if (target !== null) {
				this.goTo(target);
			}
		});

		// Hand the export/print orchestrator the live navigation signal + deck
		// accessors + stage resolver so it can flip the stage and capture slides.
		this.xport.bind({
			activeSlideIndex: this.activeSlideIndex,
			slideCount: () => this.slideCount(),
			mergedSlides: () => this.mergedSlides(),
			resolveStage: () => this.stageElement(),
		});

		// Hand the find/replace controller a slide-navigation callback so a match
		// can scroll its slide into view.
		this.findReplace.bind((index) => this.goTo(index));

		// Hand the custom-shows controller the active-slide-index accessor so a
		// normal (non-custom) show starts at the current slide.
		this.customShowsCtl.bind(() => this.activeSlideIndex());

		// Hand the collaboration-session controller the host inputs it cannot own
		// (author name, share defaults, template-element supplier) and the
		// start/stop output emitters.
		this.session.bind({
			authorName: () => this.authorName(),
			shareDefaults: () => this.shareDefaults(),
			getTemplateElements: () => this.editor.templateElementsBySlideId(),
			applyRemoteSlides: (slides) => this.editor.applyRemoteSlides(slides),
			canvasSize: () => this.loader.canvasSize(),
			getSourceBytes: () => this.currentSourceBytes(),
			currentSlides: () => this.editor.slides(),
			emitStart: (config) => this.startCollaboration.emit(config),
			emitStop: () => this.stopCollaboration.emit(),
		});

		// Hand the format-painter/eyedropper controller the selection + active-slide
		// accessors it applies styles against.
		this.formatPainter.bind({
			selectedElement: () => this.selectedElement(),
			activeSlideIndex: () => this.activeSlideIndex(),
			findActiveElement: (id) => this.activeSlide()?.elements.find((e) => e.id === id),
		});

		// Hand the keyboard-shortcut handler the mode/navigation accessors it gates
		// on (the @HostListener stays on the component).
		this.keyboard.bind({
			canEdit: () => this.canEdit(),
			presenting: () => this.presentationMode.presenting(),
			activeSlideIndex: () => this.activeSlideIndex(),
		});

		// Attach multi-touch gestures (pinch-zoom / swipe-nav / long-press menu)
		// to the canvas host once it is rendered.
		this.touchGestures.setup(() => this.mainEl()?.nativeElement, {
			canEdit: () => this.canEdit(),
			presenting: () => this.presentationMode.presenting(),
			selectedElement: () => this.selectedElement(),
			goPrev: () => this.goPrev(),
			goNext: () => this.goNext(),
			setContextMenuPos: (pos) => this.contextMenuPos.set(pos),
		});

		// Hand the presentation-mode controller the few accessors it alone needs
		// from the component (active-slide-index get/set, editing/selection
		// clearing, the source bytes for the audience hand-off, and the
		// keep-annotations prompt trigger on the extra-dialogs host).
		this.presentationMode.bind({
			slideCount: () => this.slideCount(),
			activeSlideIndex: () => this.activeSlideIndex(),
			setActiveSlideIndex: (index) => this.activeSlideIndex.set(index),
			clearEditing: () => this.editingId.set(null),
			clearSelection: () => this.editor.clearSelection(),
			sourceContent: () => this.contentOverride() ?? this.content(),
			canEdit: () => this.canEdit(),
			promptKeepAnnotations: (map) => this.extraDialogs()?.promptKeepAnnotations(map),
		});

		// Hand the mobile-sheet controller the accessors its quick-insert action
		// needs from the component.
		this.mobileSheetSvc.bind({
			canEdit: () => this.canEdit(),
			slideCount: () => this.slideCount(),
			activeSlideIndex: () => this.activeSlideIndex(),
		});
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

	/**
	 * Publish the local cursor while the pointer moves over the canvas. Throttled
	 * to {@link BROADCAST_THROTTLE_MS}; coordinates are mapped from client space
	 * into unscaled slide space (dividing by zoom, matching the cursor overlay)
	 * and clamped to the canvas bounds.
	 */
	protected onCollabPointerMove(event: PointerEvent): void {
		if (!this.collab.active()) {
			return;
		}
		const now = Date.now();
		if (now - this.lastCursorBroadcast < BROADCAST_THROTTLE_MS) {
			return;
		}
		this.lastCursorBroadcast = now;
		const host = this.mainEl()?.nativeElement;
		if (!host) {
			return;
		}
		const rect = host.getBoundingClientRect();
		const zoom = this.zoomSvc.zoom() || 1;
		const size = this.loader.canvasSize();
		const x = clampCursorPosition((event.clientX - rect.left) / zoom, 0, size.width);
		const y = clampCursorPosition((event.clientY - rect.top) / zoom, 0, size.height);
		this.collab.setCursor(x, y, this.activeSlideIndex());
	}

	/** The loaded source `.pptx` bytes (for elected-writer write-back), if any. */
	private currentSourceBytes(): Uint8Array | null {
		const content = this.contentOverride() ?? this.content();
		if (!content) {
			return null;
		}
		return content instanceof Uint8Array ? content : new Uint8Array(content);
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

	/** Review ▸ Compare: pick a `.pptx` and diff it against the current deck. */
	protected onOpenCompare(): void {
		this.compareSvc.startCompare();
	}

	/**
	 * Double-click text edit entry: equations open the equation editor instead
	 * of the inline text editor (mirrors React's dbl-click-to-edit-equation).
	 */
	protected onTextEditStart(id: string): void {
		const element = this.activeSlide()?.elements.find((el) => el.id === id);
		const segments = element && 'textSegments' in element ? element.textSegments : undefined;
		const equation = segments?.find((segment) => segment.equationXml);
		if (this.canEdit() && equation?.equationXml) {
			this.dialogs.openEquationEdit(id, equation.equationXml);
			return;
		}
		this.editingId.set(id);
	}

	/** Apply a Ctrl/Cmd+B/I/U toggle from the inline editor (undoable). */
	protected onTextFormat(event: { id: string; updates: Partial<TextStyle> }): void {
		if (!this.canEdit()) {
			return;
		}
		const element = this.activeSlide()?.elements.find((el) => el.id === event.id);
		if (!element) {
			return;
		}
		this.editor.updateElement(
			this.activeSlideIndex(),
			event.id,
			textStylePatch(element, event.updates),
		);
	}

	/** Swap the deck for a restored version-history snapshot. */
	protected onRestoreVersion(bytes: Uint8Array): void {
		this.contentOverride.set(bytes);
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
	 * Mobile "Format" slot: surface the inspector for the current selection. The
	 * inspector renders inline (below the canvas) whenever an element is selected
	 * and no other right-docked panel is open, so closing any open panel reveals
	 * it. With nothing selected this is a no-op (the slide-properties panel shows
	 * instead).
	 */
	protected onMobileFormat(): void {
		this.activePanel.set(null);
		this.mobileSheetSvc.mobileSheet.set(null);
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

	/**
	 * Handle an element press from the canvas. Additive (Shift/Ctrl) toggles
	 * membership; a plain press selects the element (keeping it selected if it
	 * already was, so a subsequent drag works).
	 */
	onElementSelect(event: { id: string; additive: boolean }): void {
		// The armed format painter intercepts the next element click: apply the
		// copied format to the target, then disarm (no selection change).
		if (this.formatPainter.active()) {
			this.formatPainter.applyToTarget(event.id);
			this.formatPainter.cancel();
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
		if (this.formatPainter.active()) {
			this.formatPainter.cancel();
			return;
		}
		this.editor.clearSelection();
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
	 * Persist a structural table change originating on the canvas (column / row
	 * drag-resize) as one undoable history entry.
	 */
	protected onTableChange(event: { id: string; tableData: PptxTableData }): void {
		if (!this.canEdit()) {
			return;
		}
		this.editor.updateElement(this.activeSlideIndex(), event.id, {
			tableData: event.tableData,
		});
	}

	/**
	 * Editing keyboard shortcuts (only when `canEdit` and not typing in a
	 * field or presenting). The decorator must live on the component; the logic
	 * is delegated to {@link ViewerKeyboardService}.
	 */
	@HostListener('document:keydown', ['$event'])
	onKeyDown(event: KeyboardEvent): void {
		this.keyboard.handleKeyDown(event);
	}

	/** Resolve the live slide-stage element within `<main>`. */
	private stageElement(): HTMLElement | undefined {
		return (
			this.mainEl()?.nativeElement.querySelector<HTMLElement>('.pptx-ng-canvas-stage') ?? undefined
		);
	}
}
