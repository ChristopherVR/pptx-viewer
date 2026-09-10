/**
 * SmartArt DiagramML interpreter - "hub + satellites" arranger DETECTION.
 *
 * Split out of `smartart-layout-interpreter-hub.ts` (repo per-file line
 * budget): the raw-XML/typed-field heuristics that decide whether an
 * arranger's own driving `dgm:forEach` genuinely repeats a child template
 * (a hub whose children become satellites) as opposed to a plain per-point
 * template, a list continuation, or an unrelated transition iterator. See
 * that module's own doc comment for the overall "hub + satellites"
 * substitution this feeds.
 */

import type { PptxSmartArtForEach, PptxSmartArtLayoutNode } from '../types';

/**
 * True when a raw `dgm:forEach` targets `axis="ch"` node points (not
 * `sibTrans`/`parTrans`, a transition/spacer iterator) starting from the
 * FIRST point (`st` absent or `"1"`). Excludes a CONTINUATION iterator
 * (`st > 1`, mirroring `smartart-layout-interpreter-composite-detect.ts`'s
 * `isContinuationForEach` for the already-parsed model - this is the raw-XML
 * equivalent, since `arrangerRepeatsChildTemplate` searches `rawXml`
 * directly, not the typed `.forEach`) - `Table List`'s `pillars` nests
 * exactly this shape (`pillar1` via a compound `presOf` handling child #1
 * specially, THEN `dgm:forEach st="2"` for the rest): it "repeats a child
 * template" in the raw sense `hasNestedChildForEach` originally checked for,
 * but is a LIST CONTINUATION, not a genuine hub whose children ALL become
 * satellites uniformly (`Converging Text`'s per-count-branch satellite
 * `dgm:forEach`s each start at `st="1"`/`"2"`/... for a DIFFERENT total
 * count, so the FIRST one found in document order is always `st="1"`).
 */
function isChildNodeForEach(entry: unknown): boolean {
	const raw = Array.isArray(entry) ? entry[0] : entry;
	if (!raw || typeof raw !== 'object') {
		return false;
	}
	const attrs = raw as Record<string, unknown>;
	const ptType = attrs['@_ptType'];
	const start = Number(attrs['@_st'] ?? '1');
	return (
		attrs['@_axis'] === 'ch' &&
		(ptType === undefined || String(ptType).includes('node')) &&
		(!Number.isFinite(start) || start <= 1)
	);
}

/**
 * True when `raw` (a `dgm:forEach`'s raw XML body) declares, anywhere within
 * it (through `dgm:layoutNode`/`dgm:choose`/`dgm:if`/`dgm:else` wrapping), a
 * NESTED `dgm:forEach axis="ch"` targeting node points.
 */
function hasNestedChildForEach(value: unknown): boolean {
	if (!value || typeof value !== 'object') {
		return false;
	}
	if (Array.isArray(value)) {
		return value.some(hasNestedChildForEach);
	}
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (key.split(':').pop() === 'forEach' && isChildNodeForEach(entry)) {
			return true;
		}
		if (hasNestedChildForEach(entry)) {
			return true;
		}
	}
	return false;
}

/**
 * True when `raw`'s own DIRECT `dgm:forEach` children (not a deeper search)
 * include one targeting `axis="self" ptType="node"` - the
 * "for each child, treat it as the current point and render its own
 * template" idiom (`radial-cluster`'s `Name54 axis="ch" cnt="21"` wrapping
 * `Name57 axis="self" ptType="node"`, which in turn wraps the actual
 * text-bearing `dgm:layoutNode`). Deliberately narrower than a general
 * recursive search: every OTHER shape this module's tests guard against
 * (a plain child TEMPLATE `dgm:layoutNode` sibling, or a nested `axis="ch"`/
 * `"followSib"` forEach) nests something else at this SAME direct level, so
 * checking only direct children (not descending further) is what keeps this
 * from also firing for those.
 */
function hasDirectSelfNodeForEach(raw: unknown): boolean {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return false;
	}
	const key = Object.keys(raw as Record<string, unknown>).find(
		(candidate) => candidate.split(':').pop() === 'forEach',
	);
	if (!key) {
		return false;
	}
	const value = (raw as Record<string, unknown>)[key];
	const entries = Array.isArray(value) ? value : [value];
	return entries.some((entry) => {
		if (!entry || typeof entry !== 'object') {
			return false;
		}
		const attrs = entry as Record<string, unknown>;
		return attrs['@_axis'] === 'self' && String(attrs['@_ptType'] ?? '').includes('node');
	});
}

/**
 * True when `entry` (an already-parsed `dgm:forEach`, `arranger.forEach[0]`)
 * IS ITSELF a `ch`-axis, node-typed, from-the-start iterator whose own raw
 * body directly nests a `axis="self" ptType="node"` forEach ({@link
 * hasDirectSelfNodeForEach}) - `radial-cluster`'s own shape, where there is
 * no SEPARATE outer selector forEach for `arrangerRepeatsChildTemplate`'s
 * original "nested `axis=ch`" search to find; the arranger's own forEach IS
 * the repeat. The `hasDirectSelfNodeForEach` requirement is deliberate, not
 * just `entry.axis?.[0] === 'ch'` alone: this module's own existing tests
 * ALSO give their "declines" fixtures a top-level `axis: ['ch']` (the
 * pre-existing typed-field convention, unrelated to whether the raw body
 * genuinely repeats a child template), so the axis/pointTypes/start check
 * alone cannot tell those apart from a genuine hub - only what is nested
 * one level inside the raw body can.
 */
function isOwnChildForEach(entry: PptxSmartArtForEach | undefined): boolean {
	if (!entry) {
		return false;
	}
	const start = entry.start?.[0] ?? 1;
	return (
		entry.axis?.[0] === 'ch' &&
		(entry.pointTypes === undefined || entry.pointTypes.includes('node')) &&
		start <= 1 &&
		hasDirectSelfNodeForEach(entry.rawXml)
	);
}

/**
 * True when `arranger`'s driving `dgm:forEach` (`arranger.forEach[0]`)
 * either IS ITSELF a `ch`-axis child iterator (`radial-cluster`'s own
 * `singleCycle`: its one DIRECT forEach child already iterates the hub's
 * children - there is no separate outer `cnt="1"` forEach wrapping it, that
 * selection lives one level up, in `arranger.forEachOrigin`, not
 * `arranger.forEach`) or declares a NESTED `dgm:forEach axis="ch"` in its
 * raw body (the shape this module originally documented - `radial-cycle`/
 * `basic-radial`/`balance`, where the arranger's own driving forEach selects
 * the hub and a forEach nested inside IT arranges the children).
 */
export function arrangerRepeatsChildTemplate(arranger: PptxSmartArtLayoutNode): boolean {
	const entry = arranger.forEach?.[0];
	if (isOwnChildForEach(entry)) {
		return true;
	}
	const raw = entry?.rawXml;
	return raw !== undefined && hasNestedChildForEach(raw);
}
