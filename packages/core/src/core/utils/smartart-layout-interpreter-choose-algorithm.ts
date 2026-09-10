/**
 * SmartArt DiagramML interpreter - `dgm:choose`-wrapped `dgm:alg` resolution.
 *
 * Split out of `smartart-layout-interpreter-flow.ts` to keep that file under
 * the repo's per-file line budget: this half resolves a decidable `dgm:choose`
 * to its winning branch's arrangement algorithm - the TYPE alone
 * ({@link chooseAlgType}, the pre-existing entry point) or the type PLUS every
 * `dgm:param` it declares ({@link chooseAlgorithm}).
 *
 * The full-algorithm resolution matters because the typed layout model (see
 * `smartart-layout-definition.ts`) only parses a DIRECT `dgm:alg` child of a
 * layoutNode into that node's own `algorithm` field; a `dgm:alg` living
 * entirely inside a `dgm:choose` (mirroring `dir="rtl"`, the common real-world
 * shape) leaves that field `undefined` at parse time. `discoverArrangement`
 * (`smartart-layout-interpreter-model.ts`) uses {@link chooseAlgorithm} to
 * populate the chosen arranger node's `algorithm` with the WINNING branch's
 * real params, not just its type, when it falls back to the choose-wrapped
 * node itself.
 */

import type {
	PptxSmartArtAlgorithmParameter,
	PptxSmartArtLayoutAlgorithm,
	PptxSmartArtLayoutNode,
	XmlObject,
} from '../types';
import {
	activeBranch,
	localName,
	nestedChooseBranch,
} from './smartart-layout-interpreter-choose-branch';
import { boundedCompositeAlg } from './smartart-layout-interpreter-choose-composite';
import type { WhenContext } from './smartart-layout-interpreter-when';

/**
 * Structural algorithm types a decidable choose branch may select. Includes
 * `hierChild`/`hierRoot`: a genuine org-chart layoutDef (ECMA-376 orgChart1)
 * wraps its OWN root hierarchy algorithm in a `dgm:choose` picking between
 * `linDir`/`hierBranch` variants, not a bare `dgm:alg` - excluding them here
 * meant a choose-wrapped hierarchy was never recognised at all (see
 * `smartart-layout-interpreter-model.ts`'s `discoverArrangement`, which
 * special-cases these two types to set `hierarchy` rather than `chosen`).
 *
 * Deliberately EXCLUDES `composite`: recognising it here would let
 * `discoverArrangement`'s `else if (kind === 'composite' ...)` branch reach
 * a choose-wrapped `composite` algorithm (`Basic Venn`/`Interconnected
 * Rings`/`Theme Picture Accent/Grid/Alternating Accent`/`Bubble Picture
 * List` all wrap theirs this way) - a genuine, still-open fix - but TRIED
 * this round and reverted: `branchAlg`'s blind recursive search (see its own
 * doc comment) also then matches an UNRELATED nested `composite` reached
 * through the SAME walk (a per-item template, or a different node's own
 * choose in a hub+satellite `cycle` family via `detectHubExpansion` -
 * `smartart-layout-interpreter-hub.ts`), stealing the decision away from a
 * genuinely earlier `cycle`/`lin` alg before it is ever reached - measured
 * regression on `Upward Arrow`/`Phased Process`/`Circle Relationship`/
 * `Opposing Ideas`/`Stacked Venn`/`Radial Picture List` even after bounding
 * the search at a `dgm:layoutNode` boundary (which ALSO regressed
 * `Continuous Cycle`/`Segmented Process`/`Accented Picture`/`Nested Target`
 * on its own, changing which alg a `cycle`/`lin`/`snake`/`pyra` branch finds
 * too). See the round-3 Track S/R handoff notes for the six fixtures this
 * would fix, and the exact regression list a future attempt must avoid.
 */
const CHOOSE_ALG_TYPES = new Set(['lin', 'cycle', 'pyra', 'snake', 'hierChild', 'hierRoot']);

/** A recognised structural `dgm:alg` found inside a branch's XML, its type plus the raw element (for its `dgm:param`s). */
interface FoundBranchAlg {
	type: string;
	raw: XmlObject;
}

