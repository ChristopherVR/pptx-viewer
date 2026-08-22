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
 * This test exercises the restored, spec-correct behaviour in
 * `smartart-layout-interpreter-named-rules.ts`: a rule declared anywhere in
 * the tree that names the arranger's item template (here, "node") overrides
 * that role's width/font size uniformly for every point rendered through it,
 * both in the live-preview render model (`computeSmartArtElementsWithoutCache`)
 * and in the fabricated cached `dsp:` drawing baked on save.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtLayoutDefinition } from '../../core/types';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtElementsWithoutCache } from '../../core/utils';

/** A `lin` layout whose item template is named `node`, matching genuine content. */
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
	it('applies the named-role override to the live-preview render model', async () => {
		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;

		// Swap the SDK-generated `lin` layout definition for one whose ruleLst
		// names the item template ("node") with width/font overrides. Uses the
		// same typed-model substitution as
		// `smartart-interpreter-save-pipeline.test.ts`, since the XML round-trip
		// of `ruleLst`/`forName` itself is already covered by
		// `smartart-constraint-rules.test.ts`; the point under test is what the
		// INTERPRETER does with a `forName`-scoped rule.
		data.layoutDefinition = NAMED_RULE_DEFINITION;

		const renderModel = computeSmartArtElementsWithoutCache(data, {
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		})!;
		expect(renderModel).toHaveLength(3);
		for (const shape of renderModel) {
			expect(shape.type).toBe('shape');
			if (shape.type === 'shape') {
				// primFontSz=28 applies uniformly: `forName` names the shared
				// "node" template, not one instance among the three siblings.
				expect(shape.textStyle?.fontSize).toBe(28);
				expect(shape.textSegments?.[0]?.style.fontSize).toBeCloseTo(28 * (96 / 72));
				// w=0.4*1.5 clamped to max=0.35 of the 600px-wide frame.
				expect(shape.width).toBeCloseTo(0.35 * 600);
			}
		}
	});

	it('bakes the same override into the fabricated cached dsp: drawing on save', async () => {
		const initial = await presentationWithThreeNodeSmartArt();
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);

		element.smartArtData!.layoutDefinition = NAMED_RULE_DEFINITION;
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const drawing = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');

		// primFontSz=28pt -> `sz="2800"` (hundredths of a point) on every shape.
		const matches = [...drawing.matchAll(/sz="2800"/gu)];
		expect(matches).toHaveLength(3);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const cached = smartArt(reloaded.slides).smartArtData!.drawingShapes;
		expect(cached?.length).toBe(3);
		for (const shape of cached ?? []) {
			expect(shape.fontSize).toBe(28);
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
