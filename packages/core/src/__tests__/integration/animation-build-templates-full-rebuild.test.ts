import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { XmlObject } from '../../core/types';
import type { PptxData } from '../../index';

/**
 * `p:tmpl/@lvl` write wiring: when the animation write service regenerates a
 * `p:bldP` for a build that carries `PptxElementAnimation.buildTemplates`
 * (the FULL-REBUILD path, `buildBuildListXml`, taken whenever a slide has no
 * prior `p:timing` tree to reconcile into surgically), the preserved
 * per-build-level `p:tmplLst/p:tmpl[@lvl]` must be re-emitted with its nested
 * `p:tnLst` intact, not silently dropped. `buildBuildListXml` +
 * `serializeBldPTemplates` already cover this at the unit level
 * (`animation-write-sequence-builders.test.ts`); this proves the same thing
 * end to end through `PptxHandler.save` / `.load` on a brand-new slide that
 * never had a `p:timing` element (mirroring "edit the effect, then save" for
 * a freshly-authored build, since a genuinely pre-existing `p:timing` tree
 * takes the surgical path instead, which already round-trips a `p:tmplLst`
 * byte-for-byte because it clones the tree and never touches it).
 */
function findAnimation(data: PptxData, elementId: string) {
	const anim = data.slides[0].animations?.find((a) => a.elementId === elementId);
	if (!anim) {
		throw new Error('animation not found');
	}
	return anim;
}

describe('p:tmplLst survives the full-rebuild animation write path', () => {
	it('re-emits a preserved buildTemplates entry as p:tmplLst/p:tmpl[@lvl] with its nested p:tnLst', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slideBuilder = createSlide('Blank').addText('Hello world', {
			x: 10,
			y: 10,
			width: 200,
			height: 40,
		});
		const textElement = slideBuilder.getLastElement()!;
		slideBuilder.addAnimation(textElement.id, { preset: 'fadeIn' });
		data.slides.push(slideBuilder.build());

		const animation = findAnimation(data, textElement.id);
		animation.sequence = 'byParagraph';
		const preservedTnLst: XmlObject = {
			'p:par': { 'p:cTn': { '@_id': '9', '@_presetID': '1', '@_presetClass': 'entr' } },
		};
		animation.buildTemplates = [
			{ level: 1, timeNodeList: preservedTnLst, rawXml: { '@_lvl': '1' } },
		];
		// Simulate "editing the effect": the write path must re-derive the whole
		// `p:timing` tree from the model (no prior tree exists yet on this
		// brand-new slide), so any edit exercises the exact full-rebuild path
		// under test.
		animation.duration = 750;

		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);

		const reloadedTextElement = reloaded.slides[0].elements.find(
			(el) => 'text' in el && String(el.text ?? '').includes('Hello world'),
		)!;
		const reloadedAnimation = findAnimation(reloaded, reloadedTextElement.id);

		expect(reloadedAnimation.buildTemplates).toHaveLength(1);
		expect(reloadedAnimation.buildTemplates?.[0]?.level).toBe(1);
		// The nested `p:tnLst` (an opaque, preserved sub-tree) must survive
		// byte-equivalently in structure (attribute ORDER aside, since
		// fast-xml-parser round-trips attribute keys as an unordered object).
		expect(reloadedAnimation.buildTemplates?.[0]?.timeNodeList).toStrictEqual(preservedTnLst);
	});
});
