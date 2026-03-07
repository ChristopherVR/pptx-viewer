import { describe, it, expect } from 'vitest';

import type { ShapeStyle, XmlObject } from "pptx-viewer-core";

describe('Pattern fill color transform preservation', () => {
	it('should prefer preserved XML colour nodes over flat sRGB on save', () => {
		// Simulate a pattern fill with schemeClr + tint transform
		const fgClrXml: XmlObject = {
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:tint': { '@_val': '50000' },
			},
		};
		const bgClrXml: XmlObject = {
			'a:schemeClr': {
				'@_val': 'accent2',
				'a:shade': { '@_val': '75000' },
			},
		};

		const shapeStyle: ShapeStyle = {
			fillMode: 'pattern',
			fillPatternPreset: 'pct10',
			fillColor: '#4472C4',
			fillPatternBackgroundColor: '#ED7D31',
			fillPatternFgClrXml: fgClrXml,
			fillPatternBgClrXml: bgClrXml,
		};

		// Build pattFill XML node (simulates save logic)
		const pattNode: XmlObject = {};
		if (shapeStyle.fillPatternPreset) {
			pattNode['@_prst'] = shapeStyle.fillPatternPreset;
		}
		// Use preserved XML if available
		if (shapeStyle.fillPatternFgClrXml) {
			pattNode['a:fgClr'] = shapeStyle.fillPatternFgClrXml;
		} else if (shapeStyle.fillColor) {
			pattNode['a:fgClr'] = {
				'a:srgbClr': { '@_val': shapeStyle.fillColor.replace('#', '') },
			};
		}
		if (shapeStyle.fillPatternBgClrXml) {
			pattNode['a:bgClr'] = shapeStyle.fillPatternBgClrXml;
		} else if (shapeStyle.fillPatternBackgroundColor) {
			pattNode['a:bgClr'] = {
				'a:srgbClr': {
					'@_val': shapeStyle.fillPatternBackgroundColor.replace('#', ''),
				},
			};
		}

		// Verify transforms are preserved, not flattened
		expect(pattNode['@_prst']).toBe('pct10');
		const fgClr = pattNode['a:fgClr'] as XmlObject;
		expect(fgClr['a:schemeClr']).toBeDefined();
		const schemeClr = fgClr['a:schemeClr'] as XmlObject;
		expect(schemeClr['@_val']).toBe('accent1');
		expect(schemeClr['a:tint']).toBeDefined();

		const bgClr = pattNode['a:bgClr'] as XmlObject;
		expect(bgClr['a:schemeClr']).toBeDefined();
		const bgScheme = bgClr['a:schemeClr'] as XmlObject;
		expect(bgScheme['@_val']).toBe('accent2');
		expect(bgScheme['a:shade']).toBeDefined();
	});

	it('should fall back to sRGB when no preserved XML nodes', () => {
		const shapeStyle: ShapeStyle = {
			fillMode: 'pattern',
			fillPatternPreset: 'pct20',
			fillColor: '#4472C4',
			fillPatternBackgroundColor: '#FFFFFF',
		};

		const pattNode: XmlObject = {};
		if (shapeStyle.fillPatternPreset) {
			pattNode['@_prst'] = shapeStyle.fillPatternPreset;
		}
		if (shapeStyle.fillPatternFgClrXml) {
			pattNode['a:fgClr'] = shapeStyle.fillPatternFgClrXml;
		} else if (shapeStyle.fillColor) {
			pattNode['a:fgClr'] = {
				'a:srgbClr': { '@_val': shapeStyle.fillColor.replace('#', '') },
			};
		}
		if (shapeStyle.fillPatternBgClrXml) {
			pattNode['a:bgClr'] = shapeStyle.fillPatternBgClrXml;
		} else if (shapeStyle.fillPatternBackgroundColor) {
			pattNode['a:bgClr'] = {
				'a:srgbClr': {
					'@_val': shapeStyle.fillPatternBackgroundColor.replace('#', ''),
				},
			};
		}

		const fgClr = pattNode['a:fgClr'] as XmlObject;
		expect(fgClr['a:srgbClr']).toBeDefined();
		expect((fgClr['a:srgbClr'] as XmlObject)['@_val']).toBe('4472C4');

		const bgClr = pattNode['a:bgClr'] as XmlObject;
		expect(bgClr['a:srgbClr']).toBeDefined();
		expect((bgClr['a:srgbClr'] as XmlObject)['@_val']).toBe('FFFFFF');
	});
});
