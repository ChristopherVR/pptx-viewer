import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex, EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { stackRoleContent } from './smartart-layout-interpreter-item-role-stack';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import type { RenderedCircleNode, RenderedRectNode } from './smartart-layout-types';

const ORIGINAL: RenderedRectNode = {
	kind: 'rect',
	key: 'k',
	x: 0,
	y: 0,
	width: 200,
	height: 2000,
	rx: 0,
	fill: '#fff',
	stroke: 'none',
	strokeWidth: 0,
	opacity: 1,
	text: 'fallback',
	fontSize: 999, // deliberately implausible: proves the split rows do NOT inherit this.
	textX: 100,
	textY: 50,
};

/** "Numbered Card List"'s exact shape: a numbered-badge role (ceiling 65pt) and a body-text role (ceiling 26pt), both self-scoped `primFontSz`. */
function numberedCardListRoles(): {
	badge: PptxSmartArtLayoutNode;
	body: PptxSmartArtLayoutNode;
	index: ReturnType<typeof buildConstraintIndex>;
} {
	const badge: PptxSmartArtLayoutNode = {
		name: 'sibTransNodeRect',
		shape: { presetGeometry: 'rect' },
		constraints: [{ type: 'primFontSz', value: 65 }],
		rules: [{ type: 'primFontSz', value: 14 }],
	};
	const body: PptxSmartArtLayoutNode = {
		name: 'nodeRect',
		shape: { presetGeometry: 'rect' },
		constraints: [{ type: 'primFontSz', value: 26 }],
		rules: [{ type: 'primFontSz', value: 11 }],
	};
	const definition: PptxSmartArtLayoutDefinition = {
		rootNode: { name: 'diagram', algorithm: { type: 'lin' }, children: [badge, body] },
	};
	return { badge, body, index: buildConstraintIndex(definition) };
}

describe('stackRoleContent font sizing', () => {
	it("gives each role its OWN primFontSz ceiling, not the arranger's single shared size (numbered-card-list--hier5.pptx: badge 65pt vs body 26pt)", () => {
		const { badge, body, index } = numberedCardListRoles();
		const content: ItemRoleContent[] = [
			{ role: badge, nodeIds: [], literalText: '01' },
			{ role: body, nodeIds: ['n1'] },
		];
		const [badgeRow, bodyRow] = stackRoleContent(content, 'diagram', ORIGINAL, index)!;
		if (badgeRow.kind !== 'rect' || bodyRow.kind !== 'rect') {
			throw new Error('expected rect rows');
		}
		// Short text ("01") trivially fits at either ceiling, so each row's
		// font size is exactly its OWN role's declared ceiling in px.
		expect(badgeRow.fontSize).toBeCloseTo(65 * (96 / 72), 1);
		expect(bodyRow.fontSize).toBeCloseTo(26 * (96 / 72), 1);
		expect(badgeRow.fontSize).not.toBe(ORIGINAL.fontSize);
		expect(bodyRow.fontSize).not.toBe(ORIGINAL.fontSize);
	});

	it('uses each row\'s own bound text ("literalText ?? original.text") for the fit, not a shared string', () => {
		const { badge, body, index } = numberedCardListRoles();
		const content: ItemRoleContent[] = [
			{ role: badge, nodeIds: [], literalText: '01' },
			{ role: body, nodeIds: ['n1'] },
		];
		const [badgeRow, bodyRow] = stackRoleContent(content, 'diagram', ORIGINAL, index)!;
		if (badgeRow.kind !== 'rect' || bodyRow.kind !== 'rect') {
			throw new Error('expected rect rows');
		}
		expect(badgeRow.text).toBe('01');
		// No literalText on the body role: falls back to the original box's text.
		expect(bodyRow.text).toBe(ORIGINAL.text);
	});
});

/**
 * "Vertical Bullet List"'s exact shape (round 20): `parentText`/`childText`
 * both declare `h refType="primFontSz" refFor="ch" refForName="parentText"`
 * (0.52/0.46), and a THIRD, non-text `spacer` sibling declares the SAME kind
 * of `h` (0.08) but never resolves into `content` at all (it carries no
 * `presOf`, so `resolveRoleContent` never returns an entry for it).
 */
