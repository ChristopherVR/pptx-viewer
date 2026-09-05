import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseChartStyleDefinition } from './chart-style-definition-parser';

const xmlLookup = {
	getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined {
		if (!parent) {
			return undefined;
		}
		const key = Object.keys(parent).find((k) => k.replace(/^.*:/u, '') === name);
		return key ? (parent[key] as XmlObject | undefined) : undefined;
	},
};

const resolveSchemeColor = (node: unknown): string | undefined => {
	const val = (node as XmlObject | undefined)?.['@_val'];
	return val ? `#${val}` : undefined;
};

const parseColor = (fillNode: XmlObject | undefined): string | undefined => {
	const srgb = fillNode?.['a:srgbClr'] as XmlObject | undefined;
	return srgb?.['@_val'] ? `#${srgb['@_val']}` : undefined;
};

describe('parseChartStyleDefinition', () => {
	it('parses cs:defRPr size/bold/italic/colour on cs:title', () => {
		const styleRoot: XmlObject = {
			'cs:title': {
				'cs:defRPr': {
					'@_sz': '1862',
					'@_b': '1',
					'@_i': '0',
					'a:solidFill': { 'a:srgbClr': { '@_val': '112233' } },
				},
			},
		};
		expect(
			parseChartStyleDefinition(styleRoot, xmlLookup, resolveSchemeColor, parseColor),
		).toStrictEqual({
			title: { fontSize: 18.62, bold: true, italic: false, color: '#112233' },
		});
	});

	it('falls back to cs:fontRef scheme colour when cs:defRPr has no own fill', () => {
		const styleRoot: XmlObject = {
			'cs:axisTitle': {
				'cs:fontRef': { '@_idx': 'minor', 'a:schemeClr': { '@_val': 'tx1' } },
				'cs:defRPr': { '@_sz': '1197' },
			},
		};
		const result = parseChartStyleDefinition(styleRoot, xmlLookup, resolveSchemeColor, parseColor);
		expect(result?.axisTitle).toStrictEqual({ fontSize: 11.97, color: '#tx1' });
	});

	it('resolves cs:lnRef and cs:fillRef scheme colours', () => {
		const styleRoot: XmlObject = {
			'cs:gridlineMajor': { 'cs:lnRef': { '@_idx': '1', 'a:schemeClr': { '@_val': 'accent1' } } },
			'cs:chartArea': { 'cs:fillRef': { '@_idx': '0', 'a:schemeClr': { '@_val': 'bg1' } } },
		};
		const result = parseChartStyleDefinition(styleRoot, xmlLookup, resolveSchemeColor, parseColor);
		expect(result?.gridlineMajor).toStrictEqual({ lineColor: '#accent1' });
		expect(result?.chartArea).toStrictEqual({ fillColor: '#bg1' });
	});

	it('parses a directly-authored cs:spPr/a:ln/@w as lineWidth (C2 wave-1 skip)', () => {
		const styleRoot: XmlObject = {
			'cs:dataPointLine': {
				'cs:lnRef': { '@_idx': '2', 'a:schemeClr': { '@_val': 'accent1' } },
				'cs:spPr': { 'a:ln': { '@_w': '28575' } },
			},
		};
		const result = parseChartStyleDefinition(styleRoot, xmlLookup, resolveSchemeColor, parseColor);
		expect(result?.dataPointLine).toStrictEqual({ lineColor: '#accent1', lineWidth: 2.25 });
	});

	it('ignores cs:spPr/a:ln with no @w or a non-positive width', () => {
		const styleRoot: XmlObject = {
			'cs:dataPoint': { 'cs:spPr': { 'a:ln': {} } },
		};
		expect(
			parseChartStyleDefinition(styleRoot, xmlLookup, resolveSchemeColor, parseColor),
		).toBeUndefined();
	});

	it('returns undefined when none of the known parts are present', () => {
		expect(
			parseChartStyleDefinition(
				{ 'cs:unknownPart': {} },
				xmlLookup,
				resolveSchemeColor,
				parseColor,
			),
		).toBeUndefined();
	});
});
