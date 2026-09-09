/**
 * SmartArt DiagramML interpreter - bounded `dgm:choose`-wrapped `composite`
 * fallback.
 *
 * Split out of `smartart-layout-interpreter-choose-algorithm.ts` (the
 * file-size budget): {@link boundedCompositeAlg} is a SEPARATE, narrower
 * search from that module's own `branchAlg`, used ONLY as a fallback after
 * `branchAlg` finds nothing at all for the same branch - see its own doc
 * comment for the full reasoning (the previously-measured regressions a
 * blind, unbounded `composite` search caused, and why this one avoids them).
 */

import type { XmlObject } from '../types';
import { localName, nestedChooseBranch } from './smartart-layout-interpreter-choose-branch';
import type { WhenContext } from './smartart-layout-interpreter-when';

/** A recognised `dgm:alg` found inside a branch's XML, its type plus the raw element (for its `dgm:param`s). */
export interface FoundBranchAlg {
	type: string;
	raw: XmlObject;
}

/**
 * First `dgm:alg type="composite"` declared inside a branch's XML, WITHOUT
 * ever crossing into a nested `dgm:layoutNode` - a SEPARATE, narrower search
 * from `smartart-layout-interpreter-choose-algorithm.ts`'s `branchAlg` (see
 * `CHOOSE_ALG_TYPES`'s own doc comment there for the measured regressions a
 * blind, unbounded `composite` search caused: it matched an UNRELATED nested
 * composite reached through a child layoutNode - a per-item template, or a
 * sibling arranger's own choose - stealing the decision from a genuinely
 * earlier `cycle`/`lin` alg before it was ever reached; bounding the WHOLE
 * walk at a layoutNode boundary regressed STRUCTURAL resolution elsewhere
 * instead, which legitimately does need to cross into a child layoutNode).
 * This function is used ONLY as a fallback (see `chooseAlgType`/
 * `chooseAlgorithm`), tried AFTER `branchAlg` finds nothing at all for the
 * SAME branch - it can never out-rank an already-reachable structural type,
 * and its own search never crosses a `dgm:layoutNode` boundary, so it cannot
 * reach an unrelated nested composite the way the reverted whole-type-set
 * addition did. `hexagon-radial--hier5.pptx`'s `Name0` needs exactly this
 * shape: an outer `dgm:if func="var" arg="dir"` wraps an INNER `dgm:choose`
 * with per-child-count `dgm:if`s, each selecting a DIFFERENT `dgm:alg
 * type="composite"` - two choose levels deep, no intervening layoutNode at
 * all.
 */
export function boundedCompositeAlg(
	raw: XmlObject | undefined,
	nodeCount: number,
	context: WhenContext,
): FoundBranchAlg | undefined {
	if (!raw) {
		return undefined;
	}
	let found: FoundBranchAlg | undefined;
	const visit = (value: unknown): void => {
		if (found !== undefined || !value || typeof value !== 'object') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		for (const [key, entry] of Object.entries(value as XmlObject)) {
			if (found !== undefined) {
				return;
			}
			if (key.startsWith('@_')) {
				continue;
			}
			const name = localName(key);
			if (name === 'layoutNode') {
				// Never cross into a nested layoutNode - see this function's doc
				// comment for why (the previously-measured regression class).
				continue;
			}
			if (name === 'alg') {
				for (const candidate of Array.isArray(entry) ? entry : [entry]) {
					const type =
						candidate && typeof candidate === 'object'
							? String((candidate as XmlObject)['@_type'] ?? '')
							: '';
					if (type === 'composite') {
						found = { type, raw: candidate as XmlObject };
						return;
					}
				}
			} else if (name === 'choose') {
				for (const candidate of Array.isArray(entry) ? entry : [entry]) {
					if (!candidate || typeof candidate !== 'object') {
						continue;
					}
					const winningBranch = nestedChooseBranch(candidate as XmlObject, nodeCount, context);
					if (winningBranch) {
						visit(winningBranch);
					}
				}
			} else {
				visit(entry);
			}
		}
	};
	visit(raw);
	return found;
}