function verticalBulletListRoles(): {
	parentText: PptxSmartArtLayoutNode;
	childText: PptxSmartArtLayoutNode;
	index: ReturnType<typeof buildConstraintIndex>;
} {
	const parentText: PptxSmartArtLayoutNode = {
		name: 'parentText',
		shape: { presetGeometry: 'roundRect' },
	};
	const childText: PptxSmartArtLayoutNode = {
		name: 'childText',
		shape: { presetGeometry: 'rect' },
	};
	const definition: PptxSmartArtLayoutDefinition = {
		rootNode: {
			name: 'linear',
			algorithm: { type: 'lin' },
			children: [parentText, childText, { name: 'spacer' }],
			// Matches the real "Vertical Bullet List" layoutDef exactly: the
			// ARRANGER ("linear") declares all 4 constraints, not the roles
			// themselves.
			constraints: [
				{ type: 'primFontSz', for: 'ch', forName: 'parentText', operator: 'equ', value: 65 },
				{
					type: 'h',
					for: 'ch',
					forName: 'parentText',
					referenceType: 'primFontSz',
					referenceFor: 'ch',
					referenceForName: 'parentText',
					factor: 0.52,
				},
				{
					type: 'h',
					for: 'ch',
					forName: 'childText',
					referenceType: 'primFontSz',
					referenceFor: 'ch',
					referenceForName: 'parentText',
					factor: 0.46,
				},
				{
					type: 'h',
					for: 'ch',
					forName: 'spacer',
					referenceType: 'primFontSz',
					referenceFor: 'ch',
					referenceForName: 'parentText',
					factor: 0.08,
				},
			],
		},
	};
	return { parentText, childText, index: buildConstraintIndex(definition) };
}

describe("stackRoleContent honours a declared, non-text sibling's own h-weight (round 20)", () => {
	it("does not let parentText/childText silently absorb spacer's own reserved 0.08 share of box.height", () => {
		const { parentText, childText, index } = verticalBulletListRoles();
		const content: ItemRoleContent[] = [
			{ role: parentText, nodeIds: ['root'] },
			{ role: childText, nodeIds: ['child'] },
		];
		const tallOriginal: RenderedRectNode = { ...ORIGINAL, height: 1000 };
		const [parentRow, childRow] = stackRoleContent(content, 'linear', tallOriginal, index)!;
		if (parentRow.kind !== 'rect' || childRow.kind !== 'rect') {
			throw new Error('expected rect rows');
		}
		// Weights 0.52/0.46/0.08 (spacer included): parentText's own fraction
		// is 0.52/1.06 ~= 0.4906 of box.height, NOT 0.52/0.98 (spacer excluded).
		const totalWithSpacer = 0.52 + 0.46 + 0.08;
		expect(parentRow.height).toBeCloseTo((0.52 / totalWithSpacer) * 1000, 1);
		expect(childRow.height).toBeCloseTo((0.46 / totalWithSpacer) * 1000, 1);
	});

	it("resolves each role's OWN descendant text via nodeTextById, not a duplicate of the point's own text", () => {
		const { parentText, childText, index } = verticalBulletListRoles();
		const content: ItemRoleContent[] = [
			{ role: parentText, nodeIds: ['root'] },
			{ role: childText, nodeIds: ['child'] },
		];
		const nodeTextById = new Map([['child', 'Real Child Text']]);
		const [parentRow, childRow] = stackRoleContent(
			content,
			'linear',
			{ ...ORIGINAL, text: 'Root Text' },
			index,
			nodeTextById,
		)!;
		if (parentRow.kind !== 'rect' || childRow.kind !== 'rect') {
			throw new Error('expected rect rows');
		}
		// parentText's own id ("root") is not in nodeTextById (only
		// descendants are), so it correctly falls through to original.text.
		expect(parentRow.text).toBe('Root Text');
		expect(childRow.text).toBe('Real Child Text');
	});
});

/**
 * `radial-list--hier5.pptx` (gallery corpus): a `cycle` arranger's per-point
 * `node` composite declares TWO roles that EACH explicitly declare a
 * DIFFERENT shape kind - `parentNode` (`presOf axis="self"`, `ellipse`) and
 * `childNode` (`presOf axis="des"`, `rect`) - cached as two SEPARATE shapes
 * (an `ellipse` and a `rect`), never folded into one. Before this fix,
 * `stackRoleContent` declined entirely for a non-rect `original` unless
 * EVERY role was rect (`everyRoleIsRect`), so this mixed pair (one ellipse,
 * one rect) fell through to "declined" and the point rendered as a single
 * merged circle with the child's text folded in as an extra paragraph
 * (measured: `radial-list--hier5.pptx` interpreted 3 shapes where the cached
 * drawing has 5).
 */
