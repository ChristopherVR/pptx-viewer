import type { PptxAction, PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import {
	buildFieldSubstitutionContext,
	isPresentationAdvanceClick,
	PRESENT_TOOLBAR_CLASSES,
	shouldConfirmExternalHyperlink,
	toggleBlackboard,
} from 'pptx-viewer-shared';
/**
 * ViewerCanvasArea: The `<main>` element containing the slide canvas,
 * find/replace panel, and presentation annotation / toolbar overlays.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	FindReplacePanel,
	NotesMasterCanvas,
	HandoutMasterCanvas,
	SlideCanvas,
	PresentationAnnotationOverlay,
	PresentationSubtitleBar,
	PresentationTransitionOverlay,
	PresentationToolbar,
	PresentationTouchControls,
} from '.';
import type { CanvasInteractionHandlers } from '../hooks/useCanvasInteractions';
import type { InsertElementHandlers } from '../hooks/useInsertElements';
import type { UsePresentationAnnotationsResult } from '../hooks/usePresentationAnnotations';
import type { UsePresentationModeResult } from '../hooks/usePresentationMode';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import type { TableOperationHandlers } from '../hooks/useTableOperations';
import { useToolbarVisibility } from '../hooks/useToolbarVisibility';
import type { ViewerState } from '../hooks/useViewerState';
import type { UseZoomViewportResult } from '../hooks/useZoomViewport';
import type { CanvasSize, TableCellEditorState } from '../types';
import type { ViewerMode } from '../types-core';
import { safeOpenUrl, isPpactionUrl, parsePpactionUrl } from '../utils/hyperlink-security';
import type { TableStyleContext } from '../utils/table-parse';
import type { FieldSubstitutionContext } from '../utils/text-field-substitution';
import { CollaborationCursorOverlay, RemoteSelectionOverlay } from './collaboration';
import { PresentationStage } from './presentation/PresentationStage';
import { PresentationAudienceEffects } from './PresentationAudienceEffects';
import type { PresentationContextMenuState } from './PresentationContextMenu';
import { PresentationContextMenu } from './PresentationContextMenu';
import { PresentationEndOverlay } from './PresentationEndOverlay';
import { PresenterSlideNavigator } from './PresenterSlideNavigator';
import { useViewerOptionsContext } from './viewer-options-context';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerCanvasAreaProps {
	mode: ViewerMode;
	canEdit: boolean;
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	masterPseudoSlide: PptxSlide | undefined;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	activeSlideIndex: number;
	gridSpacingPx: number;
	zoom: UseZoomViewportResult;
	state: ViewerState;
	selectedElement: PptxElement | null;
	canvasHandlers: CanvasInteractionHandlers;
	insertHandlers: InsertElementHandlers;
	tableOps: TableOperationHandlers;
	annotations: UsePresentationAnnotationsResult;
	presentation: UsePresentationModeResult;
	/** Called when the user clicks the "end presentation" button on the toolbar. */
	onEndPresentation?: () => void;
	findReplace: {
		findReplaceOpen: boolean;
		findQuery: string;
		replaceQuery: string;
		findMatchCase: boolean;
		findResults: Array<{
			slideIndex: number;
			elementId: string;
			segmentIndex: number;
			startOffset: number;
			length: number;
		}>;
		findResultIndex: number;
		setFindQuery: (q: string) => void;
		setReplaceQuery: (q: string) => void;
		setFindMatchCase: (v: boolean) => void;
		performFind: () => void;
		navigateFindResult: (dir: 1 | -1) => void;
		handleReplace: () => void;
		handleReplaceAll: () => void;
		setFindReplaceOpen: (v: boolean) => void;
	};
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
	/** True while the AI panel is in "pick an element" mode. */
	aiPickMode?: boolean;
	/** Route a picked canvas element to the AI focus (pick mode). */
	onAiPickElement?: (slideIndex: number, elementId: string) => void;
	/** Overlay node drawing the AI focus highlight rings on the stage. */
	aiHighlightOverlay?: React.ReactNode;
	/** True while AI activity should tween element colour changes on the canvas. */
	aiCanvasActive?: boolean;
	/** Commits the slide's animation list after an on-canvas motion-path drag. */
	onUpdateSlideAnimations?: (animations: PptxElementAnimation[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerCanvasArea(props: ViewerCanvasAreaProps) {
	const {
		mode,
		canEdit,
		slides,
		activeSlide,
		masterPseudoSlide,
		templateElements,
		canvasSize,
		activeSlideIndex,
		gridSpacingPx,
		zoom,
		state: s,
		selectedElement,
		canvasHandlers,
		insertHandlers,
		tableOps,
		annotations,
		presentation,
		onEndPresentation,
		findReplace,
		hiddenActions,
		aiPickMode = false,
		onAiPickElement,
		aiHighlightOverlay,
		aiCanvasActive = false,
	} = props;
	const { t } = useTranslation();
	const { isHidden } = useToolbarVisibility(hiddenActions);
	const viewerOptions = useViewerOptionsContext();

	const effectiveSlide = mode === 'master' ? masterPseudoSlide : activeSlide;
	// In master mode the pseudo-slide already carries the master's artwork
	// behind the selected layout's (see `masterViewPseudoSlide` in
	// `pptx-viewer-shared`), so passing it again here would paint it twice and
	// leave the duplicate un-editable.
	const effectiveTemplateElements = mode === 'master' ? [] : templateElements;

	// ── Field substitution context ──────────────────────────────────────
	// Assembled by `pptx-viewer-shared` so all five bindings resolve fields
	// identically. In particular the slide title now comes from core's
	// `deriveSlideTitle`: the `placeholderType` property this used to scan for
	// is never set on a parsed deck, so `slidetitle` fields silently kept their
	// cached literal ("Title") on every real `.pptx`.
	const fieldContext = useMemo<FieldSubstitutionContext>(
		() =>
			buildFieldSubstitutionContext({
				headerFooter: s.headerFooter,
				customProperties: s.customProperties,
				slide: activeSlide,
			}),
		[s.headerFooter, s.customProperties, activeSlide],
	);

	// ── Table style context (theme + table style map for band colours) ──
	const tableStyleContext = useMemo<TableStyleContext | undefined>(() => {
		if (!s.theme && !s.tableStyleMap) {
			return undefined;
		}
		return { theme: s.theme, tableStyleMap: s.tableStyleMap };
	}, [s.theme, s.tableStyleMap]);

	// ── Action / hyperlink handlers ────────────────────────────────────
	// Trust Center gate: external http(s) links may require confirmation
	// before opening (Options > Trust Center > confirm external hyperlinks).
	const openExternalUrl = useCallback(
		(url: string) => {
			if (
				shouldConfirmExternalHyperlink(viewerOptions, url) &&
				!window.confirm(`${t('pptx.options.trust.confirmHyperlinks')}\n\n${url}`)
			) {
				return;
			}
			safeOpenUrl(url);
		},
		[viewerOptions, t],
	);

	const handleActionClick = useCallback(
		(_elementId: string, action: PptxAction) => {
			if (mode === 'present') {
				presentation.handlePresentationAction(action);
			} else if (action.url) {
				// In editing/view mode, only open external URLs (Ctrl+Click).
				// Slide-internal jumps are not meaningful outside presentation mode.
				openExternalUrl(action.url);
			}
		},
		[mode, presentation, openExternalUrl],
	);

	const handleHyperlinkClick = useCallback(
		(url: string) => {
			// Internal ppaction:// URLs (slide jumps, show jumps) are routed
			// through the presentation action handler instead of opening a tab.
			if (isPpactionUrl(url)) {
				if (mode === 'present') {
					const parsed = parsePpactionUrl(url);
					if (parsed) {
						const action: PptxAction = {
							action: parsed.action,
							targetSlideIndex: parsed.targetSlideIndex,
						};
						presentation.handlePresentationAction(action);
					}
				}
				return;
			}
			openExternalUrl(url);
		},
		[mode, presentation, openExternalUrl],
	);

	// ── Slide-show right-click menu ────────────────────────────────────
	// Options > Advanced > "Show menu on right mouse click": while presenting,
	// right-click opens a minimal Next/Previous/End Show menu; with the option
	// off, right-click is swallowed entirely (no browser menu either).
	const [presentationMenu, setPresentationMenu] = useState<PresentationContextMenuState | null>(
		null,
	);
	const handlePresentationContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (mode !== 'present') {
				return;
			}
			e.preventDefault();
			if (!viewerOptions.advanced.slideShowShowMenuOnRightClick) {
				return;
			}
			setPresentationMenu({ x: e.clientX, y: e.clientY });
		},
		[mode, viewerOptions.advanced.slideShowShowMenuOnRightClick],
	);

	// ── Slide-show click-to-advance ────────────────────────────────────
	// PowerPoint's "On Mouse Click". The dedicated presentation stage shipped
	// without it, so a running show could only be driven from the keyboard:
	// every click anywhere on the slide did nothing at all, which reads as a
	// slide show that is simply broken.
	//
	// Live slide content keeps its own clicks (hyperlinks, action buttons, zoom
	// tiles, media transport), a drawing tool owns the click while it is armed,
	// and the advance itself is `movePresentationSlide(1, 'click')` so the
	// current slide's `advanceOnClick` gate and pending animation builds are
	// honoured exactly as they are for a tap or swipe.
	const swipeHandledAtRef = useRef(0);
	const handleStageClick = useCallback(
		(e: React.MouseEvent) => {
			if (mode !== 'present') {
				return;
			}
			// A swipe fires its own advance on touchend and then still emits a
			// synthetic click; without this a single swipe would skip two slides.
			if (Date.now() - swipeHandledAtRef.current < 700) {
				return;
			}
			if (annotations.presentationTool !== 'none') {
				return;
			}
			if (!isPresentationAdvanceClick(e.target)) {
				return;
			}
			presentation.movePresentationSlide(1, 'click');
		},
		[annotations.presentationTool, mode, presentation],
	);

	// ── Blackboard toggle: black screen + pen armed / disarmed as a pair ──
	// `setPresentationTool` toggles a re-selected tool off, so the tool setter
	// is only invoked when the target differs from what is already armed.
	const handleToggleBlackboard = useCallback(() => {
		const next = toggleBlackboard(
			presentation.presenterSnapshot.blackout,
			annotations.presentationTool,
		);
		presentation.setPresenterBlackout(next.blackout);
		if (next.tool !== annotations.presentationTool) {
			annotations.setPresentationTool(next.tool);
		}
	}, [annotations, presentation]);

	// ── Toolbar hover handling: keep toolbar visible while hovering ────
	const toolbarHoveringRef = useRef(false);

	const handleToolbarMouseEnter = useCallback(() => {
		toolbarHoveringRef.current = true;
		// Force toolbar visible while hovering
		annotations.setToolbarVisible(true);
	}, [annotations]);

	const handleToolbarMouseLeave = useCallback(() => {
		toolbarHoveringRef.current = false;
	}, []);

	// ── Touch swipe navigation ─────────────────────────────────────────
	// Only in non-editing modes: in preview/present a horizontal swipe changes
	// slides; in edit/master, touch gestures belong to element drag/resize so
	// swipe-nav stays disabled to avoid hijacking them.
	const swipeEnabled = mode === 'preview' || mode === 'present';
	const handleSwipeNext = useCallback(() => {
		if (mode === 'present') {
			// A swipe/tap on the slide is PowerPoint's "on mouse click" advance, so
			// it is gated by the current slide's advanceOnClick transition flag.
			swipeHandledAtRef.current = Date.now();
			presentation.movePresentationSlide(1, 'click');
		} else {
			s.setActiveSlideIndex((i) => Math.min(slides.length - 1, i + 1));
		}
	}, [mode, presentation, s, slides.length]);
	const handleSwipePrev = useCallback(() => {
		if (mode === 'present') {
			swipeHandledAtRef.current = Date.now();
			presentation.movePresentationSlide(-1);
		} else {
			s.setActiveSlideIndex((i) => Math.max(0, i - 1));
		}
	}, [mode, presentation, s]);
	const swipe = useSwipeNavigation({
		enabled: swipeEnabled,
		onNext: handleSwipeNext,
		onPrev: handleSwipePrev,
	});

	// ── AI pick mode ───────────────────────────────────────────────────
	// While the AI panel is picking, the next element click(s) become the
	// assistant's focus (and get highlighted) instead of selecting / inline
	// editing. mousedown is swallowed so a pick never starts a drag.
	const pickActive = aiPickMode && Boolean(onAiPickElement) && mode === 'edit';
	const handleElementClick = pickActive
		? (elementId: string, e: React.MouseEvent) => {
				e.stopPropagation();
				onAiPickElement?.(activeSlideIndex, elementId);
			}
		: canvasHandlers.handleElementClick;
	const handleElementMouseDown = pickActive
		? (_elementId: string, e: React.MouseEvent) => {
				e.stopPropagation();
			}
		: canvasHandlers.handleElementMouseDown;

	return (
		// eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the canvas area hosts swipe navigation and the presentation-mode right-click menu; it has no interactive semantics of its own
		<main
			aria-label={t('pptx.viewer.slideEditorAria')}
			data-ai-pick-mode={pickActive ? 'true' : undefined}
			className={`flex-1 min-w-0 relative flex flex-col bg-background${pickActive ? ' cursor-crosshair' : ''}`}
			onTouchStart={swipe.onTouchStart}
			onTouchEnd={swipe.onTouchEnd}
			onContextMenu={mode === 'present' ? handlePresentationContextMenu : undefined}
		>
			{findReplace.findReplaceOpen && (
				<FindReplacePanel
					findQuery={findReplace.findQuery}
					replaceQuery={findReplace.replaceQuery}
					findMatchCase={findReplace.findMatchCase}
					findResults={findReplace.findResults}
					findResultIndex={findReplace.findResultIndex}
					onSetFindQuery={findReplace.setFindQuery}
					onSetReplaceQuery={findReplace.setReplaceQuery}
					onSetFindMatchCase={findReplace.setFindMatchCase}
					onPerformFind={findReplace.performFind}
					onNavigateResult={findReplace.navigateFindResult}
					onReplace={findReplace.handleReplace}
					onReplaceAll={findReplace.handleReplaceAll}
					onClose={() => findReplace.setFindReplaceOpen(false)}
				/>
			)}

			{mode === 'present' ? (
				<PresentationStage
					activeSlide={activeSlide}
					templateElements={templateElements}
					canvasSize={canvasSize}
					mediaDataUrls={s.mediaDataUrls}
					presentationElementStates={presentation.presentationElementStates}
					presentationKeyframesCss={presentation.presentationKeyframesCss}
					onActionClick={handleActionClick}
					onHyperlinkClick={handleHyperlinkClick}
					allSlides={slides}
					onZoomClick={presentation.handleZoomClick}
					sourceSlideIndex={activeSlideIndex}
					fieldContext={fieldContext}
					tableStyleContext={tableStyleContext}
					onStageClick={handleStageClick}
					screenOverlay={
						// Blackout/whiteout, audience ink, laser and captions. Rendered on
						// the stage rather than beside the viewer, because the fullscreen
						// element is the viewer's inner container: anything mounted outside
						// it simply is not painted while a real fullscreen show is running.
						<PresentationAudienceEffects snapshot={presentation.presenterSnapshot} />
					}
				>
					{(stageScale) => (
						<>
							{/* Slide-transition overlay: animates the outgoing slide over
							    the incoming one (already live on the stage below) while a
							    transition plays, then tears itself down on completion.
							    Parented to the scaled slide box so it matches the live
							    slide instead of stretching across the whole display. */}
							{presentation.transitionOverlay &&
								slides[presentation.transitionOverlay.outgoingSlideIndex] && (
									<PresentationTransitionOverlay
										key={`${presentation.transitionOverlay.outgoingSlideIndex}-${presentation.transitionOverlay.incomingSlideIndex}`}
										outgoingSlide={slides[presentation.transitionOverlay.outgoingSlideIndex]}
										templateElements={templateElements}
										canvasSize={canvasSize}
										transition={presentation.transitionOverlay.transition}
										durationMs={presentation.transitionOverlay.durationMs}
										scale={stageScale}
										morphPlan={presentation.morphPlan}
										incomingSlide={slides[presentation.transitionOverlay.incomingSlideIndex]}
										onComplete={presentation.handleTransitionOverlayComplete}
									/>
								)}

							{/* Ink/laser overlay, sharing the slide box origin so strokes
							    land under the cursor rather than offset by the letterbox.
							    Stays mounted once ink exists so annotations remain visible
							    after switching back to the arrow pointer (Ctrl+M hides them). */}
							{annotations.inkMarkupVisible && (
								<PresentationAnnotationOverlay
									canvasSize={canvasSize}
									editorScale={stageScale}
									presentationTool={annotations.presentationTool}
									blackout={presentation.presenterSnapshot.blackout}
									annotationStrokes={annotations.annotationStrokes}
									currentStroke={annotations.currentStroke}
									laserPosition={annotations.laserPosition}
									onPointerDown={annotations.handlePointerDown}
									onPointerMove={annotations.handlePointerMove}
									onPointerUp={annotations.handlePointerUp}
									onLaserMove={annotations.handleLaserMove}
									onLaserLeave={annotations.handleLaserLeave}
									onEraseAtPoint={annotations.eraseAtPoint}
								/>
							)}
						</>
					)}
				</PresentationStage>
			) : mode === 'master' && s.masterViewTab === 'notes' ? (
				<NotesMasterCanvas
					notesMaster={s.notesMaster}
					canvasSize={canvasSize}
					notesCanvasSize={s.notesCanvasSize}
				/>
			) : mode === 'master' && s.masterViewTab === 'handout' ? (
				<HandoutMasterCanvas
					handoutMaster={s.handoutMaster}
					canvasSize={canvasSize}
					slidesPerPage={s.handoutMaster?.slidesPerPage ?? s.handoutSlidesPerPage}
				/>
			) : (
				<SlideCanvas
					onUpdateSlideAnimations={props.onUpdateSlideAnimations}
					activeSlide={effectiveSlide}
					templateElements={effectiveTemplateElements}
					canvasSize={canvasSize}
					zoom={zoom}
					mode={mode}
					canEdit={canEdit}
					editTemplateMode={mode === 'master' || s.editTemplateMode}
					selectedElementIdSet={s.selectedElementIdSet}
					selectedElement={selectedElement}
					inlineEditingElementId={s.inlineEditingElementId}
					inlineEditingText={s.inlineEditingText}
					spellCheckEnabled={s.spellCheckEnabled}
					mediaDataUrls={s.mediaDataUrls}
					tableEditorState={s.tableEditorState}
					marqueeSelectionState={s.marqueeSelectionState}
					snapLines={s.snapLines}
					showGrid={s.showGrid}
					gridSpacingPx={gridSpacingPx}
					showRulers={s.showRulers}
					guides={s.guides}
					onClick={handleElementClick}
					onDoubleClick={canvasHandlers.handleElementDoubleClick}
					onMouseDown={handleElementMouseDown}
					onContextMenu={canvasHandlers.handleElementContextMenu}
					onCanvasMouseDown={canvasHandlers.handleCanvasMouseDown}
					onResizePointerDown={canvasHandlers.handleResizePointerDown}
					onAdjustmentPointerDown={canvasHandlers.handleAdjustmentPointerDown}
					onRotate={canvasHandlers.handleRotate}
					onInlineEditChange={s.setInlineEditingText}
					onInlineEditCommit={canvasHandlers.handleInlineEditCommit}
					onInlineEditCancel={() => s.setInlineEditingElementId(null)}
					onTableCellSelect={(cell, elementId) =>
						s.setTableEditorState(cell ? ({ ...cell, elementId } as TableCellEditorState) : null)
					}
					onCommitCellEdit={tableOps.handleCommitCellEdit}
					onUpdateSmartArtElement={canvasHandlers.handleUpdateSmartArtElement}
					onFormatText={canvasHandlers.handleFormatText}
					onResizeTableColumns={tableOps.handleResizeTableColumns}
					onResizeTableRow={tableOps.handleResizeTableRow}
					findResults={findReplace.findResults}
					findResultIndex={findReplace.findResultIndex}
					activeSlideIndex={activeSlideIndex}
					activeTool={s.activeTool}
					drawingColor={s.drawingColor}
					drawingWidth={s.drawingWidth}
					isDrawingRef={s.isDrawingRef}
					onAddInkElement={insertHandlers.handleAddInkElement}
					onAddFreeformShape={insertHandlers.handleAddFreeformShape}
					onEraseInkElement={insertHandlers.handleEraseInkElement}
					onActionClick={handleActionClick}
					onHyperlinkClick={handleHyperlinkClick}
					fieldContext={fieldContext}
					tableStyleContext={tableStyleContext}
					aiActive={aiCanvasActive}
					collaborationOverlay={
						<>
							<RemoteSelectionOverlay
								elements={effectiveSlide?.elements ?? []}
								activeSlideIndex={activeSlideIndex}
							/>
							<CollaborationCursorOverlay
								activeSlideIndex={activeSlideIndex}
								canvasWidth={canvasSize.width}
								canvasHeight={canvasSize.height}
								selectedElementId={s.selectedElementId}
							/>
							{aiHighlightOverlay}
						</>
					}
					comments={activeSlide?.comments}
					showCommentMarkers={s.sidebarPanelMode === 'comments'}
					onCommentMarkerClick={() => s.setSidebarPanelMode('comments')}
					onMoveGuide={(guideId, position) => {
						s.setGuides((prev) =>
							prev.map((guide) =>
								guide.id === guideId
									? {
											...guide,
											position:
												guide.axis === 'h'
													? Math.max(0, Math.min(canvasSize.height, position))
													: Math.max(0, Math.min(canvasSize.width, position)),
										}
									: guide,
							),
						);
					}}
					onDeleteGuide={(guideId) => {
						s.setGuides((prev) => prev.filter((guide) => guide.id !== guideId));
					}}
					onCreateGuideFromRuler={(axis, positionPx) => {
						s.setGuides((prev) => [
							...prev,
							{
								id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
								axis,
								position: positionPx,
							},
						]);
					}}
				/>
			)}

			{/* All Slides navigator (Ctrl+S during a show) */}
			{mode === 'present' && presentation.allSlidesOpen && (
				<PresenterSlideNavigator
					slides={slides}
					current={presentation.presentationSlideIndex}
					canvasSize={canvasSize}
					templateElements={templateElements}
					onSelect={(index) => {
						presentation.navigateToSlide(index);
						presentation.closeAllSlides();
					}}
					onClose={presentation.closeAllSlides}
				/>
			)}

			{/* Black end-of-show screen (Options > Advanced > "End with black slide") */}
			{mode === 'present' && presentation.endOfShowVisible && (
				<PresentationEndOverlay onExit={() => presentation.movePresentationSlide(1)} />
			)}

			{/* Slide-show right-click menu */}
			{mode === 'present' && presentationMenu && (
				<PresentationContextMenu
					state={presentationMenu}
					onNext={() => presentation.movePresentationSlide(1)}
					onPrevious={() => presentation.movePresentationSlide(-1)}
					onEndShow={onEndPresentation ?? (() => {})}
					onClose={() => setPresentationMenu(null)}
					onSeeAllSlides={presentation.openAllSlides}
					onShowPresenterView={presentation.togglePresenterView}
					onBlank={(value) =>
						presentation.setPresenterBlackout(
							presentation.presenterSnapshot.blackout === value ? 'none' : value,
						)
					}
					onPointerTool={(tool) => annotations.setPresentationTool(tool === 'none' ? 'none' : tool)}
					onEraseInk={annotations.clearAnnotations}
				/>
			)}

			{/* Presentation subtitle bar */}
			{mode === 'present' && (
				<PresentationSubtitleBar visible={Boolean(s.presentationProperties.showSubtitles)} />
			)}

			{/* Always-visible touch controls (close + prev/next) for slideshow on
			    touch devices: the mouse toolbar below is hidden without a pointer
			    move, leaving no way to exit or navigate on mobile. */}
			{mode === 'present' && (
				<PresentationTouchControls
					currentSlideIndex={presentation.presentationSlideIndex}
					totalSlides={slides.length}
					onMovePresentationSlide={presentation.movePresentationSlide}
					onEndPresentation={onEndPresentation ?? (() => {})}
					hideNavigation={isHidden('navigation')}
				/>
			)}

			{/* Presentation floating toolbar with auto-hide */}
			{mode === 'present' && (
				<div
					className={PRESENT_TOOLBAR_CLASSES.wrapper}
					style={{
						opacity: annotations.toolbarVisible ? 1 : 0,
						pointerEvents: annotations.toolbarVisible ? 'auto' : 'none',
					}}
					onMouseEnter={handleToolbarMouseEnter}
					onMouseLeave={handleToolbarMouseLeave}
				>
					<PresentationToolbar
						presentationTool={annotations.presentationTool}
						penColor={annotations.penColor}
						highlighterColor={annotations.highlighterColor}
						hasAnnotations={annotations.annotationStrokes.length > 0}
						onSetTool={annotations.setPresentationTool}
						onSetPenColor={annotations.setPenColor}
						onSetHighlighterColor={annotations.setHighlighterColor}
						onClearAnnotations={annotations.clearAnnotations}
						blackout={presentation.presenterSnapshot.blackout}
						onToggleBlackboard={handleToggleBlackboard}
						currentSlideIndex={presentation.presentationSlideIndex}
						totalSlides={slides.length}
						onMovePresentationSlide={presentation.movePresentationSlide}
						presentationStartTime={presentation.presentationStartTime}
						onEndPresentation={onEndPresentation ?? (() => {})}
						onTogglePresenterView={presentation.togglePresenterView}
						presenterMode={presentation.presenterMode}
					/>
				</div>
			)}
		</main>
	);
}
