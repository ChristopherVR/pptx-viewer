import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
/**
 * Renders one `FragmentedLayer` (from `getFragmentedTransitionDescriptor` in
 * `pptx-viewer-shared`) as N clipped copies of `SlideLayer` - the React
 * mapping of the seven multi-fragment cinematic transitions (`vortex`,
 * `honeycomb`, `glitter`, `shred`, `fracture`, `curtains`, `airplane`; see
 * `slide-transition-fragments.ts` for the COM measurement and the pure
 * decision function this maps).
 *
 * Every fragment is `position:absolute` + `clip-path` + a shared
 * `@keyframes` animation (already injected via `SLIDE_TRANSITION_KEYFRAMES`)
 * parameterised by CSS custom properties, so the whole set stays
 * transform/opacity-only and GPU-composited with no per-frame JS.
 */
import type { FragmentedLayer } from 'pptx-viewer-shared';
import React from 'react';

import type { CanvasSize } from '../types';
import { SlideLayer } from './SlideTransitionSlideLayer';

export interface FragmentedTransitionLayerProps {
	layer: FragmentedLayer;
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	scale: number;
	zIndex: number;
	layerName: 'outgoing' | 'incoming';
}

export function FragmentedTransitionLayer({
	layer,
	slide,
	templateElements,
	canvasSize,
	scale,
	zIndex,
	layerName,
}: FragmentedTransitionLayerProps): React.ReactElement {
	return (
		<div
			data-pptx-transition-layer={layerName}
			data-pptx-transition-fragments={layer.keyframesName}
			className='pptx-react-transition-layer absolute inset-0'
			style={{ zIndex }}
		>
			{layer.fragments.map((fragment) => (
				<div
					key={fragment.id}
					data-pptx-transition-fragment={fragment.id}
					className='absolute inset-0 flex items-center justify-center pointer-events-none'
					style={{
						clipPath: fragment.clipPath,
						transformOrigin: fragment.transformOrigin,
						animationName: layer.keyframesName,
						animationDuration: `${layer.durationMs}ms`,
						animationTimingFunction: layer.easing,
						animationDelay: `${fragment.delayMs}ms`,
						animationFillMode: 'forwards',
						willChange: 'transform, opacity',
						...(fragment.vars as React.CSSProperties),
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
						<SlideLayer slide={slide} templateElements={templateElements} canvasSize={canvasSize} />
					</div>
				</div>
			))}
		</div>
	);
}
