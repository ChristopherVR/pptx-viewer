/**
 * @fileoverview Tests for `extractChartStyle`'s legend-position resolution.
 *
 * `extractChartStyle` is protected on a deeply mixed-in class, so it is
 * exercised via a `this`-shaped stub carrying just `xmlLookupService`/
 * `compatibilityService`/`parseColor`, and hand-crafted XML object trees
 * mirroring what `fast-xml-parser` produces (see
 * `PptxHandlerRuntimeChartChrome.test.ts` for the same pattern).
 *
 * Importing `PptxHandlerRuntimePresentationProps` directly (rather than a
 * file further along the mixin chain) trips a circular-import ordering
 * problem in this module graph ("Class extends value undefined").
 * `extractChartStyle` is still reachable, inherited, off
 * `PptxHandlerRuntimeSaveDataSerialization` (PresentationProps ->
 * SaveSlideUtils -> ... -> SaveDataSerialization), which loads safely; using
 * `Object.create` on its prototype (rather than a bare object stub) also
 * picks up the private helpers `extractChartStyle` calls internally
 * (`parseChartContainerFill`) for free.
 */

import { describe, it, expect } from 'vitest';

import { PptxXmlLookupService } from '../../services/PptxXmlLookupService';
import type { PptxChartStyle, XmlObject } from '../../types';
// Importing ChartParsingHelpers (lower in the mixin chain) first primes module
// evaluation order so the SaveDataSerialization import below doesn't trip the
// circular-import ordering hazard (see PptxHandlerRuntimeChartChrome.test.ts,
// which loads both for the same reason).
import './PptxHandlerRuntimeChartParsingHelpers';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeSaveDataSerialization';

const xmlLookupService = new PptxXmlLookupService();

function getLocalName(qualifiedName: string): string {
	const colonIndex = qualifiedName.lastIndexOf(':');
	return colonIndex >= 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}

const compatibilityService = { getXmlLocalName: getLocalName };

interface ExtractChartStyleHost {
	extractChartStyle(
		chartSpace: XmlObject | undefined,
		chartRoot: XmlObject | undefined,
	): PptxChartStyle | undefined;
}

function extractChartStyle(
	chartSpace: XmlObject | undefined,
	chartRoot: XmlObject | undefined,
): PptxChartStyle | undefined {
	const instance = Object.create(PptxHandlerRuntime.prototype) as ExtractChartStyleHost &
		Record<string, unknown>;
	instance.xmlLookupService = xmlLookupService;
	instance.compatibilityService = compatibilityService;
	instance.parseColor = () => undefined;
	return instance.extractChartStyle(chartSpace, chartRoot);
}

describe('extractChartStyle legend position (C2-G5)', () => {
	it('reads classic c:legend/c:legendPos/@val (child-element form)', () => {
		const chartRoot: XmlObject = {
			'c:legend': {
				'c:legendPos': { '@_val': 'r' },
			},
		};
		const style = extractChartStyle(undefined, chartRoot);
		expect(style?.legendPosition).toBe('r');
	});

	it('falls back to cx:legend/@pos (attribute form) when no child c:legendPos exists', () => {
		// ChartEx (cx:) charts carry the position directly on the element
		// instead of nesting a legendPos child, per CT_Legend (chartex schema).
		const chartRoot: XmlObject = {
			'cx:legend': { '@_pos': 't' },
		};
		const style = extractChartStyle(undefined, chartRoot);
		expect(style?.legendPosition).toBe('t');
	});

	it('prefers the child element over the attribute when both are somehow present', () => {
		const chartRoot: XmlObject = {
			'c:legend': {
				'@_pos': 'l',
				'c:legendPos': { '@_val': 'r' },
			},
		};
		const style = extractChartStyle(undefined, chartRoot);
		expect(style?.legendPosition).toBe('r');
	});
});

// Regression: a chart authoring an 18pt legend/chart-level default text style
// (`c:legend/c:txPr` or `c:chartSpace/c:txPr`) rendered its legend at a fixed
// 9px default, because only PER-ENTRY `c:legendEntry/c:txPr` overrides were
// ever read. See `chart-legend-entries.ts`'s `applyLegendEntryOverrides`.
describe('extractChartStyle legend text style (chart-level c:txPr default)', () => {
	function defRPrTxPr(sz: number): XmlObject {
		return {
			'a:p': { 'a:pPr': { 'a:defRPr': { '@_sz': String(sz) } } },
		};
	}

	it("reads the legend's own c:txPr as the legend text default", () => {
		const chartRoot: XmlObject = {
			'c:legend': {
				'c:legendPos': { '@_val': 'b' },
				'c:txPr': defRPrTxPr(1800),
			},
		};
		const style = extractChartStyle(undefined, chartRoot);
		expect(style?.legendTextStyle?.fontSize).toBe(18);
	});

	it('falls back to c:chartSpace/c:txPr when the legend has none of its own', () => {
		const chartSpace: XmlObject = { 'c:txPr': defRPrTxPr(1800) };
		const chartRoot: XmlObject = { 'c:legend': { 'c:legendPos': { '@_val': 'b' } } };
		const style = extractChartStyle(chartSpace, chartRoot);
		expect(style?.legendTextStyle?.fontSize).toBe(18);
	});

	it("prefers the legend's own c:txPr over the chart-space default", () => {
		const chartSpace: XmlObject = { 'c:txPr': defRPrTxPr(1800) };
		const chartRoot: XmlObject = {
			'c:legend': { 'c:legendPos': { '@_val': 'b' }, 'c:txPr': defRPrTxPr(1000) },
		};
		const style = extractChartStyle(chartSpace, chartRoot);
		expect(style?.legendTextStyle?.fontSize).toBe(10);
	});

	it('leaves legendTextStyle undefined when neither the legend nor the chart space has a txPr', () => {
		const chartRoot: XmlObject = { 'c:legend': { 'c:legendPos': { '@_val': 'b' } } };
		const style = extractChartStyle(undefined, chartRoot);
		expect(style?.legendTextStyle).toBeUndefined();
	});
});
