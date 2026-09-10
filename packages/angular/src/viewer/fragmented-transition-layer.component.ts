import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize, FragmentedLayer } from '../internal/shared';
import type { StyleMap } from './element-style';
import { SlideCanvasComponent } from './slide-canvas.component';
import { transitionSlideBoxSize } from './transition-helpers';

/** One rendered fragment: its stable id plus its fully-resolved inline style. */
export interface FragmentView {
	id: string;
	style: StyleMap;
}

/**
 * Resolve every fragment in `layer` to its rendered view: a stable id plus the
 * fully-resolved inline style the template binds via `[ngStyle]`.
 *
 * `clip-path` lands as a literal inline style (not a CSS class) so it reads
 * back via `el.style.clipPath`, which the cross-binding parity spec
 * (`e2e/cinematic-fragments-transition-parity.spec.ts`) asserts on directly.
 * Exported and pure so it can be unit-tested without Angular's TestBed, which
 * this package's `vitest.config.ts` does not provide (see
 * `presentation-transition-overlay.component.test.ts`).
 */
export function buildFragmentViews(layer: FragmentedLayer): FragmentView[] {
	return layer.fragments.map((fragment) => ({
		id: fragment.id,
		style: {
			'clip-path': fragment.clipPath,
			'transform-origin': fragment.transformOrigin,
			'animation-name': layer.keyframesName,
			'animation-duration': `${layer.durationMs}ms`,
			'animation-timing-function': layer.easing,
			'animation-delay': `${fragment.delayMs}ms`,
			'animation-fill-mode': 'forwards',
			'will-change': 'transform, opacity',
			...fragment.vars,
		},
	}));
}

/**
 * FragmentedTransitionLayerComponent: renders one `FragmentedLayer` (from
 * `getFragmentedTransitionDescriptor` in `pptx-viewer-shared`) as N clipped
 * copies of `pptx-slide-canvas` - the Angular mapping of the seven
 * multi-fragment cinematic transitions (`vortex`, `honeycomb`, `glitter`,
 * `shred`, `fracture`, `curtains`, `airplane`; see `slide-transition-fragments.ts`
 * for the COM measurement and the pure decision function this maps).
 *
 * Every fragment is `position:absolute` + `clip-path` + a shared `@keyframes`
 * animation (already injected into `SLIDE_TRANSITION_KEYFRAMES` via
 * `ensureTransitionKeyframes`) parameterised by CSS custom properties, so the
 * whole set stays transform/opacity-only and GPU-composited with no
 * per-frame JS. Mirrors the React binding's `FragmentedTransitionLayer.tsx`.
 *
 * Selector: `pptx-fragmented-transition-layer`
 */
@Component({
	selector: 'pptx-fragmented-transition-layer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent],
	styles: `
		:host {
			display: block;
		}

		.pptx-ng-transition-layer {
			position: absolute;
			inset: 0;
		}

		.pptx-ng-transition-fragment {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			pointer-events: none;
		}
	`,
	template: `
		<div
			class="pptx-ng-transition-layer"
			[attr.data-pptx-transition-layer]="layerName()"
			[attr.data-pptx-transition-fragments]="layer().keyframesName"
			[ngStyle]="wrapperStyle()"
		>
			@for (fragment of fragmentViews(); track fragment.id) {
				<div
					class="pptx-ng-transition-fragment"
					[attr.data-pptx-transition-fragment]="fragment.id"
					[ngStyle]="fragment.style"
				>
					<div [ngStyle]="slideBoxStyle()">
						<pptx-slide-canvas
							[slide]="slide()"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
							[zoom]="zoom()"
							[autoFit]="false"
							[interactive]="false"
						/>
					</div>
				</div>
			}
		</div>
	`,
})
export class FragmentedTransitionLayerComponent {
	readonly layer = input.required<FragmentedLayer>();
	readonly slide = input.required<PptxSlide>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zoom = input<number>(1);
	readonly layerName = input.required<'outgoing' | 'incoming'>();
	/** Stacking order relative to the other overlay layers and the live stage. */
	readonly zIndex = input<number>(0);

	protected readonly wrapperStyle = computed<StyleMap>(() => ({
		'z-index': String(this.zIndex()),
	}));

	/**
	 * Slide box sized to the ZOOMED slide footprint, matching the stage's own
	 * `pptx-slide-canvas` (see `transitionSlideBoxSize` for why the intrinsic
	 * size would snap the leaving slide small for one frame).
	 */
	protected readonly slideBoxStyle = computed<StyleMap>(() => {
		const box = transitionSlideBoxSize(this.canvasSize(), this.zoom());
		return {
			width: `${box.width}px`,
			height: `${box.height}px`,
			'transform-origin': 'center',
		};
	});

	/**
	 * Each fragment's fully-resolved inline style, precomputed so the template
	 * only ever binds a plain object per `@for` iteration (matching the
	 * `crossfadeGroups` pattern in `presentation-transition-overlay.component.ts`).
	 */
	protected readonly fragmentViews = computed<FragmentView[]>(() =>
		buildFragmentViews(this.layer()),
	);
}
