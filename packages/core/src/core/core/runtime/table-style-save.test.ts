import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { applyTableStyleEntryToNode } from './table-style-save';

describe('applyTableStyleEntryToNode - fill (pure)', () => {
	it('inserts new sections when missing on the style node', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			firstRowFill: { schemeColor: 'accent1', shade: 50000 },
			firstRowText: { italic: true },
		});

		const firstRow = node['a:firstRow'] as XmlObject;
		expect(firstRow).toBeDefined();
		const schemeClr = (firstRow['a:tcStyle'] as XmlObject)?.['a:fill']?.['a:solidFill']?.[
			'a:schemeClr'
		] as XmlObject | undefined;
		expect(schemeClr?.['@_val']).toBe('accent1');
		expect(schemeClr?.['a:shade']?.['@_val']).toBe('50000');
		expect((firstRow['a:tcTxStyle'] as XmlObject)?.['@_i']).toBe('on');
	});

	it('does not overwrite sections that have no edits', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:wholeTbl': {
				'a:tcStyle': {
					'a:fill': {
						'a:solidFill': { 'a:schemeClr': { '@_val': 'accent5' } },
					},
				},
			},
		};

		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			firstRowFill: { schemeColor: 'accent1' },
		});

		const wholeTbl = node['a:wholeTbl'] as XmlObject;
		expect(
			(wholeTbl['a:tcStyle'] as XmlObject)['a:fill']?.['a:solidFill']?.['a:schemeClr']?.['@_val'],
		).toBe('accent5');
	});

	it('replaces existing colour choice on a fill (solidFill is a choice)', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:wholeTbl': {
				'a:tcStyle': {
					'a:fill': {
						'a:solidFill': {
							'a:srgbClr': { '@_val': 'FF0000' },
						},
					},
				},
			},
		};

		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			wholeTblFill: { schemeColor: 'accent2', tint: 25000 },
		});

		const solidFill = (node['a:wholeTbl'] as XmlObject)['a:tcStyle']?.['a:fill']?.[
			'a:solidFill'
		] as XmlObject;
		expect(solidFill['a:srgbClr']).toBeUndefined();
		expect(solidFill['a:schemeClr']?.['@_val']).toBe('accent2');
		expect(solidFill['a:schemeClr']?.['a:tint']?.['@_val']).toBe('25000');
	});

	it('writes noFill, gradient, and pattern fills', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			band1HFill: { schemeColor: '', noFill: true },
			band2HFill: {
				schemeColor: '',
				gradient: {
					type: 'linear',
					angle: 90,
					stops: [
						{ position: 0, fill: { schemeColor: 'accent1' } },
						{ position: 100, fill: { schemeColor: 'accent1', tint: 50000 } },
					],
				},
			},
			band1VFill: {
				schemeColor: '',
				pattern: {
					preset: 'ltDnDiag',
					foreground: { schemeColor: 'accent2' },
					background: { schemeColor: 'bg1' },
				},
			},
		});

		expect((node['a:band1H'] as XmlObject)['a:tcStyle']?.['a:fill']?.['a:noFill']).toBeDefined();

		const gradFill = (node['a:band2H'] as XmlObject)['a:tcStyle']?.['a:fill']?.[
			'a:gradFill'
		] as XmlObject;
		expect(gradFill['a:lin']?.['@_ang']).toBe('5400000');
		const stops = gradFill['a:gsLst']?.['a:gs'] as XmlObject[];
		expect(stops).toHaveLength(2);
		expect(stops[0]['@_pos']).toBe('0');
		expect(stops[0]['a:schemeClr']?.['@_val']).toBe('accent1');
		expect(stops[1]['a:schemeClr']?.['a:tint']?.['@_val']).toBe('50000');

		const pattFill = (node['a:band1V'] as XmlObject)['a:tcStyle']?.['a:fill']?.[
			'a:pattFill'
		] as XmlObject;
		expect(pattFill['@_prst']).toBe('ltDnDiag');
		expect(pattFill['a:fgClr']?.['a:schemeClr']?.['@_val']).toBe('accent2');
		expect(pattFill['a:bgClr']?.['a:schemeClr']?.['@_val']).toBe('bg1');
	});

	it('leaves an image fill untouched (cannot synthesise a relationship)', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:wholeTbl': {
				'a:tcStyle': { 'a:fill': { 'a:solidFill': { 'a:schemeClr': { '@_val': 'accent5' } } } },
			},
		};
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			wholeTblFill: { schemeColor: '', image: { path: 'media/image1.png' } },
		});
		expect(
			(node['a:wholeTbl'] as XmlObject)['a:tcStyle']?.['a:fill']?.['a:solidFill']?.[
				'a:schemeClr'
			]?.['@_val'],
		).toBe('accent5');
	});
});

