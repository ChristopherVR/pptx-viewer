import type { Computed3dStyle, CssStyleMap } from 'pptx-viewer-shared';

/**
 * Merge a shared {@link Computed3dStyle} (scene3d/shape3d camera, extrusion,
 * bevel, material) into an existing style map, COMBINING shadows / filters /
 * backgrounds rather than overwriting. Port of the Vue binding's
 * `merge3dStyle`, retargeted from Vue `CSSProperties` to the neutral
 * `CssStyleMap`.
 */
export function merge3dStyle(base: CssStyleMap, computed: Computed3dStyle | undefined): void {
	if (!computed) {
		return;
	}

	const shadowPieces: string[] = [];
	if (base.boxShadow) {
		shadowPieces.push(String(base.boxShadow));
	}
	if (computed.extrusionBoxShadow) {
		shadowPieces.push(computed.extrusionBoxShadow);
	}
	if (computed.boxShadow) {
		shadowPieces.push(computed.boxShadow);
	}
	if (shadowPieces.length > 0) {
		base.boxShadow = shadowPieces.join(', ');
	}

	if (computed.transform) {
		base.transform = base.transform
			? `${String(base.transform)} ${computed.transform}`
			: computed.transform;
	}
	if (computed.perspective) {
		base.perspective = computed.perspective;
	}
	if (computed.transformStyle) {
		base.transformStyle = computed.transformStyle;
	}
	if (computed.willChange) {
		base.willChange = computed.willChange;
	}
	if (computed.filter) {
		base.filter = base.filter ? `${String(base.filter)} ${computed.filter}` : computed.filter;
	}
	if (computed.backgroundImage) {
		base.backgroundImage = base.backgroundImage
			? `${computed.backgroundImage}, ${String(base.backgroundImage)}`
			: computed.backgroundImage;
	}
	if (computed.background && !base.background) {
		base.background = computed.background;
	}
	if (computed.opacity !== undefined && base.opacity === undefined) {
		base.opacity = computed.opacity;
	}
}
