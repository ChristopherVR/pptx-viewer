import { NgClass, NgStyle } from '@angular/common';
import {
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
import { TranslatePipe } from '@ngx-translate/core';
import type {
	MasterViewTab,
	PptxComment,
	PptxCoreProperties,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
} from 'pptx-viewer-core';

import type { ViewerSettings, ViewerTheme } from '../internal/shared';
import { themeStyle } from '../theme/viewer-theme';
import { AccessibilityPanelComponent } from './accessibility-panel.component';
import { AccessibilityService } from './accessibility.service';
import { AutosaveService } from './autosave.service';
import { BroadcastDialogComponent } from './broadcast-dialog.component';
import { ChartPartSelectionService } from './chart-part-selection.service';
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
import { newChartElement, newShapeElement, newTableElement, newTextElement } from './editor-insert';
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
import { InspectorPanelComponent } from './inspector-panel.component';
import { IsMobileService } from './is-mobile';
import { LoadContentService } from './load-content.service';
import { MasterViewCanvasComponent } from './master-view-canvas.component';
import { MasterViewSidebarComponent } from './master-view-sidebar.component';
import { MobileBottomBarComponent } from './mobile-bottom-bar.component';
import type { MobileBarSheet } from './mobile-bottom-bar.component';
import { MobileMenuSheetComponent } from './mobile-menu-sheet.component';
import { MobilePresenterViewComponent } from './mobile-presenter-view.component';
import { MobileSlidesSheetComponent } from './mobile-slides-sheet.component';
import { MobileToolbarComponent } from './mobile-toolbar.component';
import { NotesPanelComponent } from './notes-panel.component';
import { PresentationOverlayComponent } from './presentation-overlay.component';
import { PresenterViewComponent } from './presenter-view.component';
import { parseAudienceNonce, PresenterWindowService } from './presenter-window.service';
import { PrintDialogComponent } from './print-dialog.component';
import { PrintService } from './print.service';
import { PropertiesDialogComponent } from './properties-dialog.component';
import { RehearseTimingsComponent } from './rehearse-timings.component';
import { RemoteSelectionOverlayComponent } from './remote-selection-overlay.component';
import { patchTextStyle } from './ribbon-text-helpers';
import { RibbonComponent } from './ribbon.component';
import { SelectionPaneComponent } from './selection-pane.component';
import { ShareDialogComponent } from './share-dialog.component';
import { SignaturesPanelComponent } from './signatures-panel.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';
import { SlideThemeOverridePanelComponent } from './slide-theme-override-panel.component';
import { SlidesPanelComponent } from './slides-panel.component';
import { SmartArt3DService } from './smart-art-3d.service';
import { buildSmartArtInsertElement } from './smart-art-insert-helpers';
import { StatusBarComponent } from './status-bar.component';
import { TableSelectionService } from './table-selection.service';
import { buildSaveSlides } from './template-mode';
import { ThemeGalleryComponent } from './theme-gallery.component';
import { TitleBarComponent } from './title-bar.component';
import type { CollaborationConfig } from './types';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';
import { ViewerCollabCursorService } from './viewer-collab-cursor.service';
import { ViewerCollaborationSessionService } from './viewer-collaboration-session.service';
import { ViewerCompareService } from './viewer-compare.service';
import { ViewerCustomShowsService } from './viewer-custom-shows.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { ViewerDocumentPropertiesService } from './viewer-document-properties.service';
import { ViewerExportService } from './viewer-export.service';
import { ViewerExtraDialogsComponent } from './viewer-extra-dialogs.component';
import { ViewerFileIOService } from './viewer-file-io.service';
import { ViewerFindReplaceService } from './viewer-find-replace.service';
import { ViewerFormatPainterService } from './viewer-format-painter.service';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';
import { ViewerKeyboardService } from './viewer-keyboard.service';
import { ViewerMobileSheetService } from './viewer-mobile-sheet.service';
import { ViewerPresentationModeService } from './viewer-presentation-mode.service';
import { ViewerThemeGalleryService } from './viewer-theme-gallery.service';
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
		ChartPartSelectionService,
		TableSelectionService,
		EmbeddedFontsService,
		CollaborationService,
		AccessibilityService,
		AutosaveService,
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
		ViewerCanvasEditingService,
		ViewerCollabCursorService,
		ViewerDocumentPropertiesService,
		ViewerFileIOService,
		ViewerFormatPainterService,
		ViewerInspectorPanelService,
		ViewerKeyboardService,
		ViewerMobileSheetService,
		ViewerPresentationModeService,
		ViewerThemeGalleryService,
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
		SlideThemeOverridePanelComponent,
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
		MasterViewCanvasComponent,
		MasterViewSidebarComponent,
		NotesPanelComponent,
		RibbonComponent,
		TitleBarComponent,
		ThemeGalleryComponent,
		SelectionPaneComponent,
		CustomShowsComponent,
		InsertSmartArtDialogComponent,
		ViewerExtraDialogsComponent,
		RehearseTimingsComponent,
		TranslatePipe,
	],
	template: `
		<div
			class="pptx-ng-viewer"
			[ngClass]="[class(), reducedMotion() ? 'pptx-ng-reduced-motion' : '']"
			[ngStyle]="rootStyle()"
			[attr.aria-busy]="loader.loading()"
		>
			@if (loader.loading()) {
				<div class="pptx-ng-state pptx-ng-loading" role="status" aria-live="polite">
					<div class="pptx-ng-spinner" aria-hidden="true"></div>
					<p>{{ 'pptx.viewer.loading' | translate }}</p>
				</div>
			} @else if (loader.isEncrypted()) {
				<div class="pptx-ng-state pptx-ng-error" role="alert">
					<p>{{ 'pptx.viewer.encrypted' | translate }}</p>
				</div>
			} @else if (loader.error()) {
				<div class="pptx-ng-state pptx-ng-error" role="alert">
					<p>{{ 'pptx.viewer.loadError' | translate }}</p>
					<pre class="pptx-ng-error-detail">{{ loader.error() }}</pre>
				</div>
			} @else {
				@if (!mobile.isMobile()) {
					<pptx-title-bar
						[canEdit]="canEdit()"
						[fileName]="fileName()"
						[isDirty]="editor.dirty()"
						[autosaveStatus]="autosave.status()"
						[autosaveEnabled]="autosaveEnabled()"
						[canUndo]="editor.canUndo()"
						[canRedo]="editor.canRedo()"
						[undoLabel]="editor.undoLabel()"
						[redoLabel]="editor.redoLabel()"
						[findReplaceOpen]="findReplace.showFind() || findReplace.showFindReplace()"
						(toggleAutosave)="autosaveEnabled.update(v => !v)"
						(save)="fileIO.saveAsPptx()"
						(undo)="editor.undo()"
						(redo)="editor.redo()"
						(toggleFindReplace)="toggleFindReplace()"
						(commandSearch)="handleCommandSearch($event)"
					/>
					<pptx-ribbon
					[slideIndex]="activeSlideIndex()"
					[slideCount]="slideCount()"
					[canEdit]="canEdit()"
					[selectedElement]="selectedElement()"
					[zoomPercent]="zoomSvc.zoomPercent()"
					[formatPainterActive]="formatPainter.active()"
					[canActivateFormatPainter]="formatPainter.canActivate()"
					[exporting]="xport.exporting()"
					[hasMacros]="loader.hasMacros()"
					[sidebarCollapsed]="slidesPanelCollapsed()"
					[inspectorOpen]="inspectorPanel.inspectorPaneOpen()"
					[commentsOpen]="inspectorPanel.activePanel() === 'comments'"
					[commentCount]="activeComments().length"
					[findOpen]="findReplace.showFind() || findReplace.showFindReplace()"
					[collabConnected]="collab.connected()"
					[connectedCount]="collab.connectedCount()"
					(toggleSidebar)="slidesPanelCollapsed.update(v => !v)"
					[spellCheckEnabled]="spellCheck()"
					(prev)="goPrev()"
					(next)="goNext()"
					(zoomIn)="zoomSvc.zoomIn()"
					(zoomOut)="zoomSvc.zoomOut()"
					(zoomReset)="zoomSvc.zoomReset()"
					(find)="findReplace.showFind.set(true)"
					(present)="presentationMode.present()"
					(presenter)="presentationMode.presentPresenter()"
					(record)="presentationMode.startRehearsalFromCurrent()"
					(recordFromBeginning)="presentationMode.startRehearsalFromBeginning()"
					(recordFromCurrent)="presentationMode.startRehearsalFromCurrent()"
					(spellCheckChange)="spellCheck.set($event)"
					(share)="session.showShare.set(true)"
					(broadcast)="session.showBroadcast.set(true)"
					(openFile)="fileIO.openFile()"
					(save)="fileIO.saveAsPptx()"
					(savePpsx)="fileIO.saveAsPpsx()"
					(savePptm)="fileIO.saveAsPptm()"
					(packageForSharing)="fileIO.packageForSharing()"
					(info)="docProperties.showProperties.set(true)"
					(print)="print.openDialog()"
					(comments)="inspectorPanel.togglePanel('comments')"
					(signatures)="inspectorPanel.togglePanel('signatures')"
					(a11y)="inspectorPanel.togglePanel('accessibility')"
					(link)="docProperties.showHyperlink.set(true)"
					(openSorter)="showSorter.set(true)"
					(toggleNotes)="mobileSheetSvc.toggleNotes()"
					(toggleFormatPainter)="formatPainter.toggle()"
					(exportPng)="xport.exportPng()"
					(exportPdf)="xport.exportPdf()"
					(exportGif)="xport.exportGif()"
					(exportVideo)="xport.exportVideo()"
					(copySlideAsImage)="xport.copySlideAsImage()"
					(replace)="findReplace.openFindReplace()"
					(toggleInspector)="inspectorPanel.toggleFormatPanel()"
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
					[themeGalleryOpen]="themeGallery.showThemeGallery()"
					(toggleThemeGallery)="themeGallery.showThemeGallery.update(v => !v)"
					(toggleSelectionPane)="inspectorPanel.togglePanel('selection')"
					(openCustomShows)="customShowsCtl.showDialog.set(true)"
					(openSmartArtDialog)="showSmartArtInsert.set(true)"
					(openEquationDialog)="dialogs.openEquationInsert()"
					(openMasterView)="openMasterView()"
					(openSetUpSlideShow)="dialogs.showSetUpSlideShow.set(true)"
					(openCompare)="onOpenCompare()"
					(openPassword)="dialogs.showPassword.set(true)"
					(openFontEmbedding)="dialogs.showFontEmbedding.set(true)"
					(openVersionHistory)="dialogs.showVersionHistory.set(true)"
					(openShortcuts)="dialogs.showShortcuts.set(true)"
					(openSettings)="dialogs.showSettings.set(true)"
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
						(save)="fileIO.saveAsPptx()"
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

					<main class="pptx-ng-main" #mainEl (pointermove)="collabCursor.onPointerMove($event)">
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
							[spellCheck]="spellCheck()"
							[snapToGuides]="showGuides()"
							[drawTool]="activeDrawTool()"
							[drawColor]="activeDrawColor()"
							[drawWidth]="activeDrawWidth()"
							[editTemplateMode]="editor.editTemplateMode()"
							[templateElements]="activeTemplateElements()"
							(elementSelect)="canvasEditing.onElementSelect($event)"
							(backgroundClick)="canvasEditing.onBackgroundClick()"
							(marqueeSelect)="editor.select($event)"
							(transformStart)="editor.beginTransform($event.label)"
							(transformUpdate)="editor.applyTransform(activeSlideIndex(), $event.id, $event.box)"
							(rotateUpdate)="
								editor.applyTransform(activeSlideIndex(), $event.id, { rotation: $event.rotation })
							"
							(contextMenu)="canvasEditing.onContextMenu($event)"
							[editingId]="canvasEditing.editingId()"
							(textEditStart)="canvasEditing.onTextEditStart($event.id)"
							(textCommit)="canvasEditing.onTextCommit($event)"
							(textCancel)="canvasEditing.editingId.set(null)"
							(textFormat)="canvasEditing.onTextFormat($event)"
							(inkStrokeComplete)="canvasEditing.onInkStrokeComplete($event)"
							(eraserHit)="canvasEditing.onEraserHit($event)"
							(cellCommit)="canvasEditing.onTableCellCommit($event)"
							(tableChange)="canvasEditing.onTableChange($event)"
						/>
						@if (collab.connected()) {
							<pptx-collaboration-cursors [cursors]="collabCursor.cursors()" [zoom]="zoomSvc.zoom()" />
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
						@if (canEdit() && !mobile.isMobile()) {
							<aside class="pptx-ng-notes" [attr.aria-label]="'pptx.notes.speakerNotes' | translate">
								<pptx-notes-panel
									[slide]="activeSlide()"
									[expanded]="mobileSheetSvc.showNotes()"
									(update)="canvasEditing.onNotesUpdate($event)"
									(notesToggle)="mobileSheetSvc.toggleNotes()"
								/>
							</aside>
						}
					</main>

					<!--
						Single inspector host for every right-rail panel. On mobile it docks
						full-width below the canvas and is swipe-dismissable (the grab handle
						feeds inspectorPanel.inspectorDrag's onPointerDown/Move/Up); a downward
						swipe past the threshold sets mobileInspectorHidden so the user
						reclaims the canvas.
					-->
					@if (inspectorPanel.visibleInspectorKind(); as kind) {
						<aside
							data-pptx-inspector
							class="pptx-ng-inspector-host"
							[attr.aria-label]="inspectorPanel.inspectorLabel() | translate"
							[style.transform]="
								inspectorPanel.inspectorDrag.dragY() > 0 ? 'translateY(' + inspectorPanel.inspectorDrag.dragY() + 'px)' : null
							"
							[style.transition]="inspectorPanel.inspectorDrag.dragging() ? 'none' : 'transform 150ms ease-out'"
						>
							<!-- Swipe-down-to-dismiss grab handle (mobile only; hidden on desktop). -->
							<div
								class="pptx-ng-idrawer-grab"
								(pointerdown)="inspectorPanel.inspectorDrag.onPointerDown($event)"
								(pointermove)="inspectorPanel.inspectorDrag.onPointerMove($event)"
								(pointerup)="inspectorPanel.inspectorDrag.onPointerUp($event)"
								(pointercancel)="inspectorPanel.inspectorDrag.onPointerUp($event)"
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
										(bringForward)="canvasEditing.onSelectionPaneBringForward($event)"
										(sendBackward)="canvasEditing.onSelectionPaneSendBackward($event)"
										(toggleHidden)="canvasEditing.onToggleElementHidden($event)"
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
														(change)="canvasEditing.onSlideBackground($event)"
													/>
												</label>
												<label class="pptx-ng-prop-row pptx-ng-prop-col">
													<span>{{ 'pptx.notes.title' | translate }}</span>
													<textarea
														rows="5"
														[attr.placeholder]="'pptx.viewer.speakerNotesPlaceholder' | translate"
														(change)="canvasEditing.onSlideNotes($event)"
														(blur)="canvasEditing.onSlideNotes($event)"
														>{{ sl.notes || '' }}</textarea
													>
												</label>
												<pptx-slide-theme-override-panel
													[slide]="sl"
													[theme]="loader.theme()"
													(patch)="editor.updateSlide(activeSlideIndex(), $event)"
												/>
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
						[autosaveStatus]="autosave.status()"
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

			@if (showMasterView()) {
				<div class="pptx-ng-master-overlay" role="dialog" [attr.aria-label]="'pptx.view.masterViews' | translate">
					<pptx-master-view-sidebar
						[tab]="masterViewTab()"
						[slideMasters]="loader.slideMasters()"
						[notesMaster]="loader.notesMaster()"
						[handoutMaster]="loader.handoutMaster()"
						[activeMasterIndex]="activeMasterIndex()"
						[activeLayoutIndex]="activeLayoutIndex()"
						[handoutSlidesPerPage]="loader.handoutMaster()?.slidesPerPage ?? 4"
						(tabChange)="selectMasterTab($event)"
						(selectMaster)="activeMasterIndex.set($event); activeLayoutIndex.set(null)"
						(selectLayout)="activeMasterIndex.set($event.masterIndex); activeLayoutIndex.set($event.layoutIndex)"
						(slidesPerPageChange)="setHandoutSlidesPerPage($event)"
						(backgroundChange)="setMasterBackground($event)"
						(close)="closeMasterView()"
					/>
					<pptx-master-view-canvas
						[tab]="masterViewTab()"
						[slideMasters]="loader.slideMasters()"
						[activeMasterIndex]="activeMasterIndex()"
						[activeLayoutIndex]="activeLayoutIndex()"
						[notesMaster]="loader.notesMaster()"
						[handoutMaster]="loader.handoutMaster()"
						[canvasSize]="loader.canvasSize()"
						[mediaDataUrls]="loader.mediaDataUrls()"
						[editable]="canEdit()"
						(notesMasterChange)="updateNotesMaster($event)"
						(handoutMasterChange)="updateHandoutMaster($event)"
					/>
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

			@if (presentationMode.presenting()) {
				<pptx-presentation-overlay
					[slides]="customShowsCtl.presentationSlides()"
					[canvasSize]="loader.canvasSize()"
					[mediaDataUrls]="loader.mediaDataUrls()"
					[startIndex]="customShowsCtl.presentationStartIndex()"
					[showWithAnimation]="loader.presentationProperties().showWithAnimation"
					(indexChange)="presentationMode.onPresentationIndexChange($event)"
					(annotationsExit)="presentationMode.onPresentationAnnotationsExit($event)"
					(closed)="presentationMode.closePresentation()"
				/>
			}
			@if (presentationMode.rehearsing()) {
				<pptx-rehearse-timings
					[slideStartedAt]="presentationMode.slideStartedAt()"
					[presentationStartedAt]="presentationMode.rehearsalStartedAt()"
					[paused]="presentationMode.rehearsalPaused()"
					[timings]="presentationMode.recordedTimings()"
					(togglePause)="presentationMode.toggleRehearsalPause()"
				/>
			}
			@if (presentationMode.showRehearsalSummary()) {
				<pptx-rehearse-timings
					[summary]="true"
					[timings]="presentationMode.recordedTimings()"
					(save)="presentationMode.saveRehearsalTimings()"
					(discard)="presentationMode.dismissRehearsalSummary()"
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
						(navigateToSlide)="goTo($event)"
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

			@if (canEdit() && canvasEditing.contextMenuPos(); as m) {
				<pptx-editor-context-menu
					[x]="m.x"
					[y]="m.y"
					[slideIndex]="activeSlideIndex()"
					(closed)="canvasEditing.contextMenuPos.set(null)"
				/>
			}

			<pptx-theme-gallery
				[open]="themeGallery.showThemeGallery()"
				[activeName]="themeGallery.activeThemeName()"
				[theme]="loader.theme()"
				(applyTheme)="themeGallery.applyThemePreset($event)"
				(applyCustomTheme)="themeGallery.applyCustomTheme($event.colorScheme, $event.fontScheme, $event.name)"
				(close)="themeGallery.showThemeGallery.set(false)"
			/>

			<pptx-properties-dialog
				[open]="docProperties.showProperties()"
				[properties]="docProperties.coreProperties()"
				(save)="docProperties.onPropertiesSave($event)"
				(close)="docProperties.showProperties.set(false)"
			/>

			<!-- Secondary dialogs / side panels (equation, set-up show, password,
			     encrypted notice, compare, font embedding, version history,
			     shortcuts, keep-annotations, signature-stripped). -->
			<pptx-viewer-extra-dialogs
				[activeSlideIndex]="activeSlideIndex()"
				[selectedElementId]="selectedElement()?.id ?? null"
				[filePath]="filePath()"
				[customShows]="customShowsCtl.pptxCustomShows()"
				[settings]="viewerSettings()"
				(restoreContent)="onRestoreVersion($event)"
				(settingsChange)="onSettingsChange($event)"
			/>

			@if (canEdit()) {
				<pptx-hyperlink-dialog
					[open]="docProperties.showHyperlink()"
					[element]="selectedElement()"
					(save)="docProperties.onHyperlinkSave($event)"
					(close)="docProperties.showHyperlink.set(false)"
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
					(openFile)="fileIO.openFile()"
					(savePptx)="fileIO.saveAsPptx()"
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
						<pptx-notes-panel
							[slide]="activeSlide()"
							[expanded]="true"
							(update)="canvasEditing.onNotesUpdate($event)"
							(notesToggle)="mobileSheetSvc.toggleNotes()"
						/>
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
					(openComments)="inspectorPanel.togglePanel('comments')"
					(notes)="mobileSheetSvc.toggleNotes()"
				/>
			}
		</div>
	`,
})
export class PowerPointViewerComponent {
	/** PowerPoint content as Uint8Array (or ArrayBuffer). */
	readonly content = input<Uint8Array | ArrayBuffer | null>(null);
	/** Licensed fonts supplied by the host application. No fonts are bundled. */
	readonly fontsInput = input<import('../internal/shared').ViewerFontSource[]>([], {
		alias: 'fonts',
	});
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
	/**
	 * Display name of the open document, shown in the title bar next to the
	 * save-location status. Falls back to a localised "Presentation" when omitted.
	 * Mirrors React's `fileName` prop.
	 */
	readonly fileName = input<string | undefined>(undefined);
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
	/** Fired when the viewer mode changes (preview, edit, present, master). */
	readonly modeChange = output<string>();
	/** Fired when the zoom level changes. */
	readonly zoomChange = output<number>();
	/** Fired when element selection changes. */
	readonly selectionChange = output<string[]>();
	/** Fired when the total slide count changes (slide added/deleted). */
	readonly slideCountChange = output<number>();
	/**
	 * Fired when a collaboration/broadcast session starts, with the connected
	 * config (role `collaborator` for Share, `owner` for Broadcast). Lets the
	 * host rewrite the URL and publish the deck. Mirrors React/Vue.
	 */
	readonly startCollaboration = output<CollaborationConfig>();
	/** Fired when the collaboration/broadcast session stops. Mirrors React/Vue. */
	readonly stopCollaboration = output<void>();

