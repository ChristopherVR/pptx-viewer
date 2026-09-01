import { describe, expect, it } from 'vitest';

import type { PptxImageEffects, XmlObject } from '../../types';
import { A14_IMAGE_PROPS_EXT_URI, parseA14ImageExtension } from './image-a14-effects';
import {
	a14ArtisticElementName,
	applyA14ImageExtension,
	buildA14ImageExtension,
} from './image-a14-effects-writer';
import { A14_NAMESPACE } from './image-a14-xml';

/**
 * The `a14` blip extension WRITER. Until it existed, an artistic effect picked
 * in the gallery (`imageEffects.artisticEffect`) was rendered but never
 * reached the saved file: `applyImageEffectsToBlip` never touched `a:extLst`.
 */

const SVG_EXT: XmlObject = {
	'@_uri': '{96DAC541-7B7A-43D3-8B79-37D633B846F1}',
	'asvg:svgBlip': { '@_r:embed': 'rId9' },
};

function extEntries(blip: XmlObject): XmlObject[] {
	const extLst = blip['a:extLst'] as XmlObject | undefined;
	const ext = extLst?.['a:ext'];
	return ext === undefined ? [] : Array.isArray(ext) ? (ext as XmlObject[]) : [ext as XmlObject];
}

function a14Ext(blip: XmlObject): XmlObject | undefined {
	return extEntries(blip).find((ext) => ext['@_uri'] === A14_IMAGE_PROPS_EXT_URI);
}

function imgEffects(blip: XmlObject): XmlObject[] {
	const props = a14Ext(blip)?.['a14:imgProps'] as XmlObject | undefined;
	const layer = props?.['a14:imgLayer'] as XmlObject | undefined;
	const list = layer?.['a14:imgEffect'];
	return list === undefined
		? []
		: Array.isArray(list)
			? (list as XmlObject[])
			: [list as XmlObject];
}

describe('a14ArtisticElementName', () => {
	it('maps the gallery names the bindings store onto a14 element names', () => {
		expect(a14ArtisticElementName('pencilSketch')).toBe('artisticPencilSketch');
		expect(a14ArtisticElementName('glow_edges')).toBe('artisticGlowEdges');
		expect(a14ArtisticElementName('paint')).toBe('artisticPaintBrush');
		// Microsoft's schema typo is part of the format.
		expect(a14ArtisticElementName('mosaic')).toBe('artisticMosiaicBubbles');
	});

	it('passes a file-sourced name straight through', () => {
		expect(a14ArtisticElementName('artisticCutout')).toBe('artisticCutout');
	});

	it('has nothing for none, blanks, or gallery entries that are not artistic effects', () => {
		expect(a14ArtisticElementName('none')).toBeUndefined();
		expect(a14ArtisticElementName(undefined)).toBeUndefined();
		expect(a14ArtisticElementName('  ')).toBeUndefined();
		expect(a14ArtisticElementName('grayscale')).toBeUndefined();
		expect(a14ArtisticElementName('sepia')).toBeUndefined();
	});
});

