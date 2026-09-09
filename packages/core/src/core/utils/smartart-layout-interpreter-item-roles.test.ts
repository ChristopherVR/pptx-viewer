import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import {
	expandItemRoles,
	resolveItemRoleContent,
	resolveItemTextRoles,
} from './smartart-layout-interpreter-item-roles';
import type { RenderedRectNode } from './smartart-layout-types';

/** A `dgm:presOf`-bearing text role: `alg type="tx"` + a non-empty axis. */
function textRole(name: string, axis: string): PptxSmartArtLayoutNode {
	return { name, algorithm: { type: 'tx' }, presentationOf: { axis: [axis] } };
}

/** A decorative/positioning node: no `presOf`, not a text algorithm. */
function auxRole(name: string): PptxSmartArtLayoutNode {
	return { name, algorithm: { type: 'sp' } };
}

function childrenOf(entries: Record<string, PptxSmartArtNode[]>): Map<string, PptxSmartArtNode[]> {
	return new Map(Object.entries(entries));
}

const RECT_BASE: Omit<RenderedRectNode, 'key' | 'x' | 'y' | 'width' | 'height' | 'nodeId'> = {
	kind: 'rect',
	rx: 6,
	fill: '#123456',
	stroke: '#000000',
	strokeWidth: 1,
	opacity: 1,
	text: '',
	fontSize: 18,
	textX: 0,
	textY: 0,
};