/**
 * First recognised structural `dgm:alg` declared inside a branch's XML,
 * carrying its raw element so a caller can also read its `dgm:param`s (see
 * {@link chooseAlgorithm}) - a type-only search generalised so a
 * choose-wrapped `dgm:alg`'s params (`grDir`/`flowDir`/`contDir`/`off`/
 * `linDir`/...) are not silently lost. Measured against `basic-block-list--
 * flat3.pptx`: its `snake` algorithm lives entirely inside a `dgm:choose`
 * (mirroring `dir="rtl"`), so `discoverArrangement`'s chosen arranger node
 * previously kept its OWN (parse-time, choose-blind) `undefined` `algorithm`
 * field - every `dgm:param` read (`contDir`, `off`, and any layout's
 * `linDir`/`stAng`/`spanAng`/`vertAlign`/`bkpt`) silently fell back to its
 * generic default instead of the declared value.
 *
 * A NESTED `dgm:choose` inside the branch (see {@link nestedChooseBranch}) is
 * evaluated, not blindly recursed into: COM-verified regression against
 * `basic-radial--hier5.pptx`, whose `dir="norm"` branch nests a SECOND
 * choose picking `stAng` by satellite count - the old blind walk always
 * found the FIRST nested `if`'s `dgm:alg` (`stAng="90"`, the `cnt<=1`
 * branch) regardless of whether that branch's own condition was true,
 * because it never evaluated it at all.
 */
function branchAlg(
	raw: XmlObject | undefined,
	nodeCount: number,
	context: WhenContext,
	allowedTypes: ReadonlySet<string> = CHOOSE_ALG_TYPES,
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
			if (name === 'alg') {
				for (const candidate of Array.isArray(entry) ? entry : [entry]) {
					const type =
						candidate && typeof candidate === 'object'
							? String((candidate as XmlObject)['@_type'] ?? '')
							: '';
					if (allowedTypes.has(type)) {
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
					// Undecidable: skip this nested choose entirely (no fallback to
					// blindly guessing one of its branches).
				}
			} else {
				visit(entry);
			}
		}
	};
	visit(raw);
	return found;
}

/** First recognised structural `dgm:alg` type declared inside a branch's XML. */
function branchAlgType(
	raw: XmlObject | undefined,
	nodeCount: number,
	context: WhenContext,
): string | undefined {
	return branchAlg(raw, nodeCount, context)?.type;
}

/** Parse a `dgm:alg` element's own `dgm:param` children (see `smartart-layout-algorithm.ts`'s parse-time equivalent for a direct, non-choose-wrapped `dgm:alg`). */
function parseBranchAlgParams(algXml: XmlObject): PptxSmartArtAlgorithmParameter[] | undefined {
	const paramKey = Object.keys(algXml).find((key) => localName(key) === 'param');
	const raw = paramKey ? algXml[paramKey] : undefined;
	const list: unknown[] = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : [];
	const params = list
		.map((entry): PptxSmartArtAlgorithmParameter | undefined => {
			if (!entry || typeof entry !== 'object') {
				return undefined;
			}
			const type = String((entry as XmlObject)['@_type'] ?? '').trim();
			if (!type) {
				return undefined;
			}
			const rawValue = (entry as XmlObject)['@_val'];
			return { type, value: rawValue !== undefined ? String(rawValue) : undefined };
		})
		.filter((param): param is PptxSmartArtAlgorithmParameter => Boolean(param));
	return params.length > 0 ? params : undefined;
}

/**
 * Resolve a decidable `dgm:choose` on `node` to the structural algorithm type
 * it selects, or `undefined` when no choose is decidable (in which case the
 * caller keeps the blind first-recognised-alg behaviour). Decidable on
 * `func="cnt"` from `nodeCount` alone, or on `func="var"` when `context`
 * carries `presLayoutVars`; `pos`/`revPos`/`posEven`/`posOdd`/`depth`/
 * `maxDepth` are decidable too when `context` supplies the declaring layout
 * node's own tree location (`discoverArrangement` in
 * `smartart-layout-interpreter-model.ts` now supplies it for every `choose`
 * it walks). `context` defaults to `{}` for source compatibility with
 * existing callers that don't have a tree location to offer (in which case
 * those functions stay undecidable, exactly as before).
 */