describe('applyA14ImageExtension', () => {
	it('writes a gallery pick in the nesting PowerPoint uses, with xmlns:a14 on imgProps', () => {
		const blip: XmlObject = { '@_r:embed': 'rId4' };
		applyA14ImageExtension(blip, { artisticEffect: 'pencilSketch', artisticRadius: 80 });

		const ext = a14Ext(blip);
		expect(ext).toBeDefined();
		const props = ext?.['a14:imgProps'] as XmlObject;
		expect(props['@_xmlns:a14']).toBe(A14_NAMESPACE);
		expect(imgEffects(blip)).toStrictEqual([
			{ 'a14:artisticPencilSketch': { '@_pressure': '80000' } },
		]);
		// No pristine original: this library did not bake anything.
		expect((props['a14:imgLayer'] as XmlObject)['@_r:embed']).toBeUndefined();
	});

	it('writes artisticParams verbatim when present, over the normalised radius', () => {
		const blip: XmlObject = {};
		applyA14ImageExtension(blip, {
			artisticEffect: 'artisticCement',
			artisticRadius: 45,
			artisticParams: { trans: 10000, crackSpacing: 45000 },
		});
		expect(imgEffects(blip)).toStrictEqual([
			{ 'a14:artisticCement': { '@_trans': '10000', '@_crackSpacing': '45000' } },
		]);
	});

	it('keeps artisticBlur/@radius absolute', () => {
		const blip: XmlObject = {};
		applyA14ImageExtension(blip, { artisticEffect: 'blur', artisticRadius: 4 });
		expect(imgEffects(blip)).toStrictEqual([{ 'a14:artisticBlur': { '@_radius': '4' } }]);
	});

	it('writes the four Corrections / Color effects and the original layer', () => {
		const blip: XmlObject = {};
		const effects: PptxImageEffects = {
			originalImageRelId: 'rId5',
			sharpenSoften: { amount: 25000 },
			brightnessContrast: { bright: 20000, contrast: -40000 },
			colorTemperature: { colorTemp: 4700 },
			colorSaturation: { sat: 166000 },
		};
		applyA14ImageExtension(blip, effects);
		const props = a14Ext(blip)?.['a14:imgProps'] as XmlObject | undefined;
		const layer = props?.['a14:imgLayer'] as XmlObject | undefined;
		expect(layer?.['@_r:embed']).toBe('rId5');
		expect(imgEffects(blip)).toStrictEqual([
			{ 'a14:sharpenSoften': { '@_amount': '25000' } },
			{ 'a14:brightnessContrast': { '@_bright': '20000', '@_contrast': '-40000' } },
			{ 'a14:colorTemperature': { '@_colorTemp': '4700' } },
			{ 'a14:saturation': { '@_sat': '166000' } },
		]);
		// And the reader gets the same model back.
		expect(parseA14ImageExtension(extEntries(blip))).toStrictEqual(effects);
	});

	it('re-emits a file-sourced backgroundRemoval verbatim, before the artistic effect', () => {
		const rawXml: XmlObject = {
			'@_t': '12000',
			'@_b': '88000',
			'@_l': '7000',
			'@_r': '93000',
			'a14:foregroundMark': { '@_x1': '10000', '@_y1': '20000', '@_x2': '15000', '@_y2': '25000' },
		};
		const blip: XmlObject = {};
		applyA14ImageExtension(blip, {
			backgroundRemoval: { top: 0.12, bottom: 0.88, left: 0.07, right: 0.93, rawXml },
			artisticEffect: 'artisticCutout',
			artisticParams: { trans: 0, numberOfShades: 6000 },
		});
		const written = imgEffects(blip);
		expect(written).toHaveLength(2);
		expect(written[0]['a14:backgroundRemoval']).toBe(rawXml);
		expect(Object.keys(written[1])).toStrictEqual(['a14:artisticCutout']);
	});

	it('rebuilds a backgroundRemoval that has no raw XML from the fractions', () => {
		const blip: XmlObject = {};
		applyA14ImageExtension(blip, {
			backgroundRemoval: {
				top: 0.1,
				bottom: 0.9,
				left: 0.2,
				right: 0.8,
				backgroundMarks: [{ x1: 0.5, y1: 0.5, x2: 0.6, y2: 0.7 }],
			},
		});
		expect(imgEffects(blip)).toStrictEqual([
			{
				'a14:backgroundRemoval': {
					'@_t': '10000',
					'@_b': '90000',
					'@_l': '20000',
					'@_r': '80000',
					'a14:backgroundMark': [
						{ '@_x1': '50000', '@_y1': '50000', '@_x2': '60000', '@_y2': '70000' },
					],
				},
			},
		]);
	});

	it('replaces an existing a14 entry and keeps every other a:ext in place', () => {
		const stale: XmlObject = {
			'@_uri': A14_IMAGE_PROPS_EXT_URI,
			'a14:imgProps': {
				'a14:imgLayer': { 'a14:imgEffect': { 'a14:artisticBlur': { '@_radius': '9' } } },
			},
		};
		const blip: XmlObject = { 'a:extLst': { 'a:ext': [SVG_EXT, stale] } };
		applyA14ImageExtension(blip, { artisticEffect: 'marker' });

		const entries = extEntries(blip);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toBe(SVG_EXT);
		expect(imgEffects(blip)).toStrictEqual([{ 'a14:artisticMarker': {} }]);
	});

	it('removes the a14 entry when the effect is cleared, leaving the others', () => {
		const blip: XmlObject = {};
		applyA14ImageExtension(blip, { artisticEffect: 'cutout' });
		(blip['a:extLst'] as XmlObject)['a:ext'] = [SVG_EXT, ...extEntries(blip)];

		applyA14ImageExtension(blip, { artisticEffect: 'none' });
		expect(extEntries(blip)).toStrictEqual([SVG_EXT]);
		expect(a14Ext(blip)).toBeUndefined();
	});

	it('drops an a:extLst it leaves empty', () => {
		const blip: XmlObject = {};
		applyA14ImageExtension(blip, { artisticEffect: 'cutout' });
		expect(blip['a:extLst']).toBeDefined();

		applyA14ImageExtension(blip, {});
		expect(blip['a:extLst']).toBeUndefined();
	});

	it('writes nothing for effects OOXML has no artistic element for', () => {
		expect(buildA14ImageExtension({ artisticEffect: 'sepia' })).toBeUndefined();
		expect(buildA14ImageExtension({ grayscale: true, brightness: 20 })).toBeUndefined();
	});
});
