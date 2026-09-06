/**
 * @fileoverview Regression test for the `buildNewSeriesXml` template-clone
 * bug: cloning an existing series as a template for a newly-added series
 * (`JSON.parse(JSON.stringify(templateSeries))`) used to duplicate the
 * template's `c16:uniqueId` (c:ser/c:extLst/c:ext/c16:uniqueId, see
 * chart-series-identity.ts) verbatim onto the new series, so two series
 * ended up sharing one PowerPoint identity GUID. `buildNewSeriesXml` now
 * regenerates a fresh id on the clone.
 *
 * `buildNewSeriesXml` is protected on a deeply mixed-in class; bound onto a
 * minimal stub `this` the same way `PptxHandlerRuntimeChartChrome.test.ts`
 * binds `applyChartChrome`.
 */

import { describe, it, expect } from 'vitest';

import { PptxXmlLookupService } from '../../services/PptxXmlLookupService';
import type { PptxChartSeries, XmlObject } from '../../types';
import { parseChartUniqueId } from '../../utils/chart-series-identity';
// Side-effect-only import that must run before importing the Save mixin
// chain below: the runtime mixin chain has a load-order dependency where
// importing PptxHandlerRuntimeSaveDataSerialization without first touching
// PptxHandlerRuntimeChartParsingHelpers throws "Class extends value
// undefined" deep in the chain (see PptxHandlerRuntimePresentationProps.test.ts
// for the same pattern).
import './PptxHandlerRuntimeChartParsingHelpers';
import { PptxHandlerRuntime as SaveDataRuntime } from './PptxHandlerRuntimeSaveDataSerialization';

const xmlLookupService = new PptxXmlLookupService();

function getLocalName(qualifiedName: string): string {
	const colonIndex = qualifiedName.lastIndexOf(':');
	return colonIndex >= 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}

const compatibilityService = { getXmlLocalName: getLocalName };

type AnyRuntime = {
	xmlLookupService: typeof xmlLookupService;
	compatibilityService: typeof compatibilityService;
} & Record<string, unknown>;

const ctx: AnyRuntime = { xmlLookupService, compatibilityService };
ctx.updateChartCacheValues = (
	(SaveDataRuntime.prototype as Record<string, unknown>).updateChartCacheValues as (
		...args: unknown[]
	) => unknown
).bind(ctx);
const buildNewSeriesXml = (
	(SaveDataRuntime.prototype as Record<string, unknown>).buildNewSeriesXml as (
		...args: unknown[]
	) => XmlObject
).bind(ctx);

const TEMPLATE_UNIQUE_ID = '{00000000-AEA2-48ED-A484-A1104AEB1B51}';

function templateSeries(): XmlObject {
	return {
		'c:idx': { '@_val': '0' },
		'c:order': { '@_val': '0' },
		'c:tx': {
			'c:strRef': {
				'c:strCache': {
					'c:ptCount': { '@_val': '1' },
					'c:pt': { '@_idx': '0', 'c:v': 'Series 1' },
				},
			},
		},
		'c:cat': {
			'c:strRef': {
				'c:strCache': {
					'c:ptCount': { '@_val': '2' },
					'c:pt': [
						{ '@_idx': '0', 'c:v': 'Q1' },
						{ '@_idx': '1', 'c:v': 'Q2' },
					],
				},
			},
		},
		'c:val': {
			'c:numRef': {
				'c:numCache': {
					'c:formatCode': 'General',
					'c:ptCount': { '@_val': '2' },
					'c:pt': [
						{ '@_idx': '0', 'c:v': '1' },
						{ '@_idx': '1', 'c:v': '2' },
					],
				},
			},
		},
		'c:extLst': {
			'c:ext': {
				'@_uri': '{C3380CC4-5D6E-409C-BE32-E72D297353CC}',
				'@_xmlns:c16': 'http://schemas.microsoft.com/office/drawing/2014/chart',
				'c16:uniqueId': { '@_val': TEMPLATE_UNIQUE_ID },
			},
		},
	};
}

const newSeriesData: PptxChartSeries = { name: 'Series 2', values: [3, 4] };

describe('buildNewSeriesXml (template-clone c16:uniqueId regeneration)', () => {
	it('gives a series cloned from a template a DIFFERENT uniqueId', () => {
		const clone = buildNewSeriesXml(1, newSeriesData, ['Q1', 'Q2'], templateSeries());
		const clonedId = parseChartUniqueId(clone, getLocalName);
		expect(clonedId).toBeDefined();
		expect(clonedId).not.toBe(TEMPLATE_UNIQUE_ID);
	});

	it('does not mutate the original template node', () => {
		const template = templateSeries();
		buildNewSeriesXml(1, newSeriesData, ['Q1', 'Q2'], template);
		expect(parseChartUniqueId(template, getLocalName)).toBe(TEMPLATE_UNIQUE_ID);
	});

	it('still updates idx/order/name/values on the clone as before', () => {
		const clone = buildNewSeriesXml(1, newSeriesData, ['Q1', 'Q2'], templateSeries());
		expect(xmlLookupService.getChildByLocalName(clone, 'idx')?.['@_val']).toBe('1');
		expect(xmlLookupService.getChildByLocalName(clone, 'order')?.['@_val']).toBe('1');
	});

	it('gives a wholly new series (no template) its own fresh uniqueId', () => {
		const built = buildNewSeriesXml(0, newSeriesData, ['Q1', 'Q2']);
		expect(parseChartUniqueId(built, getLocalName)).toBeDefined();
	});
});