describe('applyTableStyleEntryToNode - corner cells (W3-E)', () => {
	it.each(['neCell', 'nwCell', 'seCell', 'swCell'] as const)(
		'writes fill and text onto %s, previously dropped on save',
		(corner) => {
			const node: XmlObject = { '@_styleId': '{X}' };
			applyTableStyleEntryToNode(node, {
				styleId: '{X}',
				[`${corner}Fill`]: { schemeColor: 'accent3' },
				[`${corner}Text`]: { bold: true },
			});
			const section = node[`a:${corner}`] as XmlObject;
			expect(section).toBeDefined();
			expect(section['a:tcStyle']?.['a:fill']?.['a:solidFill']?.['a:schemeClr']?.['@_val']).toBe(
				'accent3',
			);
			expect(section['a:tcTxStyle']?.['@_b']).toBe('on');
		},
	);
});

describe('applyTableStyleEntryToNode - borders (W3-E)', () => {
	it('writes every border side including the diagonals', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			wholeTblBorders: {
				left: { width: 1, dash: 'solid', fill: { schemeColor: 'tx1' } },
				top: { noFill: true },
				tl2br: { color: '#808080', width: 2 },
				tr2bl: { fill: { schemeColor: 'accent1' } },
			},
		});
		const tcBdr = (node['a:wholeTbl'] as XmlObject)['a:tcStyle']?.['a:tcBdr'] as XmlObject;
		expect(tcBdr['a:left']?.['a:ln']?.['@_w']).toBe(String(Math.round(9525)));
		expect(tcBdr['a:left']?.['a:ln']?.['a:solidFill']?.['a:schemeClr']?.['@_val']).toBe('tx1');
		expect(tcBdr['a:top']?.['a:ln']?.['a:noFill']).toBeDefined();
		expect(tcBdr['a:tl2br']?.['a:ln']?.['a:solidFill']?.['a:srgbClr']?.['@_val']).toBe('808080');
		expect(tcBdr['a:tr2bl']?.['a:ln']?.['a:solidFill']?.['a:schemeClr']?.['@_val']).toBe('accent1');
	});

	it('drops a legacy bl2tr key once the real tr2bl side is written', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:wholeTbl': { 'a:tcStyle': { 'a:tcBdr': { 'a:bl2tr': { 'a:ln': { '@_w': '1' } } } } },
		};
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			wholeTblBorders: { tr2bl: { fill: { schemeColor: 'accent1' } } },
		});
		const tcBdr = (node['a:wholeTbl'] as XmlObject)['a:tcStyle']?.['a:tcBdr'] as XmlObject;
		expect(tcBdr['a:bl2tr']).toBeUndefined();
		expect(tcBdr['a:tr2bl']).toBeDefined();
	});

	it('leaves untouched sides intact when patching only one side', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:wholeTbl': {
				'a:tcStyle': { 'a:tcBdr': { 'a:right': { 'a:ln': { '@_w': '9525' } } } },
			},
		};
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			wholeTblBorders: { left: { width: 2 } },
		});
		const tcBdr = (node['a:wholeTbl'] as XmlObject)['a:tcStyle']?.['a:tcBdr'] as XmlObject;
		expect(tcBdr['a:right']).toBeDefined();
		expect(tcBdr['a:left']).toBeDefined();
	});
});

