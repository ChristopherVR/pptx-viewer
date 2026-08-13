import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../../index';
import type { PptxData, PptxImageEffects, XmlObject } from '../../../index';
import { PptxHandlerRuntime } from '../PptxHandlerRuntime';

/**
 * The `a14` blip extension, exercised through the REAL
 * `extractImageEffects` (not a copy of it).
 *
 * `PptxHandlerRuntimeImageEffects.test.ts` next door tests a transcription of
 * the parser, which is exactly why the nesting bug survived: the transcription
 * and the original agreed on a shape (`a:ext > a14:imgEffect`) that no
 * PowerPoint file uses. Everything here goes through the shipped code path.
 */
class ImageEffectsProbe extends PptxHandlerRuntime {
	public parse(blip: XmlObject): PptxImageEffects | null {
		return this.extractImageEffects(blip);
	}
}

/** A blip carrying the a14 extension in the nesting PowerPoint actually writes. */
function blipWithA14(effects: XmlObject[]): XmlObject {
	return {
		'@_r:embed': 'rId4',
		'a:extLst': {
			'a:ext': [
				{
					'@_uri': '{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}',
					'a14:imgProps': {
						'a14:imgLayer': { '@_r:embed': 'rId5', 'a14:imgEffect': effects },
					},
				},
			],
		},
	};
}

describe('extractImageEffects: a14 image extension', () => {
	it('reads an artistic effect out of the real imgProps/imgLayer nesting', () => {
		const parsed = new ImageEffectsProbe().parse(
			blipWithA14([{ 'a14:artisticPencilSketch': { '@_trans': '16000', '@_pressure': '80000' } }]),
		);
		expect(parsed?.artisticEffect).toBe('artisticPencilSketch');
		expect(parsed?.artisticRadius).toBe(80);
		expect(parsed?.artisticParams).toStrictEqual({ trans: 16000, pressure: 80000 });
	});

	it('flags a file-sourced artistic effect as already baked into the bitmap', () => {
		const parsed = new ImageEffectsProbe().parse(
			blipWithA14([{ 'a14:artisticCutout': { '@_trans': '0', '@_numberOfShades': '6000' } }]),
		);
		// PowerPoint renders the stored bitmap, which already carries the effect;
		// re-applying it in the viewer would double it up.
		expect(parsed?.artisticPrerenderedEffect).toBe('artisticCutout');
	});

	it('models a14:backgroundRemoval, which used to be parsed nowhere', () => {
		const parsed = new ImageEffectsProbe().parse(
			blipWithA14([
				{
					'a14:backgroundRemoval': {
						'@_t': '12000',
						'@_b': '88000',
						'@_l': '7000',
						'@_r': '93000',
						'a14:foregroundMark': {
							'@_x1': '10000',
							'@_y1': '20000',
							'@_x2': '15000',
							'@_y2': '25000',
						},
					},
				},
			]),
		);
		expect(parsed?.backgroundRemoval).toMatchObject({
			top: 0.12,
			bottom: 0.88,
			left: 0.07,
			right: 0.93,
			foregroundMarks: [{ x1: 0.1, y1: 0.2, x2: 0.15, y2: 0.25 }],
		});
	});

	it('records the pristine original the effects were derived from', () => {
		const parsed = new ImageEffectsProbe().parse(
			blipWithA14([{ 'a14:artisticGlowEdges': { '@_smoothness': '40000' } }]),
		);
		expect(parsed?.originalImageRelId).toBe('rId5');
	});
});

const FIXTURE = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/issue-132-hr-deck.pptx', import.meta.url),
);

describe('a14 image extension on a real PowerPoint deck', () => {
	// A 29-slide deck: the load takes seconds under a loaded worker pool.
	it(
		'resolves the a14 layer of a picture authored by PowerPoint',
		{ timeout: 30_000 },
		async () => {
			const buf = readFileSync(FIXTURE);
			const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
			const data: PptxData = await new PptxHandler().load(ab);
			const picture = data.slides[0].elements.find(
				(el) => 'imageEffects' in el && el.imageEffects?.duotone,
			);
			expect(picture).toBeDefined();
			// slide1's logo carries
			//   a:ext > a14:imgProps > a14:imgLayer r:embed="rId5" > a14:imgEffect
			// so anything looking for a14:imgEffect directly under a:ext found nothing.
			expect(
				(picture as { imageEffects?: PptxImageEffects }).imageEffects?.originalImageRelId,
			).toBe('rId5');
		},
	);
});
