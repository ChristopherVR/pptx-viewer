/**
 * The save writers that used `(node['x'] ??= {}) as XmlObject`.
 *
 * `??=` assigns only when the left side is `undefined` or `null`. An element a
 * real deck spells `<p:spPr/>` arrives from fast-xml-parser as the empty
 * STRING, which is neither, so the string survived the `??=` and the very next
 * property assignment threw
 * `TypeError: Cannot create property '@_x' on string ''` - a crash on save, not
 * a silent loss. `ensureXmlChildOrCreate` heals the present-but-empty case and
 * still creates the element when it is genuinely absent, so the writers keep
 * the behaviour they had for every other input.
 *
 * The methods are protected and depend on the whole mixin chain, so they are
 * reached the way `PptxHandlerRuntimeElementActions.test` reaches its own: by
 * instantiating the concrete runtime and casting to a structural view.
 */
import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { Model3DPptxElement, XmlObject, ZoomPptxElement } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

interface RuntimeWithProtected {
	applyZoomTransform(shapeProperties: XmlObject, el: ZoomPptxElement): void;
	applyZoomBlipRelationship(zoomProperties: XmlObject, relationshipId: string | undefined): void;
	updateZoomFallback(shape: XmlObject, el: ZoomPptxElement, relationshipId: string): void;
	alternateContentBlockByRawXml: Map<XmlObject, { rawAc: XmlObject }>;
}

const runtime = new PptxHandlerRuntime() as unknown as RuntimeWithProtected;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
});

function parse(xml: string): XmlObject {
	return (parser.parse(xml) as Record<string, XmlObject>)['root'];
}

const zoomElement = {
	id: 'z1',
	type: 'zoom',
	zoomType: 'slide',
	x: 10,
	y: 20,
	width: 100,
	height: 50,
} as unknown as ZoomPptxElement;

describe('the parser shape the writers have to survive', () => {
	it('renders a bare <p:spPr/> as the empty string', () => {
		expect(parse('<root><p:spPr/></root>')['p:spPr']).toBe('');
	});
});

describe('applyZoomTransform', () => {
	it('writes the transform into a bare <a:xfrm/> instead of throwing', () => {
		const spPr = parse('<root><a:xfrm/><a:prstGeom prst="rect"/></root>');
		expect(spPr['a:xfrm']).toBe('');
		expect(() => runtime.applyZoomTransform(spPr, zoomElement)).not.toThrow();
		const xfrm = spPr['a:xfrm'] as XmlObject;
		expect((xfrm['a:off'] as XmlObject)['@_x']).toBe('95250');
		expect((xfrm['a:ext'] as XmlObject)['@_cx']).toBe('952500');
	});

	it('still creates a:xfrm when the shape properties declare none', () => {
		const spPr: XmlObject = {};
		runtime.applyZoomTransform(spPr, zoomElement);
		expect(spPr['a:xfrm']).toBeDefined();
	});

	it('rewrites an existing a:xfrm in place, keeping its identity', () => {
		const spPr = parse('<root><a:xfrm><a:off x="1" y="2"/></a:xfrm></root>');
		const existing = spPr['a:xfrm'];
		runtime.applyZoomTransform(spPr, zoomElement);
		expect(spPr['a:xfrm']).toBe(existing);
		expect((existing as XmlObject)['a:off']).toStrictEqual({ '@_x': '95250', '@_y': '190500' });
	});
});

describe('applyZoomBlipRelationship', () => {
	it('reaches a:blip through a bare <p166:blipFill/>', () => {
		const zoomProperties = parse('<root><p166:blipFill/></root>');
		expect(() => runtime.applyZoomBlipRelationship(zoomProperties, 'rId7')).not.toThrow();
		const fill = zoomProperties['p166:blipFill'] as XmlObject;
		expect((fill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId7');
	});

	it('reaches a bare <a:blip/> inside a populated blip fill', () => {
		const zoomProperties = parse('<root><p166:blipFill><a:blip/></p166:blipFill></root>');
		runtime.applyZoomBlipRelationship(zoomProperties, 'rId8');
		const fill = zoomProperties['p166:blipFill'] as XmlObject;
		expect((fill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId8');
	});
});

describe('updateZoomFallback', () => {
	it('re-transforms a fallback picture whose <p:spPr/> is bare', () => {
		const shape: XmlObject = {};
		const rawAc = parse(
			'<root><mc:Fallback><p:pic><p:spPr/><p:blipFill/></p:pic></mc:Fallback></root>',
		);
		runtime.alternateContentBlockByRawXml.set(shape, { rawAc });
		expect(() => runtime.updateZoomFallback(shape, zoomElement, 'rId9')).not.toThrow();
		const fallback = rawAc['mc:Fallback'] as XmlObject;
		const picture = fallback['p:pic'] as XmlObject;
		const spPr = picture['p:spPr'] as XmlObject;
		expect((spPr['a:xfrm'] as XmlObject)['a:ext']).toStrictEqual({
			'@_cx': '952500',
			'@_cy': '476250',
		});
		const blipFill = picture['p:blipFill'] as XmlObject;
		expect((blipFill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId9');
		runtime.alternateContentBlockByRawXml.delete(shape);
	});
});

describe('model3D save path', () => {
	interface Model3DRuntime {
		updateModel3DFallback(
			shape: XmlObject,
			el: Model3DPptxElement,
			posterRelationshipId: string,
		): void;
	}
	const model3d = runtime as unknown as Model3DRuntime;
	const element = {
		id: 'm1',
		type: 'model3D',
		x: 5,
		y: 5,
		width: 20,
		height: 20,
	} as unknown as Model3DPptxElement;

	it('re-transforms a bare fallback <p:spPr/> and reaches a bare <a:blip/>', () => {
		const shape: XmlObject = {};
		const rawAc = parse(
			'<root><mc:Fallback><p:pic><p:spPr/><p:blipFill><a:blip/></p:blipFill></p:pic></mc:Fallback></root>',
		);
		runtime.alternateContentBlockByRawXml.set(shape, { rawAc });
		expect(() => model3d.updateModel3DFallback(shape, element, 'rId3')).not.toThrow();
		const picture = (rawAc['mc:Fallback'] as XmlObject)['p:pic'] as XmlObject;
		const spPr = picture['p:spPr'] as XmlObject;
		expect((spPr['a:xfrm'] as XmlObject)['a:off']).toStrictEqual({
			'@_x': '47625',
			'@_y': '47625',
		});
		const blipFill = picture['p:blipFill'] as XmlObject;
		expect((blipFill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId3');
		runtime.alternateContentBlockByRawXml.delete(shape);
	});
});