describe('applyTableStyleEntryToNode - cell3D (W3-E, issue G5)', () => {
	it('writes material, bevel, and light rig', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			firstRowCell3D: {
				material: 'metal',
				bevelWidth: 1,
				bevelHeight: 2,
				bevelPreset: 'circle',
				lightRig: 'threePt',
				lightRigDirection: 'tl',
			},
		});
		const cell3D = (node['a:firstRow'] as XmlObject)['a:tcStyle']?.['a:cell3D'] as XmlObject;
		expect(cell3D['@_prstMaterial']).toBe('metal');
		expect(cell3D['a:bevel']?.['@_w']).toBe(String(Math.round(1 * 9525)));
		expect(cell3D['a:bevel']?.['@_h']).toBe(String(Math.round(2 * 9525)));
		expect(cell3D['a:bevel']?.['@_prst']).toBe('circle');
		expect(cell3D['a:lightRig']?.['@_rig']).toBe('threePt');
		expect(cell3D['a:lightRig']?.['@_dir']).toBe('tl');
	});
});

describe('applyTableStyleEntryToNode - tblBg (W3-E)', () => {
	it('writes an inline solid fill', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			tableBackground: { fill: { schemeColor: 'dk2' } },
		});
		const tblBg = node['a:tblBg'] as XmlObject;
		expect(tblBg['a:fill']?.['a:solidFill']?.['a:schemeClr']?.['@_val']).toBe('dk2');
		expect(tblBg['a:fillRef']).toBeUndefined();
	});

	it('writes a style-matrix fillRef with a colour transform', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			tableBackground: { fillRef: { idx: 2, color: { schemeColor: 'accent1' } } },
		});
		const tblBg = node['a:tblBg'] as XmlObject;
		expect(tblBg['a:fillRef']?.['@_idx']).toBe('2');
		expect(tblBg['a:fillRef']?.['a:schemeClr']?.['@_val']).toBe('accent1');
		expect(tblBg['a:fill']).toBeUndefined();
	});

	it('preserves an existing effectLst untouched', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:tblBg': { 'a:effectLst': { 'a:outerShdw': { '@_blurRad': '1' } } },
		};
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			tableBackground: { fill: { schemeColor: 'lt1' } },
		});
		const tblBg = node['a:tblBg'] as XmlObject;
		expect(tblBg['a:effectLst']).toBeDefined();
		expect(tblBg['a:fill']?.['a:solidFill']?.['a:schemeClr']?.['@_val']).toBe('lt1');
	});
});

describe('applyTableStyleEntryToNode - text fontRef colour (W3-E)', () => {
	it('nests scheme colour inside a:fontRef, not a top-level schemeClr', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			lastRowText: { fontSchemeColor: 'lt1', fontRefIdx: 'minor' },
		});
		const tcTxStyle = (node['a:lastRow'] as XmlObject)['a:tcTxStyle'] as XmlObject;
		expect(tcTxStyle['a:schemeClr']).toBeUndefined();
		expect(tcTxStyle['a:fontRef']?.['@_idx']).toBe('minor');
		expect(tcTxStyle['a:fontRef']?.['a:schemeClr']?.['@_val']).toBe('lt1');
	});

	it('writes explicit sRGB font colour under a:fontRef', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			lastColText: { fontColor: '#FF0000' },
		});
		const tcTxStyle = (node['a:lastCol'] as XmlObject)['a:tcTxStyle'] as XmlObject;
		expect(tcTxStyle['a:fontRef']?.['@_idx']).toBe('minor');
		expect(tcTxStyle['a:fontRef']?.['a:srgbClr']?.['@_val']).toBe('FF0000');
	});

	it('sets and clears underline explicitly', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, { styleId: '{X}', firstColText: { underline: true } });
		expect((node['a:firstCol'] as XmlObject)['a:tcTxStyle']?.['@_u']).toBe('sng');

		applyTableStyleEntryToNode(node, { styleId: '{X}', firstColText: { underline: false } });
		expect((node['a:firstCol'] as XmlObject)['a:tcTxStyle']?.['@_u']).toBe('none');
	});
});
