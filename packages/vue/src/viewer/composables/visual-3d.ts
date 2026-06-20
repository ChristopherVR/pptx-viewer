/**
 * visual-3d.ts: Vue adapter over the shared 3D engine.
 *
 * The pure scene3d/shape3d → CSS computation lives in `pptx-viewer-shared`
 * (`render/visual-3d`) so React, Vue, and Angular share one implementation.
 * This module re-exports that surface and adds the one framework-coupled piece:
 * {@link merge3dStyle}, which folds the computed pieces into a Vue
 * `CSSProperties` object (combining shadows/filters/backgrounds rather than
 * overwriting them).
 */
import type { Computed3dStyle } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';

export {
	get3dTransformCss,
	getExtrusionBoxShadow,
	getContourBoxShadow,
	getBevelStyle,
	getMaterialFilter,
	getComputed3dStyle,
} from 'pptx-viewer-shared';
export type { Transform3dCss, BevelCss, Computed3dStyle } from 'pptx-viewer-shared';

/**
 * Merge a {@link Computed3dStyle} into an existing `CSSProperties` object,
 * COMBINING shadows/filters/backgrounds rather than overwriting. This is the
 * recommended integration helper for `getShapeFillStrokeStyle`.
 *
 * - `extrusionBoxShadow` + `boxShadow` are comma-joined with `base.boxShadow`.
 * - `filter` is space-joined; `backgroundImage` comma-joined (3D layer first).
 * - `transform` from 3D is appended after any existing transform.
 */
export function merge3dStyle(base: CSSProperties, computed: Computed3dStyle | undefined): void {
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
		base.transformStyle = computed.transformStyle as CSSProperties['transformStyle'];
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
