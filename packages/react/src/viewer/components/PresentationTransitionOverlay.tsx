import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
/**
 * Overlay rendered during slide transitions in presentation mode.
 *
 * Displays the *outgoing* (previous) slide as an absolutely-positioned layer
 * with CSS exit animation. The *incoming* (new) slide is rendered by the
 * main SlideCanvas underneath (or on top, depending on `outgoingOnTop`).
 */
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
	onComplete,
}: PresentationTransitionOverlayProps): React.ReactElement | null {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState<{
		width: number;
		height: number;
	} | null>(null);

	// Measure container to compute scale
	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}
		const rect = el.getBoundingClientRect();
		setContainerSize({ width: rect.width, height: rect.height });
	}, []);

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

	// Compute scale for the slide layer to fit inside the container
	const scale = useMemo(() => {
		if (!containerSize) {
			return 1;
		}
		const scaleX = containerSize.width / Math.max(canvasSize.width, 1);
		const scaleY = containerSize.height / Math.max(canvasSize.height, 1);
		return Math.min(scaleX, scaleY);
	}, [containerSize, canvasSize]);

	const outgoingZIndex = animations.outgoingOnTop ? 40 : 20;

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
