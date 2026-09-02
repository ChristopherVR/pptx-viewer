import { describe, expect, it } from 'vitest';

import { parseStructuredCustomGeometry } from '../../geometry/custom-geometry-parser';
import type { XmlObject } from '../../types';
import { PptxRuntimeDependencyFactory } from '../factories/PptxRuntimeDependencyFactory';
import { mergeXmlObjects } from './merge-xml-objects';

const ensureArray = (value: unknown): unknown[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

function customGeometryFrom(parsed: XmlObject): XmlObject {
	return ((parsed['p:sp'] as XmlObject)['p:spPr'] as XmlObject)['a:custGeom'] as XmlObject;
}

describe('mergeXmlObjects', () => {
	it('preserves interleaved custom-geometry command order when a placeholder merge clones a path node', () => {
		const xml =
			'<p:sp xmlns:p="urn:p" xmlns:a="urn:a"><p:spPr><a:custGeom>' +
			'<a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>' +
			'<a:pathLst><a:path w="100" h="100">' +
			'<a:moveTo><a:pt x="0" y="20"/></a:moveTo>' +
			'<a:lnTo><a:pt x="40" y="0"/></a:lnTo>' +
			'<a:cubicBezTo><a:pt x="80" y="0"/><a:pt x="100" y="20"/><a:pt x="100" y="50"/></a:cubicBezTo>' +
			'<a:lnTo><a:pt x="40" y="100"/></a:lnTo><a:close/>' +
			'</a:path></a:pathLst></a:custGeom></p:spPr></p:sp>';
		const factory = new PptxRuntimeDependencyFactory();
		const parsed = factory.createParser().parse(xml) as XmlObject;
		const geometry = customGeometryFrom(parsed);

		// An override that also carries `a:pathLst/a:path` (e.g. a slide
		// placeholder overriding an inherited master/layout custom shape)
		// forces mergeXmlObjects to recurse into the path node and produce a
		// brand-new merged object.
		const mergedGeometry = mergeXmlObjects(geometry, {
			'a:pathLst': { 'a:path': { '@_fill': 'none' } },
		}) as XmlObject;

		const paths = parseStructuredCustomGeometry(mergedGeometry, 100, 100, ensureArray);
		expect(paths[0].segments.map((segment) => segment.type)).toStrictEqual([
			'moveTo',
			'lineTo',
			'cubicBezTo',
			'lineTo',
			'close',
		]);
	});
});
