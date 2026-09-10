/**
 * SmartArt DiagramML interpreter - wire the `tailed` (org-chart) family's own
 * hanging tail placer.
 *
 * Split out of `smartart-hierarchy-hanging.ts` (the file-size budget): pure
 * relocation, no behaviour change.
 */

import type { PptxSmartArtPresLayoutVars } from '../types';
import { tailDirection } from './smartart-hierarchy-branch-mode';
import type { CascadePlan } from './smartart-hierarchy-cascade';
import { placeHangingForest } from './smartart-hierarchy-hanging';
import { HIER_TAIL_OFFSET_RATIO } from './smartart-hierarchy-shared';
import type { StandardOptions } from './smartart-hierarchy-standard';

/**
 * Wire `standardOptions.hangingPlacer` for the `tailed` (org-chart) family's
 * own hanging tail. A no-op (leaves `standardOptions.hangingPlacer` unset)
 * for `std`/`hanging` mode and for the SESSION 28 cascade construct
 * (`cascadePlan.active`): see that field's own call-site doc comment history
 * for why the cascade shape needs `placeAt`'s DEFAULT fanned-row branch
 * instead of this placer.
 */
export function configureTailedHangingPlacer(
	standardOptions: StandardOptions,
	mode: 'std' | 'tailed' | 'hanging',
	cascadePlan: Pick<CascadePlan, 'active'>,
	boxW: number,
	boxH: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	orgChart: boolean,
): void {
	if (mode !== 'tailed' || cascadePlan.active) {
		return;
	}
	// Measured ratio (`HIER_TAIL_OFFSET_RATIO`), not the unrelated 0.35 used by
	// the `linDir`-only `hanging` mode: this is the org-chart-family
	// `hierAlign`/`alignOff` root-box offset, and genuine PowerPoint output
	// pins it at exactly 0.25x the box width - see the constant's doc comment.
	const indent = boxW * HIER_TAIL_OFFSET_RATIO;
	const vGap = boxH * 0.55;
	const direction = tailDirection(presLayoutVars);
	standardOptions.hangingPlacer = (childHc, subtrees, anchorX, anchorY) => {
		placeHangingForest(childHc, subtrees, anchorX, anchorY, {
			orgChart,
			direction,
			indent,
			vGap,
		});
	};
}
