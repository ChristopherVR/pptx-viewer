import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { resolveSmartArtEffectIntensity } from '../../utils/smartart-effect-intensity';
import { applySmartArtStyleIntensity } from './smartart-style-intensity-builder';

const localName = (key: string) => key.split(':').at(-1)!;

describe('explicit SmartArt style intensity', () => {
	it('removes previous bevel geometry when switching to flat and preserves colors and connectors', () => {
		const node: XmlObject = {
			'@_name': 'node1',
			'q:sp3d': { 'a:bevelT': { '@_w': '100' } },
			'q:style': { 'a:fillRef': { '@_idx': '3', 'a:schemeClr': { '@_val': 'accent2' } } },
			'q:future': { '@_keep': 'yes' },
		};
		const connector = { '@_name': 'parChTrans1D2', 'q:style': { 'a:effectRef': { '@_idx': '2' } } };
		const definition = { 'q:styleLbl': [node, connector] };
		expect(applySmartArtStyleIntensity(definition, 'flat', localName)).toBeTruthy();
		expect(resolveSmartArtEffectIntensity([node], localName)).toBe('subtle');
		expect(node['q:style']).toMatchObject({
			'a:fillRef': { 'a:schemeClr': { '@_val': 'accent2' } },
		});
		expect(node['q:future']).toStrictEqual({ '@_keep': 'yes' });
		expect(connector['q:style']['a:effectRef']['@_idx']).toBe('2');
	});

	it('leaves an untouched quick style intact when no gallery style was selected', () => {
		const definition = { 'q:styleLbl': { '@_name': 'node1', 'q:sp3d': { 'a:bevelT': {} } } };
		const original = structuredClone(definition);
		expect(applySmartArtStyleIntensity(definition, undefined, localName)).toBeFalsy();
		expect(definition).toStrictEqual(original);
	});
});
