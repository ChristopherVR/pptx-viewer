/**
 * SmartArt DiagramML interpreter - `dgm:choose` branch selection (top-level
 * and nested).
 *
 * Split out of `smartart-layout-interpreter-choose-algorithm.ts` (the
 * file-size budget): the two functions that pick WHICH branch's raw XML is
 * active, for a layoutNode's own parsed `dgm:choose` ({@link activeBranch})
 * and for one living entirely inside an already-active branch's raw body
 * ({@link nestedChooseBranch}) - see that module's own doc comment for how
 * `branchAlg` uses both.
 */

import type { PptxSmartArtChoose, XmlObject } from '../types';
import { parseWhen } from './smartart-layout-control-flow';
import { evaluateWhen } from './smartart-layout-interpreter-when';
import type { WhenContext } from './smartart-layout-interpreter-when';

export const localName = (key: string): string => key.split(':').pop() ?? key;

/**
 * Resolve the raw XML of the active `dgm:choose` branch for a node count, or
 * `undefined` when the choose is not decidable (an earlier branch is
 * undecidable) or no branch applies. DiagramML picks the first matching `if` in
 * order, so an undecidable earlier branch forces a bail.
 */
export function activeBranch(
	choose: PptxSmartArtChoose,
	nodeCount: number,
	context: WhenContext,
): XmlObject | undefined {
	for (const when of choose.when) {
		const result = evaluateWhen(when, nodeCount, context);
		if (result === undefined) {
			return undefined;
		}
		if (result) {
			return when.rawXml;
		}
	}
	return choose.otherwise?.rawXml ?? undefined;
}

/**
 * Resolve a NESTED `dgm:choose` (one living entirely inside an already-active
 * branch's raw XML, e.g. `basic-radial--hier5.pptx`'s `stAng` choose nested
 * inside its `dir="norm"` branch) to its own winning branch's raw content, or
 * `undefined` when it is not decidable - never a raw `dgm:if`/`dgm:else`
 * `branchAlg`'s blind walk would otherwise recurse into UNCONDITIONALLY.
 * Only a layoutNode's OWN direct `dgm:choose` children are parsed into
 * `PptxSmartArtChoose` at load time (`smartart-layout-control-flow.ts`'s
 * `parseSmartArtControlFlow`); one nested inside a branch's raw XML is only
 * ever reachable here, parsed on the fly with the SAME `parseWhen` the
 * top-level parser uses, so it decides with the exact same rules (including
 * compound `@axis` navigation - see `smartart-layout-interpreter-when.ts`).
 */
export function nestedChooseBranch(
	chooseXml: XmlObject,
	nodeCount: number,
	context: WhenContext,
): XmlObject | undefined {
	let elseBranch: XmlObject | undefined;
	for (const [key, entry] of Object.entries(chooseXml)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const name = localName(key);
		if (name === 'if') {
			for (const ifXml of Array.isArray(entry) ? entry : [entry]) {
				if (!ifXml || typeof ifXml !== 'object') {
					continue;
				}
				const when = parseWhen(ifXml as XmlObject);
				if (!when) {
					continue;
				}
				const result = evaluateWhen(when, nodeCount, context);
				if (result === undefined) {
					// An earlier `if` is undecidable: DiagramML picks the first
					// matching branch in document order, so an undecidable one
					// forces the WHOLE nested choose undecidable too - matching
					// `activeBranch`'s own top-level rule.
					return undefined;
				}
				if (result) {
					return ifXml as XmlObject;
				}
			}
		} else if (name === 'else') {
			elseBranch = (Array.isArray(entry) ? entry[0] : entry) as XmlObject | undefined;
		}
	}
	return elseBranch;
}
