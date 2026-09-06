import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyDataLabelsRangeToDLbls } from './chart-data-labels-range';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

const CHART15_URI = '{CE6537A1-D6FC-4f65-9D91-7224C49458BB}';

describe('applyDataLabelsRangeToDLbls', () => {
	it('writes a fresh c15:datalabelsRange + c15:showDataLabelsRange when none existed', () => {
		const dLbls: XmlObject = { 'c:showVal': { '@_val': '1' } };
		applyDataLabelsRangeToDLbls(
			dLbls,
			{ formula: 'Sheet1!$D$2:$D$4', cache: ['A', 'B', 'C'] },
			true,
			getLocalName,
		);
		const ext = (dLbls['c:extLst'] as XmlObject)['c:ext'] as XmlObject;
		expect(ext['@_uri']).toBe(CHART15_URI);
		expect(ext['c15:showDataLabelsRange']).toStrictEqual({ '@_val': '1' });
		expect(ext['c15:datalabelsRange']).toStrictEqual({
			'c15:f': 'Sheet1!$D$2:$D$4',
			'c15:dlblRangeCache': {
				'c:ptCount': { '@_val': '3' },
				'c:pt': [
					{ '@_idx': '0', 'c:v': 'A' },
					{ '@_idx': '1', 'c:v': 'B' },
					{ '@_idx': '2', 'c:v': 'C' },
				],
			},
		});
	});

	it('replaces an existing datalabelsRange with an edited cache, preserving sibling dlblFieldTable and other ext uris', () => {
		const dLbls: XmlObject = {
			'c:extLst': {
				'c:ext': [
					{ '@_uri': '{02D57815-91ED-43cb-92C2-25804820EDAC}', 'c15:someOtherThing': {} },
					{
						'@_uri': CHART15_URI,
						'c15:dlblFieldTable': { 'c15:dlblFieldTableEntry': { 'c15:f': 'Sheet1!$B$2' } },
						'c15:datalabelsRange': { 'c15:f': 'Sheet1!$D$2:$D$3', 'c15:dlblRangeCache': {} },
						'c15:showDataLabelsRange': { '@_val': '1' },
					},
				],
			},
		};
		applyDataLabelsRangeToDLbls(
			dLbls,
			{ formula: 'Sheet1!$D$2:$D$4', cache: ['New1', 'New2'] },
			true,
			getLocalName,
		);
		const exts = (dLbls['c:extLst'] as XmlObject)['c:ext'] as XmlObject[];
		expect(exts).toHaveLength(2);
		const otherExt = exts.find((e) => e['@_uri'] === '{02D57815-91ED-43cb-92C2-25804820EDAC}');
		expect(otherExt?.['c15:someOtherThing']).toStrictEqual({});
		const ownExt = exts.find((e) => e['@_uri'] === CHART15_URI)!;
		expect(ownExt['c15:dlblFieldTable']).toBeDefined();
		expect((ownExt['c15:datalabelsRange'] as XmlObject)['c15:f']).toBe('Sheet1!$D$2:$D$4');
	});

	it('removes datalabelsRange/showDataLabelsRange when range is undefined, keeping siblings', () => {
		const dLbls: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': CHART15_URI,
					'c15:showLeaderLines': { '@_val': '0' },
					'c15:datalabelsRange': { 'c15:f': 'Sheet1!$D$2:$D$3' },
					'c15:showDataLabelsRange': { '@_val': '1' },
				},
			},
		};
		applyDataLabelsRangeToDLbls(dLbls, undefined, undefined, getLocalName);
		const ext = (dLbls['c:extLst'] as XmlObject)['c:ext'] as XmlObject;
		expect(ext['c15:datalabelsRange']).toBeUndefined();
		expect(ext['c15:showDataLabelsRange']).toBeUndefined();
		expect(ext['c15:showLeaderLines']).toStrictEqual({ '@_val': '0' });
	});

	it('drops the whole extLst when nothing remains', () => {
		const dLbls: XmlObject = {
			'c:extLst': { 'c:ext': { '@_uri': CHART15_URI, 'c15:datalabelsRange': { 'c15:f': 'x' } } },
		};
		applyDataLabelsRangeToDLbls(dLbls, undefined, undefined, getLocalName);
		expect(dLbls['c:extLst']).toBeUndefined();
	});

	it('writes showDataLabelsRange="0" when explicitly disabled', () => {
		const dLbls: XmlObject = {};
		applyDataLabelsRangeToDLbls(
			dLbls,
			{ formula: 'Sheet1!$D$2', cache: ['x'] },
			false,
			getLocalName,
		);
		const ext = (dLbls['c:extLst'] as XmlObject)['c:ext'] as XmlObject;
		expect(ext['c15:showDataLabelsRange']).toStrictEqual({ '@_val': '0' });
	});
});
