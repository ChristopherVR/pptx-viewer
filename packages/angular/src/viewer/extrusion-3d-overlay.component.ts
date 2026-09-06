import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { Extrusion3DData, Extrusion3dCss } from '../internal/shared';
import type { StyleMap } from './element-style';

/**
 * Convert a framework-neutral `Extrusion3dCss` map (shared `build3DExtrusionData`)
 * into this binding's kebab-case `StyleMap`.
 *
 * The shared builder returns bare numbers for length values (`width`,
 * `height`, `left`, `top`, `inset`), relying on React's automatic `px`
 * suffixing for inline styles. Angular's `[ngStyle]` does NOT append units to
 * numbers (unlike React's `CSSProperties` object, and like Vue's `:style`,
 * which has its own `toCss` doing exactly this coercion in
 * `Extrusion3DOverlay.vue`), so a bare `200` here would set an invalid,
 * ignored CSS length. Every key in the map is also unitless-safe (no
 * unitless CSS property, such as `opacity` or `z-index`, ever appears in this
 * particular map), so a blanket numeric -> `px` string coercion is safe.
 */
function toStyleMap(style: Extrusion3dCss): StyleMap {
	const map: StyleMap = {};
	for (const [key, value] of Object.entries(style)) {
		const kebab = key.replace(/[A-Z]/gu, (m) => `-${m.toLowerCase()}`);
		map[kebab] = typeof value === 'number' ? `${value}px` : value;
	}
	return map;
}

/**
 * Extrusion3DOverlayComponent: Angular port of React's `Extrusion3DOverlay.tsx`
 * / Vue's `Extrusion3DOverlay.vue`.
 *
 * Renders the CSS 3D extrusion side faces (top/bottom/left/right panels) of a
 * shape with `a:sp3d` extrusion depth, from the framework-agnostic panel data
 * shared `build3DExtrusionData` computes. Each panel is a plain `<div>`
 * positioned in 3D space around the shape's bounding box to form the sides of
 * the extrusion volume; an optional material gradient overlays the front face.
 *
 * Before this component existed, Angular vendored `build3DExtrusionData`
 * (via `../internal/shared`) but no template ever called it: an extruded
 * shape's depth showed only as the flat `box-shadow` approximation from
 * `getShapeFillStrokeStyle`/`merge3dStyleMap`, the fallback every other
 * binding treats as a fallback ONLY for a scene the panel geometry cannot
 * cover, while React/Vue/Svelte/Vanilla additionally rendered these real,
 * camera-rotated 3D panels on top. This is purely visual
 * (`pointer-events: none`, `aria-hidden`): no interactivity on the panels.
 */
@Component({
	selector: 'pptx-extrusion-3d-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		@if (data().hasExtrusion && data().panels.length > 0) {
			<div class="pptx-ng-extrusion-3d-wrapper" aria-hidden="true" [ngStyle]="wrapperStyle()">
				@for (panel of panels(); track panel.side) {
					<div
						class="pptx-ng-extrusion-3d-panel"
						[class]="'pptx-ng-extrusion-3d-panel pptx-ng-extrusion-3d-panel--' + panel.side"
						[ngStyle]="panel.style"
					></div>
				}
				@if (materialOverlayStyle(); as mo) {
					<div class="pptx-ng-extrusion-3d-material-overlay" [ngStyle]="mo"></div>
				}
			</div>
		}
	`,
})
export class Extrusion3DOverlayComponent {
	/** Extrusion data computed by shared `build3DExtrusionData`. */
	readonly data = input.required<Extrusion3DData>();

	readonly wrapperStyle = computed<StyleMap>(() => toStyleMap(this.data().wrapperStyle));

	readonly panels = computed(() =>
		this.data().panels.map((panel) => ({ side: panel.side, style: toStyleMap(panel.style) })),
	);

	readonly materialOverlayStyle = computed<StyleMap | undefined>(() => {
		const overlay = this.data().materialOverlay;
		if (!overlay) {
			return undefined;
		}
		const style: StyleMap = {
			position: 'absolute',
			inset: '0',
			'background-image': overlay,
			'pointer-events': 'none',
			'border-radius': 'inherit',
			'transform-style': 'preserve-3d',
			'backface-visibility': 'hidden',
			'mix-blend-mode': 'normal',
		};
		const frontTransform = this.data().frontFaceStyle.transform;
		if (frontTransform !== undefined) {
			style['transform'] = frontTransform;
		}
		return style;
	});
}
