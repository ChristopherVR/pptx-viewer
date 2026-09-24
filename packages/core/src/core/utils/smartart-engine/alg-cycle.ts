/**
 * `cycle` algorithm (ECMA-376 Part 1, 21.4.2.x): children are placed evenly
 * around a ring inscribed in the node's box. `stAng` (start angle, clockwise
 * from 12 o'clock) picks the first point; `spanAng` sweeps a full ring when
 * `abs(spanAng) >= 360`, otherwise the LAST point lands exactly `spanAng`
 * degrees from the first (`n - 1` gaps, not `n`). `ctrShpMap="fNode"` pulls
 * the FIRST content point off the ring and centres it instead - PowerPoint's
 * hub+ring "Radial Cycle" construction. `rotPath="alongPath"` rotates each
 * ring item to the path's own tangent at its position instead of leaving it
 * upright.
 *
 * Mirrors the legacy family interpreter's derivation
 * (`smartart-layout-interpreter-cycle-ring.ts`'s module doc comment, itself
 * reverse-engineered against live PowerPoint COM output): in a unit space
 * where the ring item's own width is 1, the ring radius solves the
 * adjacent-item chord to `1 + sibSp`, then the whole ring (radius and item
 * size together) is scaled by a SINGLE isotropic factor to CONTAIN it in the
 * node's box (never stretched per axis, matching that module's "contain not
 * cover" fit), centring the slack. Unlike that interpreter, which also
 * resolves hub-satellite gap ratios, a `sibTrans` curve's own bulge and
 * axis-flush centring for asymmetric ring counts, this engine algorithm keeps
 * the plain-ring and `ctrShpMap="fNode"` hub cases only; each item's own
 * subtree still sizes itself through the engine's ordinary constraint/
 * font-fit pipeline the same way every other per-point algorithm does.
 */

import type { EngineNode } from './engine-node';
import { preferredSize } from './preferred-size';
import type { Size } from './preferred-size';

const DEG_TO_RAD = Math.PI / 180;

/**
 * `sibSp`'s schema default is 0, but every ring-family gallery layout
 * examined declares (or the interpreter's own aesthetic floor enforces) at
 * least half an item-width of gap between adjacent ring items - see
 * `smartart-layout-interpreter-cycle-constraints.ts`'s `DEFAULT_MIN_GAP_RATIO`
 * doc comment. Used only when the layout declares no `sibSp`/`sp` at all.
 */
const DEFAULT_GAP_RATIO = 0.5;

/**
 * Presentation entries for the SAME `node`/`asst` content point collapse to
 * one ring slot. Filtering on the point's OWN type (not the entry's
 * `alg.type`) matters: a transition's own connector LABEL (`connectorText`,
 * commonly `alg="tx"`) presents the `sibTrans`/`parTrans` point, not a
 * content point, so an `alg.type !== 'conn'` filter alone would still count
 * it as an extra ring item and crowd the ring - measured against
 * `basic-cycle--flat3.pptx`, whose `sibTrans` carries exactly this label.
 */
function groupContentChildren(node: EngineNode): EngineNode[][] {
	const groups: EngineNode[][] = [];
	const byPoint = new Map<object, EngineNode[]>();
	for (const child of node.children) {
		if (child.point.type !== 'node' && child.point.type !== 'asst') {
			continue;
		}
		let group = byPoint.get(child.point);
		if (!group) {
			group = [];
			byPoint.set(child.point, group);
			groups.push(group);
		}
		group.push(child);
	}
	return groups;
}

