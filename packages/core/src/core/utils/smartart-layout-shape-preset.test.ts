import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import {
	findCompositeItemShape,
	presetCornerRadiusFraction,
	resolvePresetRenderKind,
	roundRectCornerInsetPx,
} from './smartart-layout-shape-preset';

describe('resolvePresetRenderKind', () => {
	it('falls back to the arranger default when the node has no shape override', () => {
		expect(resolvePresetRenderKind(undefined, 'rect')).toBe('rect');
		expect(resolvePresetRenderKind({}, 'circle')).toBe('circle');
	});

	it('maps ellipse-family presets to circle', () => {
		expect(resolvePresetRenderKind({ presetGeometry: 'ellipse' }, 'rect')).toBe('circle');
		expect(resolvePresetRenderKind({ presetGeometry: 'donut' }, 'rect')).toBe('circle');
	});

	it('maps chevron/diamond/trapezoid-family presets to polygon', () => {
		expect(resolvePresetRenderKind({ presetGeometry: 'chevron' }, 'rect')).toBe('polygon');
		expect(resolvePresetRenderKind({ presetGeometry: 'diamond' }, 'circle')).toBe('polygon');
		// Real fixture presets (layout4.xml, smartart-chart-table-mix.pptx).
		expect(resolvePresetRenderKind({ presetGeometry: 'trapezoid' }, 'rect')).toBe('polygon');
		expect(resolvePresetRenderKind({ presetGeometry: 'nonIsoscelesTrapezoid' }, 'rect')).toBe(
			'polygon',
		);
	});

	it('maps roundRect-family presets and plain rect to rect', () => {
		// Real fixture preset (layout1.xml, smartart-chart-table-mix.pptx).
		expect(resolvePresetRenderKind({ presetGeometry: 'roundRect' }, 'circle')).toBe('rect');
		expect(resolvePresetRenderKind({ presetGeometry: 'rect' }, 'circle')).toBe('rect');
	});

	it('falls back to the arranger default for an unrecognised preset name', () => {
		expect(resolvePresetRenderKind({ presetGeometry: 'gear6' }, 'rect')).toBe('rect');
	});
});

describe('presetCornerRadiusFraction', () => {
	it('returns undefined for a non-roundRect-family preset', () => {
		expect(presetCornerRadiusFraction({ presetGeometry: 'rect' })).toBeUndefined();
		expect(presetCornerRadiusFraction(undefined)).toBeUndefined();
	});

	it("returns roundRect's own OOXML preset default (1/6, adj guide 16667) when it carries no adjustment - matches vertical-bullet-list--flat3.pptx/continuous-block-process--flat3.pptx/pyramid-list--flat3.pptx cached txXfrm insets exactly (round 10)", () => {
		expect(presetCornerRadiusFraction({ presetGeometry: 'roundRect' })).toBeCloseTo(
			16667 / 100000,
			10,
		);
	});

	it('uses the idx=1 adjustment value as the corner radius fraction', () => {
		expect(
			presetCornerRadiusFraction({
				presetGeometry: 'roundRect',
				adjustments: [{ index: 1, value: 0.3 }],
			}),
		).toBe(0.3);
	});

	it('normalises a raw 0..100000 guide-unit adjustment value', () => {
		expect(
			presetCornerRadiusFraction({
				presetGeometry: 'roundRect',
				adjustments: [{ index: 1, value: 25000 }],
			}),
		).toBe(0.25);
	});
});

