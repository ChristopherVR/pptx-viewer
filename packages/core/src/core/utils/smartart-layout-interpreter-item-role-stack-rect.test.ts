import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import { stackRoleContent } from './smartart-layout-interpreter-item-role-stack';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import type { RenderedRectNode } from './smartart-layout-types';

/** "Vertical Bullet List"'s own real shape: `parentText`/`childText`, `h` primFontSz-relative to `parentText`, `parentText`'s own `primFontSz` a literal ceiling. */
function verticalBulletListRoles(): {
	parentText: PptxSmartArtLayoutNode;
	childText: PptxSmartArtLayoutNode;
	index: ReturnType<typeof buildConstraintIndex>;
} {
	const parentText: PptxSmartArtLayoutNode = {
		name: 'parentText',
		shape: { presetGeometry: 'rect' },
	};
	const childText: PptxSmartArtLayoutNode = {
		name: 'childText',
		shape: { presetGeometry: 'rect' },
	};
	const definition: PptxSmartArtLayoutDefinition = {
		rootNode: {
			name: 'linear',
			algorithm: { type: 'lin' },
			children: [parentText, childText],
			constraints: [
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
				{ type: 'primFontSz', for: 'ch', forName: 'parentText', value: 65 },
			],
		},
	};
	return { parentText, childText, index: buildConstraintIndex(definition) };
}

describe('stackAsRect driving-role font reuse (round 23)', () => {
	it("reuses original.fontSize/descendantFontSize for a primFontSz-role-split item, NOT an independent per-role resolveRoleFontSize fit (arrangeLinear's own two-tier fit is already correct for this construct - see smartart-track-l-successor.md round 22/23)", () => {
		const { parentText, childText, index } = verticalBulletListRoles();
		const original: RenderedRectNode = {
			kind: 'rect',
			key: 'k',
			x: 0,
			y: 0,
			width: 800,
			height: 200,
			rx: 0,
			fill: '#fff',
			stroke: 'none',
			strokeWidth: 0,
			opacity: 1,
			text: 'Node One',
			fontSize: 61.33, // 46pt, arrangeLinear's own fitted rootSizePx
			descendantFontSize: 48, // 36pt, arrangeLinear's own fitted descendantSizePx
			textX: 400,
			textY: 100,
		};
		const content: ItemRoleContent[] = [
			{ role: parentText, nodeIds: [] },
			{ role: childText, nodeIds: ['n1'] },
		];
		const [parentRow, childRow] = stackRoleContent(content, 'linear', original, index)!;
		if (parentRow.kind !== 'rect' || childRow.kind !== 'rect') {
			throw new Error('expected rect rows');
		}
		expect(parentRow.fontSize).toBe(61.33);
		expect(childRow.fontSize).toBe(48);
	});

	it('falls back to descendantFontSize ?? fontSize when the original carries no descendantFontSize at all', () => {
		const { parentText, childText, index } = verticalBulletListRoles();
		const original: RenderedRectNode = {
			kind: 'rect',
			key: 'k',
			x: 0,
			y: 0,
			width: 800,
			height: 200,
			rx: 0,
			fill: '#fff',
			stroke: 'none',
			strokeWidth: 0,
			opacity: 1,
			text: 'Node One',
			fontSize: 61.33,
			textX: 400,
			textY: 100,
		};
		const content: ItemRoleContent[] = [
			{ role: parentText, nodeIds: [] },
			{ role: childText, nodeIds: ['n1'] },
		];
		const [parentRow, childRow] = stackRoleContent(content, 'linear', original, index)!;
		if (parentRow.kind !== 'rect' || childRow.kind !== 'rect') {
			throw new Error('expected rect rows');
		}
		expect(parentRow.fontSize).toBe(61.33);
		expect(childRow.fontSize).toBe(61.33);
	});

	it('does NOT reuse original.fontSize when the item template does not match the pattern (e.g. "Numbered Card List"\'s independent-ceiling roles keep their own resolveRoleFontSize fit)', () => {
		const badge: PptxSmartArtLayoutNode = {
			name: 'sibTransNodeRect',
			shape: { presetGeometry: 'rect' },
			constraints: [{ type: 'primFontSz', value: 65 }],
		};
		const body: PptxSmartArtLayoutNode = {
			name: 'nodeRect',
			shape: { presetGeometry: 'rect' },
			constraints: [{ type: 'primFontSz', value: 26 }],
		};
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: { name: 'diagram', algorithm: { type: 'lin' }, children: [badge, body] },
		};
		const index = buildConstraintIndex(definition);
		const original: RenderedRectNode = {
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
			fontSize: 999, // deliberately implausible: proves the rows do NOT inherit this.
			textX: 100,
			textY: 50,
		};
		const content: ItemRoleContent[] = [
			{ role: badge, nodeIds: [], literalText: '01' },
			{ role: body, nodeIds: ['n1'] },
		];
		const [badgeRow, bodyRow] = stackRoleContent(content, 'diagram', original, index)!;
		if (badgeRow.kind !== 'rect' || bodyRow.kind !== 'rect') {
			throw new Error('expected rect rows');
		}
		expect(badgeRow.fontSize).not.toBe(999);
		expect(bodyRow.fontSize).not.toBe(999);
	});
});
