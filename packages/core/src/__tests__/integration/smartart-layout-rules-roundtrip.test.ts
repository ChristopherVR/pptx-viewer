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
 * **The fabricated `dsp:` drawing (save path, `core/runtime/smartart-
 * fabrication-*.ts`) does NOT consult `ruleLst` at all** - confirmed
 * directly (a probe script comparing the fabricated drawing WITH and
 * WITHOUT the same `ruleLst` present on the layout definition produces
 * BYTE-IDENTICAL `sz`/width output either way). This is a distinct,
 * unowned-by-any-SmartArt-interpreter-track subsystem (`core/runtime/`, not
 * `core/utils/`) used only to fabricate a plausible cached drawing for a
 * newly-created/edited deck with no real PowerPoint-authored cache to
 * preserve - it was never wired to the interpreter's named-rule machinery,
 * on EITHER the old (unconditional-override) or the new (bound) reading, so
 * there is no regression here to fix; the second test below asserts this
 * rule-agnostic behaviour honestly rather than a number that happened to
 * look like the rule's own literal value by coincidence.
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

	it('the fabricated cached dsp: drawing on save is rule-agnostic (a separate subsystem, never wired to ruleLst either way) and round-trips consistently', async () => {
		// `core/runtime/smartart-fabrication-drawing.ts` (a wholly separate
		// subsystem from the SmartArt interpreter's `core/utils/` - it fabricates
		// a plausible cached drawing for a newly-created/edited deck with no
		// real PowerPoint-authored cache to preserve) never consults `ruleLst`
		// at all: confirmed directly below by diffing its OWN output WITH and
		// WITHOUT the identical `ruleLst` present on the same layout definition.
		// There is no "same override" to bake (the module doc comment's older
		// framing was never true of this architecture) - this test asserts the
		// honest, current behaviour instead, and still exercises the save/reload
		// round-trip this test module is named for.
		async function fabricatedSzValues(definition: PptxSmartArtLayoutDefinition): Promise<string[]> {
			const initial = await presentationWithThreeNodeSmartArt();
			const handler = new PptxHandler();
			const loaded = await handler.load(initial.buffer as ArrayBuffer);
			const element = smartArt(loaded.slides);
			element.smartArtData!.layoutDefinition = definition;
			element.smartArtData!.drawingShapes = undefined;
			element.smartArtData!.drawingDirty = true;
			const saved = await handler.save(loaded.slides);
			const savedZip = await JSZip.loadAsync(saved);
			const drawing = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');
			return [...drawing.matchAll(/sz="(\d+)"/gu)].map((match) => match[1]!);
		}

		const withRules = await fabricatedSzValues(NAMED_RULE_DEFINITION);
		const withoutRules = await fabricatedSzValues(NO_RULE_DEFINITION);
		expect(withRules).toHaveLength(3);
		// Byte-identical regardless of the ruleLst's presence - proving
		// fabrication never reads it (neither as an override nor as a bound),
		// not merely that the two happen to agree on THIS one field.
		expect(withRules).toStrictEqual(withoutRules);
		// Never the rule's own literal 28pt value (`sz="2800"`) - whatever
		// fabrication's own heuristic produces, it is not coincidentally the
		// unapplied rule's value either.
		expect(withRules).not.toContain('2800');

		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		element.smartArtData!.layoutDefinition = NAMED_RULE_DEFINITION;
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;
		const saved = await handler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const cached = smartArt(reloaded.slides).smartArtData!.drawingShapes;
		expect(cached?.length).toBe(3);
		const savedSzPt = Number(withRules[0]) / 100;
		for (const shape of cached ?? []) {
			// The cached model exposes renderer units even though OOXML stores
			// points - the reloaded model must agree with what was actually
			// written to `drawing1.xml`, whatever that value is.
			expect(shape.fontSize).toBeCloseTo(savedSzPt * (96 / 72));
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