	protected readonly loader = inject(LoadContentService);
	protected readonly editor = inject(EditorStateService);
	private readonly fonts = inject(EmbeddedFontsService);
	protected readonly collab = inject(CollaborationService);
	protected readonly accessibility = inject(AccessibilityService);
	protected readonly autosave = inject(AutosaveService);
	protected readonly print = inject(PrintService);
	protected readonly mobile = inject(IsMobileService);
	private readonly smartArt3DSvc = inject(SmartArt3DService);
	private readonly zoomTarget = inject(ZoomTargetService);
	protected readonly presenterWindow = inject(PresenterWindowService);
	private readonly destroyRef = inject(DestroyRef);
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
	protected readonly inspectorPanel = inject(ViewerInspectorPanelService);
	protected readonly fileIO = inject(ViewerFileIOService);
	protected readonly themeGallery = inject(ViewerThemeGalleryService);
	protected readonly canvasEditing = inject(ViewerCanvasEditingService);
	protected readonly collabCursor = inject(ViewerCollabCursorService);
	protected readonly docProperties = inject(ViewerDocumentPropertiesService);

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

	/** Slide-sorter grid overlay visibility. */
	protected readonly showSorter = signal(false);
	/** Full-canvas master editor visibility and active target. */
	protected readonly showMasterView = signal(false);
	protected readonly masterViewTab = signal<MasterViewTab>('slides');
	protected readonly activeMasterIndex = signal(0);
	protected readonly activeLayoutIndex = signal<number | null>(null);
	/** Whether the left slides panel is collapsed (top-bar sidebar toggle). */
	protected readonly slidesPanelCollapsed = signal(false);
	/** Whether periodic autosave is enabled (title-bar AutoSave toggle; default on). */
	protected readonly autosaveEnabled = signal(true);

