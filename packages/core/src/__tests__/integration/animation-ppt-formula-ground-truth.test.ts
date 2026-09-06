import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxAttributeAnimation, PptxData } from '../../index';
import { requireFixture } from '../require-fixture';

/**
 * Real PowerPoint-authored fixture (Office16 x64 COM, see
 * `pptx-viewer-shared`'s `animation-ppt-formula-ground-truth.md`) with a
 * single rectangle carrying ten entrance effects known to author bare
 * `p:anim` nodes driving `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h` via geometry
 * formulas: Grow And Turn, Bounce, Boomerang, Credits, Float, Sling,
 * Stretch, Swish, Pinwheel, Spiral.
 *
 * This is a PARSING regression guard: it asserts the raw formula strings and
 * `p:tavLst` stops survive into the typed model untouched, not that playback
 * resolves them (that is `animation-attribute-transform.test.ts` in shared).
 */
const FIXTURE = requireFixture(
	path.resolve(__dirname, '../fixtures/animation-ppt-formula-ground-truth.pptx'),
);

async function loadFixture(): Promise<PptxData> {
	const buf = readFileSync(FIXTURE);
	const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	return new PptxHandler().load(ab);
}

function componentsForAttr(
	all: PptxAttributeAnimation[],
	attrName: string,
): PptxAttributeAnimation[] {
	return all.filter((component) => component.attrName === attrName);
}

describe('animation-ppt-formula-ground-truth fixture', () => {
	it('surfaces every attributeAnimations component across the ten effects', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const allComponents = anims.flatMap((anim) => anim.attributeAnimations ?? []);
		expect(allComponents.length).toBeGreaterThan(0);
		// Every effect drives at least one of ppt_x/ppt_y/ppt_w/ppt_h.
		for (const axis of ['ppt_x', 'ppt_y', 'ppt_w', 'ppt_h']) {
			expect(componentsForAttr(allComponents, axis).length).toBeGreaterThan(0);
		}
	});

	it('parses Grow And Turn ppt_x as a bare from/to p:anim with no p:tavLst', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const allComponents = anims.flatMap((anim) => anim.attributeAnimations ?? []);
		const xComponents = componentsForAttr(allComponents, 'ppt_x');
		const growAndTurnFrom = xComponents.find((component) => component.from !== undefined);
		expect(growAndTurnFrom).toBeDefined();
		expect(growAndTurnFrom?.from).toBe('(-#ppt_w/2)');
		expect(growAndTurnFrom?.to).toBe('(#ppt_x)');
		expect(growAndTurnFrom?.keyframes).toStrictEqual([]);

		const growAndTurnBy = xComponents.find((component) => component.by !== undefined);
		expect(growAndTurnBy).toBeDefined();
		expect(growAndTurnBy?.by).toBe('(#ppt_h/3+#ppt_w*0.1)');
	});

	it('parses Bounce ppt_x/ppt_y tavLst stops as formula strings, tm as a number', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const allComponents = anims.flatMap((anim) => anim.attributeAnimations ?? []);
		const xComponents = componentsForAttr(allComponents, 'ppt_x');
		const bounceX = xComponents.find(
			(component) =>
				component.keyframes.length === 2 &&
				component.keyframes.some((k) => k.value === '#ppt_x-0.25'),
		);
		expect(bounceX).toBeDefined();
		expect(bounceX?.keyframes[0]).toMatchObject({ tm: 0, value: '#ppt_x-0.25', valueType: 'str' });
		expect(bounceX?.keyframes[1]).toMatchObject({ tm: 100000, value: '#ppt_x', valueType: 'str' });

		// The y-oscillation stops carry a literal numeric p:val ($) alongside
		// a formula on p:tav/@fmla, per the ground-truth doc.
		const yComponents = componentsForAttr(allComponents, 'ppt_y');
		const bounceY = yComponents.find((component) =>
			component.keyframes.some((k) => k.fmla === '#ppt_y-sin(pi*$)/3'),
		);
		expect(bounceY).toBeDefined();
		const firstStop = bounceY?.keyframes.find((k) => k.fmla !== undefined);
		expect(firstStop).toMatchObject({
			fmla: '#ppt_y-sin(pi*$)/3',
			tm: 0,
			value: 0.5,
			valueType: 'flt',
		});
	});

	it('parses Boomerang/Float ppt_w scale stops, including a literal 0', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		const allComponents = anims.flatMap((anim) => anim.attributeAnimations ?? []);
		const wComponents = componentsForAttr(allComponents, 'ppt_w');

		const boomerangShrink = wComponents.find((component) =>
			component.keyframes.some((k) => k.value === '#ppt_w*.05'),
		);
		expect(boomerangShrink).toBeDefined();

		const floatGrow = wComponents.find(
			(component) =>
				component.keyframes[0]?.value === 0 && component.keyframes[0]?.valueType === 'flt',
		);
		expect(floatGrow).toBeDefined();
		expect(floatGrow?.keyframes[1]).toMatchObject({ value: '#ppt_w' });
	});
});