describe('resolveItemTextRoles', () => {
	it('returns undefined for a single plain text item (the common case)', () => {
		const arranger: PptxSmartArtLayoutNode = {
			name: 'linear',
			children: [textRole('node', 'self')],
		};
		expect(resolveItemTextRoles(arranger)).toBeUndefined();
	});

	it('finds a flat self + des sibling pair, dropping a non-text spacer alternative', () => {
		// Vertical Bullet List's shape: parentText (self) + a dgm:choose between
		// childText (des, when the point has children) and spacer (no text) -
		// smartart-layout-definition.ts flattens BOTH choose branches here.
		const arranger: PptxSmartArtLayoutNode = {
			name: 'linear',
			children: [textRole('parentText', 'self'), textRole('childText', 'des'), auxRole('spacer')],
		};
		const roles = resolveItemTextRoles(arranger);
		expect(roles?.map((r) => r.name)).toStrictEqual(['parentText', 'childText']);
	});

	it('drills into a composite item WRAPPER whose own children are the real roles', () => {
		// Meet the Team's shape: `compNode` (alg=composite, paints nothing) wraps
		// photoCircle/spacer (no text) and nameText (self) / roleText (des).
		const compNode: PptxSmartArtLayoutNode = {
			name: 'compNode',
			algorithm: { type: 'composite' },
			children: [auxRole('photoCircle'), textRole('nameText', 'self'), textRole('roleText', 'des')],
		};
		const arranger: PptxSmartArtLayoutNode = { name: 'root', children: [compNode] };
		const roles = resolveItemTextRoles(arranger);
		expect(roles?.map((r) => r.name)).toStrictEqual(['nameText', 'roleText']);
	});

	it('ignores a multi-axis presOf compound it does not model (single role left)', () => {
		const arranger: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [
				textRole('parent', 'self'),
				{ name: 'child', algorithm: { type: 'tx' }, presentationOf: { axis: ['ch', 'desOrSelf'] } },
			],
		};
		// Both roles carry SOME axis, so resolveItemTextRoles still returns both
		// (axis validity is checked per-node at content-resolution time); a
		// compound axis simply resolves to no content later.
		const roles = resolveItemTextRoles(arranger);
		expect(roles?.map((r) => r.name)).toStrictEqual(['parent', 'child']);
	});

	it('treats an unresolved (choose-wrapped) algorithm as text, not decorative', () => {
		// List1's real shape: `parentText`'s own `dgm:alg` is wrapped in a
		// dgm:choose (LTR/RTL params), so `algorithm` parses as undefined -
		// still a text role, not excluded as decorative.
		const parentText: PptxSmartArtLayoutNode = {
			name: 'parentText',
			presentationOf: { axis: ['self'] },
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'linear',
			children: [parentText, textRole('childText', 'des')],
		};
		const roles = resolveItemTextRoles(arranger);
		expect(roles?.map((r) => r.name)).toStrictEqual(['parentText', 'childText']);
	});

	it("unions a non-text WRAPPER primary's own children with flat siblings (List1 shape)", () => {
		// List1's real shape: `parentLin` (a nested `lin` sub-arranger for
		// LTR/RTL alignment, alg unresolved through its OWN choose) wraps just
		// `parentText`; the true secondary role `childText` is a FLAT SIBLING
		// of parentLin at the arranger's own level, not nested inside it.
		const parentLin: PptxSmartArtLayoutNode = {
			name: 'parentLin',
			children: [
				auxRole('parentLeftMargin'),
				{ name: 'parentText', presentationOf: { axis: ['self'] } },
			],
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'linear',
			children: [parentLin, textRole('childText', 'des'), auxRole('spacer')],
		};
		const roles = resolveItemTextRoles(arranger);
		expect(roles?.map((r) => r.name)).toStrictEqual(['childText', 'parentText']);
	});

	it('excludes a sibTrans/parTrans transition role even when it carries presOf axis="self"', () => {
		// Multidirectional Cycle's shape: `sibTrans` (a reserved DiagramML
		// transition-point role, NOT user data) wraps `connectorText` and
		// itself carries `presOf axis="self"` - that "self" means the
		// TRANSITION point's own text, not the arranged node's, so it must
		// never become one of the arranged node's own per-item roles.
		const sibTrans: PptxSmartArtLayoutNode = {
			name: 'sibTrans',
			presentationOf: { axis: ['self'] },
			children: [
				{ name: 'connectorText', algorithm: { type: 'tx' }, presentationOf: { axis: ['self'] } },
			],
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'Name0',
			children: [textRole('node', 'desOrSelf'), sibTrans],
		};
		expect(resolveItemTextRoles(arranger)).toBeUndefined();
	});

	it("uses the PRIMARY wrapper's roles for two content-compatible parity-alternating wrappers (Alternating Flow)", () => {
		// `alternating-flow--hier5.pptx`: `composite1` (ODD points, reached
		// through a `dgm:forEach axis="ch" step="2"`) and `composite2` (EVEN
		// points, reached through a `followSib` iterator) each independently
		// unwrap to the SAME self+des SHAPE (just styled/positioned
		// differently for the alternating visual) - `smartart-layout-
		// interpreter-flow.ts`'s `selectArrangedNodes` now resolves the union
		// of both iterators (every point), so every point renders through
		// composite1's base geometry regardless of parity; using composite1's
		// (the non-partial, primary) roles for every point resolves the right
		// TEXT content since `self`/`des` axes resolve identically against
		// any point. (Measured: `alternating-flow--hier5.pptx` interpreted 5
		// shapes matching the cached drawing once combined with the flow.ts
		// fix; NOT reachable from this unit alone, which only pins the role
		// choice.)
		const composite1: PptxSmartArtLayoutNode = {
			name: 'composite1',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], step: [2] },
			children: [textRole('parentNode1', 'self'), textRole('childNode1tx', 'des')],
		};
		const composite2: PptxSmartArtLayoutNode = {
			name: 'composite2',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['followSib'], pointTypes: ['node'] },
			children: [textRole('parentNode2', 'self'), textRole('childNode2tx', 'des')],
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'process',
			children: [composite1, auxRole('conn1'), composite2, auxRole('conn2')],
		};
		const roles = resolveItemTextRoles(arranger);
		expect(roles?.map((role) => role.name)).toStrictEqual(['parentNode1', 'childNode1tx']);
	});

	it('still declines when parity-alternating wrappers resolve DIFFERENT role axis sets', () => {
		// A hypothetical variant of the Alternating Flow shape where the two
		// alternating templates genuinely disagree on role shape (one is a
		// plain self+des pair, the other has TWO des roles) - not
		// content-interchangeable, so this must still decline entirely.
		const composite1: PptxSmartArtLayoutNode = {
			name: 'composite1',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], step: [2] },
			children: [textRole('parentNode1', 'self'), textRole('childNode1tx', 'des')],
		};
		const composite2: PptxSmartArtLayoutNode = {
			name: 'composite2',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['followSib'], pointTypes: ['node'] },
			children: [textRole('childNode2a', 'des'), textRole('childNode2b', 'des')],
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'process',
			children: [composite1, composite2],
		};
		expect(resolveItemTextRoles(arranger)).toBeUndefined();
	});

	it('still unions two FULL-coverage composite wrappers (Circle Accent Timeline)', () => {
		// `circle-accent-timeline--hier5.pptx`: `parComposite`/`desComposite`
		// are each reached through a plain `axis="ch"` forEach with no `step`/
		// transition restriction - genuinely complementary self/des roles
		// covering the SAME full point set, not parity alternatives. Axis
		// shape alone cannot tell this apart from Alternating Flow's shape
		// (both pair a `self` role with another role); `forEachOrigin` can.
		const parComposite: PptxSmartArtLayoutNode = {
			name: 'parComposite',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'] },
			children: [textRole('parTx', 'self')],
		};
		const desComposite: PptxSmartArtLayoutNode = {
			name: 'desComposite',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'] },
			children: [textRole('desTx', 'des')],
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [parComposite, desComposite],
		};
		const roles = resolveItemTextRoles(arranger);
		expect(roles?.map((r) => r.name)).toStrictEqual(['parTx', 'desTx']);
	});
});