const ORIGINAL_CIRCLE: RenderedCircleNode = {
	kind: 'circle',
	key: 'k',
	cx: 100,
	cy: 100,
	r: 80,
	fill: '#fff',
	stroke: 'none',
	strokeWidth: 0,
	opacity: 1,
	text: 'fallback',
	fontSize: 999,
	textX: 100,
	textY: 100,
};

describe('stackRoleContent preserves the composite-level merged preset for a shapeless self role', () => {
	// detailed-process--hier5.pptx / grouped-list--hier5.pptx /
	// accent-process--hier5.pptx (cached preset `roundRect` for every point,
	// split or not): the self role (`parentNode`) declares NO `dgm:shape` at
	// all, the des role (`childNode`) declares its own `rect` (`hideGeom`).
	// Before this fix, the self role's split row fell back to `rolePreset`'s
	// bare "no shape -> rect", diverging from the arranger's own merged
	// `roundRect` every UNSPLIT point at the same arranger correctly gets.
	it("a self role with NO dgm:shape at all inherits the arranger's merged preset, not the bare rect fallback", () => {
		const original: RenderedRectNode = { ...ORIGINAL, presetOverride: 'roundRect' };
		const parentNode: PptxSmartArtLayoutNode = {
			name: 'parentNode',
			presentationOf: { axis: ['self'] },
		};
		const childNode: PptxSmartArtLayoutNode = {
			name: 'childNode',
			shape: { presetGeometry: 'rect', hideGeometry: true },
			presentationOf: { axis: ['des'] },
		};
		const content: ItemRoleContent[] = [
			{ role: parentNode, nodeIds: ['n1'] },
			{ role: childNode, nodeIds: ['n2'] },
		];
		const rows = stackRoleContent(content, 'compositeNode', original, EMPTY_CONSTRAINT_INDEX);
		expect(rows?.map((row) => row.presetOverride)).toStrictEqual(['roundRect', 'rect']);
	});

	it('a self role that DOES declare its own visible shape keeps that shape (unaffected by the fallback rule)', () => {
		const original: RenderedRectNode = { ...ORIGINAL, presetOverride: 'roundRect' };
		const parentNode: PptxSmartArtLayoutNode = {
			name: 'parentNode',
			shape: { presetGeometry: 'ellipse' },
			presentationOf: { axis: ['self'] },
		};
		const childNode: PptxSmartArtLayoutNode = {
			name: 'childNode',
			shape: { presetGeometry: 'rect' },
			presentationOf: { axis: ['des'] },
		};
		const content: ItemRoleContent[] = [
			{ role: parentNode, nodeIds: ['n1'] },
			{ role: childNode, nodeIds: ['n2'] },
		];
		const rows = stackRoleContent(content, 'compositeNode', original, EMPTY_CONSTRAINT_INDEX);
		expect(rows?.map((row) => row.presetOverride)).toStrictEqual(['ellipse', 'rect']);
	});
});

