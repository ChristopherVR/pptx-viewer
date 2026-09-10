import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveHierarchyItemNode } from './smartart-hierarchy-item-template';

/** A plain "Hierarchy"-family shape: ONE `tx`+shape descendant, no cross-reference. */
function singleTemplateNode(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild' },
		constraints: [{ type: 'h', for: 'des', forName: 'text', referenceType: 'w', factor: 0.667 }],
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [{ name: 'text', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } }],
			},
		],
	};
}

/**
 * `horizontal-multi-level-hierarchy--hier5.pptx`'s own real `layout1.xml`
 * shape (trimmed): `Name0` (`hierChild`) declares TWO named item templates
 * in its own top-level constrLst - `LevelOneTextNode` (the root's own item, a
 * plain self-referential aspect, found FIRST by document order) and
 * `LevelTwoTextNode` (every deeper generation's item, whose own `h`
 * constraint cross-references `LevelOneTextNode`'s name).
 */
function twoTemplateNode(): PptxSmartArtLayoutNode {
	return {
		name: 'Name0',
		algorithm: { type: 'hierChild' },
		constraints: [
			{ type: 'h', for: 'des', forName: 'LevelOneTextNode', referenceType: 'h' },
			{
				type: 'w',
				for: 'des',
				forName: 'LevelOneTextNode',
				referenceType: 'h',
				referenceFor: 'des',
				referenceForName: 'LevelOneTextNode',
				factor: 0.19,
			},
			{
				type: 'h',
				for: 'des',
				forName: 'LevelTwoTextNode',
				referenceType: 'w',
				referenceFor: 'des',
				referenceForName: 'LevelOneTextNode',
			},
			{
				type: 'w',
				for: 'des',
				forName: 'LevelTwoTextNode',
				referenceType: 'h',
				referenceFor: 'des',
				referenceForName: 'LevelTwoTextNode',
				factor: 3.28,
			},
		],
		children: [
			{
				name: 'root1',
				algorithm: { type: 'hierRoot' },
				children: [
					{
						name: 'LevelOneTextNode',
						algorithm: { type: 'tx' },
						shape: { presetGeometry: 'rect' },
					},
					{
						name: 'level2hierChild',
						algorithm: { type: 'hierChild' },
						children: [
							{
								name: 'root2',
								algorithm: { type: 'hierRoot' },
								children: [
									{
										name: 'LevelTwoTextNode',
										algorithm: { type: 'tx' },
										shape: { presetGeometry: 'rect' },
									},
								],
							},
						],
					},
				],
			},
		],
	};
}

/**
 * `name-and-title-organization-chart--hier5.pptx`'s own real shape (trimmed):
 * the composite ALSO declares a second `tx`+shape descendant (`titleText1`),
 * but its cross-reference to `rootText1` is a `primFontSz` constraint
 * (`for="des"`, inside the SAME top-level constrLst this function reads) -
 * not `h`/`w` - so the gate must NOT fire for it.
 */
function compoundTextRoleNode(): PptxSmartArtLayoutNode {
	return {
		name: 'hierChild1',
		algorithm: { type: 'hierChild' },
		constraints: [
			{
				type: 'primFontSz',
				for: 'des',
				forName: 'titleText1',
				referenceType: 'primFontSz',
				referenceFor: 'des',
				referenceForName: 'rootText1',
			},
		],
		children: [
			{
				name: 'hierRoot1',
				algorithm: { type: 'hierRoot' },
				children: [
					{
						name: 'rootComposite1',
						algorithm: { type: 'composite' },
						children: [
							{ name: 'rootText1', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
							{ name: 'titleText1', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
						],
					},
				],
			},
		],
	};
}

describe('resolveHierarchyItemNode', () => {
	it('returns the single tx+shape descendant unchanged when only one exists', () => {
		expect(resolveHierarchyItemNode(singleTemplateNode())?.name).toBe('text');
	});

	it('returns undefined for a layoutDef with no tx+shape descendant at all', () => {
		expect(
			resolveHierarchyItemNode({ name: 'hierChild1', algorithm: { type: 'hierChild' } }),
		).toBeUndefined();
	});

	it("prefers the CROSS-REFERENCING item (LevelTwoTextNode) over the first-found root-only item (LevelOneTextNode) - horizontal-multi-level-hierarchy--hier5.pptx's own construct", () => {
		expect(resolveHierarchyItemNode(twoTemplateNode())?.name).toBe('LevelTwoTextNode');
	});

	it("falls back to the first-found item when a second tx+shape descendant exists but its own cross-reference is NOT h/w (name-and-title-organization-chart--hier5.pptx's own primFontSz-only cross-reference)", () => {
		expect(resolveHierarchyItemNode(compoundTextRoleNode())?.name).toBe('rootText1');
	});
});