describe('resolveItemRoleContent', () => {
	const parent: PptxSmartArtNode = { id: 'p', text: 'Parent' };
	const child: PptxSmartArtNode = { id: 'c', text: 'Child' };
	const grandchild: PptxSmartArtNode = { id: 'g', text: 'Grandchild' };
	const map = childrenOf({ p: [child], c: [grandchild] });

	it('resolves self to the node itself and des to all transitive descendants', () => {
		const roles = [textRole('parentText', 'self'), textRole('childText', 'des')];
		const content = resolveItemRoleContent(roles, parent, map);
		expect(content).toHaveLength(2);
		expect(content[0].nodeIds).toStrictEqual(['p']);
		expect(content[1].nodeIds).toStrictEqual(['c', 'g']);
	});

	it('drops a des role for a leaf node with no descendants', () => {
		const roles = [textRole('parentText', 'self'), textRole('childText', 'des')];
		const content = resolveItemRoleContent(roles, grandchild, map);
		expect(content).toHaveLength(1);
		expect(content[0].role.name).toBe('parentText');
	});

	it('drops a later role whose content is already fully claimed (mutually exclusive alternatives)', () => {
		// Step Down Process: the last point gets `FinalChildText`, every other
		// point gets `ChildText` - both `presOf axis="des"`, both flattened onto
		// the same parent. Only the FIRST alternative with content survives.
		const roles = [
			textRole('ParentText', 'self'),
			textRole('FinalChildText', 'des'),
			textRole('ChildText', 'des'),
		];
		const content = resolveItemRoleContent(roles, parent, map);
		expect(content.map((c) => c.role.name)).toStrictEqual(['ParentText', 'FinalChildText']);
	});

	it('resolves ch to direct children only, not grandchildren', () => {
		const roles = [textRole('self', 'self'), textRole('direct', 'ch')];
		const content = resolveItemRoleContent(roles, parent, map);
		expect(content[1].nodeIds).toStrictEqual(['c']);
	});

	// tab-list--hier5.pptx (cached shape count 5): a compound `presOf axis="ch
	// desOrSelf"` role selects a 1-based POSITION RANGE into the point's own
	// children (`FirstChild`: position 1 only; `Child`: position 2 onward,
	// unbounded), not "every child" the way a bare `axis="ch"` role does -
	// before this fix, both compound roles resolved to the SAME full child
	// list, so the second role's ids were always already claimed and its box
	// silently dropped (measured: interpreted 4 shapes where the cached
	// drawing has 5).
	it('resolves a compound "ch desOrSelf" axis to a POSITION RANGE, not every child (Tab List FirstChild/Child pattern)', () => {
		const nodeOne: PptxSmartArtNode = { id: 'one', text: 'Node One' };
		const nodeFour: PptxSmartArtNode = { id: 'four', text: 'Node Four' };
		const nodeFive: PptxSmartArtNode = { id: 'five', text: 'Node Five' };
		const tabMap = childrenOf({ one: [nodeFour, nodeFive] });
		const parentRole = textRole('Parent', 'self');
		const firstChild: PptxSmartArtLayoutNode = {
			name: 'FirstChild',
			presentationOf: { axis: ['ch', 'desOrSelf'], start: [1, 1], count: [1, 0] },
		};
		const childRole: PptxSmartArtLayoutNode = {
			name: 'Child',
			presentationOf: { axis: ['ch', 'desOrSelf'], start: [2, 1], count: [0, 0] },
		};
		const content = resolveItemRoleContent([parentRole, firstChild, childRole], nodeOne, tabMap);
		expect(content.map((c) => c.role.name)).toStrictEqual(['Parent', 'FirstChild', 'Child']);
		expect(content[0].nodeIds).toStrictEqual(['one']);
		expect(content[1].nodeIds).toStrictEqual(['four']);
		expect(content[2].nodeIds).toStrictEqual(['five']);
	});

	it('a compound "ch desOrSelf" role with no matching position (only 1 child) resolves to nothing, not a re-claim', () => {
		const nodeTwo: PptxSmartArtNode = { id: 'two', text: 'Node Two has a longer label' };
		const nodeThree: PptxSmartArtNode = { id: 'three', text: 'Node Three' };
		const tabMap = childrenOf({ two: [nodeThree] });
		const parentRole = textRole('Parent', 'self');
		const firstChild: PptxSmartArtLayoutNode = {
			name: 'FirstChild',
			presentationOf: { axis: ['ch', 'desOrSelf'], start: [1, 1], count: [1, 0] },
		};
		const childRole: PptxSmartArtLayoutNode = {
			name: 'Child',
			presentationOf: { axis: ['ch', 'desOrSelf'], start: [2, 1], count: [0, 0] },
		};
		const content = resolveItemRoleContent([parentRole, firstChild, childRole], nodeTwo, tabMap);
		expect(content.map((c) => c.role.name)).toStrictEqual(['Parent', 'FirstChild']);
		expect(content[1].nodeIds).toStrictEqual(['three']);
	});
});

