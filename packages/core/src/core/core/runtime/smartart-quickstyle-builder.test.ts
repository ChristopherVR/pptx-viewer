import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { applySmartArtQuickStyle } from './smartart-quickstyle-builder';

describe('applySmartArtQuickStyle', () => {
	it('is a no-op for undefined quick style', () => {
		const def: XmlObject = { '@_title': 'Original' };
		expect(applySmartArtQuickStyle(def, undefined)).toBeFalsy();
		expect(def['@_title']).toBe('Original');
	});

	it('is a no-op when the name is empty', () => {
		const def: XmlObject = { '@_title': 'Original' };
		expect(applySmartArtQuickStyle(def, { name: '' })).toBeFalsy();
		expect(def['@_title']).toBe('Original');
	});

	it('refreshes the styleDef title from name', () => {
		const def: XmlObject = { '@_title': 'Original', '@_uniqueId': 'urn:style/x' };
		const changed = applySmartArtQuickStyle(def, { name: 'Intense Effect' });
		expect(changed).toBeTruthy();
		expect(def['@_title']).toBe('Intense Effect');
		// uniqueId preserved.
		expect(def['@_uniqueId']).toBe('urn:style/x');
	});

	it('reports no change when the title already matches', () => {
		const def: XmlObject = { '@_title': 'Same' };
		expect(applySmartArtQuickStyle(def, { name: 'Same' })).toBeFalsy();
	});

	it('does not touch styleLbl structures', () => {
		const def: XmlObject = {
			'@_title': 'Old',
			'dgm:styleLbl': { '@_name': 'node0', 'dgm:effectRef': {} },
		};
		applySmartArtQuickStyle(def, { name: 'New', effectIntensity: 'intense' });
		expect(def['dgm:styleLbl']).toStrictEqual({ '@_name': 'node0', 'dgm:effectRef': {} });
	});
});
