/**
 * @fileoverview Tests for chart chrome / view3D / ofPie option round-trip.
 *
 * The parsing helpers on `PptxHandlerRuntimeChartParsingHelpers` and the
 * save-side helpers on `PptxHandlerRuntimeSaveDataSerialization` are
 * protected on deeply mixed-in classes, so we exercise them by binding a
 * real `PptxXmlLookupService` and a minimal compatibility-service stub.
 *
 * The tests stay free of full PPTX I/O: they hand-craft XML object trees
 * (mirroring what `fast-xml-parser` produces) and verify the parse →
 * mutate → re-emit path for ofPie options, view3D, and chrome flags.
 */

import { describe, it, expect } from 'vitest';

import { PptxXmlLookupService } from '../../services/PptxXmlLookupService';
import type {
	PptxChartChrome,
	PptxChartOfPieOptions,
	PptxChartView3D,
	XmlObject,
} from '../../types';
import { PptxHandlerRuntime as ParsingHelpersRuntime } from './PptxHandlerRuntimeChartParsingHelpers';
import { PptxHandlerRuntime as SaveDataRuntime } from './PptxHandlerRuntimeSaveDataSerialization';

// ---------------------------------------------------------------------------
// Bind protected parse/save helpers as standalone functions for testing.
//
// `PptxHandlerRuntimeChartParsingHelpers` and the save data serialization
// methods are protected on a deeply mixed-in class, so we synthesize a
// `this`-shaped object carrying just `xmlLookupService` and
// `compatibilityService` and bind the prototype methods onto it.
// ---------------------------------------------------------------------------
const xmlLookupService = new PptxXmlLookupService();

function getLocalName(qualifiedName: string): string {
	const colonIndex = qualifiedName.lastIndexOf(':');
	return colonIndex >= 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}

const compatibilityService = { getXmlLocalName: getLocalName };

type AnyHelpers = {
	xmlLookupService: typeof xmlLookupService;
	compatibilityService: typeof compatibilityService;
} & Record<string, unknown>;

function bind<T>(prototype: object, ctx: AnyHelpers, name: string): T {
	const fn = (prototype as Record<string, unknown>)[name] as (...args: unknown[]) => unknown;
	return fn.bind(ctx) as T;
}

// Parse-side helpers
const parseHelpersCtx: AnyHelpers = { xmlLookupService, compatibilityService };
const parseOfPieOptions = bind<(node: XmlObject | undefined) => PptxChartOfPieOptions | undefined>(
	ParsingHelpersRuntime.prototype,
	parseHelpersCtx,
	'parseOfPieOptions',
);
const parseView3D = bind<(node: XmlObject | undefined) => PptxChartView3D | undefined>(
	ParsingHelpersRuntime.prototype,
	parseHelpersCtx,
	'parseView3D',
);
const parseChartChrome = bind<(node: XmlObject | undefined) => PptxChartChrome | undefined>(
	ParsingHelpersRuntime.prototype,
	parseHelpersCtx,
	'parseChartChrome',
);
const parseUserShapesXml = bind<(node: XmlObject | undefined) => unknown>(
	ParsingHelpersRuntime.prototype,
	parseHelpersCtx,
	'parseUserShapesXml',
);
const parsePivotFmtsXml = bind<(node: XmlObject | undefined) => unknown>(
	ParsingHelpersRuntime.prototype,
	parseHelpersCtx,
	'parsePivotFmtsXml',
);
const parseClrMapOvr = bind<(node: XmlObject | undefined) => Record<string, string> | undefined>(
	ParsingHelpersRuntime.prototype,
	parseHelpersCtx,
	'parseClrMapOvr',
);

