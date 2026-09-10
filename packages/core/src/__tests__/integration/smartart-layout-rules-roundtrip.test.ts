/**
 * `dgm:rule/@forName` scoped rule overrides: live-preview + save round-trip.
 *
 * Before the SmartArt layout engine unification, a second, weaker engine
 * (`smartart-layout-engine.ts` + `smartart-layout-rule-evaluator.ts`, both
 * deleted) fabricated the saved file's cached `dsp:` drawing and supported
 * `forName`-scoped numeric-rule overrides by matching `forName` against a
 * DATA-POINT id. That was never correct: ECMA-376's `dgm:rule/@forName`
 * (like `dgm:constr/@forName`) names a `dgm:layoutNode` by its `name=`
 * attribute - a structural ROLE, not a data point - confirmed against a
 * genuine PowerPoint-authored diagram (`ppt/diagrams/layout1.xml` inside
 * `e2e/fixtures/animation-builds-color.pptx` uses `forName="node"` /
 * `forName="sibTrans"` on `dgm:constr` to scope the root's constraints to its
 * two differently-named child roles). The deleted evaluator's fallback also
 * applied an unmatched name to EVERY node instead of none.
 *
 * This test exercises `smartart-layout-interpreter-named-rules.ts`'s
 * `forName`-scoped `w` handling.
 *
 * **NEITHER `w`/`h` NOR `primFontSz`/`secFontSz` is a literal "set the
 * value" override.** Per ECMA-376 21.4.2.24 (`CT_Rule`, `dgm:rule`): a rule
 * declares the value a constraint may be CHANGED TO when the diagram does
 * not fit in the given space - a bound the auto-shrink search may fall back
 * to, not an unconditional assignment applied regardless of whether the
 * constraint-resolved layout already fits. `applyToNode` (`smartart-layout-
 * interpreter-named-rules.ts`) resolves a `w`/`h` rule as a FLOOR
 * (`Math.max(constraintResolvedSize, ruleValue)`) for exactly this reason -
 * round 24 measured it directly against genuine PowerPoint-authored
 * content: `horizontal-bullet-list--hier5.pptx` and `accent-process--
 * hier5.pptx` (`smartart-gallery-ground-truth.test.ts`) both declare
 * `<dgm:rule type="w" for="ch" forName="composite" val="0"/>` on their real
 * `layout1.xml` - a trivially-satisfied floor (`0` never binds against any
 * positive width) per this reading, but the PREVIOUS unconditional-replace
 * behaviour forced every rendered item's width to literally zero, a
 * catastrophic, directly-traced regression. `primFontSz`/`secFontSz` got
 * the SAME correction earlier: measured against "Vertical Bullet List"
 * (same gate), `<dgm:rule type="primFontSz" for="ch" forName="parentText"
 * val="5"/>` is an intentionally shallow floor of last resort (mirrored by
 * the SAME item's own `<dgm:rule type="h" val="INF"/>` in the identical
 * `ruleLst` container - unambiguously a bound, since height cannot
 * literally be set to infinity), never a value to assign outright; treating
 * it as a literal override discarded `smartart-layout-item-font-size.ts`'s
 * own real text-measured fit entirely and made that fixture's font size
 * come out roughly 10x too small. `primFontSz`/`secFontSz` are consequently
 * not wired into `OVERRIDE_KEY` at all (see that module's own doc comment)
 * - this test asserts the rendered font size is whatever the REAL
 * text-measured fit produces, never the rule's literal `val`.
 *
 * **Round 26 correction of a round-25 mistake**: an earlier version of this
 * comment claimed the fabricated `dsp:` drawing (save path, `core/runtime/
 * smartart-fabrication-*.ts`) "does not consult `ruleLst` at all". That was
 * never true, and was itself an artifact of a bug in the PROBE SCRIPT that
 * produced the claim (it called `.save()` on a different `PptxHandler`
 * instance than the one that `.load()`ed the data, so the SmartArt save
 * step silently bailed and the file's STALE, pre-rule drawing was left
 * untouched - unrelated to `ruleLst` handling at all). In reality,
 * `core/runtime/PptxHandlerRuntimeSaveSmartArtFabrication.ts` (a brand-new
 * SmartArt element) and `core/runtime/PptxHandlerRuntimeSaveDocumentParts
 * .ts`'s `drawingDirty` block (an edited, already-saved one) BOTH call
 * `decomposeSmartArt`, which falls through to `computeSmartArtElementsWithoutCache`
 * - the SAME interpreter entry the live viewer uses - whenever no cached
 * `drawingShapes` exist. Fabrication has ALWAYS gone through the same
 * `ruleLst`-aware interpreter as the live render.
 *
 * What WAS real: a unit-conversion bug in the ONE shared bridge from the
 * interpreter's own output to `PptxElement[]`
 * (`smartart-interpreter-drawing-bridge.ts`'s `interpretedLayoutToElements`)
 * re-applied a pt->px conversion to an ALREADY-px `RenderedNode.fontSize`
 * when building each shape's PER-SEGMENT style (`textSegments[].style
 * .fontSize`, used for a node with folded/multi-run text) - a stray
 * `* (96 / 72)`. The shape's TOP-LEVEL `textStyle.fontSize` (what the live
 * viewer and this whole gate/test suite have always asserted) was
 * unaffected, so this was invisible everywhere EXCEPT `core/runtime/
 * smartart-fabrication-text.ts`'s `drawingTextBodyXml`, which prefers the
 * (wrongly inflated) per-segment style over the top-level one whenever
 * `textSegments` is present - baking a font 96/72 = 1.333x too large into
 * the SAVED file specifically. Fixed at the source (the bridge no longer
 * re-converts); the second test below now asserts live and fabricated
 * agree, bit for bit, instead of documenting a divergence.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtLayoutDefinition } from '../../core/types';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtElementsWithoutCache } from '../../core/utils';

/**
 * A `lin` layout whose item template is named `node`, matching genuine
 * content. Its `w` rule resolves to `0.35` (`0.4 * 1.5`, clamped to
 * `max="0.35"`) of the 600px-wide frame - ABOVE this template's own
 * constraint-resolved natural width (171px/600 = 0.285, measured directly:
 * three plain `node` items with no declared `w`/`sibSp` constraint at all,
 * default gap ratio), so the floor genuinely BINDS here (`toBeBoundBy`
 * below). `NARROW_RULE_DEFINITION` is the same template with a rule that
 * resolves BELOW that natural width, to assert the opposite case - a floor
 * that does NOT bind leaves the constraint-resolved size untouched.
 */
