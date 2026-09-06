/**
 * Framework-neutral view model for `p:contentPart` ink.
 *
 * Every binding paints the same thing from the same data: one SVG per content
 * part, sized to the element box, holding a constant-width `<path>` per
 * stroke, a run of pressure `<circle>`s, or (when the source declared a pen-
 * tilt channel) a run of tilt-driven `<ellipse>` nib marks. This module is
 * the single decision function for that; a binding only maps the returned
 * descriptors onto its own template.
 *
 * It was lifted out of `packages/svelte/src/viewer/render/contentpart-view.ts`
 * when Vue and Angular needed the same logic. Before that, three of the five
 * bindings each had their own copy and Vue and Angular had none at all, so a
 * real inked slide fell through to their "unsupported element" placeholder.
 *
 * @module render/content-part-strokes
 */
import type { ContentPartPptxElement } from 'pptx-viewer-core';

import type { InkStrokeView } from './ink-stroke-view';
import { buildInkStrokeView } from './ink-stroke-view';

/** One rendered content-part ink stroke: a constant-width path, pressure circles, or tilt nib marks. */
export interface ContentPartStrokeView extends InkStrokeView {
	key: string;
}

/** SVG `viewBox` for the content-part element's bounding box (min 1x1). */
export function contentPartViewBox(element: ContentPartPptxElement): string {
	return `0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`;
}

/** Project the element's ink strokes into per-stroke view models. */
export function buildContentPartStrokes(element: ContentPartPptxElement): ContentPartStrokeView[] {
	return (element.inkStrokes ?? []).map((stroke, index) => ({
		key: `stroke${index}`,
		...buildInkStrokeView({
			path: stroke.path,
			color: stroke.color,
			width: stroke.width,
			opacity: stroke.opacity,
			pressures: stroke.pressures,
			tiltAngles: stroke.tiltAngles,
			tiltMagnitudes: stroke.tiltMagnitudes,
		}),
	}));
}
