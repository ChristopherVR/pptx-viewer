import type { PptxAction, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { PRESENTATION_HIT_TEST_CSS, PRESENTATION_STAGE_ATTRIBUTE } from 'pptx-viewer-shared';
/**
 * PresentationStage: the slide show surface.
 *
 * A dedicated, full-bleed presentation surface rather than a re-dressed editor
 * canvas. PowerPoint's slide show scales the slide to fill the display and
 * letterboxes the leftover space in black, so this measures its own container
 * and scales freely in BOTH directions: the editor's fit scale is deliberately
 * capped at 1 (a slide never zooms past 100% while you edit), which is exactly
 * the wrong rule here and left the show pinned at native size on any display
 * larger than the deck.
 *
 * Slide content is inert: no selection, drag, resize, marquee, rulers, grid or
 * guides. Only the things PowerPoint keeps live during a show survive -
 * hyperlinks, action buttons, zoom links and media playback - which is why
 * elements render with `canInteract={false}` but keep their action handlers.
 *
 * Overlays (annotations, transitions) render via `children` INSIDE the scaled
 * slide box so they share its origin and scale; anchoring them to the container
 * instead leaves them offset by the letterbox margins.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import type { CanvasSize } from '../../types';
import type { ElementAnimationState } from '../../utils/animation-timeline';
import { getReactSlideBackgroundStyle } from '../../utils/slide-background-style';
import type { TableStyleContext } from '../../utils/table-parse';
import type { FieldSubstitutionContext } from '../../utils/text-field-substitution';
import { ElementRenderer } from '../ElementRenderer';
import { SlideBackgroundImageLayer } from '../SlideBackgroundImageLayer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationStageProps {
	activeSlide: PptxSlide | undefined;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	/** Per-element animation visibility/CSS for the running build sequence. */
	presentationElementStates?: Map<string, ElementAnimationState>;
	/** `@keyframes` block backing the current slide's animations. */
	presentationKeyframesCss?: string;
	onActionClick?: (elementId: string, action: PptxAction) => void;
	onHyperlinkClick?: (url: string) => void;
	/** All slides, so zoom links and slide jumps can resolve their target. */
	allSlides?: PptxSlide[];
	onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
	sourceSlideIndex?: number;
	fieldContext?: FieldSubstitutionContext;
	tableStyleContext?: TableStyleContext;
	/**
	 * PowerPoint's "On Mouse Click" advance. A click anywhere on the show
	 * surface - the slide and the letterbox bars alike - steps the show on.
	 * Without it the stage is a dead surface that only the keyboard can drive,
	 * which is exactly how a presenter experiences a broken show.
	 */
	onStageClick?: (event: React.MouseEvent) => void;
	/** Overlays drawn inside the scaled slide box, given the live scale. */
	children?: (scale: number) => React.ReactNode;
	/**
	 * Overlays covering the whole display, letterbox bars included. Blackout and
	 * whiteout live here: PowerPoint's B/W blank the entire screen, not just the
	 * slide.
	 */
	screenOverlay?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationStage({
	activeSlide,
	templateElements,
	canvasSize,
	mediaDataUrls,
	presentationElementStates,
	presentationKeyframesCss,
	onActionClick,
	onHyperlinkClick,
	allSlides,
	onZoomClick,
	sourceSlideIndex,
	fieldContext,
	tableStyleContext,
	onStageClick,
	children,
	screenOverlay,
}: PresentationStageProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [box, setBox] = useState<CanvasSize | null>(null);

	// Measure the show surface. The container is the fullscreen element in a
	// real slide show and a plain panel in windowed/presenter use, so measuring
	// the container rather than `window` keeps both paths correct.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect && rect.width > 0 && rect.height > 0) {
				setBox({ width: rect.width, height: rect.height });
			}
		});
		observer.observe(el);
		const initial = el.getBoundingClientRect();
		if (initial.width > 0 && initial.height > 0) {
			setBox({ width: initial.width, height: initial.height });
		}
		return () => {
			observer.disconnect();
		};
	}, []);

	const safeWidth = Math.max(canvasSize.width, 1);
	const safeHeight = Math.max(canvasSize.height, 1);

	// Contain-fit, uncapped: fill the display in the constrained axis and
	// letterbox the other. Falls back to 1 until the first measurement lands.
	const scale = useMemo(() => {
		if (!box) {
			return 1;
		}
		const fit = Math.min(box.width / safeWidth, box.height / safeHeight);
		return fit > 0 ? fit : 1;
	}, [box, safeWidth, safeHeight]);

	const scaledWidth = safeWidth * scale;
	const scaledHeight = safeHeight * scale;

	return (
		// oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- the show surface is not a control; it carries PowerPoint's click-to-advance, whose keyboard equivalent (Space / arrows / PageDown) is bound globally by usePresentationKeyboard
		<div
			ref={containerRef}
			data-pptx-presentation-stage
			className='relative flex-1 min-h-0 overflow-hidden bg-black select-none'
			onClick={onStageClick}
		>
			<div
				className='absolute'
				style={{
					width: scaledWidth,
					height: scaledHeight,
					// Centre the letterboxed slide without flexbox so the box keeps a
					// definite size for the overlays parented to it.
					left: box ? Math.max(0, (box.width - scaledWidth) / 2) : 0,
					top: box ? Math.max(0, (box.height - scaledHeight) / 2) : 0,
				}}
			>
				<div
					role='region'
					aria-roledescription='slide'
					aria-label={`Slide ${(sourceSlideIndex ?? 0) + 1}`}
					// The shared running-show marker every binding's show stage carries
					// (`applyRenderedElementAccessibility` stamps it elsewhere; React
					// renders accessibility per element in JSX, so the stage stamps it
					// directly). e2e reads the visible slide through this attribute.
					{...{ [PRESENTATION_STAGE_ATTRIBUTE]: 'true' }}
					className='absolute top-0 left-0 overflow-hidden'
					style={
						{
							width: safeWidth,
							height: safeHeight,
							transform: `scale(${scale})`,
							transformOrigin: 'top left',
							// Motion-path keyframes translate by a fraction of the SLIDE, so
							// the stage publishes its own size for those calc() offsets.
							'--pptx-slide-w': `${safeWidth}px`,
							'--pptx-slide-h': `${safeHeight}px`,
							...getReactSlideBackgroundStyle(activeSlide),
						} as React.CSSProperties
					}
				>
					<SlideBackgroundImageLayer slide={activeSlide} />
					{/*
					 * Which elements a running show accepts a pointer on. It has to be a
					 * STYLESHEET, not a per-element `pointer-events: none`: an actionable
					 * shape nested inside an inert group re-enables itself here, which an
					 * inline rule written onto the group never could. React wrote the
					 * inline form and was the only binding whose show could not click a
					 * nested action shape at all.
					 */}
					<style>{PRESENTATION_HIT_TEST_CSS}</style>
					{presentationKeyframesCss && <style>{presentationKeyframesCss}</style>}

					{templateElements.map((element, index) => (
						<ElementRenderer
							key={`tpl-${element.id}`}
							element={element}
							activeSlide={activeSlide}
							isSelected={false}
							isInlineEditing={false}
							inlineEditingText=''
							canInteract={false}
							// A running show: hit-testing is owned by the shared stylesheet
							// above, never by an inline `pointer-events` on the element.
							presenting
							spellCheckEnabled={false}
							mediaDataUrls={mediaDataUrls}
							selectionColorClass='blue-400'
							showHoverBorder={false}
							zIndex={index}
							imageAltText='Template element'
							showResizeHandles={false}
							renderInk={false}
							renderGroups
							adjustmentHandles={[]}
							onResizePointerDown={noop}
							onAdjustmentPointerDown={noop}
							onInlineEditChange={noop}
							onInlineEditCommit={noop}
							onInlineEditCancel={noop}
							onActionClick={onActionClick}
							onHyperlinkClick={onHyperlinkClick}
							animationState={presentationElementStates?.get(element.id)}
							presentationElementStates={presentationElementStates}
							allSlides={allSlides}
							onZoomClick={onZoomClick}
							sourceSlideIndex={sourceSlideIndex}
							fieldContext={fieldContext}
							tableStyleContext={tableStyleContext}
						/>
					))}

					{activeSlide?.elements.map((element, index) => (
						<ElementRenderer
							key={element.id}
							element={element}
							activeSlide={activeSlide}
							isSelected={false}
							isInlineEditing={false}
							inlineEditingText=''
							canInteract={false}
							// A running show: hit-testing is owned by the shared stylesheet
							// above, never by an inline `pointer-events` on the element.
							presenting
							spellCheckEnabled={false}
							mediaDataUrls={mediaDataUrls}
							selectionColorClass='blue-500'
							showHoverBorder={false}
							zIndex={templateElements.length + index}
							imageAltText='Slide element'
							showResizeHandles={false}
							renderInk
							renderGroups
							adjustmentHandles={[]}
							onResizePointerDown={noop}
							onAdjustmentPointerDown={noop}
							onInlineEditChange={noop}
							onInlineEditCommit={noop}
							onInlineEditCancel={noop}
							onActionClick={onActionClick}
							onHyperlinkClick={onHyperlinkClick}
							animationState={presentationElementStates?.get(element.id)}
							presentationElementStates={presentationElementStates}
							allSlides={allSlides}
							onZoomClick={onZoomClick}
							sourceSlideIndex={sourceSlideIndex}
							fieldContext={fieldContext}
							tableStyleContext={tableStyleContext}
						/>
					))}
				</div>

				{children?.(scale)}
			</div>

			{screenOverlay}
		</div>
	);
}

/** Shared no-op for the editing callbacks a slide show never invokes. */
function noop(): void {
	/* slide content is inert during a show */
}
