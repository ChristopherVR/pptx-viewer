import { describe, expect, it } from 'vitest';

import { PptxColorTransformCodec } from '../core/builders/PptxColorTransformCodec';
import type { XmlObject } from '../types';
import { applyChartPivotFormats, parseChartPivotFormats } from './chart-pivot-formats';

const localName = (key: string): string => key.replace(/^.*:/u, '');

/** Real theme colour resolver (the same class the runtime uses) over a tiny stub theme. */
const THEME_ACCENT2 = '#ED7D31';
const colorCodec = new PptxColorTransformCodec({
	resolveThemeColor: (key) => (key === 'accent2' ? THEME_ACCENT2 : undefined),
});
const colorParser = {
	parseColor: (node: XmlObject | undefined, placeholder?: string) =>
		colorCodec.parseColor(node, placeholder),
};

describe('classic ChartML pivot formats', () => {
	it('parses, edits, serializes, and reparses typed pivot formats', () => {
		const chart: XmlObject = {
			'x:pivotFmts': {
				'@_vendor': 'root',
				'x:pivotFmt': {
					'x:marker': { 'x:symbol': { '@_val': 'circle' } },
					'x:idx': { '@_val': '4', '@_vendor': 'idx' },
					'a:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } } },
					'x:dLbl': { 'x:idx': { '@_val': '2' } },
					'x:extLst': { 'x:ext': { '@_uri': 'urn:test', 'v:data': {} } },
					'v:future': { '@_keep': 'yes' },
				},
			},
			'x:plotArea': {},
		};
		const parsed = parseChartPivotFormats(chart, localName)!;
		expect(parsed.formats[0]).toMatchObject({ index: 4 });
		parsed.formats[0].index = 7;
		parsed.formats[0].markerXml = { 'x:symbol': { '@_val': 'diamond' } };
		parsed.formats[0].dataLabelXml = null;
		applyChartPivotFormats(chart, parsed, localName);

		const root = chart['x:pivotFmts'] as XmlObject;
		const item = root['x:pivotFmt'] as XmlObject[];
		expect(Object.keys(item[0]).map(localName)).toStrictEqual([
			'idx',
			'spPr',
			'marker',
			'extLst',
			'future',
		]);
		expect(item[0]['x:idx']).toStrictEqual({ '@_val': '7', '@_vendor': 'idx' });
		expect(item[0]['x:extLst']).toStrictEqual({
			'x:ext': { '@_uri': 'urn:test', 'v:data': {} },
		});
		expect(item[0]['v:future']).toStrictEqual({ '@_keep': 'yes' });
		expect(parseChartPivotFormats(chart, localName)!.formats[0]).toMatchObject({ index: 7 });
	});

	it('inserts in chart schema order and supports removal', () => {
		const chart: XmlObject = { 'c:autoTitleDeleted': {}, 'c:view3D': {}, 'c:plotArea': {} };
		applyChartPivotFormats(chart, { formats: [{ index: 0 }] }, localName);
		expect(Object.keys(chart).map(localName)).toStrictEqual([
			'autoTitleDeleted',
			'pivotFmts',
			'view3D',
			'plotArea',
		]);
		applyChartPivotFormats(chart, null, localName);
		expect(Object.keys(chart).map(localName)).toStrictEqual([
			'autoTitleDeleted',
			'view3D',
			'plotArea',
		]);
	});

	it('rejects invalid indexes and empty collections', () => {
		expect(() => applyChartPivotFormats({}, { formats: [] }, localName)).toThrow(RangeError);
		expect(() => applyChartPivotFormats({}, { formats: [{ index: -1 }] }, localName)).toThrow(
			RangeError,
		);
		expect(() =>
			applyChartPivotFormats({}, { formats: [{ index: 4_294_967_296 }] }, localName),
		).toThrow(RangeError);
	});

	// W4-D: spPr/txPr/marker are now independently modeled fields (previously
	// editable only as opaque raw XML), with a lossless fallback to the raw
	// `*Xml` sibling for whatever the typed model does not cover.
	describe('typed spPr/txPr/marker (W4-D)', () => {
		it('parses spPr/marker into typed fields alongside their raw XML', () => {
			const chart: XmlObject = {
				'c:pivotFmts': {
					'c:pivotFmt': {
						'c:idx': { '@_val': '1' },
						'c:spPr': {
							'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
							'a:ln': {
								'@_w': '12700',
								'a:solidFill': { 'a:srgbClr': { '@_val': '00FF00' } },
								'a:prstDash': { '@_val': 'dash' },
							},
						},
						'c:txPr': {
							'a:bodyPr': {},
							'a:lstStyle': {},
							'a:p': { 'a:pPr': { 'a:defRPr': { '@_sz': '1400', '@_b': '1' } } },
						},
						'c:marker': {
							'c:symbol': { '@_val': 'diamond' },
							'c:size': { '@_val': '9' },
						},
					},
				},
			};
			const parsed = parseChartPivotFormats(chart, localName)!;
			expect(parsed.formats[0].shapeProperties).toStrictEqual({
				fillColor: '#FF0000',
				strokeColor: '#00FF00',
				strokeWidth: 1,
				strokeDashStyle: 'dash',
			});
			expect(parsed.formats[0].textStyle).toStrictEqual({ fontSize: 14, bold: true });
			expect(parsed.formats[0].marker).toStrictEqual({ symbol: 'diamond', size: 9 });
			// The raw fallback is still populated (lossless: an untouched entry
			// re-serializes byte-equivalent).
			expect(parsed.formats[0].shapePropertiesXml).toBeDefined();
			expect(parsed.formats[0].txPrXml).toBeDefined();
			expect(parsed.formats[0].markerXml).toBeDefined();
		});

		it('leaves an unedited entry byte-equivalent (typed fields unchanged is not an edit signal)', () => {
			const chart: XmlObject = {
				'c:pivotFmts': {
					'c:pivotFmt': {
						'c:idx': { '@_val': '1' },
						'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } } },
						'c:marker': { 'c:symbol': { '@_val': 'circle' } },
					},
				},
			};
			const original = JSON.parse(
				JSON.stringify((chart['c:pivotFmts'] as XmlObject)['c:pivotFmt']),
			) as XmlObject;
			const parsed = parseChartPivotFormats(chart, localName)!;
			applyChartPivotFormats(chart, parsed, localName);

			const root = chart['c:pivotFmts'] as XmlObject;
			const item = (root['c:pivotFmt'] as XmlObject[])[0];
			expect(item).toStrictEqual(original);
		});

		it('merges a typed shapeProperties edit onto the existing spPr, preserving unmodeled children', () => {
			const chart: XmlObject = {
				'c:pivotFmts': {
					'c:pivotFmt': {
						'c:idx': { '@_val': '1' },
						'c:spPr': {
							'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
							'a:effectLst': { 'a:outerShdw': { '@_blurRad': '40000' } },
						},
					},
				},
			};
			const parsed = parseChartPivotFormats(chart, localName)!;
			parsed.formats[0].shapeProperties = { fillColor: '#0000FF' };
			applyChartPivotFormats(chart, parsed, localName);

			const reparsed = parseChartPivotFormats(chart, localName)!;
			expect(reparsed.formats[0].shapeProperties).toStrictEqual({ fillColor: '#0000FF' });
			// The unmodeled effect list survives the edit untouched.
			const root = chart['c:pivotFmts'] as XmlObject;
			const item = (root['c:pivotFmt'] as XmlObject[])[0] ?? root['c:pivotFmt'];
			const spPr = item['c:spPr'] as XmlObject;
			expect(spPr['a:effectLst']).toStrictEqual({ 'a:outerShdw': { '@_blurRad': '40000' } });
		});

		it('creates a fresh txPr from a typed textStyle when none is authored', () => {
			const chart: XmlObject = {
				'c:pivotFmts': { 'c:pivotFmt': { 'c:idx': { '@_val': '2' } } },
			};
			const parsed = parseChartPivotFormats(chart, localName)!;
			expect(parsed.formats[0].textStyle).toBeUndefined();
			parsed.formats[0].textStyle = { fontSize: 18, italic: true, color: '#112233' };
			applyChartPivotFormats(chart, parsed, localName);

			const reparsed = parseChartPivotFormats(chart, localName)!;
			expect(reparsed.formats[0].textStyle).toStrictEqual({
				fontSize: 18,
				italic: true,
				color: '#112233',
			});
		});

		it('rebuilds marker from a typed edit even when markerXml is stale', () => {
			const chart: XmlObject = {
				'c:pivotFmts': {
					'c:pivotFmt': {
						'c:idx': { '@_val': '3' },
						'c:marker': { 'c:symbol': { '@_val': 'circle' } },
					},
				},
			};
			const parsed = parseChartPivotFormats(chart, localName)!;
			// Simulate an SDK caller that only touches the typed field, leaving
			// the stale `markerXml` from parse in place.
			parsed.formats[0].marker = { symbol: 'square', size: 6 };
			applyChartPivotFormats(chart, parsed, localName);

			const reparsed = parseChartPivotFormats(chart, localName)!;
			expect(reparsed.formats[0].marker).toStrictEqual({ symbol: 'square', size: 6 });
		});

		it('lets an explicit raw override win when the typed field is untouched', () => {
			const chart: XmlObject = {
				'c:pivotFmts': {
					'c:pivotFmt': {
						'c:idx': { '@_val': '4' },
						'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } } },
					},
				},
			};
			const parsed = parseChartPivotFormats(chart, localName)!;
			// shapeProperties is left exactly as parsed (not a typed edit); the
			// raw override is the explicit edit signal here.
			parsed.formats[0].shapePropertiesXml = {
				'a:solidFill': { 'a:schemeClr': { '@_val': 'accent2' } },
			};
			applyChartPivotFormats(chart, parsed, localName);

			const root = chart['c:pivotFmts'] as XmlObject;
			const item = (root['c:pivotFmt'] as XmlObject[])[0];
			expect(item['c:spPr']).toStrictEqual({
				'a:solidFill': { 'a:schemeClr': { '@_val': 'accent2' } },
			});
		});

		// W5-E: `a:schemeClr` (with its lumMod/lumOff/tint/shade transforms) now
		// resolves through a supplied colour resolver, the same theme +
		// `c:clrMapOvr` chain the rest of chart parsing uses (chart-color-choice.ts).
		describe('schemeClr resolution (W5-E)', () => {
			const schemeClrChart = (): XmlObject => ({
				'c:pivotFmts': {
					'c:pivotFmt': {
						'c:idx': { '@_val': '1' },
						'c:spPr': {
							'a:solidFill': {
								'a:schemeClr': { '@_val': 'accent2', 'a:lumMod': { '@_val': '75000' } },
							},
						},
					},
				},
			});

			it('resolves an a:schemeClr with lumMod to its themed hex when a colour resolver is supplied', () => {
				const chart = schemeClrChart();
				const expected = colorCodec.parseColor({
					'a:schemeClr': { '@_val': 'accent2', 'a:lumMod': { '@_val': '75000' } },
				});
				expect(expected).toBeDefined();

				const parsed = parseChartPivotFormats(chart, localName, colorParser)!;
				expect(parsed.formats[0].shapeProperties).toStrictEqual({ fillColor: expected });
			});

			it('leaves the typed colour unresolved without a colour resolver (raw XML fallback only)', () => {
				const chart = schemeClrChart();
				const parsed = parseChartPivotFormats(chart, localName)!;
				expect(parsed.formats[0].shapeProperties).toBeUndefined();
				expect(parsed.formats[0].shapePropertiesXml).toStrictEqual({
					'a:solidFill': {
						'a:schemeClr': { '@_val': 'accent2', 'a:lumMod': { '@_val': '75000' } },
					},
				});
			});

			it('round-trips an untouched schemeClr entry byte-identical', () => {
				const chart = schemeClrChart();
				const original = JSON.parse(
					JSON.stringify((chart['c:pivotFmts'] as XmlObject)['c:pivotFmt']),
				) as XmlObject;
				const parsed = parseChartPivotFormats(chart, localName, colorParser)!;
				applyChartPivotFormats(chart, parsed, localName, colorParser);

				const root = chart['c:pivotFmts'] as XmlObject;
				const item = (root['c:pivotFmt'] as XmlObject[])[0] ?? root['c:pivotFmt'];
				expect(item).toStrictEqual(original);
			});

			it('preserves the authored schemeClr fill when an unrelated field on the same spPr changes', () => {
				const chart: XmlObject = {
					'c:pivotFmts': {
						'c:pivotFmt': {
							'c:idx': { '@_val': '5' },
							'c:spPr': {
								'a:solidFill': { 'a:schemeClr': { '@_val': 'accent2' } },
								'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': '00FF00' } } },
							},
						},
					},
				};
				const parsed = parseChartPivotFormats(chart, localName, colorParser)!;
				// A genuine edit (stroke colour) forces `resolveSpPrOverride` to
				// re-derive `spPr`, but the fill itself is untouched and must keep
				// following the theme instead of collapsing to a literal srgbClr.
				parsed.formats[0].shapeProperties = {
					...parsed.formats[0].shapeProperties,
					strokeColor: '#0000FF',
				};
				applyChartPivotFormats(chart, parsed, localName, colorParser);

				const root = chart['c:pivotFmts'] as XmlObject;
				const item = (root['c:pivotFmt'] as XmlObject[])[0] ?? root['c:pivotFmt'];
				const spPr = item['c:spPr'] as XmlObject;
				expect(spPr['a:solidFill']).toStrictEqual({ 'a:schemeClr': { '@_val': 'accent2' } });
			});
		});
	});
});
