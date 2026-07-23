import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxData } from '../../index';

/**
 * Real PowerPoint-authored fixture exercising the native-timing animation
 * constructs the slideshow engine consumes:
 *  - slide 1: a chart entrance built BY SERIES (`a:bldChart bld="series"`)
 *  - slide 2: a SmartArt entrance built BY NODE (`a:bldDgm bld="one"`)
 *  - slide 3: a shape fill-colour emphasis (`p:animClr` targeting `fillcolor`)
 *
 * Regression guard for the `animClr` target-attribute parse: `p:attrName` is a
 * TEXT element, so it must not be run through the object-only `ensureArray`
 * (which silently dropped it, leaving every real colour animation with no
 * target and so no fill/stroke recolour at playback).
 */
const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/animation-builds-color.pptx', import.meta.url),
);

async function loadFixture(): Promise<PptxData> {
	const buf = readFileSync(FIXTURE);
	const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	return new PptxHandler().load(ab);
}

describe('animation-builds-color fixture', () => {
	it('parses the chart build-by-series entrance', async () => {
		const data = await loadFixture();
		const anims = data.slides[0]?.nativeAnimations ?? [];
		expect(anims.some((a) => a.graphicBuild === 'series')).toBeTruthy();
	});

	it('parses the SmartArt build-by-node entrance', async () => {
		const data = await loadFixture();
		const anims = data.slides[1]?.nativeAnimations ?? [];
		// The diagram build token ("one") surfaces on the graphic build.
		expect(anims.some((a) => a.graphicBuild === 'one')).toBeTruthy();
	});

	it('parses the animClr fill-colour target attribute (regression)', async () => {
		const data = await loadFixture();
		const anims = data.slides[2]?.nativeAnimations ?? [];
		const colour = anims.find((a) => a.colorAnimation);
		expect(colour).toBeDefined();
		// The bug: this was `undefined` because `p:attrName` (a string) was
		// filtered out by an object-only `ensureArray`.
		expect(colour?.colorAnimation?.targetAttribute).toBe('fillcolor');
		expect(colour?.colorAnimation?.toColor?.toLowerCase()).toBe('#00ff00');
	});
});
