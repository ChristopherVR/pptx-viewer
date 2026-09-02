import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
/**
 * Overlay rendered during slide transitions in presentation mode.
 *
 * Displays the *outgoing* (previous) slide as an absolutely-positioned layer
 * with CSS exit animation. The *incoming* (new) slide is rendered by the
 * main SlideCanvas underneath (or on top, depending on `outgoingOnTop`).
 */
import type { MorphTransitionPlan } from 'pptx-viewer-shared';
import {
	MORPH_CROSSFADE_GROUP_STYLE,
	MORPH_CROSSFADE_HALF_STYLE,
	visibleTemplateElements,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef, useMemo, useState } from 'react';

import type { CanvasSize } from '../types';
import { normalizeHexColor } from '../utils';
import {
	getSlideTransitionAnimations,
	SLIDE_TRANSITION_KEYFRAMES,
} from '../utils/slide-transitions';
import type { SlideTransitionAnimations } from '../utils/slide-transitions';
import { SlideBackgroundImageLayer } from './SlideBackgroundImageLayer';
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
	/**
	 * The arriving slide, needed only as the render context for the few of its
	 * own shapes a morph has to paint above the ghosts (see
	 * {@link MorphTransitionPlan.overlayIncomingElements}). Every other
	 * transition ignores it.
	 */
	incomingSlide?: PptxSlide;
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
	const elements = [...visibleTemplateElements(slide, templateElements), ...slide.elements];

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
			<SlideBackgroundImageLayer slide={slide} />
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
	incomingSlide,
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
							// The slide box is a flex ITEM, so it shrinks to the container
							// unless told not to. A show surface narrower than the deck's own
							// canvas (a windowed show, or a display scaled past 100%) squeezed
							// the unscaled 1280px box down to the container width and only
							// then scaled it, landing the whole outgoing slide up to ~77px to
							// the right of the live one for the length of the morph (issue
							// #161). The stage below positions its slide box absolutely and is
							// unaffected, so the two layers disagreed.
							flexShrink: 0,
							transform: `scale(${scale})`,
							transformOrigin: 'center',
							position: 'relative',
						}}
					>
						{morphPlan.outgoingElements.map((element, index) => (
							<div
								key={element.id}
								data-pptx-morph-outgoing={element.id}
								style={{ position: 'absolute', inset: 0 }}
							>
								{/* The animation rides the element's own positioned container:
								    ghost keyframes are element-local (they restate the static
								    rotation/flips and pivot on the element centre), so a
								    slide-sized wrapper would pivot them around the slide
								    centre and double-apply the static transform. */}
								<StaticElementRenderer
									element={element}
									activeSlide={outgoingSlide}
									allSlides={[outgoingSlide]}
									zIndex={index}
									animation={morphPlan.outgoingAnimations.get(element.id)}
									imageAnimation={morphPlan.outgoingImageAnimations.get(element.id)}
								/>
							</div>
						))}
						{/* The arriving shapes a ghost above them would otherwise hide for
						    the whole morph, painted here instead so they dissolve in where
						    a viewer can see them (issue #146). Their copy on the live stage
						    is held invisible by the plan, so nothing composites twice. */}
						{incomingSlide &&
							morphPlan.overlayIncomingElements.map((element, index) => (
								<div
									key={element.id}
									data-pptx-morph-lifted={element.id}
									style={{ position: 'absolute', inset: 0 }}
								>
									<StaticElementRenderer
										element={element}
										activeSlide={incomingSlide}
										allSlides={[incomingSlide]}
										zIndex={morphPlan.outgoingElements.length + index}
										animation={morphPlan.overlayIncomingAnimations.get(element.id)}
									/>
								</div>
							))}
						{/* Pairs the overlay paints both halves of, summed inside their own
						    isolated group instead of stacked: two source-over fades dip the
						    ink they share toward the backdrop, which bites chunks out of
						    glyphs that cross during a text dissolve (issue #161). The group
						    carries an explicit z-index because `isolation` makes it a
						    stacking context, so the halves' own z-indexes no longer place
						    it against the ghosts. */}
						{incomingSlide &&
							morphPlan.crossfadeGroups.map((group, index) => (
								<div
									key={group.incoming.id}
									data-pptx-morph-crossfade={group.incoming.id}
									style={{
										...MORPH_CROSSFADE_GROUP_STYLE,
										zIndex:
											morphPlan.outgoingElements.length +
											morphPlan.overlayIncomingElements.length +
											index,
									}}
								>
									{/* The dissolve rides the WRAPPER, not the element: a pair that
									    dissolves in place never moves, and an animation on the small
									    element box gives it a compositing layer whose raster snaps
									    to whole device pixels, painting the wording a fraction of a
									    pixel off the live stage (issue #161). */}
									<div
										data-pptx-morph-outgoing={group.outgoing.id}
										style={{ ...MORPH_CROSSFADE_HALF_STYLE, animation: group.outgoingAnimation }}
									>
										<StaticElementRenderer
											element={group.outgoing}
											activeSlide={outgoingSlide}
											allSlides={[outgoingSlide]}
											zIndex={0}
											animation={morphPlan.outgoingAnimations.get(group.outgoing.id)}
											imageAnimation={morphPlan.outgoingImageAnimations.get(group.outgoing.id)}
										/>
									</div>
									<div
										data-pptx-morph-lifted={group.incoming.id}
										style={{ ...MORPH_CROSSFADE_HALF_STYLE, animation: group.incomingAnimation }}
									>
										<StaticElementRenderer
											element={group.incoming}
											activeSlide={incomingSlide}
											allSlides={[incomingSlide]}
											zIndex={0}
											animation={morphPlan.overlayIncomingAnimations.get(group.incoming.id)}
										/>
									</div>
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
			{/* The ARRIVING slide, carrying the incoming animation. Without this
			    layer the arriving slide is only the live stage BENEATH the
			    overlay: an opaque outgoing layer (wipe/cover leave it in place)
			    hid it for the whole duration, then the teardown revealed it in
			    one frame - "takes the time, then instantly replaced". Types whose
			    incoming half is 'none' (uncover family) must keep revealing the
			    stage, so no static layer is rendered for them. */}
			{!morphPlan && animations.incoming !== 'none' && incomingSlide ? (
				<div
					data-pptx-transition-layer='incoming'
					className='pptx-react-transition-layer absolute inset-0 flex items-center justify-center'
					style={{
						animation: animations.incoming,
						zIndex: animations.outgoingOnTop ? 0 : 10,
					}}
				>
					<div
						style={{
							width: canvasSize.width,
							height: canvasSize.height,
							flexShrink: 0,
							transform: `scale(${scale})`,
							transformOrigin: 'center',
						}}
					>
						<SlideLayer
							slide={incomingSlide}
							templateElements={templateElements}
							canvasSize={canvasSize}
						/>
					</div>
				</div>
			) : null}
			<div
				data-pptx-transition-layer='outgoing'
				className='pptx-react-transition-layer absolute inset-0 flex items-center justify-center'
				style={{
					animation: animations.outgoing !== 'none' ? animations.outgoing : undefined,
					zIndex: animations.outgoingOnTop ? 10 : 0,
				}}
			>
				<div
					style={{
						width: canvasSize.width,
						height: canvasSize.height,
						// See the morph layer above: a flex item shrinks to its container,
						// which offsets the whole outgoing slide on a show surface narrower
						// than the deck's canvas.
						flexShrink: 0,
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
