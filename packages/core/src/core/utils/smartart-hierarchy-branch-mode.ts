/**
 * SmartArt DiagramML interpreter - hierarchy `hierBranch`/`linDir`/`chPref`
 * mode resolution.
 *
 * Split out of `smartart-layout-interpreter-hierarchy.ts` (the file-size
 * budget): pure decision helpers deciding WHICH placement mode
 * (`std`/`tailed`/`hanging`), tail direction, and per-row size
 * `arrangeHierarchy` should use, all read from `presLayoutVars`/`linDir` -
 * see that module's own doc comment for the full derivation and the
 * genuine-fixture measurements behind each rule.
 *
 * Pure decision logic; no framework code, no DOM.
 */

import type { PptxSmartArtPresLayoutVars } from '../types';
import type { HangDirection } from './smartart-hierarchy-hanging';

/**
 * `std`: literal ECMA-376 standard branch, no hanging tail anywhere (every
 *        generation fans). Reachable only from an explicit hand-built
 *        `hierarchyBranch: 'std'` - see the module doc comment.
 * `tailed`: the root's own children fan out (same as `std`), but every
 *        deeper generation hangs. Selected by `init`/`hang`/`l`/`r`.
 * `hanging`: the WHOLE tree hangs, including the root's own children. Only
 *        reached via the `linDir` fallback (no `presLayoutVars.hierBranch` at
 *        all) - see the module doc comment.
 */
export type BranchMode = 'std' | 'tailed' | 'hanging';

/** `linDir` values that select a hanging tree when `hierBranch` is absent. */
function isHangingLinDir(linDir: string | undefined): boolean {
	return linDir === 'fromL' || linDir === 'fromR';
}

export function branchMode(
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
	linDir: string | undefined,
): BranchMode {
	const branch = presLayoutVars?.hierarchyBranch;
	if (branch === 'l' || branch === 'r' || branch === 'hang' || branch === 'init') {
		return 'tailed';
	}
	if (branch === undefined && isHangingLinDir(linDir)) {
		return 'hanging';
	}
	return 'std';
}

/**
 * Tail direction for `tailed` mode (the root's own children are unaffected).
 *
 * `l`/`hang`/`r`/`init` all measure identically as 'right' against genuine
 * PowerPoint output - see `smartart-layout-interpreter-hierarchy.ts`'s module
 * doc comment and `HIER_TAIL_OFFSET_RATIO` in `smartart-hierarchy-shared.ts`.
 * Kept as a function (rather than a bare constant) so a future genuine-fixture
 * measurement that DOES find a real per-branch difference has a single place
 * to encode it.
 */
export function tailDirection(
	_presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): HangDirection {
	return 'right';
}

/**
 * Direction for `hanging` mode, reached ONLY via the `linDir` fallback (no
 * `presLayoutVars.hierBranch` at all): `fromR` grows the tree leftward
 * (children lead away from the right edge), `fromL` grows it rightward.
 */
export function linDirHangDirection(linDir: string | undefined): HangDirection {
	return linDir === 'fromR' ? 'left' : 'right';
}

/**
 * Resolve `chPref`/`chMax` into one per-row size (`Infinity` = unbounded).
 * `<= 1` is treated as unbounded: `hierarchy--hier8.pptx` declares `chPref
 * val="1"` (root-scoped, not scoped to the generation that fans 5-wide two
 * levels down) yet cached output fans all 5 in ONE row, not five 1-item
 * rows - a literal "wrap to 1" would be worse than a hanging column, which
 * `std` never selects. Every existing wrapping unit test uses `>= 2`.
 */
export function resolveRowSize(presLayoutVars: PptxSmartArtPresLayoutVars | undefined): number {
	const pref = presLayoutVars?.childPreferred;
	if (typeof pref === 'number' && pref > 1) {
		return pref;
	}
	const max = presLayoutVars?.childMax;
	if (typeof max === 'number' && max > 1) {
		return max;
	}
	return Number.POSITIVE_INFINITY;
}