const NAMED_RULE_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: {
		name: 'diagram',
		algorithm: { type: 'lin' },
		rules: [
			{ type: 'w', forName: 'node', value: 0.4, factor: 1.5, max: 0.35 },
			{ type: 'primFontSz', forName: 'node', value: 28 },
		],
		children: [{ name: 'node' }],
	},
};

/** Same template, no `ruleLst` at all - the natural, unbound baseline. */
const NO_RULE_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: { name: 'diagram', algorithm: { type: 'lin' }, children: [{ name: 'node' }] },
};

/** Same template, a `w` rule resolving well BELOW the natural width (0.1 * 600 = 60px, against a ~171px natural width) - must be a no-op. */
const NARROW_RULE_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: {
		name: 'diagram',
		algorithm: { type: 'lin' },
		rules: [{ type: 'w', forName: 'node', value: 0.1 }],
		children: [{ name: 'node' }],
	},
};

async function presentationWithThreeNodeSmartArt(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push({
		id: 'smartart-rules',
		type: 'smartArt',
		x: 20,
		y: 30,
		width: 600,
		height: 300,
		smartArtData: {
			layout: 'basicBlockList',
			nodes: [
				{ id: 'n1', text: 'One' },
				{ id: 'n2', text: 'Two' },
				{ id: 'n3', text: 'Three' },
			],
		},
	} as SmartArtPptxElement as PptxElement);
	return handler.save(data.slides);
}

