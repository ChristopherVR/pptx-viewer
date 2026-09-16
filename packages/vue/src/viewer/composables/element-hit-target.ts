import type { PptxElement } from 'pptx-viewer-core';
import { shouldRenderHitTarget } from 'pptx-viewer-shared';
import type { ComputedRef, CSSProperties } from 'vue';
import { computed } from 'vue';

import { getElementHitTargetStyle } from './element-style';

/**
 * Reactive wiring for the interaction-only hit-target overlay shared by every
 * element renderer (issue #285): a transparent, centred, minimum-size
 * click/drag target rendered ONLY while the surface is interactive/editable
 * and NOT presenting, so a live show never grows draggable elements. The
 * decision itself (`shouldRenderHitTarget` + `getElementHitTargetStyle`) is
 * framework-agnostic; this just re-runs it as a Vue `computed` so each
 * renderer component does not repeat the same three-line wrapper.
 *
 * Every delegated renderer (`ElementImageBox`, `ElementMediaBox`,
 * `TableRenderer`, `ChartRenderer`, `SmartArtRenderer`, `SmartArt3DRenderer`,
 * `InkRenderer`, `ContentPartRenderer`, `OleRenderer`, `Model3DRenderer`,
 * `ZoomRenderer`, `EquationRenderer`) has its own single-root box and none of
 * them share a common wrapper component, so the gating inputs are threaded in
 * as props and this composable is called once per component. `ElementRenderer`
 * itself uses it directly for its inline `text`/`shape`/`group` branches.
 */
export function useElementHitTargetStyle(
	element: () => PptxElement,
	interactive: () => boolean | undefined,
	presenting: () => boolean | undefined,
): ComputedRef<CSSProperties | undefined> {
	return computed<CSSProperties | undefined>(() =>
		shouldRenderHitTarget(interactive() === true, presenting() === true)
			? getElementHitTargetStyle(element())
			: undefined,
	);
}