export function chooseAlgType(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	context: WhenContext = {},
): string | undefined {
	if (!node.choose || node.choose.length === 0) {
		return undefined;
	}
	for (const choose of node.choose) {
		const type = branchAlgType(activeBranch(choose, nodeCount, context), nodeCount, context);
		if (type !== undefined) {
			return type;
		}
	}
	// See `boundedCompositeAlg`'s doc comment: a `composite` fallback, tried
	// only once every branch's own structural search above has found nothing.
	for (const choose of node.choose) {
		const found = boundedCompositeAlg(activeBranch(choose, nodeCount, context), nodeCount, context);
		if (found) {
			return found.type;
		}
	}
	return undefined;
}

/**
 * Same decidability rules as {@link chooseAlgType}, but resolves the winning
 * branch's FULL algorithm (type plus every `dgm:param`), not just its type -
 * see {@link branchAlg}'s doc comment for why a type-only resolution loses a
 * choose-wrapped arranger's own `grDir`/`flowDir`/`contDir`/`off`/`linDir`/
 * `stAng`/`spanAng`/... entirely. The one caller
 * (`smartart-layout-interpreter-model.ts`'s `discoverArrangement`) uses this
 * to populate the CHOSEN arranger node's `algorithm` field when it falls back
 * to the choose-wrapped node itself (no child's own `algorithm.type` matched),
 * so every `algorithmParam` read downstream sees the real declared value
 * instead of silently defaulting.
 */
export function chooseAlgorithm(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	context: WhenContext = {},
): PptxSmartArtLayoutAlgorithm | undefined {
	if (!node.choose || node.choose.length === 0) {
		return undefined;
	}
	for (const choose of node.choose) {
		const found = branchAlg(activeBranch(choose, nodeCount, context), nodeCount, context);
		if (found) {
			const parameters = parseBranchAlgParams(found.raw);
			return { type: found.type, ...(parameters ? { parameters } : {}) };
		}
	}
	// See `boundedCompositeAlg`'s doc comment: a `composite` fallback, tried
	// only once every branch's own structural search above has found nothing.
	for (const choose of node.choose) {
		const found = boundedCompositeAlg(activeBranch(choose, nodeCount, context), nodeCount, context);
		if (found) {
			const parameters = parseBranchAlgParams(found.raw);
			return { type: found.type, ...(parameters ? { parameters } : {}) };
		}
	}
	return undefined;
}

/**
 * Resolve a decidable `dgm:choose` to a WINNING branch algorithm whose type
 * belongs to `allowedTypes` - a generalisation of {@link chooseAlgType}/
 * {@link chooseAlgorithm} for a caller that needs a type OUTSIDE their own
 * `CHOOSE_ALG_TYPES` whitelist (e.g. `tx`, for hierarchy generation-template
 * detection - `smartart-hierarchy-generation-templates.ts`).
 *
 * Deliberately kept SEPARATE from `chooseAlgType`/`chooseAlgorithm`'s own
 * default whitelist rather than widening `CHOOSE_ALG_TYPES` itself: that
 * whitelist also gates `discoverArrangement`'s own ARRANGEMENT dispatch
 * (`smartart-layout-interpreter-model.ts`), and widening it there for an
 * unrelated type has previously regressed unrelated fixtures - see
 * `CHOOSE_ALG_TYPES`'s own doc comment for the measured `composite`
 * regression. A narrow caller asking for a specific, non-structural type via
 * this entry point cannot affect that dispatch at all.
 */
export function chooseAlgorithmOfType(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	allowedTypes: ReadonlySet<string>,
	context: WhenContext = {},
): PptxSmartArtLayoutAlgorithm | undefined {
	if (!node.choose || node.choose.length === 0) {
		return undefined;
	}
	for (const choose of node.choose) {
		const found = branchAlg(
			activeBranch(choose, nodeCount, context),
			nodeCount,
			context,
			allowedTypes,
		);
		if (found) {
			const parameters = parseBranchAlgParams(found.raw);
			return { type: found.type, ...(parameters ? { parameters } : {}) };
		}
	}
	return undefined;
}