// Save-side helpers — also bind the private `upsertValChild` helper that
// `applyOfPieOptions` / `applyChartChrome` reach for via `this`.
const saveCtx: AnyHelpers = { xmlLookupService, compatibilityService };
saveCtx.upsertValChild = (
	(SaveDataRuntime.prototype as Record<string, unknown>).upsertValChild as (
		...args: unknown[]
	) => unknown
).bind(saveCtx);
const applyOfPieOptions = bind<(c: XmlObject, o: PptxChartOfPieOptions) => void>(
	SaveDataRuntime.prototype,
	saveCtx,
	'applyOfPieOptions',
);
const applyView3D = bind<(c: XmlObject, v: PptxChartView3D) => void>(
	SaveDataRuntime.prototype,
	saveCtx,
	'applyView3D',
);
const applyChartChrome = bind<(c: XmlObject, chrome: PptxChartChrome) => void>(
	SaveDataRuntime.prototype,
	saveCtx,
	'applyChartChrome',
);

// ---------------------------------------------------------------------------
// ofPieChart options
// ---------------------------------------------------------------------------
describe('parseOfPieOptions', () => {
	it('returns undefined for missing container', () => {
		expect(parseOfPieOptions(undefined)).toBeUndefined();
	});

	it('defaults ofPieType to "pie" when ofPieType@val is absent', () => {
		const ofPie: XmlObject = { 'c:ofPieType': {} };
		expect(parseOfPieOptions(ofPie)).toStrictEqual({ ofPieType: 'pie' });
	});

	it('parses ofPieType="bar"', () => {
		const ofPie: XmlObject = { 'c:ofPieType': { '@_val': 'bar' } };
		expect(parseOfPieOptions(ofPie)).toStrictEqual({ ofPieType: 'bar' });
	});

	it('parses splitType, splitPos, secondPieSize, gapWidth, and serLines', () => {
		const ofPie: XmlObject = {
			'c:ofPieType': { '@_val': 'pie' },
			'c:gapWidth': { '@_val': '100' },
			'c:splitType': { '@_val': 'percent' },
			'c:splitPos': { '@_val': '10' },
			'c:secondPieSize': { '@_val': '75' },
			'c:serLines': {},
		};
		expect(parseOfPieOptions(ofPie)).toStrictEqual({
			ofPieType: 'pie',
			splitType: 'percent',
			splitPos: 10,
			secondPieSize: 75,
			gapWidth: 100,
			serLines: true,
		});
	});

	it('parses custSplit secondary indices', () => {
		const ofPie: XmlObject = {
			'c:ofPieType': { '@_val': 'pie' },
			'c:splitType': { '@_val': 'cust' },
			'c:custSplit': {
				'c:secondPiePt': [{ '@_val': '3' }, { '@_val': '5' }],
			},
		};
		const out = parseOfPieOptions(ofPie);
		expect(out?.custSplit).toStrictEqual([3, 5]);
		expect(out?.splitType).toBe('cust');
	});

	it('rejects unknown splitType values', () => {
		const ofPie: XmlObject = {
			'c:ofPieType': { '@_val': 'pie' },
			'c:splitType': { '@_val': 'banana' },
		};
		expect(parseOfPieOptions(ofPie)?.splitType).toBeUndefined();
	});
});

describe('applyOfPieOptions', () => {
	it('rewrites existing children and inserts new ones', () => {
		const container: XmlObject = {
			'c:ofPieType': { '@_val': 'pie' },
			'c:gapWidth': { '@_val': '50' },
		};
		applyOfPieOptions(container, {
			ofPieType: 'bar',
			splitType: 'val',
			splitPos: 25,
			secondPieSize: 80,
			gapWidth: 100,
			serLines: true,
			custSplit: [1, 4],
		});
		expect(container['c:ofPieType']).toStrictEqual({ '@_val': 'bar' });
		expect(container['c:splitType']).toStrictEqual({ '@_val': 'val' });
		expect(container['c:splitPos']).toStrictEqual({ '@_val': '25' });
		expect(container['c:secondPieSize']).toStrictEqual({ '@_val': '80' });
		expect(container['c:gapWidth']).toStrictEqual({ '@_val': '100' });
		expect(container['c:serLines']).toStrictEqual({});
		expect(container['c:custSplit']).toStrictEqual({
			'c:secondPiePt': [{ '@_val': '1' }, { '@_val': '4' }],
		});
	});

	it('round-trips ofPie options through parse → apply → re-parse', () => {
		const container: XmlObject = { 'c:ofPieType': {} };
		const original: PptxChartOfPieOptions = {
			ofPieType: 'bar',
			splitType: 'percent',
			splitPos: 12.5,
			secondPieSize: 90,
			gapWidth: 150,
			serLines: true,
		};
		applyOfPieOptions(container, original);
		const reparsed = parseOfPieOptions(container);
		expect(reparsed).toStrictEqual(original);
	});
});