	// ── Draw tool state (forwarded to slide-canvas) ───────────────────────────
	/** Active drawing tool (from the ribbon Draw tab). */
	protected readonly activeDrawTool = signal<
		'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform'
	>('select');
	/** Active ink stroke colour. */
	protected readonly activeDrawColor = signal<string>('#000000');
	/** Active ink stroke width in stage pixels. */
	protected readonly activeDrawWidth = signal<number>(3);

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
		if (this.inspectorPanel.activePanel() === 'comments') {
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
	/** Comments on the active slide. */
	protected readonly activeComments = computed<PptxComment[]>(
		() => this.activeSlide()?.comments ?? [],
	);
	/** Whether the dot-grid overlay is visible on the editor canvas. */
	protected readonly showGrid = signal(false);
	/** Whether ruler strips are visible on the editor canvas. */
	protected readonly showRulers = signal(false);
	/** Whether center-crosshair guide lines are visible on the editor canvas. */
	protected readonly showGuides = signal(false);
	/** Whether snap-to-grid is active on the editor canvas. */
	protected readonly snapToGrid = signal(false);
	/** Whether browser spell-check is active in the inline text editor. */
	protected readonly spellCheck = signal(false);
	/** User override that suppresses viewer animations and transitions. */
	protected readonly reducedMotion = signal(false);
	/** Snapshot consumed by the settings dialog. */
	protected readonly viewerSettings = computed<ViewerSettings>(() => ({
		autoSave: this.autosaveEnabled(),
		spellCheck: this.spellCheck(),
		showGrid: this.showGrid(),
		showRulers: this.showRulers(),
		snapToGrid: this.snapToGrid(),
		reducedMotion: this.reducedMotion(),
	}));
	/** Whether the Insert SmartArt gallery dialog is open. */
	protected readonly showSmartArtInsert = signal(false);
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

	constructor() {
		// Surface the `smartArt3D` opt-in to the element dispatcher via the
		// viewer-scoped SmartArt3DService.
		effect(() => {
			this.smartArt3DSvc.enabled.set(this.smartArt3D());
		});

		// A new host `content` input supersedes any in-place picked file.
		effect(() => {
			this.content();
			this.fileIO.contentOverride.set(null);
		});

		// Load whenever the active content (picked override, else input) changes.
		effect(() => {
			void this.loader.load(this.fileIO.activeContent());
		});

		// Reset to the first slide and seed the editable deck whenever a new
		// presentation finishes loading.
		effect(() => {
			const slides = this.loader.slides();
			this.editor.setSlides(slides, this.loader.sections());
			this.activeSlideIndex.set(0);
		});

		// Selecting an element re-opens the inspector if a prior swipe had hidden
		// it on mobile — tapping a shape to edit it should surface its properties.
		effect(() => {
			if (this.selectedElement()) {
				this.inspectorPanel.mobileInspectorHidden.set(false);
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

		// Emit mode changes.
		effect(() => {
			const mode = this.presentationMode.presenting()
				? 'present'
				: this.editor.editTemplateMode()
					? 'master'
					: this.canEdit()
						? 'edit'
						: 'preview';
			this.modeChange.emit(mode);
		});

		// Emit zoom changes.
		effect(() => {
			this.zoomChange.emit(this.zoomSvc.zoom());
		});

		// Emit selection changes.
		effect(() => {
			this.selectionChange.emit([...this.editor.selectedIds()]);
		});

		// Emit slide count changes.
		effect(() => {
			this.slideCountChange.emit(this.slideCount());
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
		effect(() => {
			this.fonts.setHostFonts(this.fontsInput());
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

		// Hand the custom-shows controller the active-slide-index accessor (so a
		// normal show starts at the current slide) and the LIVE edited-slides
		// accessor (so present mode reflects in-session edits like inserted media,
		// mirroring React/Vue) rather than the pristine loaded deck.
		this.customShowsCtl.bind({
			activeSlideIndex: () => this.activeSlideIndex(),
			liveSlides: () => this.displaySlidesMut(),
		});

		// Hand the collaboration-session controller the host inputs it cannot own
		// (author name, share defaults, template-element supplier) and the
		// start/stop output emitters.
		this.session.bind({
			authorName: () => this.authorName(),
			shareDefaults: () => this.shareDefaults(),
			getTemplateElements: () => this.editor.templateElementsBySlideId(),
			applyRemoteSlides: (slides) => this.editor.applyRemoteSlides(slides),
			canvasSize: () => this.loader.canvasSize(),
			getSourceBytes: () => this.fileIO.sourceBytes(),
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
			setContextMenuPos: (pos) => this.canvasEditing.contextMenuPos.set(pos),
		});

		// Hand the presentation-mode controller the few accessors it alone needs
		// from the component (active-slide-index get/set, editing/selection
		// clearing, the source bytes for the audience hand-off, and the
		// keep-annotations prompt trigger on the extra-dialogs host).
		this.presentationMode.bind({
			slideCount: () => this.slideCount(),
			activeSlideIndex: () => this.activeSlideIndex(),
			setActiveSlideIndex: (index) => this.activeSlideIndex.set(index),
			clearEditing: () => this.canvasEditing.editingId.set(null),
			clearSelection: () => this.editor.clearSelection(),
			sourceContent: () => this.fileIO.activeContent(),
			canEdit: () => this.canEdit(),
			promptKeepAnnotations: (map) => this.extraDialogs()?.promptKeepAnnotations(map),
			applyRehearsalTimings: (timings) => {
				const slides = this.editor.snapshot().map((slide, index) => {
					const advanceAfterMs = timings[index];
					return typeof advanceAfterMs !== 'number'
						? slide
						: {
								...slide,
								transition: {
									...slide.transition,
									type: slide.transition?.type ?? 'none',
									advanceAfterMs,
								},
							};
				});
				this.editor.applyReplacement(slides, 'Rehearse timings');
			},
		});
		if (parseAudienceNonce()) {
			const disconnectAudience = this.presenterWindow.connectAudience(
				(index) => this.activeSlideIndex.set(index),
				() => this.presentationMode.presenting.set(false),
			);
			this.presentationMode.presenting.set(true);
			this.destroyRef.onDestroy(disconnectAudience);
		}

		// Hand the mobile-sheet controller the accessors its quick-insert action
		// needs from the component.
		this.mobileSheetSvc.bind({
			canEdit: () => this.canEdit(),
			slideCount: () => this.slideCount(),
			activeSlideIndex: () => this.activeSlideIndex(),
		});

		// Hand the inspector-panel controller the accessors its content
		// precedence needs from the component.
		this.inspectorPanel.bind({
			canEdit: () => this.canEdit(),
			selectedElement: () => this.selectedElement(),
			activeSlide: () => this.activeSlide(),
		});

		// Hand the file-IO controller the accessors it alone needs from the
		// component (canEdit, the host `content` input, the File ▸ Open override,
		// the editor's slides + template elements, and the contentChange emitter).
		this.fileIO.bind({
			canEdit: () => this.canEdit(),
			content: () => this.content(),
			onOpenFile: () => this.onOpenFile(),
			slides: () => this.editor.slides(),
			sections: () => this.editor.sections(),
			templateElementsBySlideId: () => this.editor.templateElementsBySlideId(),
			emitContentChange: (bytes) => this.contentChange.emit(bytes),
		});

		// Hand the canvas-editing controller the accessors it alone needs from the
		// component (canEdit / active-slide / active-slide-index).
		this.canvasEditing.bind({
			canEdit: () => this.canEdit(),
			activeSlide: () => this.activeSlide(),
			activeSlideIndex: () => this.activeSlideIndex(),
		});

		// Hand the collab-cursor controller the accessors it alone needs from the
		// component (the `<main>` host, zoom, canvas size, active-slide-index).
		this.collabCursor.bind({
			mainElement: () => this.mainEl()?.nativeElement,
			zoom: () => this.zoomSvc.zoom(),
			canvasSize: () => this.loader.canvasSize(),
			activeSlideIndex: () => this.activeSlideIndex(),
		});

		// Hand the document-properties controller the accessors/emitter it alone
		// needs from the component.
		this.docProperties.bind({
			canEdit: () => this.canEdit(),
			selectedElement: () => this.selectedElement(),
			activeSlideIndex: () => this.activeSlideIndex(),
			emitPropertiesChange: (patch) => this.propertiesChange.emit(patch),
		});

		// Hand the autosave engine the reactive accessors it reads (enabled toggle,
		// file-path key, dirty flag) and a deck serialiser. It writes a recovery
		// snapshot to the shared IndexedDB store every N seconds while dirty.
		this.autosave.bind({
			enabled: () => this.autosaveEnabled(),
			filePath: () => this.filePath(),
			isDirty: () => this.editor.dirty(),
			serialize: () => this.serializeForAutosave(),
		});
	}

	/**
	 * Serialise the current presentation to `.pptx` bytes (imperative handle).
	 * When editing, this serialises the editor's edited deck so changes persist.
	 */
	async getContent(): Promise<Uint8Array> {
		return this.fileIO.getContent();
	}

	protected openMasterView(): void {
		this.showMasterView.set(true);
		this.masterViewTab.set('slides');
		this.activeMasterIndex.set(0);
		this.activeLayoutIndex.set(null);
		this.modeChange.emit('master');
	}

	protected closeMasterView(): void {
		this.showMasterView.set(false);
		this.masterViewTab.set('slides');
		this.editor.clearSelection();
		this.modeChange.emit(this.canEdit() ? 'edit' : 'preview');
	}

	protected selectMasterTab(tab: MasterViewTab): void {
		this.masterViewTab.set(tab);
		this.editor.clearSelection();
	}

	protected setMasterBackground(backgroundColor: string): void {
		if (this.masterViewTab() === 'notes') {
			const current = this.loader.notesMaster();
			if (current) {
				this.updateNotesMaster({ ...current, backgroundColor });
			}
			return;
		}
		if (this.masterViewTab() === 'handout') {
			const current = this.loader.handoutMaster();
			if (current) {
				this.updateHandoutMaster({ ...current, backgroundColor });
			}
			return;
		}
		const masters = [...this.loader.slideMasters()];
		const index = this.activeMasterIndex();
		const current = masters[index];
		if (!current) {
			return;
		}
		const layoutIndex = this.activeLayoutIndex();
		if (layoutIndex === null) {
			masters[index] = { ...current, backgroundColor };
		} else {
			const layouts = [...(current.layouts ?? [])];
			const layout = layouts[layoutIndex];
			if (!layout) {
				return;
			}
			layouts[layoutIndex] = { ...layout, backgroundColor };
			masters[index] = { ...current, layouts };
		}
		this.loader.slideMasters.set(masters);
		this.editor.dirty.set(true);
	}

	protected setHandoutSlidesPerPage(slidesPerPage: number): void {
		const current = this.loader.handoutMaster();
		if (current) {
			this.updateHandoutMaster({ ...current, slidesPerPage });
		}
	}

	protected updateNotesMaster(master: PptxNotesMaster): void {
		this.loader.notesMaster.set(master);
		this.editor.dirty.set(true);
	}

	protected updateHandoutMaster(master: PptxHandoutMaster): void {
		this.loader.handoutMaster.set(master);
		this.editor.dirty.set(true);
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

	/** Undo the last editing action. No-op when nothing to undo. */
	undo(): void {
		this.editor.undo();
	}
	/** Redo the last undone action. No-op when nothing to redo. */
	redo(): void {
		this.editor.redo();
	}
	/** Whether an undo action is available. */
	canUndo(): boolean {
		return this.editor.canUndo();
	}
	/** Whether a redo action is available. */
	canRedo(): boolean {
		return this.editor.canRedo();
	}

	/** Get the current zoom level (1 = 100%). */
	getZoom(): number {
		return this.zoomSvc.zoom();
	}
	/** Set the zoom level (clamped to min/max bounds). */
	setZoom(level: number): void {
		this.zoomSvc.zoom.set(Math.min(Math.max(level, 0.2), 3));
	}
	/** Zoom in by one step. */
	zoomIn(): void {
		this.zoomSvc.zoomIn();
	}
	/** Zoom out by one step. */
	zoomOut(): void {
		this.zoomSvc.zoomOut();
	}
	/** Reset zoom to 100%. */
	zoomReset(): void {
		this.zoomSvc.zoomReset();
	}

	/** Get the current viewer mode. */
	getMode(): string {
		if (this.presentationMode.presenting()) {
			return 'present';
		}
		if (this.showMasterView() || this.editor.editTemplateMode()) {
			return 'master';
		}
		return this.canEdit() ? 'edit' : 'preview';
	}
	/** Switch the viewer mode (e.g. 'edit', 'preview', 'present'). */
	setMode(mode: string): void {
		if (mode === 'present') {
			this.presentationMode.present();
		} else if (mode === 'master') {
			this.openMasterView();
		} else {
			this.presentationMode.presenting.set(false);
			this.showMasterView.set(false);
			this.editor.setEditTemplateMode(false);
		}
	}

	/** Get the zero-based active slide index. */
	getActiveSlideIndex(): number {
		return this.activeSlideIndex();
	}
	/** Get the total number of slides. */
	getSlideCount(): number {
		return this.slideCount();
	}
	/** Whether the document has unsaved changes. */
	isDirty(): boolean {
		return this.editor.dirty();
	}

	/** Get the IDs of currently selected elements. */
	getSelectedElementIds(): string[] {
		return [...this.editor.selectedIds()];
	}
	/** Programmatically select elements by their IDs. */
	selectElements(ids: string[]): void {
		this.editor.selectedIds.set(ids);
	}
	/** Clear the current selection. */
	clearSelection(): void {
		this.editor.selectedIds.set([]);
	}

	/** Set the active slide by zero-based index (alias of goTo). */
	setActiveSlideIndex(index: number): void {
		this.goTo(index);
	}

	/** Get a read-only reference to all slides. */
	getSlides(): readonly PptxSlide[] {
		return this.displaySlides();
	}

	/** Get a single slide by zero-based index. */
	getSlide(index: number): PptxSlide | undefined {
		return this.displaySlides()[index];
	}

	/** Get the currently active slide. */
	getActiveSlide(): PptxSlide | undefined {
		return this.displaySlides()[this.activeSlideIndex()];
	}

	/** Add a blank slide after the given index (or after the active slide). */
	addSlide(afterIndex?: number): void {
		const idx = afterIndex ?? this.activeSlideIndex();
		this.editor.addSlide(idx);
	}

	/** Delete slides at the given zero-based indexes. */
	deleteSlides(indexes: number[]): void {
		for (const i of [...indexes].sort((a, b) => b - a)) {
			this.editor.deleteSlide(i);
		}
	}

	/** Duplicate slides at the given zero-based indexes. */
	duplicateSlides(indexes: number[]): void {
		for (const i of indexes) {
			this.editor.duplicateSlide(i);
		}
	}

	/** Move a slide from one position to another. */
	moveSlide(fromIndex: number, toIndex: number): void {
		this.editor.moveSlide(fromIndex, toIndex);
	}

	/** Toggle the hidden flag on slides at the given indexes. */
	toggleHideSlides(indexes: number[]): void {
		for (const i of indexes) {
			const s = this.displaySlides()[i];
			if (s) {
				this.editor.updateSlide(i, { hidden: !s.hidden });
			}
		}
	}

	/** Get elements on a slide (defaults to active slide). */
	getElements(slideIndex?: number): readonly PptxElement[] {
		const idx = slideIndex ?? this.activeSlideIndex();
		const s = this.displaySlides()[idx];
		return s?.elements ?? [];
	}

	/** Get a single element by ID. */
	getElementById(elementId: string, slideIndex?: number): PptxElement | undefined {
		const idx = slideIndex ?? this.activeSlideIndex();
		const s = this.displaySlides()[idx];
		return s?.elements.find((e) => e.id === elementId);
	}

	/** Update one or more properties of an element by ID. */
	updateElement(elementId: string, updates: Partial<PptxElement>): void {
		this.editor.updateElement(this.activeSlideIndex(), elementId, updates);
	}

	/** Delete elements by their IDs from the active slide. */
	deleteElements(elementIds: string[]): void {
		this.editor.selectedIds.set(elementIds);
		this.editor.deleteSelected(this.activeSlideIndex());
	}

	/** Duplicate an element. Returns the new element's ID. */
	duplicateElement(elementId: string): string | undefined {
		this.editor.selectedIds.set([elementId]);
		this.editor.duplicateSelected(this.activeSlideIndex());
		return this.editor.selectedIds()[0];
	}

	/** Toggle the Find & Replace panel from the title-bar search button. */
	protected toggleFindReplace(): void {
		if (this.findReplace.showFindReplace()) {
			this.findReplace.showFindReplace.set(false);
			return;
		}
		this.findReplace.openFindReplace();
	}

	/** Dispatch a command from the title-bar search palette. */
	protected handleCommandSearch(command: string): void {
		const [category, action] = command.split('.');
		switch (category) {
			case 'format':
				this.dispatchFormatCommand(action);
				break;
			case 'insert':
				this.dispatchInsertCommand(action);
				break;
			case 'view':
				this.dispatchViewCommand(action);
				break;
			case 'slideShow':
				if (action === 'fromBeginning') {
					this.presentationMode.present();
				} else if (action === 'presenterView') {
					this.presentationMode.presentPresenter();
				}
				break;
			case 'design':
				if (action === 'browseThemes') {
					this.themeGallery.showThemeGallery.update((v) => !v);
				} else if (action === 'slideSize') {
					this.dialogs.showSetUpSlideShow.set(true);
				}
				break;
			case 'arrange':
				this.dispatchArrangeCommand(action);
				break;
			case 'review':
				if (action === 'spelling') {
					this.findReplace.openFindReplace();
				} else if (action === 'accessibility') {
					this.inspectorPanel.togglePanel('accessibility');
				}
				break;
		}
	}

	private dispatchFormatCommand(action: string): void {
		const el = this.selectedElement();
		const idx = this.activeSlideIndex();
		switch (action) {
			case 'bold':
				patchTextStyle(this.editor, idx, el, { bold: true });
				break;
			case 'italic':
				patchTextStyle(this.editor, idx, el, { italic: true });
				break;
			case 'underline':
				patchTextStyle(this.editor, idx, el, { underline: true });
				break;
			case 'alignLeft':
				patchTextStyle(this.editor, idx, el, { align: 'left' });
				break;
			case 'alignCenter':
				patchTextStyle(this.editor, idx, el, { align: 'center' });
				break;
			case 'alignRight':
				patchTextStyle(this.editor, idx, el, { align: 'right' });
				break;
			case 'clear':
				patchTextStyle(this.editor, idx, el, {
					bold: false,
					italic: false,
					underline: false,
					strikethrough: false,
				});
				break;
		}
	}

	private dispatchInsertCommand(action: string): void {
		const idx = this.activeSlideIndex();
		switch (action) {
			case 'textBox':
				this.editor.addElement(idx, newTextElement());
				break;
			case 'shape':
				this.editor.addElement(idx, newShapeElement('rect'));
				break;
			case 'table':
				this.editor.addElement(idx, newTableElement());
				break;
			case 'chart':
				this.editor.addElement(idx, newChartElement('bar'));
				break;
			case 'smartArt':
				this.showSmartArtInsert.set(true);
				break;
			case 'equation':
				this.dialogs.openEquationInsert();
				break;
			case 'link':
				this.docProperties.showHyperlink.set(true);
				break;
		}
	}

	private dispatchViewCommand(action: string): void {
		switch (action) {
			case 'toggleGrid':
				this.showGrid.update((v) => !v);
				break;
			case 'toggleRulers':
				this.showRulers.update((v) => !v);
				break;
			case 'slideSorter':
				this.showSorter.set(true);
				break;
			case 'zoomToFit':
				this.zoomSvc.zoomReset();
				break;
		}
	}

	private dispatchArrangeCommand(action: string): void {
		switch (action) {
			case 'duplicate':
				this.editor.duplicateSelected(this.activeSlideIndex());
				break;
		}
	}

	/**
	 * Serialise the edited deck (templates merged back) to `.pptx` bytes for an
	 * autosave recovery snapshot. Returns null when the deck is read-only so the
	 * autosave engine skips the write. Distinct from {@link getContent}, this does
	 * NOT emit `contentChange` (autosave is a background recovery write, not a
	 * host-visible save).
	 */
	private async serializeForAutosave(): Promise<Uint8Array | null> {
		if (!this.canEdit()) {
			return null;
		}
		return this.loader.saveSlides(
			buildSaveSlides(this.editor.slides(), this.editor.templateElementsBySlideId()),
			'pptx',
			this.editor.sections(),
		);
	}

	/** Review ▸ Compare: pick a `.pptx` and diff it against the current deck. */
	protected onOpenCompare(): void {
		this.compareSvc.startCompare();
	}

	/** Swap the deck for a restored version-history snapshot. */
	protected onRestoreVersion(bytes: Uint8Array): void {
		this.fileIO.contentOverride.set(bytes);
	}

	/** Apply Settings dialog changes to the live editor state. */
	protected onSettingsChange(settings: ViewerSettings): void {
		this.autosaveEnabled.set(settings.autoSave);
		this.spellCheck.set(settings.spellCheck);
		this.showGrid.set(settings.showGrid);
		this.showRulers.set(settings.showRulers);
		this.snapToGrid.set(settings.snapToGrid);
		this.reducedMotion.set(settings.reducedMotion);
	}

	/**
	 * Mobile "Format" slot: surface the inspector for the current selection. The
	 * inspector renders inline (below the canvas) whenever an element is selected
	 * and no other right-docked panel is open, so closing any open panel reveals
	 * it. With nothing selected this is a no-op (the slide-properties panel shows
	 * instead).
	 */
	protected onMobileFormat(): void {
		this.inspectorPanel.activePanel.set(null);
		this.mobileSheetSvc.mobileSheet.set(null);
		// Reopen the inspector if a prior swipe-down had dismissed it.
		this.inspectorPanel.mobileInspectorHidden.set(false);
	}

	/** Receive draw-tool state changes from the ribbon Draw tab. */
	protected onDrawToolChange(state: { tool: string; color: string; width: number }): void {
		this.activeDrawTool.set(state.tool as 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform');
		this.activeDrawColor.set(state.color);
		this.activeDrawWidth.set(state.width);
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