describe('roundRectCornerInsetPx', () => {
	it('returns 0 for a plain rect (no corner radius, no inset)', () => {
		expect(roundRectCornerInsetPx({ presetGeometry: 'rect' }, 170.75, 102.45)).toBe(0);
		expect(roundRectCornerInsetPx(undefined, 170.75, 102.45)).toBe(0);
	});

	it("reproduces basic-process--hier5.pptx's cached txXfrm/spPr inset exactly (170.75x102.45pt box, adj=10%: cached inset 3.00pt each side)", () => {
		// smartart-gallery/basic-process--hier5.pptx's real cached
		// `ppt/diagrams/drawing1.xml`: `<a:xfrm><a:ext cx="2168549" cy="1301129"/>`
		// (170.75x102.45pt) vs `<dsp:txXfrm><a:ext cx="2092331" cy="1224911"/>`
		// (164.75x96.45pt) - a 3.00pt inset on every side, and `<a:gd
		// name="adj" fmla="val 10000"/>` (10%).
		const insetPt = roundRectCornerInsetPx(
			{ presetGeometry: 'roundRect', adjustments: [{ index: 1, value: 0.1 }] },
			170.75,
			102.45,
		);
		expect(insetPt).toBeCloseTo(3.0, 1);
	});

	it('reproduces a differently-sized roundRect fixture (table-hierarchy--hier8.pptx, 125.7x93.6pt, adj=10%: cached inset 2.74pt)', () => {
		const insetPt = roundRectCornerInsetPx(
			{ presetGeometry: 'roundRect', adjustments: [{ index: 1, value: 0.1 }] },
			125.7,
			93.6,
		);
		expect(insetPt).toBeCloseTo(2.74, 1);
	});

	it('scales with the SHORTER side (min(w, h)), not the longer one', () => {
		const shape = { presetGeometry: 'roundRect', adjustments: [{ index: 1, value: 0.1 }] };
		expect(roundRectCornerInsetPx(shape, 200, 100)).toBeCloseTo(
			roundRectCornerInsetPx(shape, 100, 200),
			5,
		);
	});
});