// ---------------------------------------------------------------------------
// view3D
// ---------------------------------------------------------------------------
describe('parseView3D', () => {
	it('returns undefined when the chart root is missing', () => {
		expect(parseView3D(undefined)).toBeUndefined();
	});

	it('returns undefined when c:view3D is absent', () => {
		expect(parseView3D({})).toBeUndefined();
	});

	it('parses every documented child field', () => {
		const chartRoot: XmlObject = {
			'c:view3D': {
				'c:rotX': { '@_val': '15' },
				'c:hPercent': { '@_val': '120' },
				'c:rotY': { '@_val': '30' },
				'c:depthPercent': { '@_val': '100' },
				'c:rAngAx': { '@_val': '1' },
				'c:perspective': { '@_val': '20' },
			},
		};
		expect(parseView3D(chartRoot)).toStrictEqual({
			rotX: 15,
			hPercent: 120,
			rotY: 30,
			depthPercent: 100,
			rAngAx: true,
			perspective: 20,
		});
	});

	it('returns undefined when c:view3D is empty (no children)', () => {
		expect(parseView3D({ 'c:view3D': {} })).toBeUndefined();
	});
});

describe('applyView3D', () => {
	it('inserts c:view3D when absent', () => {
		const chartRoot: XmlObject = {};
		applyView3D(chartRoot, { rotX: 30, perspective: 30 });
		expect(chartRoot['c:view3D']).toStrictEqual({
			'c:rotX': { '@_val': '30' },
			'c:perspective': { '@_val': '30' },
		});
	});

	it('replaces an existing c:view3D rather than mutating it in place', () => {
		const chartRoot: XmlObject = {
			'c:view3D': { 'c:rotX': { '@_val': '0' } },
		};
		applyView3D(chartRoot, { rotY: 90 });
		expect(chartRoot['c:view3D']).toStrictEqual({ 'c:rotY': { '@_val': '90' } });
	});

	it('round-trips view3D through parse → apply → re-parse', () => {
		const chartRoot: XmlObject = {};
		const original: PptxChartView3D = {
			rotX: 10,
			rotY: 20,
			depthPercent: 100,
			perspective: 30,
			hPercent: 75,
			rAngAx: false,
		};
		applyView3D(chartRoot, original);
		expect(parseView3D(chartRoot)).toStrictEqual(original);
	});

	it('does not emit an empty c:view3D when given an empty object', () => {
		const chartRoot: XmlObject = {};
		applyView3D(chartRoot, {});
		expect(chartRoot['c:view3D']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Chart chrome flags
// ---------------------------------------------------------------------------
describe('parseChartChrome', () => {
	it('returns undefined when no chrome flags are present', () => {
		expect(parseChartChrome({})).toBeUndefined();
	});

	it('parses autoTitleDeleted with explicit val="1"', () => {
		expect(parseChartChrome({ 'c:autoTitleDeleted': { '@_val': '1' } })).toStrictEqual({
			autoTitleDeleted: true,
		});
	});

	it('treats element without @val as default true (CT_Boolean spec)', () => {
		expect(parseChartChrome({ 'c:autoTitleDeleted': {} })).toStrictEqual({
			autoTitleDeleted: true,
		});
	});

	it('parses autoTitleDeleted="0" as false', () => {
		expect(parseChartChrome({ 'c:autoTitleDeleted': { '@_val': '0' } })).toStrictEqual({
			autoTitleDeleted: false,
		});
	});

	it('parses dispBlanksAs="span"', () => {
		expect(parseChartChrome({ 'c:dispBlanksAs': { '@_val': 'span' } })).toStrictEqual({
			dispBlanksAs: 'span',
		});
	});

	it('rejects unknown dispBlanksAs values', () => {
		expect(parseChartChrome({ 'c:dispBlanksAs': { '@_val': 'noodle' } })).toBeUndefined();
	});

	it('parses showDLblsOverMax', () => {
		expect(parseChartChrome({ 'c:showDLblsOverMax': { '@_val': '1' } })).toStrictEqual({
			showDLblsOverMax: true,
		});
	});
});

describe('applyChartChrome', () => {
	it('writes only the supplied flags, leaving siblings untouched', () => {
		const chartRoot: XmlObject = { 'c:plotArea': {} };
		applyChartChrome(chartRoot, { dispBlanksAs: 'gap' });
		expect(chartRoot['c:plotArea']).toStrictEqual({});
		expect(chartRoot['c:dispBlanksAs']).toStrictEqual({ '@_val': 'gap' });
		expect(chartRoot['c:autoTitleDeleted']).toBeUndefined();
		expect(chartRoot['c:showDLblsOverMax']).toBeUndefined();
	});

	it('does not emit empty placeholders when chrome is empty', () => {
		const chartRoot: XmlObject = {};
		applyChartChrome(chartRoot, {});
		expect(Object.keys(chartRoot)).toStrictEqual([]);
	});

	it('round-trips every flag through parse → apply → re-parse', () => {
		const chartRoot: XmlObject = {};
		const original: PptxChartChrome = {
			autoTitleDeleted: true,
			dispBlanksAs: 'zero',
			showDLblsOverMax: false,
		};
		applyChartChrome(chartRoot, original);
		expect(parseChartChrome(chartRoot)).toStrictEqual(original);
	});
});

// ---------------------------------------------------------------------------
// Raw preservation: userShapes, pivotFmts, clrMapOvr
// ---------------------------------------------------------------------------
describe('parseUserShapesXml / parsePivotFmtsXml', () => {
	it('returns the c:userShapes node verbatim when present', () => {
		const node = { '@_r:id': 'rId7' };
		expect(parseUserShapesXml({ 'c:userShapes': node })).toBe(node);
	});

	it('returns undefined when c:userShapes is absent', () => {
		expect(parseUserShapesXml({})).toBeUndefined();
	});

	it('returns the c:pivotFmts node verbatim when present', () => {
		const node = { 'c:pivotFmt': [{ 'c:idx': { '@_val': '0' } }] };
		expect(parsePivotFmtsXml({ 'c:pivotFmts': node })).toBe(node);
	});
});

describe('parseClrMapOvr', () => {
	it('returns undefined when the element is absent', () => {
		expect(parseClrMapOvr({})).toBeUndefined();
	});

	it('flattens all 12 attribute slots into a string map', () => {
		const chartSpace: XmlObject = {
			'c:clrMapOvr': {
				'@_bg1': 'lt1',
				'@_tx1': 'dk1',
				'@_bg2': 'lt2',
				'@_tx2': 'dk2',
				'@_accent1': 'accent1',
				'@_accent2': 'accent2',
				'@_accent3': 'accent3',
				'@_accent4': 'accent4',
				'@_accent5': 'accent5',
				'@_accent6': 'accent6',
				'@_hlink': 'hlink',
				'@_folHlink': 'folHlink',
			},
		};
		expect(parseClrMapOvr(chartSpace)).toStrictEqual({
			bg1: 'lt1',
			tx1: 'dk1',
			bg2: 'lt2',
			tx2: 'dk2',
			accent1: 'accent1',
			accent2: 'accent2',
			accent3: 'accent3',
			accent4: 'accent4',
			accent5: 'accent5',
			accent6: 'accent6',
			hlink: 'hlink',
			folHlink: 'folHlink',
		});
	});

	it('returns undefined for an empty element with no attributes', () => {
		expect(parseClrMapOvr({ 'c:clrMapOvr': {} })).toBeUndefined();
	});
});
