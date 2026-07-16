import { describe, expect, it } from 'vitest';

import { PptxRuntimeDependencyFactory } from '../core/factories/PptxRuntimeDependencyFactory';
import type { XmlObject } from '../types';
import { customGeometryPathsToXml } from './custom-geometry';
import { parseStructuredCustomGeometry } from './custom-geometry-parser';

const ensureArray = (value: unknown): unknown[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

function customGeometryFrom(parsed: XmlObject): XmlObject {
	return ((parsed['p:sp'] as XmlObject)['p:spPr'] as XmlObject)['a:custGeom'] as XmlObject;
}

describe('custom geometry command order', () => {
	it('preserves interleaved commands through parse, model, serialize, and reload', () => {
		const xml =
			'<p:sp xmlns:p="urn:p" xmlns:a="urn:a"><p:spPr><a:custGeom>' +
			'<a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>' +
			'<a:pathLst><a:path w="100" h="100">' +
			'<a:moveTo><a:pt x="0" y="0"/></a:moveTo>' +
			'<a:lnTo><a:pt x="100" y="0"/></a:lnTo>' +
			'<a:arcTo wR="50" hR="50" stAng="0" swAng="5400000"/>' +
			'<a:lnTo><a:pt x="0" y="100"/></a:lnTo><a:close/>' +
			'</a:path></a:pathLst></a:custGeom></p:spPr></p:sp>';
		const factory = new PptxRuntimeDependencyFactory();
		const parser = factory.createParser();
		const parsed = parser.parse(xml) as XmlObject;
		const paths = parseStructuredCustomGeometry(customGeometryFrom(parsed), 100, 100, ensureArray);

		expect(paths[0].segments.map((segment) => segment.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'arcTo',
			'lineTo',
			'close',
		]);

		const serialized = factory.createBuilder().build({
			'p:sp': {
				'@_xmlns:p': 'urn:p',
				'@_xmlns:a': 'urn:a',
				'p:spPr': { 'a:custGeom': customGeometryPathsToXml(paths) },
			},
		});
		const serializedPath = /<a:path\b[^>]*>([\s\S]*?)<\/a:path>/u.exec(serialized)?.[1] ?? '';
		expect(
			[...serializedPath.matchAll(/<a:(moveTo|lnTo|arcTo|close)\b/gu)].map((match) => match[1]),
		).toStrictEqual(['moveTo', 'lnTo', 'arcTo', 'lnTo', 'close']);

		const reparsed = parser.parse(serialized) as XmlObject;
		const reparsedPaths = parseStructuredCustomGeometry(
			customGeometryFrom(reparsed),
			100,
			100,
			ensureArray,
		);
		expect(reparsedPaths[0].segments.map((segment) => segment.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'arcTo',
			'lineTo',
			'close',
		]);
	});
});
