import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
/**
 * Overlay rendered during slide transitions in presentation mode.
 *
 * Displays the *outgoing* (previous) slide as an absolutely-positioned layer
 * with CSS exit animation. The *incoming* (new) slide is rendered by the
 * main SlideCanvas underneath (or on top, depending on `outgoingOnTop`).
 */
import type { MorphTransitionPlan } from 'pptx-viewer-shared';
import React, { useEffect, useRef, useMemo, useState } from 'react';

import type { CanvasSize } from '../types';
import { normalizeHexColor } from '../utils';
import {
	getSlideTransitionAnimations,
	SLIDE_TRANSITION_KEYFRAMES,
} from '../utils/slide-transitions';
import type { SlideTransitionAnimations } from '../utils/slide-transitions';
import { StaticElementRenderer } from './StaticElementRenderer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationTransitionOverlayProps {
	/** The outgoing (old) slide to render in the overlay layer. */
	outgoingSlide: PptxSlide;
	/** Template/master elements that belong to the outgoing slide. */
	templateElements: PptxElement[];
	/** Canvas dimensions (slide width × height in EMU-derived px). */
	canvasSize: CanvasSize;
	/** Transition definition from the incoming slide. */
	transition: PptxSlideTransition;
	/** Resolved transition duration in ms. */
	durationMs: number;
	/**
	 * The live stage scale (slide box scale) supplied by `PresentationStage`.
	 *
	 * Passing it is what keeps the outgoing slide the same size as the incoming
	 * one on the very first painted frame. Without it the overlay has to measure
	 * itself after mount, and the first frame paints the outgoing slide at its
	 * intrinsic (unscaled) size over a full-screen incoming slide - a one-frame
	 * flash right after the transition starts.
	 */
	scale?: number;
	/**
	 * Active Morph plan, when the incoming slide's transition is `morph`.
	 *
	 * Morph is not a whole-slide effect, so the overlay changes shape when this
	 * is present: instead of animating the entire outgoing slide as one block, it
	 * paints each outgoing shape separately and glides it onto its counterpart -
	 * dissolving into it when its appearance changed, fading out in place when it
	 * has none. The incoming halves animate on the live stage underneath (their
	 * `incomingAnimations` are already merged into the stage's element states by
	 * `usePresentationMode`).
	 */
	morphPlan?: MorphTransitionPlan;
	/** Called when the transition animation completes. */
	onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Slide layer renderer (simplified non-interactive slide, like SlideThumbnail)
// ---------------------------------------------------------------------------

interface SlideLayerProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
}