/**
 * The ring's own declared `sibSp`/`sp` gap, as a fraction of a ring item's
 * width. Read straight from the DECLARED constraint's `fact` (or a bare
 * `val` under 1), not the generic pipeline's already-solved `node.values`
 * entry: a real gallery layoutDef's own `sibSp` constraint commonly reads
 * `refFor="ch" refType="w"`, i.e. "a fraction of a ring ITEM's own width" -
 * but by the time the generic pass runs it, that referenced item `w` has
 * itself already been set (by an EARLIER "ch" constraint in the SAME list,
 * `type="w" for="ch" ptType="node" refType="w" refFor="self" fact="1"`, a
 * ring item's own "wish" size before the ring geometry shrinks it) to the
 * WHOLE node's own width - so `node.values.get('sibSp')` resolves to
 * `fact * fullNodeWidth`, not `fact` (measured against
 * `basic-cycle--flat3.pptx`: 650.25 * 0.5 = 325.125, not the intended 0.5).
 * `fact` alone is the correct ratio regardless of what it was multiplied
 * against, matching the legacy family interpreter's own
 * `resolveRatioConstraint`, which reads the same `fact` directly from the
 * XML rather than a solved value.
 */
function resolveGapRatio(node: EngineNode): number {
	for (const constraint of node.constraints) {
		if (constraint.for !== 'self' || (constraint.type !== 'sibSp' && constraint.type !== 'sp')) {
			continue;
		}
		if (constraint.refType !== 'none') {
			return Math.max(0, constraint.fact);
		}
		if (constraint.hasVal) {
			return constraint.val < 1 ? Math.max(0, constraint.val) : DEFAULT_GAP_RATIO;
		}
	}
	return DEFAULT_GAP_RATIO;
}

/** A ring item's own declared `h`/`w` aspect (`refType` fact, self-scoped); square by default. */
function resolveAspect(group: EngineNode[]): number {
	for (const item of group) {
		for (const constraint of item.constraints) {
			if (constraint.for !== 'self' || constraint.refType === 'none' || constraint.fact <= 0) {
				continue;
			}
			if (constraint.type === 'h' && constraint.refType === 'w') {
				return constraint.fact;
			}
			if (constraint.type === 'w' && constraint.refType === 'h') {
				return 1 / constraint.fact;
			}
		}
	}
	return 1;
}

function placeGroup(group: EngineNode[], x: number, y: number, w: number, h: number): void {
	for (const item of group) {
		item.box = { x, y, w, h };
	}
}

function placeGroupCentered(
	group: EngineNode[],
	cx: number,
	cy: number,
	w: number,
	h: number,
): void {
	placeGroup(group, cx - w / 2, cy - h / 2, w, h);
}

function normaliseAngle(degrees: number): number {
	return ((degrees % 360) + 360) % 360;
}

function setRotation(group: EngineNode[], degrees: number): void {
	const rotation = normaliseAngle(degrees);
	for (const item of group) {
		item.rotation = rotation;
	}
}

/**
 * A ring item's own presentation entries are the only children this
 * algorithm positions on the ring; every other child (a `sibTrans`/`parTrans`
 * transition, most commonly the `conn` shape itself and, when nested under
 * it, its own connector-text label) still needs SOME non-degenerate box
 * before the layout driver's connector pass or font-fit walk touches it, or
 * it inherits the layout driver's `{0,0,0,0}` fallback and the whole layout
 * gets rejected downstream (`isFiniteGeometry` requires `width > 0` and
 * `height > 0`). `arrangeConnector` repositions and resizes the `conn` node
 * itself entirely from the two shapes it joins, but reads its OWN `box.h` as
 * the connector's rendered thickness first, so that seed still has to be a
 * sane, non-zero value - `preferredSize` (the child's own self constraints,
 * e.g. a `h refType="w"` thickness ratio) resolved against the ring item's
 * own size, since a bare transition has no ring geometry of its own to size
 * against.
 */
function placeTransitionChildren(
	node: EngineNode,
	centre: { x: number; y: number },
	fallback: Size,
): void {
	for (const child of node.children) {
		if (child.point.type === 'node' || child.point.type === 'asst') {
			continue;
		}
		const size = preferredSize(child, fallback);
		const w = Math.max(1, size.w);
		const h = Math.max(1, size.h);
		child.box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
	}
}