describe('stackRoleContent splits a mixed-preset item template even when the original is a circle', () => {
	it('splits an explicit ellipse self-role and rect des-role into two rows', () => {
		const parentNode: PptxSmartArtLayoutNode = {
			name: 'parentNode',
			shape: { presetGeometry: 'ellipse' },
			presentationOf: { axis: ['self'] },
		};
		const childNode: PptxSmartArtLayoutNode = {
			name: 'childNode',
			shape: { presetGeometry: 'rect' },
			presentationOf: { axis: ['des'] },
		};
		const content: ItemRoleContent[] = [
			{ role: parentNode, nodeIds: ['n1'] },
			{ role: childNode, nodeIds: ['n2'] },
		];
		const rows = stackRoleContent(content, 'cycle', ORIGINAL_CIRCLE, EMPTY_CONSTRAINT_INDEX);
		expect(rows).toHaveLength(2);
		expect(rows?.map((row) => row.presetOverride)).toStrictEqual(['ellipse', 'rect']);
	});

	it('still declines when every role agrees on the SAME explicit kind (hub+satellite `cycle` families)', () => {
		// `basic-radial`/`radial-cycle`/... : the hub's own `centerShape` and a
		// satellite's `node` role are BOTH `ellipse` - not genuinely mixed, so
		// this must NOT split (splitting it regressed those fixtures' shape
		// count - see `stackRoleContent`'s own doc comment).
		const centerShape: PptxSmartArtLayoutNode = {
			name: 'centerShape',
			shape: { presetGeometry: 'ellipse' },
			presentationOf: { axis: ['self'] },
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'node',
			shape: { presetGeometry: 'ellipse' },
			presentationOf: { axis: ['desOrSelf'] },
		};
		const content: ItemRoleContent[] = [
			{ role: centerShape, nodeIds: ['n1'] },
			{ role: node, nodeIds: ['n1', 'n2', 'n3', 'n4'] },
		];
		const rows = stackRoleContent(content, 'cycle', ORIGINAL_CIRCLE, EMPTY_CONSTRAINT_INDEX);
		expect(rows).toBeUndefined();
	});
});

describe("stackRoleContent dispatches to stackAsColumns for a `layoutScope.orientation === 'column'` (round 27)", () => {
	function bracketColumnsIndex() {
		const parTx: PptxSmartArtLayoutNode = { name: 'parTx' };
		const desTx: PptxSmartArtLayoutNode = { name: 'desTx' };
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'linNode',
				children: [parTx, desTx],
				constraints: [
					{ type: 'w', for: 'ch', forName: 'parTx', referenceType: 'w', factor: 0.3 },
					{ type: 'w', for: 'ch', forName: 'desTx', referenceType: 'w', factor: 0.7 },
				],
			},
		};
		return { parTx, desTx, index: buildConstraintIndex(definition) };
	}

	it('lays two roles out side by side, left to right, instead of stacking them vertically', () => {
		const { parTx, desTx, index } = bracketColumnsIndex();
		const original: RenderedRectNode = { ...ORIGINAL, width: 1000, height: 150, x: 50, y: 100 };
		const content: ItemRoleContent[] = [
			{ role: parTx, nodeIds: ['self'] },
			{ role: desTx, nodeIds: ['child'] },
		];
		const rows = stackRoleContent(content, 'Name0', original, index, undefined, {
			declaringRole: 'linNode',
			orientation: 'column',
		});
		expect(rows).toHaveLength(2);
		const [left, right] = rows as RenderedRectNode[];
		// Both share the FULL row height (never split vertically).
		expect(left.height).toBeCloseTo(150, 0);
		expect(right.height).toBeCloseTo(150, 0);
		expect(left.y).toBeCloseTo(100, 0);
		expect(right.y).toBeCloseTo(100, 0);
		// Widths split 0.3/0.7, left to right.
		expect(left.x).toBeCloseTo(50, 0);
		expect(left.width).toBeCloseTo(300, 0);
		expect(right.x).toBeCloseTo(350, 0);
		expect(right.width).toBeCloseTo(700, 0);
	});

	it('still routes a LEAF point (a single resolved role) through stackAsColumns, unlike the generic single-role bypass every other construct uses', () => {
		const { parTx, index } = bracketColumnsIndex();
		const original: RenderedRectNode = { ...ORIGINAL, width: 1000, height: 150, x: 50, y: 100 };
		const content: ItemRoleContent[] = [{ role: parTx, nodeIds: ['self'] }];
		const rows = stackRoleContent(content, 'Name0', original, index, undefined, {
			declaringRole: 'linNode',
			orientation: 'column',
		});
		expect(rows).toHaveLength(1);
		const [onlyCol] = rows as RenderedRectNode[];
		expect(onlyCol.width).toBeCloseTo(300, 0); // parTx's own 0.3 share, not the full 1000
	});

	it('a single resolved role WITHOUT a column layoutScope still declines entirely (the pre-existing hub/satellite-safe default, unaffected)', () => {
		const { parTx, index } = bracketColumnsIndex();
		const original: RenderedRectNode = { ...ORIGINAL, width: 1000, height: 150 };
		const content: ItemRoleContent[] = [{ role: parTx, nodeIds: ['self'] }];
		expect(stackRoleContent(content, 'Name0', original, index)).toBeUndefined();
	});
});
