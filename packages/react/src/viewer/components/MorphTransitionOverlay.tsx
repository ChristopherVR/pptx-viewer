import type { PptxSlide } from 'pptx-viewer-core';
/**
 * Morph transition overlay: paints only the departing shapes, unanimated as a
 * layer, each carrying its own fade-out. The persisting shapes are already
 * gliding on the live stage below, so covering them with a copy of the whole
 * outgoing slide would hide the effect entirely.
 *
 * Split out of `PresentationTransitionOverlay.tsx` to keep that file under the
 * project's per-file LOC budget; this is the whole `morphPlan` branch,
 * unchanged in behaviour.
 */
import type { MorphTransitionPlan } from 'pptx-viewer-shared';
import { MORPH_CROSSFADE_GROUP_STYLE, MORPH_CROSSFADE_HALF_STYLE } from 'pptx-viewer-shared';
import React from 'react';

import type { CanvasSize } from '../types';
import { StaticElementRenderer } from './StaticElementRenderer';

export interface MorphTransitionOverlayProps {
	canvasSize: CanvasSize;
	scale: number;
	morphPlan: MorphTransitionPlan;
	outgoingSlide: PptxSlide;
	/**
	 * The arriving slide, needed only as the render context for the few of its
	 * own shapes a morph has to paint above the ghosts (see
	 * {@link MorphTransitionPlan.overlayIncomingElements}).
	 */
	incomingSlide?: PptxSlide;
	/**
	 * Forwarded to the root node, exactly like the non-morph overlay root: the
	 * parent's fallback size-measurement effect (used when no stage `scale` is
	 * supplied) reads `containerRef.current.getBoundingClientRect()`, so this
	 * has to land on whichever root actually renders, morph or not.
	 */
	containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function MorphTransitionOverlay({
	canvasSize,
	scale,
	morphPlan,
	outgoingSlide,
	incomingSlide,
	containerRef,
}: MorphTransitionOverlayProps): React.ReactElement {
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
