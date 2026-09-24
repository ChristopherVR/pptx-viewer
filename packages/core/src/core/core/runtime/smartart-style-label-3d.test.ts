import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { parseSmartArtStyleLabel3d } from './smartart-style-label-3d';
import { buildSmartArtQuickStyle } from './smartart-style-label-refs';

const localName = (key: string): string => key.split(':').pop() ?? key;
const parseColor = (node: XmlObject | undefined): string | undefined =>
	node?.['a:schemeClr'] ? 'FFFFFF' : undefined;

describe('parseSmartArtStyleLabel3d', () => {
	it('reads a bevel label (Polished): per-label scene3d + plastic bevel', () => {
		const label3d = parseSmartArtStyleLabel3d(
			{
				'@_name': 'node1',
				'dgm:scene3d': {
					'a:camera': { '@_prst': 'orthographicFront' },
					'a:lightRig': { '@_rig': 'flat', '@_dir': 't' },
				},
				'dgm:sp3d': {
					'@_prstMaterial': 'plastic',
					'a:bevelT': { '@_w': '120900', '@_h': '88900' },
					'a:bevelB': { '@_w': '88900', '@_h': '31750', '@_prst': 'angle' },
				},
				'dgm:txPr': '',
			},
			localName,
			parseColor,
		);
		expect(label3d?.scene3d?.lightRigType).toBe('flat');
		expect(label3d?.shape3d).toMatchObject({
			presetMaterial: 'plastic',
			bevelTopType: 'circle',
			bevelTopWidth: 120900,
			bevelBottomType: 'angle',
		});
		expect(label3d?.text3d).toBeUndefined();
	});

	it('reads a scene label contour colour and its txPr text extrusion', () => {
		const label3d = parseSmartArtStyleLabel3d(
			{
				'dgm:sp3d': {
					'@_extrusionH': '381000',
					'@_contourW': '38100',
					'a:contourClr': { 'a:schemeClr': { '@_val': 'lt1' } },
				},
				'dgm:txPr': { 'a:sp3d': { '@_extrusionH': '28000', '@_prstMaterial': 'matte' } },
			},
			localName,
			parseColor,
		);
		expect(label3d?.shape3d).toMatchObject({ extrusionHeight: 381000, contourColor: 'FFFFFF' });
		expect(label3d?.text3d).toStrictEqual({ extrusionHeight: 28000, presetMaterial: 'matte' });
	});

	it('an empty sp3d / txPr (flat quick styles) yields no shape or text 3D', () => {
		const label3d = parseSmartArtStyleLabel3d(
			{ 'dgm:sp3d': '', 'dgm:txPr': '' },
			localName,
			parseColor,
		);
		expect(label3d).toBeUndefined();
	});

	it('buildSmartArtQuickStyle attaches the label 3D by name', () => {
		const styleLbls: XmlObject[] = [
			{ '@_name': 'node1', 'dgm:sp3d': { '@_prstMaterial': 'metal', 'a:bevelT': {} } },
			{ '@_name': 'revTx', 'dgm:sp3d': '' },
		];
		const quickStyle = buildSmartArtQuickStyle(
			{ 'dgm:styleLbl': styleLbls },
			localName,
			styleLbls,
			{
				resolveThemeFillRef: () => undefined,
				resolveThemeLineRef: () => undefined,
				resolveThemeEffectRef: () => undefined,
				resolveThemeTypeface: () => undefined,
				parseColor,
			},
		);
		const [node1, revTx] = quickStyle.labels ?? [];
		expect(node1.shape3d?.presetMaterial).toBe('metal');
		expect(revTx).toStrictEqual({ name: 'revTx' });
	});
});
