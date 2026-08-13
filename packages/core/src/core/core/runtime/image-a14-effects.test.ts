import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { A14_IMAGE_PROPS_EXT_URI, parseA14ImageExtension } from './image-a14-effects';

/**
 * Regression cover for the `a14` blip extension
 * (`{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}`).
 *
 * The parse used to look for `a14:imgEffect` (or `a14:imgLayer`) as a DIRECT
 * child of `a:ext`, a shape no PowerPoint file has: the real nesting is
 * `a:ext > a14:imgProps > a14:imgLayer > a14:imgEffect`, confirmed against
 * `e2e/fixtures/issue-132-hr-deck.pptx`. Every artistic effect in a real deck
 * therefore parsed to nothing, and `a14:backgroundRemoval` was modelled nowhere
 * at all.
 */

/** Build the `a:ext` list for the real PowerPoint nesting. */
function realNesting(effects: XmlObject[], layerRelId = 'rId5'): XmlObject[] {
	return [
		{
			'@_uri': A14_IMAGE_PROPS_EXT_URI,
			'a14:imgProps': {
				'a14:imgLayer': {
					'@_r:embed': layerRelId,
					'a14:imgEffect': effects,
				},
			},
		},
	];
}

describe('parseA14ImageExtension', () => {
	it('returns undefined when the a14 extension is absent', () => {
		expect(
			parseA14ImageExtension([{ '@_uri': '{96DAC541-7B7A-43D3-8B79-37D633B846F1}' }]),
		).toBeUndefined();
	});

	it('reads an artistic effect through the real imgProps/imgLayer nesting', () => {
		const parsed = parseA14ImageExtension(
			realNesting([{ 'a14:artisticPencilSketch': { '@_trans': '16000', '@_pressure': '80000' } }]),
		);
		expect(parsed?.artisticEffect).toBe('artisticPencilSketch');
		// `pressure` is the primary parameter (1/1000th of a percent -> 0..100).
		expect(parsed?.artisticRadius).toBe(80);
		// `trans` used to be dropped entirely by the single-number model.
		expect(parsed?.artisticParams).toStrictEqual({ trans: 16000, pressure: 80000 });
	});

	it('keeps artisticBlur/@radius as an absolute value', () => {
		const parsed = parseA14ImageExtension(
			realNesting([{ 'a14:artisticBlur': { '@_radius': '10' } }]),
		);
		expect(parsed).toMatchObject({ artisticEffect: 'artisticBlur', artisticRadius: 10 });
	});

	it('records the pristine original from a14:imgLayer/@r:embed', () => {
		const parsed = parseA14ImageExtension(
			realNesting([{ 'a14:artisticMosiaicBubbles': { '@_pressure': '50000' } }], 'rId9'),
		);
		expect(parsed?.originalImageRelId).toBe('rId9');
	});

	it('parses backgroundRemoval into the retained rect and both mark lists', () => {
		const parsed = parseA14ImageExtension(
			realNesting([
				{
					'a14:backgroundRemoval': {
						'@_t': '12000',
						'@_b': '88000',
						'@_l': '7000',
						'@_r': '93000',
						'a14:foregroundMark': [
							{ '@_x1': '10000', '@_y1': '20000', '@_x2': '15000', '@_y2': '25000' },
							{ '@_x1': '30000', '@_y1': '40000', '@_x2': '35000', '@_y2': '45000' },
						],
						'a14:backgroundMark': {
							'@_x1': '1000',
							'@_y1': '2000',
							'@_x2': '1500',
							'@_y2': '2500',
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
			foregroundMarks: [
				{ x1: 0.1, y1: 0.2, x2: 0.15, y2: 0.25 },
				{ x1: 0.3, y1: 0.4, x2: 0.35, y2: 0.45 },
			],
			backgroundMarks: [{ x1: 0.01, y1: 0.02, x2: 0.015, y2: 0.025 }],
		});
		// The raw node is kept so the effect can be re-emitted losslessly.
		expect(parsed?.backgroundRemoval?.rawXml).toBeDefined();
	});

	it('reads sibling imgEffect elements (removal and artistic together)', () => {
		const parsed = parseA14ImageExtension(
			realNesting([
				{ 'a14:backgroundRemoval': { '@_t': '0', '@_b': '100000', '@_l': '0', '@_r': '50000' } },
				{ 'a14:artisticCement': { '@_trans': '10000', '@_crackSpacing': '45000' } },
			]),
		);
		expect(parsed?.backgroundRemoval?.right).toBe(0.5);
		expect(parsed?.artisticEffect).toBe('artisticCement');
		expect(parsed?.artisticRadius).toBe(45);
	});

	it('still accepts the flattened ext > imgEffect shape', () => {
		const parsed = parseA14ImageExtension([
			{
				'@_uri': A14_IMAGE_PROPS_EXT_URI,
				'a14:imgEffect': { 'a14:artisticBlur': { '@_radius': '4' } },
			},
		]);
		expect(parsed).toMatchObject({ artisticEffect: 'artisticBlur', artisticRadius: 4 });
	});

	it('ignores a backgroundRemoval missing an edge', () => {
		const parsed = parseA14ImageExtension(
			realNesting([{ 'a14:backgroundRemoval': { '@_t': '12000', '@_b': '88000', '@_l': '7000' } }]),
		);
		expect(parsed?.backgroundRemoval).toBeUndefined();
	});
});