function smartArt(slides: { elements: PptxElement[] }[]): SmartArtPptxElement {
	return slides[0].elements.find(
		(element): element is SmartArtPptxElement => element.type === 'smartArt',
	)!;
}

describe('smartArt layout rule round-trip: forName-scoped rule overrides', () => {
	it('applies a binding `w` rule as a FLOOR, and never applies `primFontSz` as a literal override, in the live-preview render model', async () => {
		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;
		const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };

		// Swap the SDK-generated `lin` layout definition for one whose ruleLst
		// names the item template ("node") with width/font rules. Uses the same
		// typed-model substitution as `smartart-interpreter-save-pipeline
		// .test.ts`, since the XML round-trip of `ruleLst`/`forName` itself is
		// already covered by `smartart-constraint-rules.test.ts`; the point
		// under test is what the INTERPRETER does with a `forName`-scoped rule.
		data.layoutDefinition = NO_RULE_DEFINITION;
		const natural = computeSmartArtElementsWithoutCache(data, bounds)!;
		const naturalWidth = natural[0]?.type === 'shape' ? natural[0].width : undefined;
		expect(naturalWidth).toBeDefined();

		data.layoutDefinition = NAMED_RULE_DEFINITION;
		const renderModel = computeSmartArtElementsWithoutCache(data, bounds)!;
		expect(renderModel).toHaveLength(3);
		for (const shape of renderModel) {
			expect(shape.type).toBe('shape');
			if (shape.type === 'shape') {
				// The `primFontSz` rule is NEVER applied as a literal 28pt override
				// (see the module doc comment above) - `primFontSz`/`secFontSz` are
				// not wired into `OVERRIDE_KEY` at all, so the rendered size is
				// whatever the REAL text-measured fit produces for this short text,
				// which is never close to the rule's own literal value.
				expect(shape.textStyle?.fontSize).not.toBeCloseTo(28 * (96 / 72));
				// w=0.4*1.5 clamped to max=0.35 of the 600px-wide frame - ABOVE this
				// template's own natural width, so the floor genuinely BINDS and
				// the rendered width equals the rule's own resolved value exactly.
				expect(0.35 * 600).toBeGreaterThan(naturalWidth!);
				expect(shape.width).toBeCloseTo(0.35 * 600);
			}
		}

		// A rule resolving BELOW the natural width must be a no-op (round 24's
		// floor-clamp fix, `Math.max(constraintResolvedSize, ruleValue)`): the
		// SAME construct never shrinks below what its own constraints already
		// resolve, matching the measured, genuine-content proof this fix is
		// based on (`horizontal-bullet-list--hier5.pptx`/`accent-process--
		// hier5.pptx`'s own trivially-satisfied `val="0"` floor,
		// `smartart-gallery-ground-truth.test.ts`).
		data.layoutDefinition = NARROW_RULE_DEFINITION;
		const withNarrowRule = computeSmartArtElementsWithoutCache(data, bounds)!;
		expect(0.1 * 600).toBeLessThan(naturalWidth!);
		for (const shape of withNarrowRule) {
			if (shape.type === 'shape') {
				expect(shape.width).toBeCloseTo(naturalWidth!);
			}
		}
	});

	it('bakes the SAME `w`-rule-bound override into the fabricated cached dsp: drawing that the live-preview render model computes', async () => {
		// `core/runtime/smartart-fabrication-drawing.ts`/`-text.ts` fabricate a
		// plausible cached drawing for a newly-created/edited deck with no real
		// PowerPoint-authored cache to preserve, by calling `decomposeSmartArt`
		// -> `computeSmartArtElementsWithoutCache` - the SAME interpreter entry
		// the live-preview test above calls directly. This test proves that
		// identity empirically rather than assuming it: it computes the LIVE
		// render model first, then saves (forcing regeneration via
		// `drawingDirty`), then asserts the SAVED file's own `a:rPr/@sz` and
		// `a:xfrm` geometry agree with the live values bit for bit - width AND
		// font, both governed by `ruleLst` (the `w` rule as a bound, `primFontSz`
		// never as a literal override - same semantics as the live-preview test).
		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };

		element.smartArtData!.layoutDefinition = NAMED_RULE_DEFINITION;
		const live = computeSmartArtElementsWithoutCache(element.smartArtData!, bounds)!;
		expect(live).toHaveLength(3);
		const liveShape = live[0];
		expect(liveShape?.type).toBe('shape');
		const liveWidth = liveShape?.type === 'shape' ? liveShape.width : undefined;
		const liveFontSizePx = liveShape?.type === 'shape' ? liveShape.textStyle?.fontSize : undefined;
		expect(liveWidth).toBeDefined();
		expect(liveFontSizePx).toBeDefined();
		// Sanity: this is genuinely the bound-`w`/never-literal-`primFontSz`
		// case the live-preview test above already establishes, not some other
		// unrelated value.
		expect(liveWidth).toBeCloseTo(0.35 * 600);
		expect(liveFontSizePx).not.toBeCloseTo(28 * (96 / 72));

		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;
		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const drawing = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');

		// `a:rPr/@sz` is in hundredths of a point; the live model's own
		// `textStyle.fontSize` is in CSS px (this codebase's renderer-unit
		// convention throughout the interpreter) - convert once, the same way
		// `core/runtime/smartart-fabrication-text.ts`'s `runProperties` does,
		// and require EXACT agreement (not merely "close"), since both paths
		// now compute from the identical interpreter output.
		const expectedSz = String(Math.round(liveFontSizePx! * (72 / 96) * 100));
		const szValues = [...drawing.matchAll(/sz="(\d+)"/gu)].map((match) => match[1]!);
		expect(szValues).toHaveLength(3);
		expect(szValues).toStrictEqual([expectedSz, expectedSz, expectedSz]);

		const widthValues = [...drawing.matchAll(/<a:ext cx="(\d+)"/gu)].map(
			(match) => Number(match[1]) / (914400 / 96),
		);
		for (const widthPx of widthValues) {
			expect(widthPx).toBeCloseTo(liveWidth!, 0);
		}

		// Round-trip through a reload too: the cached model the NEXT load sees
		// must agree with what was actually written, and therefore with the
		// live render that produced it.
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const cached = smartArt(reloaded.slides).smartArtData!.drawingShapes;
		expect(cached?.length).toBe(3);
		for (const shape of cached ?? []) {
			expect(shape.fontSize).toBeCloseTo(liveFontSizePx!, 0);
			expect(shape.width).toBeCloseTo(liveWidth!, 0);
		}
	});

	it('overrides no node when the ruleLst names a role absent from this diagram', async () => {
		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;

		const unnamedRoleDefinition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				...NAMED_RULE_DEFINITION.rootNode,
				rules: [{ type: 'w', forName: 'a-role-this-diagram-does-not-have', value: 0.05 }],
			},
		};
		const bounds = {
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		};

		data.layoutDefinition = { ...unnamedRoleDefinition };
		const withUnmatchedRule = computeSmartArtElementsWithoutCache(data, bounds)!;
		data.layoutDefinition = {
			...NAMED_RULE_DEFINITION,
			rootNode: { ...NAMED_RULE_DEFINITION.rootNode, rules: undefined },
		};
		const withNoRules = computeSmartArtElementsWithoutCache(data, bounds)!;

		// An unmatched `forName` must override NOTHING (not everything, which is
		// the exact bug the deleted evaluator had in its fallback path).
		expect(
			withUnmatchedRule.map((el) => (el.type === 'shape' ? el.width : undefined)),
		).toStrictEqual(withNoRules.map((el) => (el.type === 'shape' ? el.width : undefined)));
	});
});
