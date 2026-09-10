/**
 * SmartArt DiagramML interpreter - `dgm:if/@func="var"` evaluation.
 *
 * Split out of `smartart-layout-interpreter-when.ts` (the repo's per-file
 * line budget): compares a diagram's own `presLayoutVars` (`dgm:varLst`)
 * against a `dgm:if`'s `@arg`/`@val`. Pure TypeScript - no framework code,
 * no DOM.
 */

import type { PptxSmartArtPresLayoutVars, PptxSmartArtWhen } from '../types';
import { compareNumeric, toNumber } from './smartart-layout-interpreter-when-numeric';

/** `dgm:if/@arg` variable name -> the `presLayoutVars` field it names (`dgm:varLst` tag names). */
const VAR_LOOKUP: Readonly<
	Record<string, (vars: PptxSmartArtPresLayoutVars) => string | number | boolean | undefined>
> = {
	dir: (v) => v.direction,
	hierBranch: (v) => v.hierarchyBranch,
	orgChart: (v) => v.orgChart,
	chMax: (v) => v.childMax,
	chPref: (v) => v.childPreferred,
	bulletEnabled: (v) => v.bulletEnabled,
	animLvl: (v) => v.animationLevel,
	animOne: (v) => v.animateOne,
	resizeHandles: (v) => v.resizeHandles,
};

/**
 * ECMA-376 `CT_DirectionVarSet`/etc. default a `dgm:varLst` variable NOT
 * written to the file, rather than leaving it "unknown": most built-in
 * layoutDefs (every `lin`/`snake`/`cycle`/`pyra` family, at minimum) gate
 * their primary arrangement algorithm behind
 * `<dgm:if func="var" arg="dir" op="equ" val="norm">` and never write an
 * explicit `dgm:dir` unless the diagram is actually reversed - so treating
 * "absent" as undecidable (rather than "norm", the spec default) meant this
 * choose was NEVER decided for the common case, and `discoverArrangement`
 * fell through to the legacy family approximation for the majority of the
 * built-in gallery (measured via `smartart-gallery-ground-truth.test.ts`:
 * "Basic Process" and most List/Process/Cycle/Pyramid layouts). Only `dir`
 * is defaulted here; the other `dgm:varLst` variables (`hierBranch`,
 * `chMax`/`chPref`, ...) are resolved with their own defaults already
 * applied at parse time (`smartart-pres-layout-vars.ts`), so they reach here
 * with a concrete value or a deliberate "genuinely absent" `undefined`.
 */
const VAR_DEFAULT: Readonly<Partial<Record<string, string>>> = { dir: 'norm' };

/** Evaluate `func="var"`: compare `presLayoutVars[@arg]` against `when.value`. */
export function evaluateVar(
	when: PptxSmartArtWhen,
	presLayoutVars: PptxSmartArtPresLayoutVars,
): boolean | undefined {
	if (!when.argument) {
		return undefined;
	}
	const resolved = VAR_LOOKUP[when.argument]?.(presLayoutVars);
	const actual = resolved ?? VAR_DEFAULT[when.argument];
	if (actual === undefined) {
		return undefined;
	}
	if (typeof actual === 'number') {
		const threshold = toNumber(when.value);
		return threshold === undefined ? undefined : compareNumeric(actual, when.operator, threshold);
	}
	// Boolean/string variables (`orgChart`, `dir`, `hierBranch`, ...) only support
	// equality: ECMA-376 doesn't define an ordering for them.
	const actualStr = String(actual);
	if (when.operator === 'equ') {
		return actualStr === when.value;
	}
	if (when.operator === 'neq') {
		return actualStr !== when.value;
	}
	return undefined;
}
