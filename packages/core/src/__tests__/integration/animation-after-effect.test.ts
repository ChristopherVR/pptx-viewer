import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { indexEffectNodes } from '../../core/services/animation-timing-tree';
import { PptxAnimationWriteService } from '../../core/services/PptxAnimationWriteService';
import type { PptxNativeAnimation, XmlObject } from '../../core/types';
import { PptxHandler } from '../../index';
import type { PptxData } from '../../index';

/** Find a native animation by its raw `p:spTgt/@spid` (not `targetId`, which is a synthetic per-slide-position key). */
function findByShapeSpid(
	anims: readonly PptxNativeAnimation[],
	spid: string,
): PptxNativeAnimation | undefined {
	return anims.find((a) => a.target?.type === 'shape' && a.target.shapeId === spid);
}

/**
 * Real PowerPoint-authored fixture for the "after animation" end-state
 * behaviour (dim to colour, hide after animation, hide on next click),
 * captured via the legacy WRITABLE `Shape.AnimationSettings` COM object
 * (PowerPoint 2016, 2026-09-06): see `fixture-corpus-manifest.ts` for full
 * provenance and `animation-after-effect-write.ts` for the shape this
 * fixture pins.
 *
 * Shapes, by `p:cNvPr/@id` (= spid): 2 = dim to explicit RGB 808080,
 * 3 = dim to theme scheme colour "accent2", 4 = hide after animation,
 * 5 = hide on next click.
 */
const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/animation-after-effect.pptx', import.meta.url),
);

async function loadFixture(): Promise<PptxData> {
	const buf = readFileSync(FIXTURE);
	const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	return new PptxHandler().load(ab);
}

describe('animation-after-effect fixture (genuine PowerPoint AnimationSettings)', () => {
	it('parses dim-to-explicit-RGB-colour on shape 2', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const anim = findByShapeSpid(anims, '2');
		expect(anim?.afterAnimationAction).toBe('dimToColor');
		expect(anim?.afterAnimationColor).toBe('#808080');
	});

	it('parses a dim to a theme scheme colour on shape 3 (no sRGB to resolve to)', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const anim = findByShapeSpid(anims, '3');
		// The action is still recognised even though this parse layer has no
		// theme to resolve `<a:schemeClr val="accent2"/>` to sRGB with; the
		// scheme reference is captured separately for a playback consumer to
		// resolve against the deck's theme colour map.
		expect(anim?.afterAnimationAction).toBe('dimToColor');
		expect(anim?.afterAnimationColor).toBeUndefined();
		expect(anim?.afterAnimationColorRef).toMatchObject({ scheme: 'accent2' });
	});

	it('parses hideAfterAnimation (sameClick) on shape 4', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const anim = findByShapeSpid(anims, '4');
		expect(anim?.afterAnimationAction).toBe('hideAfterAnimation');
	});

	it('parses hideOnNextClick (nextClick) on shape 5', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const anim = findByShapeSpid(anims, '5');
		expect(anim?.afterAnimationAction).toBe('hideOnNextClick');
	});

	it("the writer's dim-to-colour output equals the fixture's own genuine p:subTnLst node", async () => {
		const data = await loadFixture();
		const rawTiming = data.slides[0]?.rawTiming;
		expect(rawTiming).toBeDefined();
		const genuineRef = indexEffectNodes(rawTiming as XmlObject).find((ref) => ref.spid === '2');
		expect(genuineRef).toBeDefined();

		const service = new PptxAnimationWriteService();
		const result = service.buildTimingXml(
			[
				{
					elementId: '2',
					entrance: 'fadeIn',
					durationMs: 1000,
					afterAnimation: 'dimToColor',
					afterAnimationColor: '#808080',
				},
			],
			undefined,
		)!;
		const writtenRef = indexEffectNodes(result).find((ref) => ref.spid === '2');
		expect(writtenRef).toBeDefined();
		expect(writtenRef!.cTn['p:subTnLst']).toStrictEqual(genuineRef!.cTn['p:subTnLst']);
	});

	it("the writer's hideOnNextClick output equals the fixture's own genuine p:subTnLst node", async () => {
		const data = await loadFixture();
		const rawTiming = data.slides[0]?.rawTiming;
		const genuineRef = indexEffectNodes(rawTiming as XmlObject).find((ref) => ref.spid === '5');
		expect(genuineRef).toBeDefined();

		const service = new PptxAnimationWriteService();
		const result = service.buildTimingXml(
			[
				{
					elementId: '5',
					entrance: 'fadeIn',
					durationMs: 1000,
					afterAnimation: 'hideOnNextClick',
				},
			],
			undefined,
		)!;
		const writtenRef = indexEffectNodes(result).find((ref) => ref.spid === '5');
		expect(writtenRef).toBeDefined();
		expect(writtenRef!.cTn['p:subTnLst']).toStrictEqual(genuineRef!.cTn['p:subTnLst']);
	});
});
