import type { Computed3dStyle } from '../internal/shared';
import type { StyleMap } from './element-style';

/**
 * Merge a shared {@link Computed3dStyle} (scene3d camera/perspective +
 * sp3d extrusion / bevel / material) into an Angular `[ngStyle]` map,
 * COMBINING shadows / filters / backgrounds rather than overwriting them.
 *
 * Angular port of the Vue `merge3dStyle` (and its Svelte / Vanilla copies),
 * retargeted from the camelCase `CssStyleMap` those bindings use onto this
 * binding's kebab-case {@link StyleMap}. Only the key spelling differs, so the
 * merge ORDER (extrusion depth under the contour/bevel/material shadows, 3D
 * transform appended after any existing one) is kept identical to them - it is
 * what decides which face of an extruded shape paints on top.
 *
 * Without this Angular ignored `a:spPr/a:scene3d` and `a:spPr/a:sp3d`
 * entirely: a bevelled or extruded shape rendered flat here and correct in the
 * other four bindings, while this binding still shipped the inspector UI that
 * authors it.
 */
export function merge3dStyleMap(base: StyleMap, computed: Computed3dStyle | undefined): void {
	if (!computed) {
		return;
	}

	const shadows = [base['box-shadow'], computed.extrusionBoxShadow, computed.boxShadow]
		.filter((piece) => piece !== undefined && piece !== '')
		.map(String);
	if (shadows.length > 0) {
		base['box-shadow'] = shadows.join(', ');
	}

	if (computed.transform) {
		base['transform'] = base['transform']
			? `${String(base['transform'])} ${computed.transform}`
			: computed.transform;
	}
	if (computed.perspective) {
		base['perspective'] = computed.perspective;
	}
	if (computed.transformStyle) {
		base['transform-style'] = computed.transformStyle;
	}
	if (computed.willChange) {
		base['will-change'] = computed.willChange;
	}
	if (computed.filter) {
		base['filter'] = base['filter']
			? `${String(base['filter'])} ${computed.filter}`
			: computed.filter;
	}
	if (computed.backgroundImage) {
		// The 3D layer paints ON TOP of the element's own fill, so it goes first
		// in the comma list (CSS paints earlier background layers above later
		// ones).
		base['background-image'] = base['background-image']
			? `${computed.backgroundImage}, ${String(base['background-image'])}`
			: computed.backgroundImage;
	}
	if (computed.background && !base['background']) {
		base['background'] = computed.background;
	}
	if (computed.opacity !== undefined && base['opacity'] === undefined) {
		base['opacity'] = computed.opacity;
	}
}