export function arrangeCycle(node: EngineNode): void {
	const box = node.box;
	if (!box) {
		return;
	}
	const groups = groupContentChildren(node);
	if (groups.length === 0) {
		return;
	}
	const params = node.alg.params;
	const hub = params.ctrShpMap === 'fNode' ? groups.shift() : undefined;
	const n = groups.length;
	const cx0 = box.x + box.w / 2;
	const cy0 = box.y + box.h / 2;
	if (n === 0) {
		if (hub) {
			placeGroup(hub, box.x, box.y, box.w, box.h);
		}
		placeTransitionChildren(node, { x: cx0, y: cy0 }, { w: box.w, h: box.h });
		return;
	}

	const heightOverWidth = Math.max(0.01, resolveAspect(groups[0]));
	const gap = resolveGapRatio(node);
	const stAng = Number(params.stAng) || 0;
	const parsedSpan = Number(params.spanAng);
	const spanAng = Number.isFinite(parsedSpan) ? parsedSpan : 360;
	const rotPath = params.rotPath === 'alongPath';

	if (n === 1) {
		const w0 = box.w;
		const h0 = Math.min(box.h, box.w * heightOverWidth);
		placeGroupCentered(groups[0], cx0, cy0, w0, h0);
		if (rotPath) {
			setRotation(groups[0], stAng);
		}
		if (hub) {
			placeGroupCentered(hub, cx0, cy0, w0 / 4, h0 / 4);
		}
		placeTransitionChildren(node, { x: cx0, y: cy0 }, { w: w0, h: h0 });
		return;
	}

	const full = Math.abs(spanAng) >= 360;
	const step = full ? spanAng / n : spanAng / (n - 1);
	const halfStepRad = (Math.abs(step) * DEG_TO_RAD) / 2;
	const sinHalf = Math.sin(halfStepRad);
	// Chord between adjacent ring items = (1 + gap) item-widths (unit width 1
	// in this natural space) -> solve the ring radius r0.
	const r0 = sinHalf > 1e-6 ? (1 + gap) / (2 * sinHalf) : 0;

	const natural = groups.map((_, i) => {
		const angleRad = (stAng + i * step - 90) * DEG_TO_RAD;
		return { x: r0 * Math.cos(angleRad), y: r0 * Math.sin(angleRad) };
	});
	const halfW = 0.5;
	const halfH = heightOverWidth / 2;
	const xs = natural.map((p) => p.x);
	const ys = natural.map((p) => p.y);
	const minX = Math.min(...xs) - halfW;
	const maxX = Math.max(...xs) + halfW;
	const minY = Math.min(...ys) - halfH;
	const maxY = Math.max(...ys) + halfH;
	const boundW = Math.max(1e-6, maxX - minX);
	const boundH = Math.max(1e-6, maxY - minY);
	// A SINGLE isotropic scale (never independent per-axis stretching): the
	// tighter of the two per-axis "fill" candidates wins, and the slack on
	// the other axis is centred.
	const scale = Math.min(box.w / boundW, box.h / boundH);
	const offsetX = box.x + (box.w - boundW * scale) / 2;
	const offsetY = box.y + (box.h - boundH * scale) / 2;
	const itemW = scale;
	const itemH = heightOverWidth * scale;

	groups.forEach((group, i) => {
		const cx = (natural[i].x - minX) * scale + offsetX;
		const cy = (natural[i].y - minY) * scale + offsetY;
		placeGroupCentered(group, cx, cy, itemW, itemH);
		if (rotPath) {
			setRotation(group, stAng + i * step);
		}
	});

	if (hub) {
		const hubCx = (0 - minX) * scale + offsetX;
		const hubCy = (0 - minY) * scale + offsetY;
		// Largest hub half-extent (natural units) that clears every ring
		// item's own edge from the shared natural centre.
		const naturalHubRadius = Math.max(0, r0 - Math.max(halfW, halfH));
		const hubW = Math.max(1, naturalHubRadius * scale * 2);
		const hubH = Math.max(1, naturalHubRadius * scale * 2);
		placeGroupCentered(hub, hubCx, hubCy, hubW, hubH);
	}

	placeTransitionChildren(node, { x: cx0, y: cy0 }, { w: itemW, h: itemH });
}