function SlideLayer({ slide, templateElements, canvasSize }: SlideLayerProps): React.ReactElement {
	const safeWidth = Math.max(canvasSize.width, 1);
	const safeHeight = Math.max(canvasSize.height, 1);
	const elements = [...templateElements, ...slide.elements];

	return (
		<div
			className='relative overflow-hidden'
			style={{
				width: safeWidth,
				height: safeHeight,
				backgroundColor: slide.backgroundColor
					? normalizeHexColor(slide.backgroundColor, '#ffffff')
					: '#ffffff',
				backgroundImage: slide.backgroundImage
					? `url(${slide.backgroundImage})`
					: slide.backgroundGradient
						? slide.backgroundGradient
						: undefined,
				backgroundSize: slide.backgroundImage ? 'cover' : undefined,
				backgroundPosition: slide.backgroundImage ? 'center' : undefined,
			}}
		>
			{elements.map((element, index) => (
				<StaticElementRenderer
					key={element.id}
					element={element}
					activeSlide={slide}
					allSlides={[slide]}
					zIndex={index}
				/>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationTransitionOverlay({
	outgoingSlide,
	templateElements,
	canvasSize,
	transition,
	durationMs,
	scale: stageScale,
	morphPlan,
	onComplete,
}: PresentationTransitionOverlayProps): React.ReactElement | null {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const resolvedStageScale =
		typeof stageScale === 'number' && Number.isFinite(stageScale) && stageScale > 0
			? stageScale
			: null;

	// Fallback measurement for hosts that mount the overlay without a stage
	// scale. Skipped entirely when the stage supplied one, since measuring only
	// ever reproduces the value we were already handed - one frame later.
	useEffect(() => {
		if (resolvedStageScale !== null) {
			return;
		}
		const el = containerRef.current;
		if (!el) {
			return;
		}
		const rect = el.getBoundingClientRect();
		setContainerSize({ width: rect.width, height: rect.height });
	}, [resolvedStageScale]);

	// Fire completion callback after duration
	useEffect(() => {
		const timer = window.setTimeout(onComplete, durationMs + 50);
		return () => {
			window.clearTimeout(timer);
		};
	}, [durationMs, onComplete]);

	// Compute transition animations
	const animations: SlideTransitionAnimations = useMemo(
		() =>
			getSlideTransitionAnimations(
				transition.type,
				durationMs,
				transition.direction,
				transition.orient,
				transition.spokes,
			),
		[transition.type, transition.direction, transition.orient, transition.spokes, durationMs],
	);

	// Scale for the slide layer. Prefer the stage's own scale: it is already
	// correct on the first render, so the outgoing slide never paints unscaled.
	const scale = useMemo(() => {
		if (resolvedStageScale !== null) {
			return resolvedStageScale;
		}
		if (!containerSize) {
			return 1;
		}
		const scaleX = containerSize.width / Math.max(canvasSize.width, 1);
		const scaleY = containerSize.height / Math.max(canvasSize.height, 1);
		return Math.min(scaleX, scaleY);
	}, [resolvedStageScale, containerSize, canvasSize]);

	const outgoingZIndex = animations.outgoingOnTop ? 40 : 20;

	// Morph: paint only the departing shapes, unanimated as a layer, each
	// carrying its own fade-out. The persisting shapes are already gliding on
	// the live stage below, so covering them with a copy of the whole outgoing
	// slide would hide the effect entirely.
	if (morphPlan) {
		return (
			<div
				ref={containerRef}
				data-pptx-transition-overlay
				data-pptx-transition-morph='true'
				className='pptx-react-transition-overlay absolute inset-0 pointer-events-none overflow-hidden'
				style={{ zIndex: 40 }}
			>
				<style>{morphPlan.keyframesCss}</style>
				<div className='absolute inset-0 flex items-center justify-center'>
					<div
						style={{
							width: canvasSize.width,
							height: canvasSize.height,
							transform: `scale(${scale})`,
							transformOrigin: 'center',
							position: 'relative',
						}}
					>
						{morphPlan.outgoingElements.map((element, index) => (
							<div
								key={element.id}
								data-pptx-morph-outgoing={element.id}
								style={{
									position: 'absolute',
									inset: 0,
									animation: morphPlan.outgoingAnimations.get(element.id),
								}}
							>
								<StaticElementRenderer
									element={element}
									activeSlide={outgoingSlide}
									allSlides={[outgoingSlide]}
									zIndex={index}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			data-pptx-transition-overlay
			className='pptx-react-transition-overlay absolute inset-0 pointer-events-none overflow-hidden'
			style={{ zIndex: outgoingZIndex }}
		>
			{/* Inject the transition @keyframes so the `animation` shorthands resolve. */}
			<style>{SLIDE_TRANSITION_KEYFRAMES}</style>
			<div
				data-pptx-transition-layer='outgoing'
				className='pptx-react-transition-layer absolute inset-0 flex items-center justify-center'
				style={{
					animation: animations.outgoing !== 'none' ? animations.outgoing : undefined,
				}}
			>
				<div
					style={{
						width: canvasSize.width,
						height: canvasSize.height,
						transform: `scale(${scale})`,
						transformOrigin: 'center',
					}}
				>
					<SlideLayer
						slide={outgoingSlide}
						templateElements={templateElements}
						canvasSize={canvasSize}
					/>
				</div>
			</div>
		</div>
	);
}