describe('findCompositeItemShape', () => {
	it('returns undefined for an undefined item', () => {
		expect(findCompositeItemShape(undefined)).toBeUndefined();
	});

	it('prefers the item template own shape when it declares one directly', () => {
		const item: PptxSmartArtLayoutNode = {
			name: 'node',
			shape: { presetGeometry: 'roundRect' },
			children: [
				{ name: 'decorative', algorithm: { type: 'sp' }, shape: { presetGeometry: 'chevron' } },
			],
		};
		expect(findCompositeItemShape(item)).toStrictEqual({ presetGeometry: 'roundRect' });
	});

	it('prefers a decorative (sp-alg) descendant shape over a tx one, for a bare composite wrapper', () => {
		// "Basic Chevron Process"'s item template shape: a composite with no
		// shape of its own, an `sp`-alg decorative chevron, and a `tx` text
		// sub-node with no shape declared.
		const item: PptxSmartArtLayoutNode = {
			name: 'composite',
			algorithm: { type: 'composite' },
			children: [
				{ name: 'acctBkgd', algorithm: { type: 'sp' }, shape: { presetGeometry: 'chevron' } },
				{ name: 'parTx', algorithm: { type: 'tx' } },
			],
		};
		expect(findCompositeItemShape(item)).toStrictEqual({ presetGeometry: 'chevron' });
	});

	it('skips a conn-alg transition marker even though it parses before the real item (text-cycle--flat3.pptx: cached rect, not the sibTrans connector\'s "conn" marker)', () => {
		// Real parsed order for "Text Cycle"'s `cycle` arranger: `dummy`
		// (`sp`, no shape), `sibTrans` (`conn`, shape type="conn"), THEN
		// `node` (`tx`, shape type="rect") - forEach-wrapped siblings do not
		// always parse back in raw-XML text order.
		const item: PptxSmartArtLayoutNode = {
			name: 'cycle',
			children: [
				{ name: 'dummy', algorithm: { type: 'sp' } },
				{ name: 'sibTrans', algorithm: { type: 'conn' }, shape: { presetGeometry: 'conn' } },
				{ name: 'node', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
			],
		};
		expect(findCompositeItemShape(item)).toStrictEqual({ presetGeometry: 'rect' });
	});

	it('falls back to any declared shape when nothing decorative (sp-alg) is present', () => {
		// A hierarchy item's own composite: `rootComposite` (no shape) ->
		// `rootText` (`alg="tx"`, the real preset) - see
		// `smartart-hierarchy-shared.ts`'s `findHierarchyItemShape`.
		const item: PptxSmartArtLayoutNode = {
			name: 'rootComposite',
			algorithm: { type: 'composite' },
			children: [
				{ name: 'rootText', algorithm: { type: 'tx' }, shape: { presetGeometry: 'rect' } },
			],
		};
		expect(findCompositeItemShape(item)).toStrictEqual({ presetGeometry: 'rect' });
	});

	it('returns undefined when nothing in the subtree declares a shape', () => {
		const item: PptxSmartArtLayoutNode = {
			name: 'composite',
			algorithm: { type: 'composite' },
			children: [{ name: 'parTx', algorithm: { type: 'tx' } }],
		};
		expect(findCompositeItemShape(item)).toBeUndefined();
	});

	it('prefers a self-presented text role\'s own shape over an earlier, un-presented decorative accent (icon-circle-label-list--hier5.pptx: cached "rect", not the icon backdrop\'s "ellipse")', () => {
		// "Icon Circle Label List"'s `compNode`: two decorative `sp`-alg
		// circles with NO `presOf` of their own (`iconBgRect`/`iconRect`),
		// THEN the real self-presented text role (`textRect`) with its own,
		// DIFFERENT `rect` shape.
		const item: PptxSmartArtLayoutNode = {
			name: 'compNode',
			algorithm: { type: 'composite' },
			children: [
				{ name: 'iconBgRect', algorithm: { type: 'sp' }, shape: { presetGeometry: 'ellipse' } },
				{ name: 'iconRect', algorithm: { type: 'sp' }, shape: { presetGeometry: 'ellipse' } },
				{ name: 'spaceRect', algorithm: { type: 'sp' } },
				{
					name: 'textRect',
					algorithm: { type: 'tx' },
					presentationOf: { axis: ['self'] },
					shape: { presetGeometry: 'rect' },
				},
			],
		};
		expect(findCompositeItemShape(item)).toStrictEqual({ presetGeometry: 'rect' });
	});

	it('skips a self-presented role\'s own shape when it is hideGeom (text-fit-only, never painted), falling through to the decorative accent (detailed-process--hier5.pptx: cached "roundRect")', () => {
		// "Detailed Process"'s `compositeNode`: a presented (`presOf
		// axis="self"`) decorative `bgRect` (`sp`-alg, VISIBLE `roundRect`),
		// then the text role `parentNode` (`tx`-alg, ALSO `presOf
		// axis="self"`) whose own shape is `hideGeom` - text-sizing only,
		// never painted, so it must not win over the visible accent.
		const item: PptxSmartArtLayoutNode = {
			name: 'compositeNode',
			algorithm: { type: 'composite' },
			children: [
				{
					name: 'bgRect',
					algorithm: { type: 'sp' },
					presentationOf: { axis: ['self'] },
					shape: { presetGeometry: 'roundRect' },
				},
				{
					name: 'parentNode',
					algorithm: { type: 'tx' },
					presentationOf: { axis: ['self'] },
					shape: { presetGeometry: 'rect', hideGeometry: true },
				},
			],
		};
		expect(findCompositeItemShape(item)).toStrictEqual({ presetGeometry: 'roundRect' });
	});

	it('an sp-alg node CAN be the winning presented text role when it carries its own presOf (process-arrows--hier5.pptx: cached "rightArrow" wins over a later self-presented "ellipse" nested inside it)', () => {
		// "Process Arrows"'s `compNode`: `childTextVisible` is `alg="sp"` but
		// carries `presOf axis="des"` (PowerPoint merges the accent shape
		// with a CHILD point's text into one visual) and comes FIRST;
		// `parentText` is a plain `tx` role, `presOf axis="self"`, with a
		// DIFFERENT shape (`ellipse`) nested visually inside the arrow. The
		// per-item merged/outer shape must stay the arrow (first presented,
		// visible shape found), not flip to the later self role's ellipse -
		// this is the "kind" `smartart-layout-interpreter-item-role-stack.ts`
		// (Track S) splits each point's per-role boxes from.
		const item: PptxSmartArtLayoutNode = {
			name: 'compNode',
			algorithm: { type: 'composite' },
			children: [
				{
					name: 'childTextVisible',
					algorithm: { type: 'sp' },
					presentationOf: { axis: ['des'] },
					shape: { presetGeometry: 'rightArrow' },
				},
				{
					name: 'parentText',
					algorithm: { type: 'tx' },
					presentationOf: { axis: ['self'] },
					shape: { presetGeometry: 'ellipse' },
				},
			],
		};
		expect(findCompositeItemShape(item)).toStrictEqual({ presetGeometry: 'rightArrow' });
	});
});