describe('expandItemRoles', () => {
	const roles = [textRole('parentText', 'self'), textRole('childText', 'des')];
	const parent: PptxSmartArtNode = { id: 'p', text: 'Parent' };
	const child: PptxSmartArtNode = { id: 'c', text: 'Child' };
	const map = childrenOf({ p: [child] });
	const box: RenderedRectNode = {
		...RECT_BASE,
		key: 'k',
		x: 10,
		y: 20,
		width: 100,
		height: 80,
		nodeId: 'p',
	};

	it('splits the box into stacked role rows covering the full height', () => {
		const result = expandItemRoles(roles, 'linear', box, parent, map, EMPTY_CONSTRAINT_INDEX);
		expect(result).toHaveLength(2);
		const [first, second] = result as RenderedRectNode[];
		expect(first.nodeId).toBe('p');
		expect(second.nodeId).toBe('c');
		expect(first.y).toBe(20);
		expect(second.y).toBeCloseTo(first.y + first.height, 5);
		expect(second.y + second.height).toBeCloseTo(100, 5);
		// x/width untouched: both rows still span the item's full cross-axis.
		expect(first.x).toBe(10);
		expect(second.width).toBe(100);
	});

	it('returns undefined for a leaf point with no secondary content (keep the single box)', () => {
		const leaf: PptxSmartArtNode = { id: 'l', text: 'Leaf' };
		const leafBox: RenderedRectNode = { ...box, nodeId: 'l' };
		expect(
			expandItemRoles(roles, 'linear', leafBox, leaf, new Map(), EMPTY_CONSTRAINT_INDEX),
		).toBeUndefined();
	});

	it('recovers a rect split from a circle-kind original when every role EXPLICITLY declares a rect shape ("Meet the Team")', () => {
		// `compNode` collapses to `kind: 'circle'` because `findCompositeItemShape`
		// prefers the decorative `photoCircle`'s `ellipse` over `nameText`/
		// `roleText`'s OWN declared `rect` shapes - real "Meet the Team" writes
		// `<dgm:shape type="rect">` on both, so the split must still happen,
		// using the circle's OWN bounding box as the item extent. A role
		// declaring NO shape at all does NOT count (see the next test): only an
		// EXPLICIT rect declaration overrides the arranger's own merged shape.
		const rectRoles = [
			{ ...roles[0], shape: { presetGeometry: 'rect' } },
			{ ...roles[1], shape: { presetGeometry: 'rect' } },
		];
		const circle = {
			kind: 'circle' as const,
			key: 'k',
			cx: 0,
			cy: 0,
			r: 10,
			fill: '#fff',
			stroke: '#000',
			strokeWidth: 1,
			opacity: 1,
			text: '',
			fontSize: 12,
			nodeId: 'p',
		};
		const result = expandItemRoles(
			rectRoles,
			'linear',
			circle,
			parent,
			map,
			EMPTY_CONSTRAINT_INDEX,
		) as RenderedRectNode[];
		expect(result).toHaveLength(2);
		expect(result[0].kind).toBe('rect');
		expect(result[1].kind).toBe('rect');
		expect(result[0].x).toBe(-10);
		expect(result[0].width).toBe(20);
		expect(result[0].y).toBe(-10);
		expect(result[1].y + result[1].height).toBeCloseTo(10, 5);
	});

	it('declines entirely for a circle original when its roles declare NO shape of their own (hub+satellite cycle)', () => {
		// A hub+satellite `cycle` family's own roles commonly declare no
		// `dgm:shape` at all, correctly inheriting the arranger's real `circle`
		// merged shape - `rolePreset`'s "default to rect" fallback must NOT be
		// read as "this role wants rect" here. Nor does this fall to the
		// "unchanged copy per role" treatment reserved for `polygon` (pyramid
		// accents): duplicating a `circle` per role produces IDENTICAL
		// overlapping circles, not a real split (measured:
		// `radial-cycle`/`basic-radial`/`diverging-radial`/`radial-venn`/
		// `converging-radial`/`hexagon-radial`'s shape COUNT regressed when
		// this case wasn't excluded) - so the caller keeps its ONE original
		// circle, with the bridge's own descendant-folding inference
		// combining any child text into it, same as before this round.
		const circle = {
			kind: 'circle' as const,
			key: 'k',
			cx: 0,
			cy: 0,
			r: 10,
			fill: '#fff',
			stroke: '#000',
			strokeWidth: 1,
			opacity: 1,
			text: '',
			fontSize: 12,
			nodeId: 'p',
		};
		expect(
			expandItemRoles(roles, 'linear', circle, parent, map, EMPTY_CONSTRAINT_INDEX),
		).toBeUndefined();
	});

	it('keeps a non-rect original AND kind unsplit-geometry when a role declares a non-rect shape (pyramid accent)', () => {
		// A pyramid row's `trapezoid`/`nonIsoscelesTrapezoid` parent+child accent
		// has no generic way to split its OWN polygon geometry the way a rect
		// splits by height - each role's entry starts as an UNCHANGED copy of
		// the original geometry, tagged with `itemRoleName` for
		// `arrangePyramid` to reposition.
		const trapezoidRoles = [
			{ ...roles[0], shape: { presetGeometry: 'trapezoid' } },
			{ ...roles[1], shape: { presetGeometry: 'nonIsoscelesTrapezoid' } },
		];
		const polygon = {
			kind: 'polygon' as const,
			key: 'k',
			points: '0,0 10,0 10,10 0,10',
			fill: '#fff',
			stroke: '#000',
			strokeWidth: 1,
			opacity: 1,
			text: '',
			fontSize: 12,
			textX: 5,
			textY: 5,
			nodeId: 'p',
		};
		const result = expandItemRoles(
			trapezoidRoles,
			'linear',
			polygon,
			parent,
			map,
			EMPTY_CONSTRAINT_INDEX,
		);
		expect(result).toHaveLength(2);
		expect(result?.[0]).toMatchObject({ kind: 'polygon', points: '0,0 10,0 10,10 0,10' });
		expect(result?.[0]?.itemRoleName).toBe('parentText');
		expect(result?.[1]?.itemRoleName).toBe('childText');
	});

	it('sets a role-declared preset override distinct from the primary role', () => {
		const rolesWithShape = [
			{ ...roles[0], shape: { presetGeometry: 'roundRect' } },
			{ ...roles[1], shape: { presetGeometry: 'rect' } },
		];
		const result = expandItemRoles(
			rolesWithShape,
			'linear',
			box,
			parent,
			map,
			EMPTY_CONSTRAINT_INDEX,
		) as RenderedRectNode[];
		expect(result[0].presetOverride).toBe('roundRect');
		expect(result[1].presetOverride).toBe('rect');
	});
});
